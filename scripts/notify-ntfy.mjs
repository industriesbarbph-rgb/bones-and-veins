import fs from 'node:fs/promises';

const topic = (process.env.NTFY_TOPIC || '').trim();
const server = (process.env.NTFY_SERVER || 'https://ntfy.sh').replace(/\/$/, '');
const consoleUrl = process.env.NTFY_CONSOLE_URL || 'https://seohealth.barbph.com/';
const previousPath = process.env.PREV_HEALTH_PATH || '/tmp/health-before.json';
const testMode = ['1', 'true', 'yes'].includes(String(process.env.NTFY_TEST || '').toLowerCase());

if (!topic) {
  console.log('NTFY_TOPIC is not configured; skipping ntfy alerts.');
  process.exit(0);
}

const readJson = async (path, fallback) => {
  try {
    return JSON.parse(await fs.readFile(path, 'utf8'));
  } catch {
    return fallback;
  }
};

const current = await readJson('data/health.json', { properties: [] });
const previous = await readJson(previousPath, { properties: [] });

const prevById = new Map((previous.properties || []).map(p => [p.id, p]));
const rank = { thriving: 0, healthy: 0, observing: 1, warning: 2, fault: 3 };
const isHealthy = s => s === 'healthy' || s === 'thriving';
const findingCodes = p => new Set((p?.findings || []).map(f => f.code).filter(Boolean));

const faults = [];
const warnings = [];
const recoveries = [];

for (const now of current.properties || []) {
  const before = prevById.get(now.id);
  if (!before) continue;

  const beforeState = before.state || 'observing';
  const nowState = now.state || 'observing';
  const oldCodes = findingCodes(before);
  const newCodes = [...findingCodes(now)].filter(code => !oldCodes.has(code));

  if (nowState === 'fault' && beforeState !== 'fault') {
    faults.push(`${now.name}: ${beforeState.toUpperCase()} → FAULT`);
    continue;
  }

  if (nowState === 'fault' && newCodes.length) {
    faults.push(`${now.name}: new fault finding ${newCodes.join(', ')}`);
    continue;
  }

  if (nowState === 'warning' && (rank[nowState] > (rank[beforeState] ?? 0))) {
    warnings.push(`${now.name}: ${beforeState.toUpperCase()} → WARNING`);
    continue;
  }

  if (nowState === 'warning' && beforeState === 'warning' && newCodes.length) {
    warnings.push(`${now.name}: new warning finding ${newCodes.join(', ')}`);
    continue;
  }

  if (isHealthy(nowState) && !isHealthy(beforeState)) {
    recoveries.push(`${now.name}: ${beforeState.toUpperCase()} → ${nowState.toUpperCase()}`);
    continue;
  }

  if (beforeState === 'fault' && nowState === 'warning') {
    recoveries.push(`${now.name}: FAULT → WARNING`);
  }
}

async function publish({ title, message, priority, tags }) {
  const response = await fetch(`${server}/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      topic,
      title,
      message,
      priority,
      tags,
      click: consoleUrl
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`ntfy publish failed: HTTP ${response.status} ${body}`.trim());
  }
}

const stamp = current.generatedAt ? new Date(current.generatedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : 'latest scan';

if (testMode) {
  await publish({
    title: 'BARBPH SEO ALERT ENGINE ONLINE',
    message: `ntfy is connected to the Electrocardiogram Console. Test sent: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}`,
    priority: 4,
    tags: ['white_check_mark', 'test_tube']
  });
}

if (faults.length) {
  await publish({
    title: 'BARBPH SEO FAULT',
    message: `${faults.slice(0, 6).join('\n')}\nDetected: ${stamp}${faults.length > 6 ? `\n+${faults.length - 6} more` : ''}`,
    priority: 5,
    tags: ['rotating_light', 'warning']
  });
}

if (warnings.length) {
  await publish({
    title: 'BARBPH SEO WARNING',
    message: `${warnings.slice(0, 6).join('\n')}\nDetected: ${stamp}${warnings.length > 6 ? `\n+${warnings.length - 6} more` : ''}`,
    priority: 4,
    tags: ['warning']
  });
}

if (recoveries.length) {
  await publish({
    title: 'BARBPH SEO RECOVERY',
    message: `${recoveries.slice(0, 6).join('\n')}\nDetected: ${stamp}${recoveries.length > 6 ? `\n+${recoveries.length - 6} more` : ''}`,
    priority: 3,
    tags: ['white_check_mark']
  });
}

if (!testMode && !faults.length && !warnings.length && !recoveries.length) {
  console.log('No alert-worthy SEO state changes; ntfy remains quiet.');
} else {
  console.log(`ntfy completed: test=${testMode}, ${faults.length} fault, ${warnings.length} warning, ${recoveries.length} recovery change(s).`);
}
