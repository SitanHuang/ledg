function fzy_query_account(q, accounts=Object.keys(data.accounts)) {
  if (q[0] == '!')
    return accounts.filter(a => a == q.substring(1)).sort();
  return accounts.filter(a => fzy_compare(q, a)).sort();
}

function fzy_compare(q, acc) {
  let rgx = fzy_compile(q);
  return !!acc.match(rgx);
}

function fzy_compile(q) {
  if (q.indexOf('\\v') == 0)
    return new RegExp(q.substring(2));
  q = ("^[^.]*" + q
    .replace(/\*/g, '␞')
    .replace(/\./g, '[^.]*\\.[^.]*')
    .replace(/([a-z])/gi, '[^.]*$1[^.]*') + '[^.]*$')
    .replace(/\[\^\.\]\*\[\^\.\]\*/g, '[^.]*')
    .replace(/\[\^\.\]\*\.\*/g, '.*')
    .replace(/␞/g, '.*?');

  return new RegExp(q, 'i');
}

function isArgAccount(v) {
  let len = v.length;
  while (len--)
    switch (v[len]) {
      case ".":
      case "*":
      case "|":
      case "$":
      case "!":
        return true;
    }
  return v.indexOf('\\v') == 0;
}
