function fzy_query_account(q, accounts=Object.keys(data.accounts)) {
  if (q[0] == '!')
    return accounts.filter(a => a == q.substring(1)).sort();
  return accounts.filter(a => fzy_compare(q, a)).sort();
}

function fzy_compare(q, acc) {
  q = ("^[^.]*" + q
    .replace(/\*/g, '␞')
    .replace(/\./g, '[^.]*\\.[^.]*')
    .replace(/([a-z])/gi, '[^.]*$1[^.]*') + '[^.]*$')
    .replace(/\[\^\.\]\*\[\^\.\]\*/g, '[^.]*')
    .replace(/\[\^\.\]\*\.\*/g, '.*')
    .replace(/␞/g, '.*?');

  let rgx = new RegExp(q, 'i');
  return !!acc.match(rgx);
}

function isArgAccount(v) {
  let len = v.length;
  while (len--) {
    switch (v[len]) {
      case ".":
      case "*":
      case "$":
      case "!":
        return true;
    }
  }
  return false;
}
