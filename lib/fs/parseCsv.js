
function fs_read_csv(file, callback) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(file)) {
      let fileStream = fs.createReadStream(file);

      let rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });
      
      rl.on('line', (line) => {
        try {
          callback(fs_csv2array(line))
        } catch (e) {
          reject(e);
          rl.close();
        }
      });
      rl.on('close', resolve);
    } else {
      reject(file + ' cannot be read.');
    }
  });
}

function fs_csv2array(text, delimeter=",") {
  let p = '', row = [''], ret = [row], i = 0, r = 0, s = !0, l;
  for (l of text) {
    if ('"' === l) {
      if (s && l === p)
        row[i] += l;
      s = !s;
    } else if (delimeter === l && s) {
      l = row[++i] = '';
    } else if ('\n' === l && s) {
        if ('\r' === p)
          row[i] = row[i].slice(0, -1);
        row = ret[++r] = [l = '']; i = 0;
    } else {
      row[i] += l;
    }
    p = l;
  }
  return ret;
};