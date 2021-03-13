var fs = require('fs');

// bin/ledger is included here:
const TEST = true; // prevent CLI from running
eval(fs.readFileSync('bin/ledger').toString());


let entry = entry_create(
  "Test",
  [
    ["1", "Expense.Taxes.Federal", 2000.02],
    ["2", "Assets.Checking", -500],
    ["3", "Liability.CC", -1449.51]
  ],
  { goose: 3.14159 });
let y = new Date().getFullYear();

var assert = require('assert');
describe('Entry', function() {
  describe('#entry_create', function() {
    it('Should create Imbalance', function() {
      assert.equal(entry.transfers.length, 4);
      assert.equal(entry.transfers[3][2], -50.51);
    });
    it('Should be balanced', function() {
      assert.equal(entry_check_balance(entry.transfers), 0);
    });
    it('Should assign opts', function() {
      assert.equal(entry.goose, 3.14159);
    });
    it('Should have 8 char uuid', function() {
      assert.equal(entry.uuid.length, 8);
    });
  });
});

describe('Data', function () {
  describe('#data_open_books', function() {
    it('Should have 2017-2022 opened', async function() {
      await data_open_books(data_books_required(Date.parse('2017-3-5'), Date.parse('2021-3-5')));
      assert.equal(data.booksOpened[2017], DATA_BOOK_OPENED);
      assert.equal(data.booksOpened[2018], DATA_BOOK_OPENED);
      assert.equal(data.booksOpened[2019], DATA_BOOK_OPENED);
      assert.equal(data.booksOpened[2020], DATA_BOOK_OPENED);
      assert.equal(data.booksOpened[2021], DATA_BOOK_OPENED);
      assert.equal(typeof data.booksOpened[2022], 'undefined');
      await data_open_books(data_books_required(Date.parse('2017-3-5'), Date.parse('2022-3-5')));
      assert.equal(data.booksOpened[2017], DATA_BOOK_OPENED);
      assert.equal(data.booksOpened[2018], DATA_BOOK_OPENED);
      assert.equal(data.booksOpened[2019], DATA_BOOK_OPENED);
      assert.equal(data.booksOpened[2020], DATA_BOOK_OPENED);
      assert.equal(data.booksOpened[2021], DATA_BOOK_OPENED);
      assert.equal(data.booksOpened[2022], DATA_BOOK_OPENED);
    });
  });
  describe('#data_push_entry', function () {
    it('Should set dirty and push', async function() {
      await data_push_entry(entry);
      assert.equal(data.booksOpened[y], DATA_BOOK_DIRTY);
      assert.equal(data.books[y][0], entry);
    });
  });
  describe('#data_push_entries', function () {
    it('Should open books in between and push entries', async function() {
      data_init_data();
      let entries = [entry];
      entries.push(JSON.parse(JSON.stringify(entry)));
      entries[1].time = Date.parse('2017-01-11') / 1000 + 1;
      await data_push_entries(entries);
      assert.equal(data.booksOpened[y], DATA_BOOK_DIRTY);
      assert.equal(data.booksOpened[2020], DATA_BOOK_OPENED);
      assert.equal(typeof data.booksOpened[y + 1], 'undefined');
      assert.equal(data.booksOpened[2017], DATA_BOOK_DIRTY);
      assert.equal(data.books[y][0], entries[0]);
      assert.equal(data.books[2017][0], entries[1]);
    });
  });
});
