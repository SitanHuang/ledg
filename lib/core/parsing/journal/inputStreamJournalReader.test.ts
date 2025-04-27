import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterAll, describe, expect, it } from 'vitest';
import { TransactionBuilder } from '../../accounting/transaction.ts';
import { isOk, Ok } from '../../types.ts';
import { InputStreamJournalReader, InputStreamSourceDescriptor } from './inputStreamJournalReader.ts';

async function readAll(reader: InputStreamJournalReader) {
  const txns: TransactionBuilder[] = [];
  reader.setOnData((t) => {
    txns.push(t);
    return Ok;
  });
  const promise = reader.promisify();
  reader.begin();
  const result = (await promise);
  if (!isOk(result)) {
    throw result;
  }
  return txns;
}


describe('InputStreamJournalReader (Empty transactions & events only)', () => {
  it('parses event-only transactions with pending flag, dual-date, CRLF, explicit UUID', async () => {
    const src = [
      '2024-01-01 event kickoff project',
      '2024-01-02 ! event   launch 🚀',                                 // pending + double-space
      '2024-01-03 12:34:56 event  sample #ABCDEFGH',                    // explicit UUID
      '2024-01-04T01:02:03=2024-02-03T23:59:59 event multi date something',
      '2024-01-04T01:02:03=2024-02-03T23:a9:59 event multi date something',
      '2024-01-04T01:02:03=2024-02-03T23:a9:59 event multi date something',
      '; pure comment',
      '    ',
      '',
      '; pure comment',
      '; pure comment',
      '2024-01-04=2024-02-03T23:a9:59 event multi date something', // 11
      '; pure comment',
      '',
      '; pure comment',
      '  ',
      '; pure comment',
      '2024-01-04=2024-02-03T23:a9:59 event multi date something', // 17
      '; pure comment',
      '  ; virt:true', // 19
      '; pure comment',
    ];

    const reader = new InputStreamJournalReader({
      filePath: 'memory://events-ledger',
      readStream: Readable.from([src.join("\r\n")]),
      sourceModifiable: false
    });

    const txns = await readAll(reader);
    expect(txns).toHaveLength(8);

    // txn #1 – basic event
    expect(txns[0].metadata.event).toBe('kickoff');
    expect(txns[0].description).toBe('project');
    expect(txns[0].metadata.pending).toBeUndefined();
    expect(txns[0].getIsModified()).toBe(true);
    expect(txns[0].getPostingBuilders().length).toBe(0);

    // txn #2 – pending + multiple-space handling
    expect(txns[1].metadata.pending).toBe(true);
    expect(txns[1].metadata.event).toBe('launch');
    expect(txns[1].description).toBe('🚀');
    expect(txns[1].getIsModified()).toBe(true);
    expect(txns[1].getPostingBuilders().length).toBe(0);

    // txn #3 – explicit UUID must be respected and stripped from description
    expect(txns[2].description).toBe('');
    expect(txns[2].metadata.event).toBe('sample');
    expect(txns[2].id).toBe("ABCDEFGH");
    expect(txns[2].getIsModified()).toBe(false);
    expect(txns[2].getPostingBuilders().length).toBe(0);

    // txn #4 – dual-date parsing must succeed exactly
    const EXPECT_PRIMARY = Date.parse('2024-01-04T01:02:03');
    const EXPECT_SECONDARY = Date.parse('2024-02-03T23:59:59');
    expect(txns[3].date).toBe(EXPECT_PRIMARY);
    expect(txns[3].date2).toBe(EXPECT_SECONDARY);
    expect(txns[3].metadata.event).toBe('multi');
    expect(txns[3].description).toBe('date something');
    expect(txns[3].getIsModified()).toBe(true);
    expect(txns[3].getPostingBuilders().length).toBe(0);

    expect(txns[4].date).toBe(EXPECT_PRIMARY);
    expect(txns[4].date2).toBe(Date.parse('2024-02-03'));
    expect(txns[5].date).toBe(EXPECT_PRIMARY);
    expect(txns[5].date2).toBe(Date.parse('2024-02-03'));
    expect(txns[6].date).toBe(Date.parse('2024-01-04'));
    expect(txns[6].date2).toBe(Date.parse('2024-02-03'));
    let source = (txns[6].source as InputStreamSourceDescriptor);
    expect(source.sourceText).toBe(src[11]);
    expect(source.lineStart).toBe(11);
    expect(source.lineEnd).toBe(11); // ignore all the stuff afterwards

    source = (txns[7].source as InputStreamSourceDescriptor);
    expect(source.sourceText.split(/\r?\n/)).toEqual([src[17], src[18], src[19]]);
    expect(source.lineStart).toBe(17);
    expect(source.lineEnd).toBe(19); // ignore all the stuff afterwards


    source = (txns[0].source as InputStreamSourceDescriptor);
    expect(source.sourceText).toBe(src[0]);
    expect(source.lineStart).toBe(0);
    expect(source.lineEnd).toBe(0);
  });
});

