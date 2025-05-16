
export type TerminalColorSpace = 16 | 256 | 'rgb';

export type RenderFormat = {
  target: 'csv'
} | {
  target: 'html'
} | {
  target: 'ascii',
  colorSpace?: TerminalColorSpace,
};

export abstract class Renderable {
  /**
   * The terminal display column-width of the content.
   */
  abstract get displayWidth(): number;

  /**
   * Whether the content, when rendered, can be chained horizontally in one
   * line. Anything that spans multiple lines cannot be embeddable.
   */
  abstract get embeddable(): boolean;

  abstract render(format: RenderFormat): string;
}

export abstract class Embeddable extends Renderable {
  override get embeddable(): boolean {
    return true;
  }
}