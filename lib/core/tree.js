var tree_c0 = "├";
// var tree_c1 = "─";
var tree_c2 = "└";
var tree_c3 = "│";

function expand_account(list=Object.keys(data.accounts)) {
  let data = [];
  let tree = {};
  for (let acc of list) {
    let levels = acc.split('.');
    let prnt = tree[levels[0]] || (tree[levels[0]] = {});
    for (let i = 1;i < levels.length;i++) {
      let l = levels[i];
      prnt = prnt[l] = (prnt[l] || {});
    }
  }

  _expand_account_subtree("", tree, data);
  return data;
}

function _expand_account_subtree(pre, t, fullList) {
  let keys = Object.keys(t);
  for (let i = 0;i < keys.length;i++) {
    fullList.push(pre + keys[i]);
    _expand_account_subtree(pre + keys[i] + '.', t[keys[i]], fullList);
  }
}

/*
 * takes in a list of accounts
 */
function print_accountTree(list) {
  let tree = {};
  let data = {list: [], fullList: [], maxLength: 0};
  list = list.sort();
  for (let acc of list) {
    let levels = acc.split('.');
    let prnt = tree[levels[0]] || (tree[levels[0]] = {});
    for (let i = 1;i < levels.length;i++) {
      let l = levels[i];
      prnt = prnt[l] = (prnt[l] || {});
    }
  }

  _print_accountTree_subtree("", tree, data);
  return data;
}

function _print_accountTree_subtree(pre, t, data, c3_col=[]) {
  let keys = Object.keys(t);
  for (let i = 0;i < keys.length;i++) {
    let prefix = '';
    for (let j = 0;j < c3_col.length;j++) {
      prefix += c3_col[j] ? tree_c3 + '  ' : '   ';
    }
    prefix += (i == keys.length - 1 ? tree_c2 : tree_c0);
    let row = prefix + keys[i];
    data.maxLength = Math.max(data.maxLength, row.length);
    data.list.push(row);
    data.fullList.push(pre + keys[i]);
    _print_accountTree_subtree(pre + keys[i] + '.', t[keys[i]], data, c3_col.concat([i != keys.length - 1]));
  }
}