describe('InputStreamJournalReader (include only)', () => {
  it('walks nested #include tree in DFS order without losing parent lines', async () => {
    const dir = "~testout/InputStreamJournalReader.1/";
    mkdirSync(dir, { recursive: true });

    const files = {
      main: join(dir, 'main.ledg'),
      inc1: join(dir, 'inc1.ledg'),
      inc1a: join(dir, 'inc1a.ledg'),
      inc2: join(dir, 'inc2.ledg')
    };

    writeFileSync(files.inc1a, '2024-01-01 event inside inc1a\n');
    writeFileSync(files.inc1, `
include inc1a.ledg
2024-01-01 event inside inc1`);
    writeFileSync(files.inc2, '2024-01-05 event inc2 event\n');
    writeFileSync(files.main, `
include inc1.ledg
include inc2.ledg
2024-01-10 event main after include\n`);

    try {
      const reader = new InputStreamJournalReader({
        filePath: files.main,
        sourceModifiable: false
      });

      const txns = await readAll(reader);

      /* Transaction order must be strict DFS:
           - first nested inc1a,
           - then inc1,
           - then inc2,
           - finally the parent remainder.
      */
      const descs = txns.map(t => t.description);
      expect(descs).toEqual([
        'inc1a',
        'inc1',
        'event',
        'after include'
      ]);

      expect(txns.map(t => t.metadata.event)).toEqual([
        'inside',
        'inside',
        'inc2',
        'main'
      ]);
    } finally {
      // rmSync(dir, { recursive: true, force: true });
    }
  });

  it('includes the *same* file twice when requested and preserves DFS order', async () => {
    const dir = '~testout/InputStreamJournalReader.2/';
    mkdirSync(dir, { recursive: true });

    const files = {
      main: join(dir, 'main.ledg'),
      inc: join(dir, 'inc.ledg')
    };

    writeFileSync(files.inc, '2024-01-09 txn inc\n');
    writeFileSync(files.main, [
      'include inc.ledg',
      'include inc.ledg',
      '2024-01-10 txn main\n'
    ].join('\n'));

    const reader = new InputStreamJournalReader({ filePath: files.main, sourceModifiable: false });
    const txns = await readAll(reader);

    expect(txns.map(t => t.description)).toEqual([
      'txn inc',   // first include
      'txn inc',   // second include – should *not* be de-duplicated
      'txn main'
    ]);
  });

  it('throws if included file does not exist', async () => {
    const path = "~testout/InputStreamJournalReader.3/main.ledg";
    mkdirSync("~testout/InputStreamJournalReader.3", { recursive: true });
    writeFileSync(path, `include no-such-file.ledg\n`);
    await expect(async () => {
      const reader = new InputStreamJournalReader({ filePath: path, sourceModifiable: false });
      await readAll(reader);
    }).rejects.toThrow();
  });
});

