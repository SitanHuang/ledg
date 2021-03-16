var data = null;

function data_init_data() {
  data = {
    accounts: {},
    books: {}, // { 2019: [ ... ], 2020: [ ... ], ...  }
    booksOpened: {}
  };
  return data;
}

data_init_data();

async function data_open_books(books) {
  for (let y of books) {
    if (data.booksOpened[y] >= DATA_BOOK_OPENED) continue;
    await fs_read_book(y);
    data.booksOpened[y] = Math.max(DATA_BOOK_OPENED, data.booksOpened[y]); // fs_read_book could set it to dirty
  }
}

function data_books_required(d1, d2) {
  d1 = new Date(d1).getFullYear();
  if (!d2) return d1;
  d2 = new Date(d2).getFullYear();
  let yr = [];
  for (let i=d1; i<=d2; i++) {
    yr.push(i);
  }
  return yr;
}

async function data_remove_entry(entry) {
  let y = new Date(entry.time * 1000).getFullYear();
  await data_open_books([y]);
  data.books[y] = data.books[y].filter(x => x.uuid != entry.uuid);
  data.booksOpened[y] = DATA_BOOK_DIRTY;
}

async function data_remove_entry(entry) {
  let y = new Date(entry.time * 1000).getFullYear();
  await data_open_books([y]);
  let book = data.books[y];
  for (let i = 0;i < book.length;i++) {
    if (book[i].uuid == entry.uuid) {
      data.booksOpened[y] = DATA_BOOK_DIRTY;
      book.splice(i, 1);
      return;
    }
  }
}

async function data_modify_entry(entry) {
  let y = new Date(entry.time * 1000).getFullYear();
  await data_open_books([y]);
  /* let range = await fs_get_data_range();
   * await data_open_books(range);
   * 
   * (being able to edit means the entry must've been opened already)
   */
  FOR: for (let year in data.books) {
    let book = data.books[year];
    for (let i = 0;i < book.length;i++) {
      if (book[i].uuid == entry.uuid) {
        data.booksOpened[y] = DATA_BOOK_DIRTY;
        data.booksOpened[year] = DATA_BOOK_DIRTY;
        if (year == y) { // same book just update entry
          book[i] = entry;
          return;
        } else {
          // remove old
          book.splice(i, 1);
          // add new
          data.books[y].push(entry);
          return;
        }
      }
    }
  }
}

async function data_push_entry(entry) {
  let y = new Date(entry.time * 1000).getFullYear();
  await data_open_books([y]);
  data.books[y] = data.books[y] || [];
  data.books[y].push(entry);
  for (let t of entry.transfers) {
    let acc = t[1];
    data.accounts[acc] = 1;
  }
  data.booksOpened[y] = DATA_BOOK_DIRTY;
}

async function data_push_entries(entries) {
  let min, max;
  min = max = new Date().getTime() / 1000;
  for (let e of entries) {
    min = Math.min(min, e.time);
    max = Math.max(max, e.time);
  }
  await data_open_books(data_books_required(min * 1000, max * 1000));
  for (let e of entries)
    await data_push_entry(e);
}

async function data_iterate_books(books, callback, afterOpenCallback) {
  await data_open_books(books);
  if (afterOpenCallback) await afterOpenCallback();
  for (let b of books) {
    let book = data.books[b];
    if (await callback(book) == DATA_CALLBACK_STOP) break;
  }
}

/*
 * =====================================
 * Constants
 * =====================================
 */
DATA_BOOK_OPENED = 1;
DATA_BOOK_DIRTY = 2;

DATA_CALLBACK_STOP = 999;

/*
 * ======================================
 * Runtime infos
 * ======================================
 */
var data_acc_imb = 'Imbalance';
