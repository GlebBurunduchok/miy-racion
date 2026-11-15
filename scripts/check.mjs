/** Dependency-free project checks. Run from any current directory. */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
for (const file of [
  'build-single.mjs',
  'tests/unit.cjs',
  'tests/features.cjs',
  'tests/api.mjs',
  'tests/storage.cjs',
  'tests/dom.mjs'
]) {
  const result = spawnSync(process.execPath, [file], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('All project checks passed.');
