import { JoinedEmbeddable, renderable } from "./embeddable.ts";
import { Embeddable, Renderable, RenderFormat } from "./renderable.ts";
import { Span } from "./span.ts";
import { Stylable } from "./stylable.ts";

export type TextJustify = 'left' | 'right' | 'center';


export interface TableOptions {
  /**
   * Column separator used when rendering ascii. Defaults to two spaces.
   */
  colBorder?: string;
  /**
   * Render a horizontal rule (composed of this character) between rows.
   * Disabled by default.
   */
  rowBorder?: string | false;
  /**
   * Column-wise justification. Falls back to `"left"` if unspecified.
   */
  justify?: TextJustify[];
  /**
   * Minimum terminal width (in columns) for each column. Defaults to zero.
   */
  minWidths?: number[];
  /**
   * Maximum terminal width (in columns) for each column. Defaults to Infinity.
   */
  maxWidths?: number[];
  /**
   * If true, odd body rows will be styled with an alternate colour / shading.
   * This only affects HTML and ascii targets.
   */
  alternateColor?: boolean;
  /**
   * When true (default), the first added row is treated as the table header.
   */
  firstRowIsHeader?: boolean;
  /**
   * When true, header rows are underlined
   */
  underlineHeader?: boolean;
  /**
   * When true, header rows are bold
   */
  boldHeader?: boolean;
}

export interface RowOptions {
  /** Whether the row acts as a table header. */
  header?: boolean;
  /** Whether to underline the whole row regardless of header status. */
  underline?: boolean;
  /** Whether to underline the previous row regardless of header status. */
  topline?: boolean;
  /** Whether to bold the whole row regardless of header status. */
  boldline?: boolean;
  /** Reset alternate-row colour to the initial (un-shaded) state before this row. */
  resetAlternateColor?: boolean;
}

class TableRow {
  readonly cells: Embeddable[];
  readonly opts: Required<RowOptions>;

  constructor(cells: (Embeddable | string)[], opts: RowOptions, colCount: number) {
    // Coerce primitives to Spans.
    this.cells = cells.map(cell => typeof cell == "string" ? new Span(String(cell)) : cell);

    // Normalize the length - short rows are padded out with empty spans so that
    // the table remains rectangular.
    if (this.cells.length < colCount) {
      for (let i = this.cells.length; i < colCount; i++) this.cells.push(new Span(""));
    }

    this.opts = {
      header: !!opts.header,
      underline: !!opts.underline,
      topline: !!opts.topline,
      boldline: !!opts.boldline,
      resetAlternateColor: !!opts.resetAlternateColor,
    };
  }
}

class TableCell extends Stylable {
  constructor(
    protected actualTarget: Embeddable,
    public width: number,
    public justify: TextJustify,
  ) {
    super(actualTarget);
    this.htmlTag('td');
  }

  header(opt: boolean): this {
    this.htmlTag(opt ? 'th' : 'td');
    return this;
  }

  override render(format: RenderFormat): string {
    switch (format.target) {
      case 'ascii': {
        const w = this.actualTarget.displayWidth;
        const pad = this.width - w;

        let padded: JoinedEmbeddable;
        switch (this.justify) {
          case "right":
            padded = renderable`${" ".repeat(pad)}${this.actualTarget}`;
            break;
          case "center": {
            const left = Math.floor(pad / 2);
            const right = pad - left;
            padded = renderable`${" ".repeat(left)}${this.actualTarget}${" ".repeat(right)}`;
            break;
          }
          case "left":
          default:
            padded = renderable`${this.actualTarget}${" ".repeat(pad)}`;
        }

        this.target = padded;

        return super.render(format);
      }
      case 'html':
        this.appendStyle(`text-align: ${this.justify}`);
        return super.render(format);
      case 'csv':
        return `"${super.render(format)}"`; // should auto escape using span
    }
  }
}

export class Table extends Renderable {
  private readonly rows: TableRow[] = [];
  private readonly opts: Required<TableOptions>;

  readonly embeddable = false;

