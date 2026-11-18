import { readFile, writeFile } from 'node:fs/promises';

// Add release metadata to the generated worker manifest without modifying source files.
const root = new URL('../', import.meta.url);
const { version } = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const manifestPath = new URL('dist/chemmanoor-erp/browser/ngsw.json', root);
try {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.appData = {
    version,
    build: process.env.GITHUB_SHA?.slice(0, 7) || 'local',
    builtAt: new Date().toISOString(),
  };
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`PWA release v${version} (${manifest.appData.build})`);
} catch (error) {
  // Development builds intentionally omit the service worker.
  if (error.code !== 'ENOENT') throw error;
}
