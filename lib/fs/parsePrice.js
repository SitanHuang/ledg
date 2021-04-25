var _fs_prices_read = 0;
async function fs_read_price(path) {
  let _start;
  if (DEBUG)
    _start = new Date();
  if (fs.existsSync(path)) {
    let fileStream = fs.createReadStream(path);

    let rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let price = null;
    const commitPrice = (price) => {
      let key = price.c1 + ',' + price.c2;
      let tree = data.prices[key] = data.prices[key] || new BTree();
      tree.put(price.time, new Big(price.price));
      // reverse
      key = price.c2 + ',' + price.c1;
      tree = data.prices[key] = data.prices[key] || new BTree();
      tree.reciprocal = true;
      tree.put(price.time, price.price ? new Big(1).div(price.price) : 0);

      data.priceGraph.addEdge(price.c1, price.c2);
    };

    for await (let line of rl)
      price = fs_read_price_proc_line(price, line, commitPrice);

    if (price)
      commitPrice(price)
  } else {
    throw new IOError(`Price file ${path} is not found.`);
  }
  if (DEBUG)
    console.debug(`Opened ${path} price table in ${new Date() - _start}ms, ${_fs_prices_read} prices read so far`);
}

function fs_read_price_proc_line(price, line, commitPrice) {
  line = line.trim();
  if (line[0] == ';')
    return price;
  if (line[0] == 'P') { // start price
    if (price)
      commitPrice(price);

    let match = line.match(/^P\s+(\d{4}-\d{2}-\d{2})\s+([^\d\s,\-.]+)\s+((-?[\d.]+)\s*([^\d\s,\-.]+)|([^\d\s,\-.]+)\s*(-?[\d.]+))\s*$/);

    if (!match) {
      if (err_ignores_list["invalid-price-declaration"])
        return price;
      throw new ParseError(`"${line}" is not a valid price declaration`);
    }

    let date = match[1];
    let cur1 = match[2];
    let cur2 = match[5] || match[6];
    let p = Number(match[4] || match[7]);

    price = {
      time: Date.parse(date + 'T00:00:00') / 1000 | 0,
      c1: cur1,
      c2: cur2,
      price: p
    };
  } else if (line.length) {
    if (err_ignores_list["invalid-price-declaration"])
      return price;
    throw new ParseError(`"${line}" is not a valid price declaration`);
  }
  return price;
}