describe('Posting parsing', () => {
  it('parses a basic posting with amount string', async () => {
    const src = [
      '2025-01-01 rent',
      '  Rent\tAssets:Cash\t100 USD',
    ];

    const reader = new InputStreamJournalReader({
      filePath: 'memory://posting-basic',
      readStream: Readable.from([src.join('\n')]),
      sourceModifiable: false,
    });

    const [txn] = await readAll(reader);
    const [p] = txn.getPostingBuilders();
    expect(p.getAccountIdentifier()).toBe('Assets:Cash');
    expect(p.getAmountString()).toBe('100 USD');
    expect(txn.description).toBe('rent');
  });

  it('marks a bracketed account as virtual', async () => {
    const src = [
      '2025-01-02 virtual test',
      '  ; virt: false',
      '  Allocation\t[Equity:OpeningBalances]\t500 USD',
    ];

    const [txn] = await readAll(new InputStreamJournalReader({
      filePath: 'memory://posting-virt',
      readStream: Readable.from([src.join('\n')]),
      sourceModifiable: false,
    }));

    const [p] = txn.getPostingBuilders();
    expect(p.getAccountIdentifier()).toBe('Equity:OpeningBalances');
    expect(p.metadata.virt).toBe(true);
    expect(txn.metadata.virt).toBe(false);
  });

  it('overrides primary date on a posting', async () => {
    const src = [
      '2025-02-01 override primary',
      '; asdf',
      '',
      '  TestPost\tAssets:Cash',
      '; fff',
      '  ; 2025-05-01 01:32:12',
      '; asdf',
      '',
      '; asdf',
      '2025-02-01 override primary',
      '  TestPost\tAssets:Cash',
      '  ; 2025-05-01',
    ];

    const [t1, t2] = await readAll(new InputStreamJournalReader({
      filePath: 'memory://posting-primary-date',
      readStream: Readable.from([src.join('\r\n')]),
      sourceModifiable: false,
    }));

    const [p1] = t1.getPostingBuilders();
    expect(p1.getDate()).toBe(Date.parse('2025-05-01 01:32:12'));
    const [p2] = t2.getPostingBuilders();
    expect(p2.getDate()).toBe(Date.parse('2025-05-01'));

    expect(p2.getDate2()).toBe(Date.parse('2025-02-01')); // retain txn date2

    expect(t2.getDate2()).toBe(t2.getDate());
    expect(t2.getDate2()).toBe(Date.parse('2025-02-01'));
  });

  it('overrides auxiliary date only', async () => {
    const src = [
      '2025-02-02 override aux',
      '  TestPost\tAssets:Cash',
      '  ; =2025-03-02',
      '2025-02-02 override aux',
      '  TestPost\tAssets:Cash',
      '  ; =2025-03-02 03:12:11',
    ];

    const [txn, t2] = await readAll(new InputStreamJournalReader({
      filePath: 'memory://posting-aux-date',
      readStream: Readable.from([src.join('\n')]),
      sourceModifiable: false,
    }));

    const [p] = txn.getPostingBuilders();
    expect(p.getDate2()).toBe(Date.parse('2025-03-02'));
    // primary date should remain that of the transaction
    expect(p.getDate()).toBe(Date.parse('2025-02-02'));

    expect(t2.getDate2()).toBe(t2.getDate());
    expect(t2.getDate2()).toBe(Date.parse('2025-02-02'));
    expect(t2.getPostingBuilders()[0].getDate2()).toBe(Date.parse('2025-03-02 03:12:11'));
  });

  it('overrides both primary and auxiliary dates', async () => {
    const src = [
      '2025-02-03 override both',
      '  TestPost\tAssets:Cash',
      '  ; 2025-04-01=2025-05-01 01:32:12',
    ];

    const [txn] = await readAll(new InputStreamJournalReader({
      filePath: 'memory://posting-both-dates',
      readStream: Readable.from([src.join('\n')]),
      sourceModifiable: false,
    }));

    const [p] = txn.getPostingBuilders();
    expect(p.getDate()).toBe(Date.parse('2025-04-01'));
    expect(p.getDate2()).toBe(Date.parse('2025-05-01 01:32:12'));
  });

  it('handles a transaction with multiple postings', async () => {
    const src = [
      '2025-03-01 multi',
      '  One\tAssets:Bank\t-50 USD',
      '  Two\tExpenses:Food\t50 USD',
    ];

    const [txn] = await readAll(new InputStreamJournalReader({
      filePath: 'memory://posting-multi',
      readStream: Readable.from([src.join('\n')]),
      sourceModifiable: false,
    }));

    expect(txn.getPostingBuilders()).toHaveLength(2);
  });

  it('accepts a posting without amount string', async () => {
    const src = [
      '2025-03-05 no-amount',
      '  Desc\tAssets:Cash',
    ];

    const [txn] = await readAll(new InputStreamJournalReader({
      filePath: 'memory://posting-no-amount',
      readStream: Readable.from([src.join('\n')]),
      sourceModifiable: false,
    }));

    const [p] = txn.getPostingBuilders();
    expect(p.getAmountString()).toBeUndefined();
  });

  it('trims posting description correctly', async () => {
    const src = [
      '2025-03-06 trim desc',
      '  Big description with spaces   \tAssets:Cash\t1 USD',
    ];

    const [txn] = await readAll(new InputStreamJournalReader({
      filePath: 'memory://posting-desc-trim',
      readStream: Readable.from([src.join('\n')]),
      sourceModifiable: false,
    }));

    const [p] = txn.getPostingBuilders();
    expect(p.description).toBe('Big description with spaces');
  });

  it('throws on invalid bracket syntax', async () => {
    const src = [
      '2025-04-01 bad bracket',
      '  Broken\t[Assets:Cash\t100 USD', // missing closing bracket
    ];

    await expect(async () => {
      await readAll(new InputStreamJournalReader({
        filePath: 'memory://posting-bad-bracket',
        readStream: Readable.from([src.join('\n')]),
        sourceModifiable: false,
      }));
    }).rejects.toThrow(/Invalid bracket syntax/);
  });

  it('throws on empty account identifier', async () => {
    const src = [
      '2025-04-02 empty account',
      '  Oops\t\t123 USD', // account field empty
    ];

    await expect(async () => {
      await readAll(new InputStreamJournalReader({
        filePath: 'memory://posting-empty-account',
        readStream: Readable.from([src.join('\n')]),
        sourceModifiable: false,
      }));
    }).rejects.toThrow(/Empty account identifier/);
  });
});