  constructor(opts: TableOptions = {}) {
    super();
    this.opts = {
      colBorder: opts.colBorder ?? "  ",
      rowBorder: opts.rowBorder ?? false,
      justify: opts.justify ?? [],
      minWidths: opts.minWidths ?? [],
      maxWidths: opts.maxWidths ?? [],
      alternateColor: opts.alternateColor ?? true,
      firstRowIsHeader: opts.firstRowIsHeader ?? true,
      underlineHeader: opts.underlineHeader ?? true,
      boldHeader: opts.boldHeader ?? true,
    };
  }

  /**
   * Append a row to the table.
   */
  addRow(cells: (Embeddable | string)[], opts: RowOptions = {}): this {
    const colCount = Math.max(this.columnCount, cells.length);
    this.rows.push(new TableRow(cells, opts, colCount));
    return this;
  }

  /**
   * The number of columns in the widest row.
   */
  private get columnCount(): number {
    return this.rows.reduce((w, row) => Math.max(w, row.cells.length), 0);
  }

  private _colWidths: number[] | null = null;

  private get colWidths(): number[] {
    if (this._colWidths) return this._colWidths;

    const cols = this.columnCount;
    const widths = new Array<number>(cols).fill(0);

    // Ensure min/max arrays are long enough.
    const min = [...this.opts.minWidths, ...new Array(cols).fill(0)].slice(0, cols);
    const max = [...this.opts.maxWidths, ...new Array(cols).fill(Infinity)].slice(0, cols);

    for (const row of this.rows) {
      row.cells.forEach((cell, idx) => {
        const w = cell.displayWidth;
        widths[idx] = Math.min(max[idx], Math.max(widths[idx], Math.max(min[idx], w)));
      });
    }

    this._colWidths = widths;
    return widths;
  }

  override get displayWidth(): number {
    const body = this.colWidths.reduce((sum, w) => sum + w, 0);
    const sep = (this.colWidths.length - 1) * this.opts.colBorder.length;
    return body + sep;
  }

  override render(format: RenderFormat): string {
    const lines: Embeddable[] = [];

    let altRow = 0;

    this.rows.forEach((row, rowId) => {
      if (row.opts.resetAlternateColor) altRow = 0;

      const cells: TableCell[] = row.cells.map(
        (cell, colIdx) => new TableCell(cell, this.colWidths[colIdx], this.opts.justify[colIdx] ?? "left")
      );

      const line = new Stylable(
        JoinedEmbeddable
          .join(cells)
          .join(format.target === "csv" ? "," : format.target == "ascii" ? this.opts.colBorder : "")
      );
      line.htmlTag('tr');

      if (
        (row.opts.header && this.opts.underlineHeader) || row.opts.underline ||
        this.rows.at(rowId + 1)?.opts.topline
      ) {
        if (format.target === "ascii") {
          line.underline(true);
        } else {
          line.addClass('underline');
        }
      }
      if (
        (row.opts.header && this.opts.boldHeader) || row.opts.boldline
      ) {
        line.bold(true);
      }

      if (this.opts.alternateColor && !row.opts.header) {
        if (altRow++ % 2 === 1) {
          line.bg(
            format.target !== "ascii" || format.lightTerminal ?
              [0xee, 0xee, 0xee] :
              [0x1c, 0x1c, 0x1c]
          );
        }
      }

      lines.push(line);

      if (format.target === "ascii" && this.opts.rowBorder) {
        lines.push(new Span(this.opts.rowBorder.repeat(this.displayWidth)));
      }
    });

    switch (format.target) {
      case "html":
        return `<table class="ledg-export">\n${lines.map(x => x.render(format)).join("\n")}</table>` +
          '<style>\n' +
          'table.ledg-export { border-collapse: collapse; }\n' +
          'table.ledg-export th, table.ledg-export td { padding: 0.2rem 0.5rem; line-height: 1.1; }\n' +
          'table.ledg-export .underline td, .ledg-export .underline th { border-bottom: 1px solid black; }\n' +
          '</style>';
      case "csv":
      case "ascii":
      default:
        return lines.map(x => x.render(format)).join("\n");
    }
  }
}
