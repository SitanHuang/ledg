import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { TransactionBuilder } from '../../accounting/transaction.ts';
import { isOk, Ok } from '../../types.ts';
import { InputStreamJournalReader } from './inputStreamJournalReader.ts';

async function readAll(reader: InputStreamJournalReader) {
  const txns: TransactionBuilder[] = [];
  reader.setOnData((t) => {
    txns.push(t);
    return Ok;
  });
  const promise = reader.promisify();
  reader.begin();
  const result = (await promise);
  if (!isOk(result))
    throw result;
  return txns;
}


describe('InputStreamJournalReader (Empty transactions & events only)', () => {
  it('parses event-only transactions with pending flag, dual-date, CRLF, explicit UUID', async () => {
    /* CRLF endings + messy whitespace are deliberate. */
    const src = [
      '2024-01-01 event kickoff project',
      '2024-01-02 ! event   launch 🚀',                                 // pending + double-space
      '2024-01-03 12:34:56 event  sample #ABCDEFGH',                    // explicit UUID
      '2024-01-04T01:02:03=2024-02-03T23:59:59 event multi date something'
    ];

    const reader = new InputStreamJournalReader({
      filePath: 'memory://events-ledger',
      readStream: Readable.from([src.join("\r\n")]),
      sourceModifiable: false
    });

    const txns = await readAll(reader);
    expect(txns).toHaveLength(4);

    // txn #1 – basic event
    expect(txns[0].metadata.event).toBe('kickoff');
    expect(txns[0].description).toBe('project');
    expect(txns[0].metadata.pending).toBeUndefined();
    expect(txns[0].getPostingBuilders().length).toBe(0);

    // txn #2 – pending + multiple-space handling
    expect(txns[1].metadata.pending).toBe(true);
    expect(txns[1].metadata.event).toBe('launch');
    expect(txns[1].description).toBe('🚀');
    expect(txns[1].getPostingBuilders().length).toBe(0);

    // txn #3 – explicit UUID must be respected and stripped from description
    expect(txns[2].description).toBe('');
    expect(txns[2].metadata.event).toBe('sample');
    expect(txns[2].id).toBe("ABCDEFGH");
    expect(txns[2].getPostingBuilders().length).toBe(0);

    // txn #4 – dual-date parsing must succeed exactly
    const EXPECT_PRIMARY = Date.parse('2024-01-04T01:02:03');
    const EXPECT_SECONDARY = Date.parse('2024-02-03T23:59:59');
    expect(txns[3].date).toBe(EXPECT_PRIMARY);
    expect(txns[3].date2).toBe(EXPECT_SECONDARY);
    expect(txns[3].metadata.event).toBe('multi');
    expect(txns[3].description).toBe('date something');
    expect(txns[3].getPostingBuilders().length).toBe(0);
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
      'txn inc',   // second include – should *not* be de‑duplicated
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