describe('Include handling (additional scenarios)', () => {
  const baseDir = '~testout/IncludeExtra/';
  mkdirSync(baseDir, { recursive: true });

  afterAll(() => {
    try { rmSync(baseDir, { recursive: true, force: true }); } catch (_) {}
  });

  it('handles three-level nested includes', async () => {
    const files = {
      a: join(baseDir, 'a.ledg'),
      b: join(baseDir, 'b.ledg'),
      c: join(baseDir, 'c.ledg'),
      d: join(baseDir, 'd.ledg'),
    };
    writeFileSync(files.d, '2025-05-01 D\n');
    writeFileSync(files.c, `include d.ledg\n2025-05-01 event type C\n`);
    writeFileSync(files.b, `include c.ledg\n2025-05-01 event type B\n`);
    writeFileSync(files.a, `include b.ledg\n2025-05-01 event type A\n`);

    const txns = await readAll(new InputStreamJournalReader({ filePath: files.a, sourceModifiable: false }));
    expect(txns.map(t => t.description)).toEqual(['D', 'C', 'B', 'A']);
  });

  it('keeps order when include appears between parent transactions', async () => {
    const dir = join(baseDir, 'between');
    mkdirSync(dir, { recursive: true });
    const files = {
      parent: join(dir, 'parent.ledg'),
      child: join(dir, 'child.ledg'),
    };
    writeFileSync(files.child, '2025-06-01 child\n');
    writeFileSync(files.parent, [
      '2025-06-01 before',
      'include child.ledg',
      '2025-06-02 after',
      '',
    ].join('\n'));

    const txns = await readAll(new InputStreamJournalReader({ filePath: files.parent, sourceModifiable: false }));
    expect(txns.map(t => t.description)).toEqual(['before', 'child', 'after']);
  });

  it('allows repeated include inside nested include', async () => {
    const dir = join(baseDir, 'nestedRepeat');
    mkdirSync(dir, { recursive: true });
    const files = {
      main: join(dir, 'main.ledg'),
      child: join(dir, 'child.ledg'),
    };
    writeFileSync(files.child, '2025-07-07 repeat\n');
    writeFileSync(files.main, [
      'include child.ledg',
      'include child.ledg',
      '',
    ].join('\n'));

    const txns = await readAll(new InputStreamJournalReader({ filePath: files.main, sourceModifiable: false }));
    expect(txns).toHaveLength(2);
    expect(txns[0].description).toBe('repeat');
    expect(txns[1].description).toBe('repeat');
  });

  it('resolves relative paths with "./" and "../"', async () => {
    const dir = join(baseDir, 'rel');
    mkdirSync(join(dir, 'sub'), { recursive: true });

    const files = {
      main: join(dir, 'main.ledg'),
      child: join(dir, 'sub', 'child.ledg'),
    };
    writeFileSync(files.child, '2025-08-01 relative\n');
    writeFileSync(files.main, 'include ./sub/child.ledg\n');

    const [txn] = await readAll(new InputStreamJournalReader({ filePath: files.main, sourceModifiable: false }));
    expect(txn.description).toBe('relative');
  });

  it('reads included file with CRLF endings', async () => {
    const dir = join(baseDir, 'crlf');
    mkdirSync(dir, { recursive: true });
    const files = {
      main: join(dir, 'main.ledg'),
      child: join(dir, 'child.ledg'),
    };
    writeFileSync(files.child, '2025-09-01 crlf\r\n');
    writeFileSync(files.main, 'include child.ledg\n');

    const [txn] = await readAll(new InputStreamJournalReader({ filePath: files.main, sourceModifiable: false }));
    expect(txn.description).toBe('crlf');
  });

  it('handles included file without trailing newline', async () => {
    const dir = join(baseDir, 'nonewline');
    mkdirSync(dir, { recursive: true });
    const files = {
      main: join(dir, 'main.ledg'),
      child: join(dir, 'child.ledg'),
    };
    writeFileSync(files.child, '2025-10-10 nonewline'); // note: no \n
    writeFileSync(files.main, 'include child.ledg\n2025-10-11 after\n');

    const txns = await readAll(new InputStreamJournalReader({ filePath: files.main, sourceModifiable: false }));
    expect(txns.map(t => t.description)).toEqual(['nonewline', 'after']);
  });

  it('orders a chain of five includes correctly', async () => {
    const dir = join(baseDir, 'five');
    mkdirSync(dir, { recursive: true });
    const paths: string[] = [];
    for (let i = 1; i <= 5; ++i) {
      paths[i] = join(dir, `f${i}.ledg`);
    }
    // f5 has no include
    writeFileSync(paths[5], '2025-11-05 F5\n');
    // build backwards: f4 includes f5, etc.
    for (let i = 4; i >= 1; --i) {
      writeFileSync(paths[i], `include f${i + 1}.ledg\n2025-11-0${i} F${i}\n`);
    }

    const txns = await readAll(new InputStreamJournalReader({ filePath: paths[1], sourceModifiable: false }));
    expect(txns.map(t => t.description)).toEqual(['F5', 'F4', 'F3', 'F2', 'F1']);
  });

  it('flushes parent transaction before include', async () => {
    const dir = join(baseDir, 'flush');
    mkdirSync(dir, { recursive: true });
    const files = {
      main: join(dir, 'main.ledg'),
      child: join(dir, 'child.ledg'),
    };
    writeFileSync(files.child, '2025-12-01 flushChild\n');
    writeFileSync(files.main, [
      '2025-12-01 parentBefore',
      'include child.ledg',
      '2025-12-02 parentAfter',
    ].join('\n'));

    const txns = await readAll(new InputStreamJournalReader({ filePath: files.main, sourceModifiable: false }));
    expect(txns.map(t => t.description)).toEqual(['parentBefore', 'flushChild', 'parentAfter']);
  });
});

