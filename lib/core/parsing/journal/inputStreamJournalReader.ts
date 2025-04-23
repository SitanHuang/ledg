import { closeSync, createReadStream, openSync, readSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface, Interface } from "node:readline";
import { Readable } from "node:stream";
import { PostingBuilder } from "../../accounting/posting.ts";
import { TransactionBuilder } from "../../accounting/transaction.ts";
import { Metadata } from "../../data/ledgObject.ts";
import { SourceDescriptor } from "../../data/sourceDescriptor.ts";
import { isOk, Maybe, Ok } from "../../types.ts";
import { JournalReader } from "./journalReader.ts";

export class InputStreamSourceDescriptor implements SourceDescriptor {

  constructor(
    public readonly sourceText: string,
    public readonly filePath: string,
    public readonly lineStart: number,
    public readonly lineEnd: number,
    public readonly modifiable = true,
  ) { }
}

export class InputStreamJournalReaderParseError extends Error {
  constructor(
    public readonly filePath: string,
    public readonly source: string,
    public readonly line: number,
    public readonly message: string,
    public readonly cause?: Error
  ) {
    super(`Error in "${filePath}" Line ${line}: ${message || cause?.message} (source: \`${source}\`)`);
  }
}

type LINE_ENDING = "\r" | "\n" | "\r\n";

/**
 * Parses a Journal input file.
 */
export class InputStreamJournalReader extends JournalReader {
  protected readonly originalFilePath: string;
  protected upstream!: Readable;
  protected readonly sourceModifiable: boolean;

  private rl!: Interface;

  /** When true, incoming lines are parked in `dripBuffer`. */
  private isPaused = false;
  private dripBuffer: string[] = [];
  private dripBufferStartInd = 0;

  private pendingChildren = 0; // active include readers
  private sourceEnded = false; // did parent stream finish?

  constructor({
    filePath = '',
    readStream,
    sourceModifiable = true
  }: {
    filePath: string,
    readStream?: Readable,
    sourceModifiable: boolean
  }) {
    super();

    this.originalFilePath = filePath;

    if (readStream) {
      this.upstream = readStream;
    }

    this.sourceModifiable = sourceModifiable;
  }

  override begin(): void {
    this.detectedDelimiter = InputStreamJournalReader.sniffDelimiter(this.originalFilePath);

    try {
      this.upstream = this.upstream ?? createReadStream(this.originalFilePath);
    } catch (err) {
      this.haltWithError(
        new InputStreamJournalReaderParseError(this.originalFilePath, "", 0, "Stream error", err as Error)
      );
      return;
    }

    this.upstream.once("error", (err) => {
      this.haltWithError(
        new InputStreamJournalReaderParseError(this.originalFilePath, "", 0, "Stream error", err as Error),
      );
    });

    this.rl = createInterface({
      input: this.upstream,
      crlfDelay: Infinity,
    }).pause();

    this.rl.on("error", (err: Error) => {
      this.haltWithError(
        new InputStreamJournalReaderParseError(this.originalFilePath, "", 0, "Readline error", err),
      );
    });

    this.rl.on('line', this.onLine.bind(this));

    this.rl.on("close", () => {
      this.flushCurrentTxn();
      this.sourceEnded = true;
      this.maybeFireEnd();
    });

    this.rl.resume();
  }

  private detectedDelimiter: LINE_ENDING = "\n";
  private lineCount = -1;
  private currentTxn: TransactionBuilder | null = null;
  private currentTxnLine = 0;
  private currentTxnLines: string[] = [];
  private currentPosting: PostingBuilder | null = null;
  private currentPostingLine = 0;
  private lastMeaningfulLine = 0;
  private currentLine = '';

  private onLine(line: string): void {
    if (this.isPaused) {
      this.dripBuffer.push(line);
      return;
    }

    const result = this.procLine(line);

    if (!isOk(result)) {
      this.haltWithError(result);
    }
  }

  private procLine(line: string): Maybe {
    this.lineCount++;
    this.currentLine = line;

    if (line.startsWith("include ")) {
      this.includeFile(resolve(dirname(this.originalFilePath), line.substring(8)));
      return Ok;
    }

    if (line[4] == '-' && line[7] == '-') { // start transaction
      this.parseTransaction();
    }

    return Ok;
  }

  private flushCurrentTxn() {
    if (!this.currentTxn) return;

    // TODO: also flush current posting

    this.currentTxn.withSource(new InputStreamSourceDescriptor(
      this.currentTxnLines.join(this.detectedDelimiter),
      this.originalFilePath,
      this.currentTxnLine, this.lastMeaningfulLine,
      this.sourceModifiable
    ));

    const result = this.onData(this.currentTxn);
    if (!isOk(result)) {
      return this.raiseError(this.currentLine, "Error commiting TransactionBuilder.", result); // re-throw error
    }

    this.currentTxn = null;
  }

