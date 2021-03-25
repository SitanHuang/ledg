let import_file_input = document.getElementById('file-input');

function import_callback(e) {
  var file = e.target.files[0];
  let promises = [];
  for (let file of e.target.files) {
    let filePromise = new Promise(resolve => {
      let reader = new FileReader();
      reader.readAsText(file);
      reader.onload = () => resolve(reader.result);
    });
    promises.push(filePromise);
  }
  Promise.all(promises).then(fileContents => {
      for (let contents of fileContents) {
        let entries = fs_read_entries_from_string(contents);
        for (let e of entries) {
          let year = new Date(e.time * 1000).getFullYear();
          (data.books[year] = data.books[year] || []).push(e);
          _fs_entries_read++;
        }
      }
      notification.innerHTML = `Imported ${_fs_entries_read} entries.`;
      notification.opened = true;
  });
}

import_file_input.addEventListener('change', import_callback, false);