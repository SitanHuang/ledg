import { Account } from "../accounting/account.ts";
import { AmountFormatOptions } from "../accounting/amount.ts";
import { Transaction } from "../accounting/transaction.ts";
import { Metadata, MetadataReservedKey } from "../data/ledgObject.ts";
import { RationalFormatOptions } from "../math/rational.ts";
import { LINE_ENDING } from "../parsing/journal/inputStreamJournalReader.ts";
import { timestamp } from "../types.ts";
import { isUtcMidnight, toUTCDateString, toUTCDatetimeString } from "../utils/dateUtils.ts";

export type AmountSerializationOptions = Omit<
  AmountFormatOptions,
  "useGrouping" | "groupSeparator" | "decimalSeparator"
>;

interface _BaseOptions {
  lineDelimiter: LINE_ENDING;
  /** default false */
  newLineAtStart?: boolean;
  /** default true */
  newLineAtEnd?: boolean;
}

export type SerializationOptions =
  | (_BaseOptions & {
    /**
     * When available, use Amount.sourceString (default).
     *
     * If set to false, the resolved values will be printed at 10 dp.
     */
    useSourceText: true;
    ledgerCompatible?: false;

    /** Not allowed when useSourceText = true */
    amountFormat?: never;
  })
  | (_BaseOptions & ({
    ledgerCompatible?: false;
  } | {
    ledgerCompatible: true;
    useSourceText?: false;
  }) & {
    useSourceText?: false;
    amountFormat?: AmountSerializationOptions;
});

const defaultAmountFormat: RationalFormatOptions = {
  minFractionDigits: 0,
  useGrouping: 0,
  groupSeparator: '',
  decimalSeparator: '.',
  displayPrecision: 10,
  showPlus: false,
};

export function serializeTransaction(
  txn: Transaction,
  opts: SerializationOptions,
): string {
  const defaults: Partial<SerializationOptions> = {
    ledgerCompatible: false,
    useSourceText: true,
    newLineAtStart: false,
    newLineAtEnd: true,
  };

  opts = Object.assign(defaults, opts);

  if (opts.ledgerCompatible) {
    opts.useSourceText = false;
  }

  const { ledgerCompatible, useSourceText, lineDelimiter } = opts;

  const builder: string[] = [];

  const LN = lineDelimiter;

  if (opts.newLineAtStart) {
    builder.push(LN);
  }

  builder.push(serializeTransactionDate(txn.date));

  if (txn.date2 !== txn.date) {
    builder.push('=', serializeTransactionDate(txn.date2));
  }

  if (txn.metadata.pending === true) {
    builder.push(' !');
  }
  if (txn.metadata.event?.length) {
    builder.push(' event ', txn.metadata.event);
  }
  if (txn.accountOpened) {
    builder.push(' open ', sanitizeAccount(txn.accountOpened, opts));
  } else if (txn.accountClosed) {
    builder.push(' close ', sanitizeAccount(txn.accountClosed, opts));
  } else if (txn.description.length) {
    builder.push(' ', txn.description);
  }

  builder.push(' #', txn.id, LN);

  serializeModifiers(builder, txn.metadata, opts);

  let amountFormat: RationalFormatOptions;

  const savedforceSerializable = opts?.amountFormat?.forceSerializable;

  if (opts.amountFormat) {
    amountFormat = opts.amountFormat;
    opts.amountFormat.forceSerializable = true;
  } else {
    amountFormat = defaultAmountFormat;
  }


  for (const posting of txn.postings) {
    const ownDesc = posting.description === txn.description ? '' : posting.description.replaceAll("\t", ' ');
    if (ledgerCompatible) {
      builder.push('  ');
    } else {
      builder.push('  ', ownDesc, '\t');
    }

    const account = sanitizeAccount(posting.account, opts);

    if (posting.metadata.virt === true) {
      builder.push('[', account, ']');
    } else {
      builder.push(account);
    }

    if ((useSourceText && posting.amount.sourceString?.length) || !useSourceText) {
      builder.push(!ledgerCompatible ? '\t' : ' '.repeat(Math.max(2, 45 - account.length - (posting.metadata.virt ? 2 : 0))));  // 2 is min by hledger
    }

    builder.push(
      (
        useSourceText && posting.amount.sourceString !== undefined ?
          posting.amount.sourceString :
          posting.amount.toString(amountFormat)
      ),
      LN
    );

    if (ledgerCompatible && ownDesc) {
      builder.push('  ; ', posting.description, LN);
    }

    const pendingHeader = posting.metadata.pending === true && txn.metadata.pending !== posting.metadata.pending;
    const date1Header = posting.date !== txn.date;
    const date2Header = posting.date2 !== txn.date2;

    if (pendingHeader || date1Header || date2Header) {
      builder.push('  ;');

      if (pendingHeader) builder.push(' !');

      if (date1Header) builder.push(' ', serializeTransactionDate(posting.date));
      else if (date2Header) builder.push(' ');

      if (date2Header) builder.push('=', serializeTransactionDate(posting.date2));

      builder.push(LN);
    }

    serializeModifiers(builder, posting.metadata, opts, txn);
  }

  if (opts.newLineAtEnd) {
    builder.push(LN);
  }

  if (typeof savedforceSerializable === 'boolean' && opts.amountFormat) {
    opts.amountFormat.forceSerializable = savedforceSerializable;
  }

  return builder.join("");
}

function sanitizeAccount(acc: Account | string, opts: SerializationOptions) {
  return opts.ledgerCompatible ?
    (acc instanceof Account ? acc.getDelimitedGroups() : Account.splitIdentifier(acc)).map(x => x.replaceAll(":", ".")).join(":") :
    acc instanceof Account ? acc.identifier : acc;
}

export function serializeTransactionDate(ts: timestamp) {
  const date = new Date(ts);

  return isUtcMidnight(date) ? toUTCDateString(date) : toUTCDatetimeString(date);
}

export function serializeModifiers(
  builder: string[],
  meta: Metadata,
  opts: SerializationOptions,
  parent?: Transaction
) {
  const keys = Object.keys(meta);

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

    builder.push('  ; ', key, ':', JSON.stringify(meta[key]), opts.lineDelimiter);
  }
}