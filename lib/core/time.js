function time_init_pricedb() {
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
    _fs_prices_read++;
  };
  // Date.parse('0000-01-01 00:00:00') / 1000
  const time = -62167190822;
  commitPrice({ c1: 'm', c2: 's', price: 60, time: time });
  commitPrice({ c1: 'h', c2: 'm', price: 60, time: time });
  commitPrice({ c1: 'd', c2: 'h', price: 24, time: time });

  commitPrice({ c1: 'h', c2: '$', price: 0, time: time });
}