  private parseTransaction() {
    this.flushCurrentTxn();

    const line = this.currentLine;

    // Valid transaction lines (hash contains 8-char optional ID; optional second datetime after equal sign is date2, which must default to first date if not provided):
    // 2024-01-01T33:11:22 desc
    // 2024-01-01T33:11:22 desc #zzzzzzzz
    // 2024-01-01 33:11:22 desc #zzzzzzzz
    // 2024-01-01 desc #zzzzzzzz
    // 2024-01-01 33:11:22=2024-01-32 desc #zzzzzzzz
    // 2024-01-01=2024-01-32 33:11:22 desc #zzzzzzzz
    // 2024-01-01=2024-01-32 33:11:22 desc #zzzzzzzz
    // 0123456789012345678901234567890123456789
    // 0         1         2

    const txn = this.currentTxn = new TransactionBuilder();
    const metadata: Metadata = {};

    this.lastMeaningfulLine = this.currentTxnLine = this.lineCount;
    this.currentTxnLines = [line];

    // Extract Primary Date
    let date1End = 0;
    let timestamp = NaN;
    if (line[13] == ':' && line[16] == ':') {
      timestamp = Date.parse(line.substring(0, 19));
      date1End = 19;
    }

    if (isNaN(timestamp)) { // fall back to date only
      timestamp = Date.parse(line.substring(0, 10));
      date1End = 10;
    }

    if (isNaN(timestamp)) {
      return this.raiseError(line, "Primary date is not a valid ISO date.");
    }

    // Extract Aux Date
    let date2End = date1End;
    let timestamp2 = NaN;
    if (line[date1End] == '=') {
      if (line[date1End + 1 + 13] == ':' && line[date1End + 1 + 16] == ':') {
        timestamp2 = Date.parse(line.substring(date1End + 1, date1End + 1 + 19));
        date2End = date1End + 1 + 19;
      }

      if (isNaN(timestamp2)) { // fall back to date only
        timestamp2 = Date.parse(line.substring(date1End + 1, date1End + 1 + 10));
        date2End = date1End + 1 + 10;
      }
    } else {
      timestamp2 = timestamp;
    }

    if (isNaN(timestamp2)) {
      return this.raiseError(line, "Auxiliary date is a valid ISO date.");
    }

    let descEnd = line.length;

    let lastNonEmptyInd = line.length;

    // Find last non whitespace ind:
    while (line[--lastNonEmptyInd] == ' ' || line[lastNonEmptyInd] == '\t');

    // Extract UUID
    if (line[lastNonEmptyInd - 8] == '#') {
      descEnd = lastNonEmptyInd - 8;
      txn.withId(line.substring(lastNonEmptyInd - 7, lastNonEmptyInd + 1));
    } else {
      // Auto gen
      txn.genId();
    }

    let desc = line.substring(date2End + 1, descEnd);

    if (desc.startsWith("! ")) {
      metadata.pending = true;
      desc = desc.substring(2);
    }

    if (desc.startsWith("event")) {
      desc = this.parseEventDescription(desc, metadata);
    }

    txn.withDate(timestamp).withDate2(timestamp2).withDescription(desc.trim()).withMetadata(metadata);
  }

  /**
   * Attempts to parse event string. Returns original description if failed.
   */
  private parseEventDescription(desc: string, metadata: Metadata): string {
    // Below code is faster than REGEX

    const LEN = desc.length;
    let i = 5; // position right after 'event'
    // skip spaces
    while (i < LEN && desc[i] === ' ') i++;
    if (i >= LEN) return desc;

    // start of eventType
    const start1 = i;
    // find end of eventType (first space after start1)
    const end1 = desc.indexOf(' ', start1);
    if (end1 === -1) return desc;

    // skip spaces to start of desc
    i = end1;
    while (i < LEN && desc[i] === ' ') i++;
    if (i > LEN) return desc;

    metadata.event = desc.slice(start1, end1);
    return desc.slice(i);
  }

  /**
   * Pause the current reader, parse `includePath` with a child reader, then
   * resume.  Any lines emitted after `rl.pause()` are parked in `dripBuffer`
   * and replayed in FIFO order before resuming the parent stream.
   */
  private includeFile(includePath: string) {
    this.isPaused = true;
    this.pendingChildren++;
    this.rl.pause();

    const child = new InputStreamJournalReader({
      filePath: includePath,
      sourceModifiable: this.sourceModifiable
    }).forkFrom(this);

    child.setOnEnd(() => {
      this.pendingChildren--;
      this.isPaused = false;

      for (let i = this.dripBufferStartInd, len = this.dripBuffer.length; i < len; ++i) {
        this.onLine(this.dripBuffer[i]);
        // we've hit another include in the drip -> just need to hand off
        // this function to after that include finishes
        if (this.isPaused) {
          this.dripBufferStartInd++;
          return;
        }
      }

      this.dripBuffer.length = 0;
      this.dripBufferStartInd = 0;

      this.rl.resume();
      this.maybeFireEnd();
    });
    child.setOnError((error) => {
      this.haltWithError(this.raiseError(
        `include ${includePath}`,
        "Error while processing included file",
        error
      ));
    });

    child.begin();
  }

  private static sniffDelimiter(filePath: string, bytes = 64 * 1024): LINE_ENDING {
    let fd: number | undefined;
    try {
      fd = openSync(filePath, "r");
      const buf = Buffer.allocUnsafe(bytes);
      const n = readSync(fd, buf, 0, bytes, 0);
      const txt = buf.subarray(0, n).toString("utf8");

      if (txt.includes("\r\n")) return "\r\n";
      if (txt.includes("\n")) return "\n";
      if (txt.includes("\r")) return "\r";
    } catch {
      /* ignore – will fall back to '\n' */
    } finally {
      if (fd !== undefined) closeSync(fd);
    }
    return "\n";
  }

  private haltWithError(error: Error) {
    this.isPaused = true;
    this.pendingChildren = Infinity; // we'll never call onEnd
    this.rl.close();
    this.onError(error);
  }

  private maybeFireEnd() {
    if (this.sourceEnded && this.pendingChildren == 0) {
      this.onEnd();
    }
  }

  private raiseError(line: string, message?: string, cause?: Error) {
    return new InputStreamJournalReaderParseError(this.originalFilePath, line, this.lineCount, message ?? cause?.message ?? '', cause);
  }
}