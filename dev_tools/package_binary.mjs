import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(__dirname, '..'); // adjust if dev_tools folder sits under root
  const binaryRelPath = path.join('bin', 'ledg2.cjs');
  const binaryPath = path.join(projectRoot, binaryRelPath);

  let contents;
  try {
    contents = await fs.readFile(binaryPath, 'utf8');
  } catch (err) {
    console.error(`[package_binary] Failed to read ${binaryRelPath}:`, err);
    process.exitCode = 1;
    return;
  }

  const shebang = '#!/usr/bin/env node';
  const lines = contents.split(/\r?\n/);

  // Ensure the correct shebang is the very first line
  if (lines[0]?.startsWith('#!')) {
    if (lines[0] !== shebang) {
      lines[0] = shebang;
    }
  } else {
    lines.unshift(shebang);
  }

  const newContents = lines.join('\n');

  if (newContents !== contents) {
    await fs.writeFile(binaryPath, newContents, 'utf8');
    console.log(`[package_binary] Applied Node.js shebang to ${binaryRelPath}`);
  } else {
    console.log(`[package_binary] Correct shebang already present in ${binaryRelPath}`);
  }

  // On POSIX systems ensure executable bit
  if (process.platform !== 'win32') {
    try {
      const stat = await fs.stat(binaryPath);
      const desiredMode = 0o755;
      if ((stat.mode & 0o111) !== 0o111) {
        fsSync.chmodSync(binaryPath, desiredMode);
        console.log(`[package_binary] Set executable mode (755) on ${binaryRelPath}`);
      }
    } catch (err) {
      console.error(`[package_binary] Failed to chmod ${binaryRelPath}:`, err);
      process.exitCode = 1;
    }
  } else {
    console.log('[package_binary] Skipping chmod on Windows');
  }
}

main();