describe('Metadata parsing', () => {
  it('parses string transaction metadata', async () => {
    const src = [
      '2025-10-01 txn',
      '  ; note:"hello"',
    ];
    const [txn] = await readAll(new InputStreamJournalReader({
      filePath: 'memory://meta-str',
      readStream: Readable.from([src.join('\n')]),
      sourceModifiable: false,
    }));
    expect(txn.metadata.note).toBe('hello');
  });

  it('parses numeric transaction metadata', async () => {
    const src = [
      '2025-10-02 txn',
      '  ; amount:42',
    ];
    const [txn] = await readAll(new InputStreamJournalReader({ filePath: 'memory://meta-num', readStream: Readable.from([src.join('\n')]), sourceModifiable: false }));
    expect(txn.metadata.amount).toBe(42);
  });

  it('parses boolean transaction metadata', async () => {
    const src = [
      '2025-10-03 txn',
      '  ; done:true',
    ];
    const [txn] = await readAll(new InputStreamJournalReader({ filePath: 'memory://meta-bool', readStream: Readable.from([src.join('\n')]), sourceModifiable: false }));
    expect(txn.metadata.done).toBe(true);
  });

  it('parses object transaction metadata', async () => {
    const src = [
      '2025-10-04 txn',
      '  ; obj:{"a":1}',
    ];
    const [txn] = await readAll(new InputStreamJournalReader({ filePath: 'memory://meta-obj', readStream: Readable.from([src.join('\n')]), sourceModifiable: false }));
    expect(txn.metadata.obj).toEqual({ a: 1 });
  });

  it('parses array transaction metadata', async () => {
    const src = [
      '2025-10-05 txn',
      '  ; arr:[1,2,3]',
    ];
    const [txn] = await readAll(new InputStreamJournalReader({ filePath: 'memory://meta-arr', readStream: Readable.from([src.join('\n')]), sourceModifiable: false }));
    expect(txn.metadata.arr).toEqual([1, 2, 3]);
  });

  it('parses multiple metadata keys', async () => {
    const src = [
      '2025-10-06 txn',
      '  ; k1:"v1"',
      '  ; k2:2',
    ];
    const [txn] = await readAll(new InputStreamJournalReader({ filePath: 'memory://meta-multi', readStream: Readable.from([src.join('\n')]), sourceModifiable: false }));
    expect(txn.metadata.k1).toBe('v1');
    expect(txn.metadata.k2).toBe(2);
  });

  it('parses posting metadata string', async () => {
    const src = [
      '2025-10-07 txn',
      '  Post\tAssets:Cash',
      '  ; note:"post"',
    ];
    const [txn] = await readAll(new InputStreamJournalReader({ filePath: 'memory://meta-post', readStream: Readable.from([src.join('\n')]), sourceModifiable: false }));
    const [p] = txn.getPostingBuilders();
    expect(p.metadata.note).toBe('post');
    expect(txn.metadata.note).toBeUndefined();
  });

  it('parses complex posting metadata object', async () => {
    const src = [
      '2025-10-08 txn',
      '  Post\tAssets:Cash',
      '  ; info:{"nested":{"x":10}}',
    ];
    const [txn] = await readAll(new InputStreamJournalReader({ filePath: 'memory://meta-post-obj', readStream: Readable.from([src.join('\n')]), sourceModifiable: false }));
    const [p] = txn.getPostingBuilders();
    expect(p.metadata.info).toEqual({ nested: { x: 10 } });
    expect(txn.metadata.info).toBeUndefined();
  });

  it('throws on invalid JSON in metadata', async () => {
    const src = [
      '2025-10-09 txn',
      '  ; bad:{abc}', // invalid JSON value
    ];
    await expect(async () => {
      await readAll(new InputStreamJournalReader({ filePath: 'memory://meta-invalid', readStream: Readable.from([src.join('\n')]), sourceModifiable: false }));
    }).rejects.toThrow();
  });

  it('handles metadata on virtual postings', async () => {
    const src = [
      '2025-10-10 txn',
      '  ; tag:"test"',
      '  Post\t[Assets:Cash]',
      '  ; tag:"virt"',
    ];
    const [txn] = await readAll(new InputStreamJournalReader({ filePath: 'memory://meta-virt', readStream: Readable.from([src.join('\n')]), sourceModifiable: false }));
    const [p] = txn.getPostingBuilders();
    expect(p.metadata.tag).toBe('virt');
    expect(p.metadata.virt).toBe(true);
    expect(txn.metadata.tag).toBe('test');
    expect(txn.metadata.virt).toBeUndefined;
  });
});

