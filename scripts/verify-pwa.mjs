import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('dist/chemmanoor-erp/browser/', root);
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
const pkg = await json(new URL('package.json', root));
const manifest = await json(new URL('manifest.webmanifest', output));
const worker = await json(new URL('ngsw.json', output));
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.start_url, '/');
assert.equal(worker.appData.version, pkg.version);
assert.deepEqual(worker.dataGroups, [], 'ERP API responses must not be cached');
assert(manifest.icons.some((icon) => icon.sizes === '192x192'));
assert(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable'));
for (const icon of manifest.icons) {
  const bytes = await readFile(new URL(icon.src.replace(/^\//, ''), output));
  const [width, height] = icon.sizes.split('x').map(Number);
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG');
  assert.equal(bytes.readUInt32BE(16), width);
  assert.equal(bytes.readUInt32BE(20), height);
}
for (const [path, expected] of Object.entries(worker.hashTable)) {
  const bytes = await readFile(new URL(path.replace(/^\//, ''), output));
  assert.equal(
    createHash('sha1').update(bytes).digest('hex'),
    expected,
    `Worker cache hash: ${path}`,
  );
}
console.log(
  `Verified PWA v${pkg.version}: icons, release metadata and ${Object.keys(worker.hashTable).length} cached assets.`,
);
