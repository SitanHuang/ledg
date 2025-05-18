import { describe, it, expect } from 'vitest';
import { parseArgvFromShellString } from './argvparse.ts';

describe('parseArgvFromShellString', () => {
  it('should handle complex quoted structures', () => {
    expect(parseArgvFromShellString(`echo "''''"`)).toEqual(['echo', "''''"]);
    expect(parseArgvFromShellString(`echo '""""'`)).toEqual(['echo', '""""']);
    expect(parseArgvFromShellString(`echo "\\"\\""`)).toEqual(['echo', `""`]);
  });

  it('should handle nested substitutions', () => {
    const env = { A: 'a', B: 'b' };
    expect(parseArgvFromShellString(`echo "$A\${B}$(echo c)"`, env))
      .toEqual(['echo', 'ab$(echo c)']);
  });

  it('should handle control operator edge cases', () => {
    expect(parseArgvFromShellString('|||')).toEqual(['||', '|']);
    expect(parseArgvFromShellString('&<')).toEqual(['&<']);
    // expect(parseArgvFromShellString(';(;')).toEqual([';;', '(']);
  });

  it('should handle empty input edge cases', () => {
    expect(parseArgvFromShellString('   ')).toEqual([]);
    expect(parseArgvFromShellString('""')).toEqual(['']);
    expect(parseArgvFromShellString("''")).toEqual(['']);
  });

  it('should handle special parameter substitutions', () => {
    const env = {
      '*': 'star',
      '@': 'at',
      '#': 'hash',
      '?': 'question',
      '-': 'dash',
      '$': 'dollar'
    };
    expect(parseArgvFromShellString('echo $* $@ $# $? $- $$', env)).toEqual([
      'echo', 'star', 'at', 'hash', 'question', 'dash', 'dollar'
    ]);
  });

  it('should handle complex escaping patterns', () => {
    expect(parseArgvFromShellString('echo "\\\\\\""'))
      .toEqual(['echo', '\\"']);
    expect(parseArgvFromShellString("echo '\\\\\\''"))
      .toEqual(['echo', "\\\\\\"]);
    expect(parseArgvFromShellString('echo \\x\\y\\z'))
      .toEqual(['echo', 'xyz']);
  });

  it('should handle mixed operators and substitutions', () => {
    const env = { VAR: 'value' };
    expect(parseArgvFromShellString('echo $VAR&&cat||tee', env)).toEqual([
      'echo', 'value&&cat||tee'
    ]);
  });

  it('should handle pathological whitespace', () => {
    expect(parseArgvFromShellString('   echo   "  hello  "   '))
      .toEqual(['echo', '  hello  ']);
    // expect(parseArgvFromShellString('echo\\   test'))
    //   .toEqual(['echo ', 'test']);
  });

  it('should handle custom escape characters', () => {
    expect(parseArgvFromShellString('echo %"hello%"', null))
      .toEqual(['echo', '%hello%']);
    expect(parseArgvFromShellString('echo %"hello%"', null, { escape: '%' }))
      .toEqual(['echo', '"hello"']);
    expect(parseArgvFromShellString('echo ^|', null, { escape: '^' }))
      .toEqual(['echo', '|']);
  });

  it('should handle substitution in operator contexts', () => {
    const env = { OP: '|' };
    expect(parseArgvFromShellString('echo $OP$OP', env))
      .toEqual(['echo', '||']);
    expect(parseArgvFromShellString('echo $OP', env))
      .toEqual(['echo', '|']);
  });

  it('should handle empty substitutions in complex contexts', () => {
    expect(parseArgvFromShellString('echo "${UNDEF}"test'))
      .toEqual(['echo', 'test']);
    expect(parseArgvFromShellString('echo a${UNDEF}b'))
      .toEqual(['echo', 'ab']);
  });

  it('should handle substitution of control characters', () => {
    const env = { CMD: '&&' };
    expect(parseArgvFromShellString('echo $CMD', env))
      .toEqual(['echo', '&&']);
    expect(parseArgvFromShellString('echo "$CMD"', env))
      .toEqual(['echo', '&&']);
  });

  it('should handle deep substitution edge cases', () => {
    const env = { A: 'a', B: 'b', C: 'c' };
    expect(parseArgvFromShellString('echo ${A}${B}$C', env))
      .toEqual(['echo', 'abc']);
    expect(parseArgvFromShellString('echo "${A}${B}$C"', env))
      .toEqual(['echo', 'abc']);
  });

  it('should handle invalid substitutions as literals', () => {
    expect(parseArgvFromShellString('echo $%^'))
      .toEqual(['echo', '$%^']);
    expect(parseArgvFromShellString('echo "$("'))
      .toEqual(['echo', '$(']);
  });

  it('should handle multi-byte characters', () => {
    expect(parseArgvFromShellString('echo こんにちは'))
      .toEqual(['echo', 'こんにちは']);
    expect(parseArgvFromShellString('echo "😀😎"'))
      .toEqual(['echo', '😀😎']);
  });

  it('should handle complex mixed quoting', () => {
    const cmd = `echo 'don'"'"'t' "\\"worry\\""`;
    expect(parseArgvFromShellString(cmd)).toEqual([
      'echo', "don't", '"worry"'
    ]);
  });

  it('should handle substitution injection attacks', () => {
    const env = { EVIL: '; rm -rf /' };
    expect(parseArgvFromShellString('echo $EVIL', env))
      .toEqual(['echo', '; rm -rf /']);
    expect(parseArgvFromShellString('echo "$EVIL"', env))
      .toEqual(['echo', '; rm -rf /']);
  });
});