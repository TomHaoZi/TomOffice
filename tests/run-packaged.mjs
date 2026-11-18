import { spawnSync } from 'node:child_process';
for (const file of ['tests/desktop-smoke.mjs', 'tests/desktop-enhanced.mjs', 'tests/desktop-glass.mjs']) {
  const result = spawnSync(process.execPath, [file], { stdio: 'inherit', env: { ...process.env, TOM_OFFICE_PACKAGED: '1' } });
  if (result.status !== 0) process.exit(result.status || 1);
}
