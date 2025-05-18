interface ParseOptions {
  escape?: string;
}

type Env = ((key: string) => string) | NodeJS.ProcessEnv;

const ARG_CONTROL = '(?:' + [
  '\\|\\|', '\\&\\&', ';;', '\\|\\&', '\\<\\(', '>>', '>\\&'
].join('|') + ')';
const ARG_META = '';
const ARG_BAREWORD = '(\\\\[\'"' + ARG_META + ']|[^\\s\'"' + ARG_META + '])+';
const ARG_SINGLE_QUOTE = '"((\\\\"|[^"])*?)"';
const ARG_DOUBLE_QUOTE = '\'((\\\\\'|[^\'])*?)\'';

const ARG_TOKEN: string = Array(4).fill('').map((): string =>
  (Math.pow(16, 8) * Math.random()).toString(16)).join("");

export function parseArgvFromShellString(
  s: string,
  env?: Env | null,
  opts?: ParseOptions
): string[] {
  const mapped = _parseArgvFromShellString(s, env ?? process.env, opts ?? {});
  if (typeof env !== 'function') return mapped.map(x => typeof x !== 'string' ? x.op : x);

  return mapped.reduce((acc: (string | { op: string })[], s) => {
    if (typeof s === 'object') return acc.concat(s);
    const xs = s.split(RegExp(`(${ARG_TOKEN}.*?${ARG_TOKEN})`, 'g'));
    if (xs.length === 1) return acc.concat(xs[0]);
    return acc.concat(xs.filter(Boolean).map(x => {
      return RegExp(`^${ARG_TOKEN}`).test(x)
        ? JSON.parse(x.split(ARG_TOKEN)[1])
        : x;
    }));
  }, []).filter(x => typeof x === 'string');
}

function _parseArgvFromShellString(
  s: string,
  env: Env,
  opts: ParseOptions
): (string | { op: string })[] {
  const chunker = new RegExp([
    `(${ARG_CONTROL})`,
    `(${ARG_BAREWORD}|${ARG_SINGLE_QUOTE}|${ARG_DOUBLE_QUOTE})*`
  ].join('|'), 'g');

  const match = s.match(chunker)?.filter(Boolean) ?? [];
  const commented = false;

  env ??= {};
  opts ??= {};

  return match.map((s): (string | { op: string }) | undefined => {
    if (commented) return undefined;
    if (new RegExp(`^${ARG_CONTROL}$`).test(s)) {
      return { op: s };
    }

    const SQ = "'";
    const DQ = '"';
    const DS = '$';
    const BS = opts.escape ?? '\\';
    let quote: false | typeof SQ | typeof DQ = false;
    let esc = false;
    let out = '';
    const isGlob = false;

    for (let i = 0, len = s.length; i < len; i++) {
      let c = s.charAt(i);
      if (esc) {
        out += c;
        esc = false;
      } else if (quote) {
        if (c === quote) {
          quote = false;
        } else if (quote === SQ) {
          out += c;
        } else {
          if (c === BS) {
            i += 1;
            c = s.charAt(i);
            if (c === DQ || c === BS || c === DS) {
              out += c;
            } else {
              out += BS + c;
            }
          } else if (c === DS) {
            out += parseEnvVar();
          } else {
            out += c;
          }
        }
      } else if (c === DQ || c === SQ) {
        quote = c;
      } else if (c === BS) {
        esc = true;
      } else if (c === DS) {
        out += parseEnvVar();
      } else {
        out += c;
      }

      function parseEnvVar(): string {
        i += 1;
        let varend: number;
        let varname: string;

        if (s.charAt(i) === '{') {
          i += 1;
          if (s.charAt(i) === '}') {
            throw new Error(`Bad substitution: ${s.substr(i - 2, 3)}`);
          }
          varend = s.indexOf('}', i);
          if (varend < 0) {
            throw new Error(`Bad substitution: ${s.substr(i)}`);
          }
          varname = s.substring(i, varend);
          i = varend;
        } else if (/[*@#?$!_-]/.test(s.charAt(i))) {
          varname = s.charAt(i);
          i += 1;
        } else {
          const varendMatch = /[^\w\d_]/.exec(s.substring(i));
          if (!varendMatch) {
            varname = s.substring(i);
            i = s.length;
          } else {
            varname = s.substring(i, i + varendMatch.index);
            i += varendMatch.index! - 1;
          }
        }
        return getVar('', varname);
      }
    }

    return isGlob ? { op: 'glob' } : out;


  }).filter((item): item is (string | { op: string }) => item !== undefined)
    .reduce<(string | { op: string })[]>(
      (prev, arg) => prev.concat(arg), []
    );

  function getVar(_pre: string, key: string): string {
    let r: string | undefined;
    if (typeof env === 'function') {
      r = (env as (k: string) => string)(key);
    } else {
      r = (env as NodeJS.ProcessEnv)[key];
    }

    if (r === undefined && key !== '') r = '';
    else r ??= '$';

    if (typeof r === 'object') {
      return `${ARG_TOKEN}${JSON.stringify(r)}${ARG_TOKEN}`;
    }
    return r;
  }
}