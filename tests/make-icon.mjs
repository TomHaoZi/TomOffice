import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tom-icon-'));
const app = await electron.launch({ args: ['.'], env: { ...process.env, TOM_OFFICE_TEST_PROFILE: dir } });
try {
  const page = await app.firstWindow();
  await page.getByRole('heading', { name: '你好，今天想创造些什么？' }).waitFor();
  const svg = await fs.readFile('assets/icon.svg', 'utf8');
  await page.evaluate(svg => { document.body.innerHTML = `<div id="icon" style="width:256px;height:256px">${svg}</div>`; document.body.style.background = 'transparent'; document.documentElement.style.background = 'transparent'; }, svg);
  const png = await page.locator('#icon').screenshot({ omitBackground: true }); await fs.writeFile('assets/icon.png', png);
  const header = Buffer.alloc(22); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4); header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
  await fs.writeFile('assets/icon.ico', Buffer.concat([header, png]));
} finally { await app.close(); await fs.rm(dir, { force: true, recursive: true }); }