describe('InputStreamJournalReader (multi-line postings and sourceDescriptor)', () => {
  it('tracks source ranges for postings spanning multiple lines with metadata and comments', async () => {
    // Construct a ledger with a transaction including two postings,
    // one of which has metadata lines following
    const srcLines = [
      '2025-02-14 Valentine transaction',              // 0: transaction line
      '; a standalone comment',                         // 1: comment
      '  Debit Account1\tAssets.Cash\t[100 USD]',      // 2: posting line 1
      '  ; note:"Gift expense"',                     // 3: posting metadata
      '  ; category:"gift"',                         // 4: posting metadata
      '',                                              // 5: empty
      '  Credit Account2\tExpenses.Personal\t[100 USD]',// 6: posting line 2
      '; a standalone comment',                         // 7: comment
      '',                                                // 8: empty
      '2025-02-15 Next transaction',                    // 9: next txn
      '  Single line posting\tLiabilities.Misc\t[50 USD]', // 10
    ];

    const reader = new InputStreamJournalReader({
      filePath: 'memory://multi-postings',
      readStream: Readable.from([srcLines.join('\n')]),
      sourceModifiable: true
    });
    const txns = await readAll(reader);

    // Two transactions expected
    expect(txns).toHaveLength(2);

    const first = txns[0];
    // Should have two postings
    const pbuilders = first.getPostingBuilders();
    expect(pbuilders.length).toBe(2);

    // Check source descriptor for first posting spans lines 1-3
    const firstPostingSource = (pbuilders[0].source as InputStreamSourceDescriptor);
    expect(firstPostingSource.lineStart).toBe(2);
    expect(firstPostingSource.lineEnd).toBe(4);
    expect(firstPostingSource.sourceText.split(/\r?\n/)).toEqual(srcLines.slice(2, 5));

    // Check source descriptor for second posting spans only its line 4
    const secondPostingSource = (pbuilders[1].source as InputStreamSourceDescriptor);
    expect(secondPostingSource.lineStart).toBe(6);
    expect(secondPostingSource.lineEnd).toBe(6);
    expect(secondPostingSource.sourceText).toBe(srcLines[6]);

    // Check transaction-level source spans its own lines (0 through 5)
    const txnSource = (first.source as InputStreamSourceDescriptor);
    expect(txnSource.lineStart).toBe(0);
    expect(txnSource.lineEnd).toBe(6);
    expect(txnSource.sourceText.split(/\r?\n/)).toEqual(srcLines.slice(0, 7));
  });

  it('handles nested includes with postings and preserves correct line numbering', async () => {
    // Setup files in memory-like structure
    const dir = '~testout/InputStreamJournalReader.MultiInclude/';
    mkdirSync(dir);
    const mainPath = join(dir, 'main.ledg');
    const incPath = join(dir, 'inc.ledg');

    // Write included file
    writeFileSync(incPath, [
      '2025-03-01 incTxn',
      '  IncPosting\tIncome.Sales\t[200 USD]',
    ].join('\n'));

    // Write main file with include and own transaction
    writeFileSync(mainPath, [
      'include inc.ledg',
      '',
      '2025-03-02 mainTxn',
      '  MainPosting\tExpenses.Office\t[75 USD]',
    ].join('\n'));

    const reader = new InputStreamJournalReader({ filePath: mainPath, sourceModifiable: false });
    const txns = await readAll(reader);

    // Expect two transactions: from inc and main
    expect(txns.length).toBe(2);

    // First: incTxn
    const inc = txns[0];
    expect(inc.description).toBe('incTxn');
    // Posting lineStart should correspond to where in inc.ledg
    const incP = inc.getPostingBuilders()[0];
    const incSource = (incP.source as InputStreamSourceDescriptor);
    expect(incSource.filePath).toContain('inc.ledg');
    expect(incSource.lineStart).toBe(1);
    expect(incSource.sourceText).toContain('IncPosting');

    // Second: mainTxn
    const main = txns[1];
    expect(main.description).toBe('mainTxn');
    const mainP = main.getPostingBuilders()[0];
    const mainSource = (mainP.source as InputStreamSourceDescriptor);
    expect(mainSource.filePath).toContain('main.ledg');
    expect(mainSource.lineStart).toBe(3);
    expect(mainSource.sourceText).toContain('MainPosting');
  });
});
