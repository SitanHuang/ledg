const ARG_FLAG_SHORTHANDS = {
  'sbc': 'skip-book-close',
  'hz': 'hide-zero',
  'lt': 'light-theme',
  'cml': 'cumulative',
  'cml-cols': 'cumulative-columns',
  'dep': 'max-depth',
  'depth': 'max-depth',
};

const ARG_MODIFIER_SHORTHANDS = {
  'desc': 'description',
  'f': 'from',
  't': 'to',
  'bc': 'bookClose'
};

function argsparser(_args) {
  let args = { _:[], flags: {}, modifiers: {} };

  let uuids = [];

  let bypass = false;
  for (let i = 0;i < _args.length;i++) {
    let arg = _args[i];

    if (arg == '--') { bypass = true; continue; }
    if (bypass) { args._.push(arg); continue; }

    let match = Object.keys(CMD_LIST).filter(x => x.indexOf(arg) == 0).sort();
    if (!match.length && (match = arg.match(/^[a-z0-9]{8}$/i))) {
      uuids.push(arg);
    } else if (match = arg.match(/^-([a-zA-Z])(.+)$/)) {
      args.flags[match[1]] = match[2];
    } else if (match = arg.match(/^--?([^=]+)(=(.*))?$/)) {
      let key = match[1];
      key = ARG_FLAG_SHORTHANDS[key] || key;
      if (!isNaN(Number(key))) { // key cannot be number
        args._.push(arg);
        continue;
      }
      let val = match[3] || (arg.indexOf('=') > 0 ? '' : true);
      if (!isNaN(Number(val))) val = Number(val);
      if (val == 'true') val = true;
      if (val == 'false') val = false;
      args.flags[key] = val;
    } else if (match = arg.match(/^([a-zA-Z_-]+):(.*)$/)) {
      let key = match[1];
      key = ARG_MODIFIER_SHORTHANDS[key] || key;
      let val = match[2];
      if (!isNaN(Number(val))) val = Number(val);
      if (val == 'true') val = true;
      if (val == 'false') val = false;
      args.modifiers[key] = val;
    } else {
      args._.push(arg)
    }
  }
  if (uuids.length) args.modifiers['uuid'] = args.modifiers.uuid || uuids.join("|");
  args._ = args._.filter(x => x.length);
  return args;
}

// '<(' is process substitution operator and
// can be parsed the same as control operator
const ARG_CONTROL = '(?:' + [
    '\\|\\|', '\\&\\&', ';;', '\\|\\&', '\\<\\(', '>>', '>\\&' ].join('|') + ')';
const ARG_META = '';
const ARG_BAREWORD = '(\\\\[\'"' + ARG_META + ']|[^\\s\'"' + ARG_META + '])+';
const ARG_SINGLE_QUOTE = '"((\\\\"|[^"])*?)"';
const ARG_DOUBLE_QUOTE = '\'((\\\\\'|[^\'])*?)\'';

var ARG_TOKEN = '';
for (var i = 0; i < 4; i++) {
    ARG_TOKEN += (Math.pow(16,8)*Math.random()).toString(16);
}

function parseArgSegmentsFromStr(s, env, opts) {
    var mapped = _parseArgSegmentsFromStr(s, env || process.env, opts);
    if (typeof env !== 'function') return mapped;
    return mapped.reduce(function (acc, s) {
        if (typeof s === 'object') return acc.concat(s);
        var xs = s.split(RegExp('(' + ARG_TOKEN + '.*?' + ARG_TOKEN + ')', 'g'));
        if (xs.length === 1) return acc.concat(xs[0]);
        return acc.concat(xs.filter(Boolean).map(function (x) {
            if (RegExp('^' + ARG_TOKEN).test(x)) {
                return JSON.parse(x.split(ARG_TOKEN)[1]);
            }
            else return x;
        }));
    }, []).filter(x => typeof x == 'string');
};

