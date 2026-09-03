import fs from 'node:fs/promises';

const [registry, health, google, ledger, cures] = await Promise.all([
  'registry.json',
  'data/health.json',
  'data/google-search-console.json',
  'data/ledger.json',
  'data/cure-candidates.json'
].map(x => fs.readFile(x, 'utf8').then(JSON.parse)));

const out = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  machine: registry.machine,
  policy: {
    cure: 'APPROVAL REQUIRED',
    publish: 'SEPARATE APPROVAL REQUIRED'
  },
  registry: registry.properties.map(({ repo, ...p }) => p),
  health,
  cures,
  google,
  ledger
};

await fs.writeFile('data/ai-diagnostic-package.json', JSON.stringify(out, null, 2) + '\n');
