import { BoundPosting } from "../../../core/accounting/posting.ts";
import { Transaction } from "../../../core/accounting/transaction.ts";
import { Metadata, MetadataReservedKey } from "../../../core/data/ledgObject.ts";
import { serializeTransactionDate } from "../../../core/serialize/transaction.ts";
import { AmountSpan } from "../../../render/amount.ts";
import { JoinedEmbeddable, renderable } from "../../../render/embeddable.ts";
import { Embeddable, Renderable } from "../../../render/renderable.ts";
import { Span } from "../../../render/span.ts";
import { Stylable } from "../../../render/stylable.ts";
import { LedgCLIContext } from "../../context.ts";

export function printTransactions(
  txns: Transaction[],
  useSourceText: boolean,
  cliContext: LedgCLIContext,
) {
  const println = (...str: Embeddable[]) => cliContext.printlnRenderable(JoinedEmbeddable.join(str));

  const aggr = aggregateComponents(txns, useSourceText, cliContext);

  const maxPostingDescWidth = aggr.postingsDescWidths > 0 ? aggr.postingsDescWidths + 2 : 0;

  const maxPostingWidth = 2 +
    aggr.amountWidths +
    aggr.postingsAccWidths + 2 +
    maxPostingDescWidth;

  const uuidAlignRight = Math.max(
    aggr.headerEndAlign + 8 + 1 + 1,
    maxPostingWidth
  );

  for (const txn of aggr.txnGroups) {
    println(
      txn.header,
      new Span(' '.repeat(Math.max(0, uuidAlignRight - txn.header.displayWidth - txn.uuid.displayWidth))),
      txn.uuid
    );
    for (const posting of txn.postingGroups) {
      const headerWidth = 2 + maxPostingDescWidth + posting.acc.displayWidth;

      println(
        new Span('  '),
        posting.desc,
        new Span(' '.repeat(Math.max(0, maxPostingDescWidth - posting.desc.displayWidth))),
        posting.acc,
        new Span(' '.repeat(Math.max(0, maxPostingWidth - headerWidth - posting.amount.displayWidth))),
        posting.amount
      );
    }
  }
}

interface AggregateComponents {
  headerEndAlign: number; // up to uuid
  postingsDescWidths: number;
  postingsAccWidths: number;
  amountWidths: number;

  txnGroups: TxnGroup[];
};

interface TxnGroup {
  header: Renderable;
  uuid: Renderable;
  mods: Renderable[];
  postingGroups: (PostingGroup)[]
};

interface PostingGroup {
  desc: Renderable; // up to amount
  acc: Renderable; // up to amount
  amount: Renderable; // up to amount
  mods: Renderable[];
};

function aggregateComponents(
  txns: Transaction[],
  useSourceText: boolean,
  cliContext: LedgCLIContext,
): AggregateComponents {

  const specs: AggregateComponents = {
    headerEndAlign: 0,
    postingsDescWidths: 0,
    postingsAccWidths: 0,
    amountWidths: 0,
    txnGroups: [],
  };

  for (const txn of txns) {
    const txnGroup = procTxn(txn, specs);
    txnGroup.postingGroups = txn.postings.map(
      posting => procPosting(posting, specs, useSourceText, cliContext)
    );
    specs.txnGroups.push(txnGroup);
  }

  return specs;
}

function procTxn(txn: Transaction, specs: AggregateComponents): TxnGroup {
  const uuid = new Stylable('#' + txn.id).color('cyan');

  let headerWidth = 0;

  const header = new JoinedEmbeddable([
    new Stylable(serializeTransactionDate(txn.date)).color('cyanBright').bold(true)
  ]);

  if (txn.date2 !== txn.date) {
    const date2 = '=' + serializeTransactionDate(txn.date2);
    header.append(new Stylable(date2).color('cyanBright'))
    headerWidth -= date2.length;
  }

  if (txn.metadata.pending === true) {
    header.append(new Stylable(' !').color('redBright').bold(true))
  }
  if (txn.metadata.event?.length) {
    header.append(new Stylable(' event ').color('cyanBright').bold(true))
    header.append(new Stylable(txn.metadata.event).color('yellowBright'))
  }
  if (txn.accountOpened) {
    header.append(new Stylable(' open ').color('cyanBright').bold(true));
    header.append(new Stylable(txn.accountOpened).color('yellowBright'));
  } else if (txn.accountClosed) {
    header.append(new Stylable(' close ').color('cyanBright').bold(true));
    header.append(new Stylable(txn.accountClosed).color('yellowBright'));
  } else if (txn.description.length) {
    header.append(new Stylable(' ' + txn.description));
  }

  headerWidth += header.displayWidth;

  specs.headerEndAlign = Math.max(specs.headerEndAlign, headerWidth);

  return {
    header,
    uuid,
    mods: procMods(txn.metadata),
    postingGroups: []
  };
}

function procPosting(
  posting: BoundPosting,
  specs: AggregateComponents,
  useSourceText: boolean,
  cliContext: LedgCLIContext,
): PostingGroup {

  let amount: Renderable;

  if (useSourceText && posting.amount.sourceString !== undefined) {
    amount = new Stylable(posting.amount.sourceString).color([255, 172, 28]);
  } else {
    amount = new AmountSpan(posting.amount, cliContext.amountDisplayPolicy);
  }

  specs.amountWidths = Math.max(specs.amountWidths, amount.displayWidth);

  const acc = new Stylable(
    posting.metadata.virt ?
      `[${posting.account.identifier}]` :
      posting.account.identifier
  ).italic(!!posting.metadata.virt).color('yellowBright');

  specs.postingsAccWidths = Math.max(specs.postingsAccWidths, acc.displayWidth);

  const desc = new Span(posting.description);

  specs.postingsDescWidths = Math.max(specs.postingsDescWidths, desc.displayWidth);

  return {
    amount,
    acc,
    desc,
    mods: procMods(posting.metadata, posting.transaction),
  };
}

function procMods(meta: Metadata, parent?: Transaction): Renderable[] {
  const keys = Object.keys(meta);
  const lines: Renderable[] = [];

  let keyLen = 0;
  const aggr: [string, string][] = [];

  for (const key of keys) {
    switch (key as MetadataReservedKey) {
      case "tags":
        break;
      case "event":
        if (parent && parent.metadata.event !== meta.event) {
          break; // posting has different event, break the switch and serialize
        }

      // otherwise, transaction level event is always skipped (fallthrough)
      case "pending":
        if (parent && parent.metadata.pending && meta.pending === false) {
          break; // need to explicitly serialize "pending: false" to override
        }

      // eslint-disable-next-line no-fallthrough
      case "virt":
        continue;
    }

    if (parent && parent.metadata[key] === meta[key]) {
      continue;
    }

    const val = JSON.stringify(meta[key]);

    keyLen = Math.max(keyLen, key.length);
    aggr.push([key, val]);
  }

  for (const [key, val] of aggr) {
    const dim = (str: string) => new Stylable(str).dim(true).color('green');
    const norm = (str: string) => new Stylable(str).color('greenBright');

    lines.push(
      renderable`${dim('  ; ')}${norm(key.padEnd(keyLen, ' ')).bold(true)}${dim(' : ')}${norm(val)}`
    );
  }

  return lines;
}