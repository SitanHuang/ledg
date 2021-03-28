let import_file_input = document.getElementById('file-input');

function import_callback(e) {
  var file = e.target.files[0];
  let promises = [];
  for (let file of e.target.files) {
    let filePromise = new Promise(resolve => {
      let reader = new FileReader();
      reader.readAsText(file);
      reader.onload = () => {
        if (file.name.match(/\.config\.ledg$/)) {
          let opts = JSON.parse(reader.result);
          Object.assign(data, opts.data);
          data_acc_imb = opts.data_acc_imb || data_acc_imb;
        } else if (file.name.match(/\.budgets\.ledg$/)) {
          data.budgets = fs_read_budgets_from_string(reader.result);
        } else {
          let entries = fs_read_entries_from_string(reader.result);
          for (let e of entries) {
            let year = new Date(e.time * 1000).getFullYear();
            (data.books[year] = data.books[year] || []).push(e);
            data.booksOpened[year] = DATA_BOOK_OPENED;
            _fs_entries_read++;
          }
        }
        resolve();
      }
    });
    promises.push(filePromise);
  }
  Promise.all(promises).then(() => {
    fs_get_data_range();
    ui_update_menu();
    notification.innerHTML = `Imported ${_fs_entries_read} entries.`;
    notification.opened = true;
  });
}

import_file_input.addEventListener('change', import_callback, false);