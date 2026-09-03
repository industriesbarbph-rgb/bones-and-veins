import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const json = p => JSON.parse(read(p));
const failures = [];
const pass = msg => console.log(`PASS  ${msg}`);
const fail = msg => { failures.push(msg); console.error(`FAIL  ${msg}`); };
const assert = (condition, msg) => condition ? pass(msg) : fail(msg);

const required = [
  'index.html', 'app.js', 'styles.css', 'privacy.html', 'robots.txt',
  'registry.json', 'config/runtime.json', 'netlify.toml',
  '.github/workflows/health-scan.yml', 'scripts/scan-health.mjs',
  'scripts/build-ai-package.mjs'
];
for (const file of required) assert(fs.existsSync(path.join(root, file)), `required file exists: ${file}`);

const registry = json('registry.json');
const runtime = json('config/runtime.json');
const index = read('index.html');
const netlify = read('netlify.toml');
const workflow = read('.github/workflows/health-scan.yml');
const gitignore = read('.gitignore');

const props = registry.properties || [];
assert(props.length === 20, `registry contains exactly 20 monitored properties (found ${props.length})`);
assert(props.every(p => typeof p.url === 'string' && /^https:\/\//.test(p.url)), 'every monitored property has an HTTPS URL');
assert(new Set(props.map(p => p.id)).size === props.length, 'registry IDs are unique');
assert(new Set(props.map(p => p.url)).size === props.length, 'registered monitoring URLs are unique');
assert(registry.machine?.curePolicy === 'approval_required', 'cure policy is approval_required');
assert(registry.machine?.publishPolicy === 'separate_approval_required', 'publish approval is separate from cure approval');
assert(registry.machine?.publicUrl === 'https://seohealth.barbph.com', 'deployment target is seohealth.barbph.com');
assert(registry.machine?.searchConsoleProperty === 'sc-domain:barbph.com', 'Search Console property is sc-domain:barbph.com');

const clientId = runtime.google?.clientId || '';
assert(/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/i.test(clientId), 'Google OAuth public Client ID is configured');
assert(runtime.google?.scope === 'https://www.googleapis.com/auth/webmasters.readonly', 'Google OAuth scope is read-only Search Console');
assert(runtime.google?.mode === 'interactive_browser', 'Google authorization mode is interactive browser');
assert(!JSON.stringify(runtime).toLowerCase().includes('clientsecret'), 'runtime config contains no Google Client Secret field');
assert(!JSON.stringify(runtime).toLowerCase().includes('refresh_token'), 'runtime config contains no refresh token');

assert(/noindex,nofollow,noarchive/i.test(index.replace(/\s+/g, '')), 'dashboard HTML declares noindex/nofollow/noarchive');
assert(index.includes('GOOGLE SEARCH CONSOLE'), 'Google Search Console bay exists');
assert(index.includes('BONES &amp; VEINS SYSTEM'), 'BONES & VEINS system bay exists');
assert(index.includes('FINDINGS / DIAGNOSIS / CURES'), 'findings/diagnosis/cures bay exists');
assert(index.includes('WARNING / SEO ATTENTION'), 'warning language distinguishes SEO attention from outage fault');

assert(netlify.includes('X-Robots-Tag = "noindex, nofollow, noarchive"'), 'Netlify sends crawler-blocking header');
assert(netlify.includes('Content-Security-Policy'), 'Content Security Policy is configured');
assert(netlify.includes('https://accounts.google.com'), 'CSP allows Google Identity Services');
assert(netlify.includes('https://raw.githubusercontent.com'), 'CSP allows live GitHub health stream');
assert(netlify.includes('Cross-Origin-Opener-Policy = "same-origin-allow-popups"'), 'OAuth popup-compatible COOP header is configured');

assert(workflow.includes('cron: "17 * * * *"'), 'hourly scheduled health scan is configured');
assert(workflow.includes('"registry.json"'), 'registry changes trigger immediate health scan');
assert(workflow.includes('[skip netlify]'), 'generated health commits explicitly skip Netlify deploys');
assert(!workflow.toLowerCase().includes('netlify deploy'), 'health workflow contains no Netlify deploy command');

assert(gitignore.includes('.env'), '.env files are ignored');
assert(gitignore.toLowerCase().includes('source-map.private'), 'private source mapping is ignored');

const publicText = [index, read('app.js'), read('styles.css'), read('registry.json'), read('config/runtime.json'), netlify].join('\n');
const forbiddenPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /AIza[0-9A-Za-z_-]{30,}/,
  /gh[pousr]_[0-9A-Za-z]{30,}/,
  /sk-[0-9A-Za-z_-]{20,}/
];
assert(!forbiddenPatterns.some(r => r.test(publicText)), 'public runtime files contain no obvious private key/token patterns');

if (failures.length) {
  console.error(`\nPRE-FLIGHT BLOCKED — ${failures.length} failure(s).`);
  process.exit(1);
}
console.log('\nPRE-FLIGHT PASS — BONES & VEINS is structurally ready for the deployment gate.');
