var fs = require('fs');

if (fs.existsSync('test/dump.2020.ledg')) fs.unlinkSync('test/dump.2020.ledg');
if (fs.existsSync('test/dump.2021.ledg')) fs.unlinkSync('test/dump.2021.ledg');

// bin/ledger is included here:
const TEST = true; // prevent CLI from running
eval(fs.readFileSync('bin/ledger').toString());
fs_book_name = 'test/book'


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
    it('Should auto balance last transfer', async function() {
      data_init_data();
      let e2 = entry_create("test2", [
        ['', "Expense.Food.Coffee", 25],
        ['', "Expense.Food", 50],
        ['', "Assets.Checking", -20.52],
        ['', "Liability.CreditCard", 0]
      ]);
      assert.equal(e2.transfers[3][2], -54.48);
    });
  });
});

describe('Data', function () {
  describe('#data_open_books', function() {
    it('Should have 2017-2022 opened', async function() {
      data_init_data();
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
  describe('#data_remove_entry', function() {
    it('Should remove entry', async function() {
      data_init_data();
      let entries = [entry, entry_create("Test2", [['', 'Exp', 0]])];
      entries.push(JSON.parse(JSON.stringify(entry)));
      entries[2].time = Date.parse('2017-01-11') / 1000 + 1;
      await data_push_entries(entries);
      assert.equal(data.books[y].length, 2);
      assert.equal(data.books[2017].length, 1);
      await data_remove_entry(entries[2]);
      assert.equal(data.books[2017].length, 0);
      await data_remove_entry(entries[1]);
      assert.equal(data.books[y].length, 1);
      assert.equal(data.books[y][0].description, "Test");
    });
    it('Should open book and set dirty', async function() {
      data_init_data();
      assert.ok(!data.books[y] && !data.booksOpened[y]);
      await data_remove_entry(entry);
      assert.ok(data.books[y]);
      assert.equal(data.booksOpened[y], DATA_BOOK_DIRTY);
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
    it('Should intialize accounts', async function() {
      data_init_data();
      await data_push_entry(entry);
      assert.ok(data.accounts["Expense.Taxes.Federal"]);
      assert.ok(data.accounts["Assets.Checking"]);
      assert.ok(data.accounts["Liability.CC"]);
    });
  });
});

describe('FS', function() {
  describe('#isNumberAtIndex', function() {
    it('Should identify numbers', function() {
      let str = '0123456789';
      for (let i = 0;i < str.length;i++)
        assert.ok(isNumberAtIndex(str, i));
      str = "a;l skdj;fak";
      for (let i = 0;i < str.length;i++)
        assert.ok(!isNumberAtIndex(str, i));
    });
  });
  describe('#fs_read_book, #fs_write_books', function() {
    it('Should parse entries and write all books', async function() {
      data_init_data();
      // await fs_read_book(2020);
      await data_open_books([2020]);
      assert.equal(data.books[2020][0].time * 1000, Date.parse('2020-03-14T00:00:00+00:00'));
      assert.equal(data.books[2020][0].description, "Test");
      assert.equal(data.books[2020][0].uuid, "UocjnJc1");
      assert.equal(data.books[2020][0].float, 3.14159);
      assert.equal(data.books[2020][0].string, "123");
      assert.equal(data.books[2020][0].array[0], 1);
      assert.equal(data.books[2020][0].array[2], 3);
      assert.equal(data.books[2020][0].transfers[3][0], '');
      assert.equal(data.books[2020][0].transfers[3][1], 'auto');
      assert.equal(data.books[2020][0].transfers[3][2], -50.51);

      assert.equal(data.books[2020][1].transfers[2][2], -1500);
      assert.equal(data.books[2020][1].transfers[2][1], data_acc_imb);
      assert.equal(data.books[2020][1].transfers[2][0], '');

      assert.equal(data.books[2020][2].transfers[3][2], -50.51);
      assert.equal(data.books[2020][2].transfers[3][1], 'auto');
      assert.equal(data.books[2020][2].transfers[3][0], 'some description; here asd 123');

      assert.equal(data.books[2020][3].time * 1000, Date.parse('2020-12-04T00:00:00+00:00'));
      assert.equal(data.books[2020][3].description, "public static void main(){}###");
      assert.equal(data.books[2020][3].uuid, "UocjnJc2");
      assert.equal(data.books[2020][3].float, 3.14159);
      assert.equal(data.books[2020][3].string, "123");
      assert.equal(data.books[2020][3].object.a, "b");
      assert.equal(data.books[2020][3].transfers[3][1], 'Imbalance1');
      assert.equal(data.books[2020][3].transfers[3][2], -50.5);

      data.booksOpened[2020] = DATA_BOOK_DIRTY;

      fs_book_name = 'test/dump';
      await data_push_entry(entry);

      // export
      await fs_write_books();
      await fs_write_config();
      assert.ok(fs.existsSync('test/dump.2020.ledg'));
      assert.ok(fs.existsSync('test/dump.2021.ledg'));
    });
  });
});
