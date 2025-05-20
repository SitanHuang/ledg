
import ansis, { Ansis } from 'ansis';
import { Embeddable, RenderFormat, TerminalColorSpace } from './renderable.ts';
import { Span } from './span.ts';

type RGB = [number, number, number];

export type Color = RGB
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'gray'
  | 'redBright'
  | 'greenBright'
  | 'yellowBright'
  | 'blueBright'
  | 'magentaBright'
  | 'cyanBright'
  | 'whiteBright'
  | false;

const isRGB = (c: Color): c is RGB => Array.isArray(c);

const rgbToAnsi16 = ([r, g, b]: [number, number, number]): number => {
  const ANSI16_PALETTE: [number, number, number][] = [
    [0, 0, 0],     // 0  black
    [128, 0, 0],     // 1  red
    [0, 128, 0],     // 2  green
    [128, 128, 0],     // 3  yellow
    [0, 0, 128],   // 4  blue
    [128, 0, 128],   // 5  magenta
    [0, 128, 128],   // 6  cyan
    [192, 192, 192],   // 7  white  (light-gray)
    [128, 128, 128],   // 8  bright-black (dark-gray)
    [255, 0, 0],     // 9  bright-red
    [0, 255, 0],     // 10 bright-green
    [255, 255, 0],     // 11 bright-yellow
    [0, 0, 255],   // 12 bright-blue
    [255, 0, 255],   // 13 bright-magenta
    [0, 255, 255],   // 14 bright-cyan
    [255, 255, 255],   // 15 bright-white
  ];

  let closest = 0;
  let minDist = Infinity;

  for (let i = 0; i < ANSI16_PALETTE.length; i++) {
    const [pr, pg, pb] = ANSI16_PALETTE[i];
    const dist =
      (r - pr) * (r - pr) +
      (g - pg) * (g - pg) +
      (b - pb) * (b - pb);

    if (dist < minDist) {
      minDist = dist;
      closest = i;
    }
  }

  return closest;
};

const rgbToAnsi256 = ([r, g, b]: [number, number, number]): number => {
  // Grayscale from 232–255
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return 232 + Math.round(((r - 8) / 247) * 24);
  }

  // 6x6x6 colour cube from 16–231
  const conv = (c: number) => Math.round((c / 255) * 5);
  const rc = conv(r), gc = conv(g), bc = conv(b);
  return 16 + (36 * rc) + (6 * gc) + bc;
};


export type FontFamily = 'monospace' | 'serif' | 'sans-serif';

export class Stylable extends Embeddable {
  private _bold = false;
  private _dim = false;
  private _italic = false;
  private _underline = false;
  private _strikethrough = false;
  private _color: Color = false;
  private _bg: Color = false;

  private _reset = false;

  private _font: FontFamily = 'sans-serif';

  private _htmlClasses = new Set<string>();
  private _htmlStyles: string[] = [];
  private _htmlTag = 'span';

  public target: Embeddable

  constructor(
    target: Embeddable | string
  ) {
    super();

    this.target = typeof target == 'string' ? new Span(target) : target;
  }

  bold(opt: boolean): this {
    this._bold = opt;
    return this;
  }
  dim(opt: boolean): this {
    this._dim = opt;
    return this;
  }
  italic(opt: boolean): this {
    this._italic = opt;
    return this;
  }
  underline(opt: boolean): this {
    this._underline = opt;
    return this;
  }
  strikethrough(opt: boolean): this {
    this._strikethrough = opt;
    return this;
  }
  color(opt: Color): this {
    this._color = opt;
    return this;
  }
  bg(opt: Color): this {
    this._bg = opt;
    return this;
  }
  forceReset(opt: boolean): this {
    this._reset = opt;
    return this;
  }
  font(opt: FontFamily): this {
    this._font = opt;
    return this;
  }
  addClass(clazz: string): this {
    this._htmlClasses.add(clazz);
    return this;
  }
  removeClass(clazz: string): this {
    this._htmlClasses.delete(clazz);
    return this;
  }
  appendStyle(style: string): this {
    this._htmlStyles.push(style);
    return this;
  }
  htmlTag(tag: string): this {
    this._htmlTag = tag;
    return this;
  }

  override get displayWidth(): number {
    return this.target.displayWidth;
  }

