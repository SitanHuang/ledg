var child_process = require('child_process');

function sys_spawn_editor(path, cwd=fs_get_book_directory()) {
  let EDITOR = process.env.EDITOR || 'vim';
  let args2 = EDITOR == 'vim' ? ['+autocmd BufRead,BufNewFile *.*.ledg setlocal ts=55 sw=55 expandtab! softtabstop=-1 nowrap listchars="tab:→\ ,nbsp:␣,trail:•,extends:⟩,precedes:⟨" list noautoindent nocindent nosmartindent indentexpr=', path] : [path];

  return child_process.spawn(EDITOR, args2, {
    cwd: cwd,
    env: process.env,
    stdio: 'inherit'
  });
}

function sys_execSync(cmd, args, cwd=fs_get_book_directory()) {
  return child_process.spawnSync(cmd, args, {
    cwd: cwd,
    env: process.env,
    stdio: 'inherit'
  });
}
