import { Embeddable, RenderFormat } from "./renderable.ts";
import { Span } from "./span.ts";

export class JoinedEmbeddable extends Embeddable {
  constructor(
    private embeds: Embeddable[]
  ) { super(); }

  override get displayWidth(): number {
    return this.embeds.reduce((sum, embed) => sum + embed.displayWidth, 0);
  }

  override render(format: RenderFormat): string {
    return this.embeds.map(embed => embed.render(format)).join('');
  }

  append(embed: Embeddable): this {
    this.embeds.push(embed);
    return this;
  }

  /**
   * Mimics Array.join by interleaving the provided separator between each
   * embeddable and returning a **new** `JoinedEmbeddable` instance. The current
   * instance is left unmodified.
   */
  join(sep: Embeddable | string): JoinedEmbeddable {
    const separator: Embeddable = sep instanceof Embeddable ? sep : new Span(sep);

    if (this.embeds.length <= 1) {
      return new JoinedEmbeddable([...this.embeds]);
    }

    const interleaved: Embeddable[] = [];
    for (let i = 0; i < this.embeds.length; i++) {
      if (i !== 0) interleaved.push(separator);
      interleaved.push(this.embeds[i]);
    }

    return new JoinedEmbeddable(interleaved);
  }

  deconstruct(): readonly Embeddable[] {
    return this.embeds;
  }

  public static join(embeds: Embeddable[]): JoinedEmbeddable {
    return new this(embeds);
  }
}

/**
 * Template‑tag function that converts a template literal into a single
 * `JoinedEmbeddable`, interleaving literal text fragments with any supplied
 * `Embeddable` expressions.
 *
 * ```ts
 * const banner = renderable`Name: ${nameCol}  Score: ${scoreCol}`;
 * terminal.write(banner.render({ format: 'ascii' }));
 * ```
 */
export function renderable(
  strings: TemplateStringsArray,
  ...expressions: (Embeddable | string)[]
): JoinedEmbeddable {
  const embeds: Embeddable[] = [];

  for (let i = 0; i < strings.length; i++) {
    const lit = strings[i];
    if (lit !== '') {
      embeds.push(new Span(lit));
    }

    if (i < expressions.length) {
      const expr = expressions[i];

      if (expr instanceof Embeddable) {
        embeds.push(expr);
      } else {
        // Fallback: treat primitive value as literal text.
        embeds.push(new Span(expr));
      }
    }
  }

  return JoinedEmbeddable.join(embeds);
}