  override render(format: RenderFormat): string {
    const content = this.target.render(format);

    switch (format.target) {
      case 'ascii':
        return this.toAnsi(content, format);
      case 'html':
        return this.toHtml(content);
      case 'csv':
        return content; // CSV should be raw, un‑styled text.
    }
  }

  private toAnsi(content: string, format: Extract<RenderFormat, { target: 'ascii' }>): string {
    let styled = this._reset ? ansis.reset : ansis;
    if (this._bold) styled = styled.bold;
    if (this._dim) styled = styled.dim;
    if (this._italic) styled = styled.italic;
    if (this._underline) styled = styled.underline;
    if (this._strikethrough) styled = styled.strikethrough;

    if (this._color) {
      styled = this.applyColor(styled, this._color, false, format.colorSpace);
    }

    if (this._bg) {
      styled = this.applyColor(styled, this._bg, true, format.colorSpace);
    }

    return styled.visible(content);
  }

  private toHtml(content: string): string {
    if (this._bold) this.appendStyle('font-weight:bold');
    if (this._dim) this.appendStyle('opacity:0.65');
    if (this._italic) this.appendStyle('font-style:italic');
    if (this._underline) this.appendStyle('text-decoration:underline');
    if (this._strikethrough) this.appendStyle('text-decoration:line-through');

    if (this._font) this.appendStyle(`font-family:${this._font}`);

    if (this._color) {
      this.appendStyle(`color:${this.cssColor(this._color)}`);
      if (!isRGB(this._color)) {
        this.addClass('color-' + this._color);
      }
    }
    if (this._bg) {
      this.appendStyle(`background-color:${this.cssColor(this._bg)}`);
      if (!isRGB(this._color)) {
        this.addClass('bg-' + this._color);
      }
    }

    const styleAttr = this._htmlStyles.length ? ` style="${this._htmlStyles.join(';')}"` : '';
    const classes = Array.from(this._htmlClasses);
    const classAttr = classes.length ? ` class="${classes.join(' ')}"` : '';
    return `<${this._htmlTag || 'span'}${styleAttr}${classAttr}>${content}</${this._htmlTag || 'span'}>`;
  }

  private cssColor(c: Color): string {
    if (!c) return '';
    if (isRGB(c)) return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
    return c === 'gray' ? 'grey' : c.replace('Bright', '');
  }

  private applyColor(styled: Ansis, col: Color, isBg: boolean, space?: TerminalColorSpace) {
    if (!col) return styled;

    if (isRGB(col)) {
      const [r, g, b] = col;

      switch (space) {
        case 16: {
          const code = rgbToAnsi16(col);
          return isBg ? styled.bg(code) : styled.fg(code);
        }
        case 256: {
          const code = rgbToAnsi256(col);
          return isBg ? styled.bg(code) : styled.fg(code);
        }
        case 'rgb':
        case undefined:
        default:
          return isBg ? styled.bgRgb(r, g, b) : styled.rgb(r, g, b);
      }
    }

    // Named colour – ansis has the same API naming convention (red, bgRed, etc.)
    switch (col) {
      case 'black': return isBg ? styled.bgBlack : styled.black;
      case 'red': return isBg ? styled.bgRed : styled.red;
      case 'green': return isBg ? styled.bgGreen : styled.green;
      case 'yellow': return isBg ? styled.bgYellow : styled.yellow;
      case 'blue': return isBg ? styled.bgBlue : styled.blue;
      case 'magenta': return isBg ? styled.bgMagenta : styled.magenta;
      case 'cyan': return isBg ? styled.bgCyan : styled.cyan;
      case 'white': return isBg ? styled.bgWhite : styled.white;

      case 'gray': return isBg ? styled.bgGray : styled.gray;

      case 'redBright': return isBg ? styled.bgRedBright : styled.redBright;
      case 'greenBright': return isBg ? styled.bgGreenBright : styled.greenBright;
      case 'yellowBright': return isBg ? styled.bgYellowBright : styled.yellowBright;
      case 'blueBright': return isBg ? styled.bgBlueBright : styled.blueBright;
      case 'magentaBright': return isBg ? styled.bgMagentaBright : styled.magentaBright;
      case 'cyanBright': return isBg ? styled.bgCyanBright : styled.cyanBright;
      case 'whiteBright': return isBg ? styled.bgWhiteBright : styled.whiteBright;
    }
  }

}