function _parseArgSegmentsFromStr (s, env, opts) {
    var chunker = new RegExp([
        '(' + ARG_CONTROL + ')', // control chars
        '(' + ARG_BAREWORD + '|' + ARG_SINGLE_QUOTE + '|' + ARG_DOUBLE_QUOTE + ')*'
    ].join('|'), 'g');
    var match = s.match(chunker).filter(Boolean);
    var commented = false;

    if (!match) return [];
    if (!env) env = {};
    if (!opts) opts = {};
    return match.map(function (s, j) {
        if (commented) {
            return;
        }
        if (RegExp('^' + ARG_CONTROL + '$').test(s)) {
            return { op: s };
        }

        // Hand-written scanner/parser for Bash quoting rules:
        //
        //  1. inside single quotes, all characters are printed literally.
        //  2. inside double quotes, all characters are printed literally
        //     except variables prefixed by '$' and backslashes followed by
        //     either a double quote or another backslash.
        //  3. outside of any quotes, backslashes are treated as escape
        //     characters and not printed (unless they are themselves escaped)
        //  4. quote context can switch mid-token if there is no whitespace
        //     between the two quote contexts (e.g. all'one'"token" parses as
        //     "allonetoken")
        var SQ = "'";
        var DQ = '"';
        var DS = '$';
        var BS = opts.escape || '\\';
        var quote = false;
        var esc = false;
        var out = '';
        var isGlob = false;

        for (var i = 0, len = s.length; i < len; i++) {
            var c = s.charAt(i);
//             isGlob = isGlob || (!quote && (c === '*' || c === '?'));
            if (esc) {
                out += c;
                esc = false;
            }
            else if (quote) {
                if (c === quote) {
                    quote = false;
                }
                else if (quote == SQ) {
                    out += c;
                }
                else { // Double quote
                    if (c === BS) {
                        i += 1;
                        c = s.charAt(i);
                        if (c === DQ || c === BS || c === DS) {
                            out += c;
                        } else {
                            out += BS + c;
                        }
                    }
                    else if (c === DS) {
                        out += parseEnvVar();
                    }
                    else {
                        out += c;
                    }
                }
            }
            else if (c === DQ || c === SQ) {
                quote = c;
            }
//             else if (RegExp('^' + ARG_CONTROL + '$').test(c)) {
//                 return { op: s };
//             }
//             else if (RegExp('^#$').test(c)) {
//                 commented = true;
//                 if (out.length){
//                     return [out, { comment: s.slice(i+1) + match.slice(j+1).join(' ') }];
//                 }
//                 return [{ comment: s.slice(i+1) + match.slice(j+1).join(' ') }];
//             }
            else if (c === BS) {
                esc = true;
            }
            else if (c === DS) {
                out += parseEnvVar();
            }
            else out += c;
        }

        if (isGlob) return {op: 'glob', pattern: out};

        return out;

        function parseEnvVar() {
            i += 1;
            var varend, varname;
            //debugger
            if (s.charAt(i) === '{') {
                i += 1;
                if (s.charAt(i) === '}') {
                    throw new Error("Bad substitution: " + s.substr(i - 2, 3));
                }
                varend = s.indexOf('}', i);
                if (varend < 0) {
                    throw new Error("Bad substitution: " + s.substr(i));
                }
                varname = s.substr(i, varend - i);
                i = varend;
            }
            else if (/[*@#?$!_\-]/.test(s.charAt(i))) {
                varname = s.charAt(i);
                i += 1;
            }
            else {
                varend = s.substr(i).match(/[^\w\d_]/);
                if (!varend) {
                    varname = s.substr(i);
                    i = s.length;
                } else {
                    varname = s.substr(i, varend.index);
                    i += varend.index - 1;
                }
            }
            return getVar(null, '', varname);
        }
    })
    // finalize parsed aruments
    .reduce(function(prev, arg){
        if (arg === undefined){
            return prev;
        }
        return prev.concat(arg);
    },[]);

    function getVar (_, pre, key) {
        var r = typeof env === 'function' ? env(key) : env[key];
        if (r === undefined && key != '')
            r = '';
        else if (r === undefined)
            r = '$';

        if (typeof r === 'object') {
            return pre + ARG_TOKEN + JSON.stringify(r) + ARG_TOKEN;
        }
        else return pre + r;
    }
}
