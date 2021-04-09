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

function sys_execSync(cmd, args, cwd=fs_get_book_directory(), stdio='inherit', input) {
  return child_process.spawnSync(cmd, args, {
    cwd: cwd,
    env: process.env,
    stdio: stdio,
    input: input
  });
}


let _old_console_log = console.log;
let _sys_log_buffer = '';
let buf_lines = 0;
function _sys_consolelog(...str) {
  str = str.join(" ");
  buf_lines += (str.match(/\n/g) || '').length + 1;
  _sys_log_buffer += str + "\n";
}

function sys_log_startBuf() {
  if (cli_args.flags.csv) return;
  _sys_log_buffer = '';
  buf_lines = 0;
  console.log = _sys_consolelog;
}

function sys_log_rlsBuf() {
  if (cli_args.flags.csv) return;
  if (buf_lines > process.stdout.rows)
    child_process.spawnSync('less', ['-r', '-S', '+G', '-'], {
      input: _sys_log_buffer,
      stdio: ['pipe', 'inherit', 'inherit']
    });
  else
    process.stdout.write(_sys_log_buffer);
  _sys_log_buffer = '';
  buf_lines = 0;
  console.log = _old_console_log;
}

