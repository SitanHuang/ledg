import stringWidth from "string-width";
import { Embeddable, RenderFormat } from "./renderable.ts";
import { escapeCsv, escapeHtml } from "./escape.ts";

/**
 * An inline text element.
 */
export class Span extends Embeddable {
  constructor(
    public content: string
  ) { super(); }

  get displayWidth(): number {
    return stringWidth(this.content, { countAnsiEscapeCodes: false });
  }

  override render(format: RenderFormat): string {
    switch (format.target) {
      case 'html':
        return escapeHtml(this.content);
      case 'csv':
        return escapeCsv(this.content);
      case 'ascii':
      default:
        return this.content;
    }
  };
}
