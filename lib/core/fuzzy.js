function fzy_query_account(q) {
  return Object.keys(data.accounts).filter(a => fzy_compare(q, a));
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
