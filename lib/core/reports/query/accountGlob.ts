import { Account } from "../../accounting/account.ts";

/**
 * AccountGlob performs Unix‑style globbing of account names.
 *   ex: ..cash =~ Account.Current.Cash
 *       .cash =~ Account.Cash
 *       exp$ =~ Expense
 *       exp|inc.sl =~ Expense | Income.Salary
 *       exp. =~ Expense.*
 *       exp. =~ Expense.*
 *
 *   anything in between dots matches any segments of account names that
 *   contains the letters in that order
 *     ex: .csh. matches *\.[^.]*?c[^.]*?s[^.]*?h[^.]*?\.* in regex
 *
 *   * matches across "." boundaries (zero or more segments)
 *   . matches "." literally
 *   {a,b,c} alternation of literal text, no nesting
 *   \   escapes the next character when you need it literal
 *       ex:  acc\*.cash   =~  Account*.Cash
 *
 *          regex literal mode
 *            adding "\v" to the beginning of an account filter switches
 *            the whole pattern to regular‑expression matching exactly as typed
 *
 *            example to exclude all equity accounts:
 *              \v^(?!Equity)
 *
 *          string literal mode
 *            adding "!" to the beginning of an account filter switches
 *            the whole pattern to string matching exactly as typed
 *
 *            example to match "Equity" as-is
 *              !Equity
 *
 * ## Benchmarks relative to ledg1 using real life account set:
 *
 *  +-------------+-------------------+---------------------+
 *  | Pattern     | fzy_compile/match | glob_compile/match  |
 *  +-------------+-------------------+---------------------+
 *  | *gro.pcare  | 1.822 s           | 180.516 ms          |
 *  | *boa.chk    | 1.920 s           | 178.734 ms          |
 *  | ..amz       | 71.882 ms         | 42.617 ms           |
 *  | et.prnt     | 52.747 ms         | 37.713 ms           |
 *  | *plat       | 1.893 s           | 195.597 ms          |
 *  | inc.sal     | 34.575 ms         | 28.504 ms           |
 *  +-------------+-------------------+---------------------+
 */
export class AccountGlob {

  protected readonly compiledPattern: RegExp;

  constructor(
    public readonly pattern: string
  ) {
    if (pattern.startsWith('\\v')) {
      this.compiledPattern = new RegExp(pattern.substring(2), 'i');
      return;
    }

    const reEsc = /[-/\\^$+?.()|[\]{}*]/g;
    const quot = (s: string) => s.replace(reEsc, '\\$&');

    if (pattern.startsWith('!')) {
      this.compiledPattern = new RegExp('^' + quot(pattern.substring(1)) + '$');
      return;
    }

    let i = 0, esc = false, rx = '^';

    while (i < this.pattern.length) {
      const c = this.pattern[i++];

      // literal backslash
      if (esc) {
        rx += quot(c);
        esc = false;
        continue;
      }
      if (c === '\\') { esc = true; continue; }

      switch (c) {
        case '*':
          rx += '.*'; // "*" -> cross dot
          break;

        case '{': // {a,b,c}
          {
            let alt = '';
            while (i < this.pattern.length && this.pattern[i] !== '}') alt += this.pattern[i++];
            i++; // skip the '}'
            rx += '(?:' + alt.split(',').map(quot).join('|') + ')';
            break;
          }

        case '.': rx += '[^.]*?\\.'; break; // literal dot

        default: rx += '[^.]*?' + c; // regex literal
      }
    }
    rx += '[^.]*?$';
    this.compiledPattern = new RegExp(rx, 'i');
  }

  execute(account: Account): boolean {
    return this.compiledPattern.test(account.identifier);
  }
}