import fs from 'node:fs/promises';

const reg = JSON.parse(await fs.readFile('registry.json', 'utf8'));
const priorHealth = JSON.parse(await fs.readFile('data/health.json', 'utf8').catch(() => '{"properties":[]}'));
const reliability = JSON.parse(await fs.readFile('data/reliability.json', 'utf8').catch(() => '{"schemaVersion":1,"properties":{}}'));
const ledger = JSON.parse(await fs.readFile('data/ledger.json', 'utf8').catch(() => '{"schemaVersion":1,"entries":[]}'));

const now = new Date().toISOString();
const out = {
  generatedAt: now,
  source: 'BONES & VEINS',
  status: 'complete',
  reliabilityPolicy: 'single network misses never become FAULT; repeated failures are escalated across scheduled runs',
  summary: { total: reg.properties.length, healthy: 0, thriving: 0, observing: 0, warning: 0, fault: 0 },
  properties: []
};

const BASE_HEADERS = {
  'user-agent': 'BonesAndVeinsSEOHealth/1.0 (+https://seohealth.barbph.com)',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.8',
  'cache-control': 'no-cache'
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const escRE = v => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalize = u => {
  try {
    const x = new URL(u);
    x.hash = '';
    return x.href.replace(/\/$/, '');
  } catch {
    return u || '';
  }
};
const title = html => html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || null;
const canonical = html => html.match(/<link\b(?=[^>]*\brel=["'][^"']*canonical[^"']*["'])[^>]*\bhref=["']([^"']+)["'][^>]*>/i)?.[1] || null;
function textMeta(html, name, attr = 'name') {
  const r = new RegExp(`<meta\\b(?=[^>]*\\b${attr}=["']${escRE(name)}["'])[^>]*\\bcontent=["']([^"']*)["'][^>]*>`, 'i');
  return html.match(r)?.[1] || null;
}

async function timedFetch(url, timeoutMs = 12000) {
  const started = Date.now();
  const response = await fetch(url, {
    redirect: 'follow',
    headers: BASE_HEADERS,
    signal: AbortSignal.timeout(timeoutMs)
  });
  return { response, durationMs: Date.now() - started };
}

async function fetchWithConfirmation(url) {
  const attempts = [];
  const delays = [0, 1200, 3500];
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await sleep(delays[i]);
    try {
      const { response, durationMs } = await timedFetch(url, i === 0 ? 10000 : 15000);
      attempts.push({ attempt: i + 1, ok: response.ok, status: response.status, finalUrl: response.url, durationMs });
      return { reachable: true, response, attempts };
    } catch (error) {
      attempts.push({ attempt: i + 1, transportError: error?.name || 'Error', message: String(error?.message || error) });
    }
  }
  return { reachable: false, response: null, attempts };
}

function previousRunFor(id) {
  return priorHealth.properties?.find(p => p.id === id) || null;
}

function reliabilityFor(id) {
  return reliability.properties[id] || {
    consecutiveTransportFailures: 0,
    consecutiveSuccessfulRuns: 0,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastConfirmedStatus: null
  };
}

function updateReliability(id, reachable, status = null) {
  const r = reliabilityFor(id);
  if (reachable) {
    r.consecutiveTransportFailures = 0;
    r.consecutiveSuccessfulRuns = (r.consecutiveSuccessfulRuns || 0) + 1;
    r.lastSuccessAt = now;
    r.lastConfirmedStatus = status;
  } else {
    r.consecutiveTransportFailures = (r.consecutiveTransportFailures || 0) + 1;
    r.consecutiveSuccessfulRuns = 0;
    r.lastFailureAt = now;
  }
  reliability.properties[id] = r;
  return r;
}

function addFinding(item, code, severity, diagnosis, cure, evidence = {}) {
  item.findings.push({ code, severity, diagnosis, cure, evidence });
}

async function scanAuxiliary(origin, item) {
  const [robotsResult, sitemapResult] = await Promise.all([
    fetchWithConfirmation(origin + '/robots.txt'),
    fetchWithConfirmation(origin + '/sitemap.xml')
  ]);

  if (robotsResult.reachable) {
    const robots = robotsResult.response;
    item.checks.robotsTxtStatus = robots.status;
    item.checks.robotsTxtPresent = robots.ok;
    if (robots.ok) {
      const txt = await robots.text();
      if (/^\s*User-agent:\s*\*[\s\S]*?^\s*Disallow:\s*\/\s*$/im.test(txt)) {
        addFinding(
          item,
          'ROBOTS_BLOCK_ALL',
          'fault',
          'robots.txt appears to block the entire site for general crawlers.',
          'Review robots.txt and remove the global block only if this product is intended to be publicly crawlable.',
          { status: robots.status }
        );
      }
    }
  } else {
    item.checks.robotsTxtStatus = 'unconfirmed';
  }

  if (sitemapResult.reachable) {
    item.checks.sitemapStatus = sitemapResult.response.status;
    item.checks.sitemapPresent = sitemapResult.response.ok;
  } else {
    item.checks.sitemapStatus = 'unconfirmed';
  }
}

async function scanOne(p) {
  const item = {
    id: p.id,
    name: p.name,
    url: p.url,
    state: 'observing',
    label: 'OBSERVING',
    checks: {},
    findings: []
  };

  if (!p.url) {
    item.state = 'warning';
    item.label = 'REGISTRATION INCOMPLETE';
    addFinding(
      item,
      'LIVE_URL_MISSING',
      'warning',
      'This published product is registered but has no live URL configured for monitoring.',
      'Add the intended live product URL to the registry after confirming the correct destination.'
    );
    return item;
  }

  const live = await fetchWithConfirmation(p.url);
  item.checks.networkAttempts = live.attempts;

  if (!live.reachable) {
    const rel = updateReliability(p.id, false);
    item.checks.consecutiveTransportFailures = rel.consecutiveTransportFailures;
    item.checks.lastConfirmedSuccessAt = rel.lastSuccessAt;

    if (rel.consecutiveTransportFailures >= 3) {
      item.state = 'fault';
      item.label = 'CONFIRMED UNREACHABLE';
      addFinding(
        item,
        'SITE_UNREACHABLE_CONFIRMED',
        'fault',
        `The live URL failed all retry attempts across ${rel.consecutiveTransportFailures} consecutive scheduled scans.`,
        'Review DNS, TLS, hosting availability and the registered URL before approving any production action.',
        { consecutiveRuns: rel.consecutiveTransportFailures, attemptsThisRun: live.attempts }
      );
    } else if (rel.consecutiveTransportFailures === 2) {
      item.state = 'warning';
      item.label = 'RECHECKING NETWORK';
      addFinding(
        item,
        'SITE_REACHABILITY_UNCONFIRMED',
        'warning',
        'The scanner could not establish a connection for a second consecutive scheduled scan. This is not yet classified as a confirmed outage.',
        'Continue confirmation. Inspect hosting/DNS only if the next scheduled scan also fails.',
        { consecutiveRuns: rel.consecutiveTransportFailures, attemptsThisRun: live.attempts }
      );
    } else {
      item.state = 'observing';
      item.label = 'NETWORK RECHECK PENDING';
      addFinding(
        item,
        'NETWORK_RECHECK_PENDING',
        'observing',
        'The scanner could not connect during this run. A single transport failure is not treated as a product fault.',
        'No cure is proposed yet. Wait for confirmation from a later scheduled scan.',
        { attemptsThisRun: live.attempts }
      );
    }
    return item;
  }

  const response = live.response;
  const rel = updateReliability(p.id, true, response.status);
  item.checks.httpStatus = response.status;
  item.checks.finalUrl = response.url;
  item.checks.responseTimeMs = live.attempts.at(-1)?.durationMs ?? null;
  item.checks.consecutiveSuccessfulRuns = rel.consecutiveSuccessfulRuns;
  item.checks.lastConfirmedSuccessAt = rel.lastSuccessAt;

  if (response.status === 404 || response.status === 410) {
    addFinding(item, 'LIVE_URL_NOT_FOUND', 'fault', `The registered live URL returned HTTP ${response.status}.`, 'Restore the intended live page or approve a registry correction to the current canonical URL.', { status: response.status });
  } else if (response.status >= 500) {
    addFinding(item, 'SERVER_ERROR', 'warning', `The live URL returned HTTP ${response.status}.`, 'Observe the next scan and investigate hosting/server logs if the response persists.', { status: response.status });
  } else if (response.status >= 400) {
    addFinding(item, 'HTTP_ACCESS_PROBLEM', 'warning', `The live URL returned HTTP ${response.status}.`, 'Review public accessibility and whether this product is intended to be crawlable.', { status: response.status });
  }

  const ct = response.headers.get('content-type') || '';
  item.checks.contentType = ct;

  if (response.ok && ct.includes('text/html')) {
    const html = await response.text();
    item.checks.title = title(html);
    item.checks.description = textMeta(html, 'description');
    item.checks.canonical = canonical(html);
    item.checks.robots = textMeta(html, 'robots');

    if (!item.checks.title) addFinding(item, 'TITLE_MISSING', 'warning', 'HTML page has no readable title element.', 'Add a unique, product-specific title.');
    if (!item.checks.description) addFinding(item, 'META_DESCRIPTION_MISSING', 'warning', 'Meta description is missing.', 'Add a concise, product-specific meta description.');
    if (item.checks.robots && /noindex/i.test(item.checks.robots)) addFinding(item, 'UNEXPECTED_NOINDEX', 'fault', 'Page declares noindex while this registry entry is marked as a published public product.', 'Remove noindex only after confirming this product should be visible in Google.');
    if (item.checks.canonical && normalize(item.checks.canonical) !== normalize(p.url)) addFinding(item, 'CANONICAL_MISMATCH', 'warning', `Declared canonical ${item.checks.canonical} differs from registered URL ${p.url}.`, 'Review which URL is authoritative; only then update the page or registry.');
    if (!item.checks.canonical) addFinding(item, 'CANONICAL_MISSING', 'warning', 'No canonical link was found.', 'Add a self-referencing canonical for the approved public URL.');
  }

  await scanAuxiliary(new URL(p.url).origin, item);

  const hasFault = item.findings.some(x => x.severity === 'fault');
  const hasWarn = item.findings.some(x => x.severity === 'warning');
  item.state = hasFault ? 'fault' : hasWarn ? 'warning' : 'healthy';
  item.label = item.state.toUpperCase();

  const prev = previousRunFor(p.id);
  if (item.state === 'healthy' && prev?.state === 'healthy' && rel.consecutiveSuccessfulRuns >= 3) {
    item.state = 'thriving';
    item.label = 'THRIVING';
  }

  return item;
}

for (let i = 0; i < reg.properties.length; i += 4) {
  const batch = await Promise.all(reg.properties.slice(i, i + 4).map(scanOne));
  out.properties.push(...batch);
}

for (const item of out.properties) out.summary[item.state] = (out.summary[item.state] || 0) + 1;

reliability.generatedAt = now;
ledger.entries.push({
  at: now,
  type: 'HEALTH_SCAN',
  message: `Scanned ${reg.properties.length} properties: ${out.summary.thriving} thriving, ${out.summary.healthy} healthy, ${out.summary.observing} observing, ${out.summary.warning} warning, ${out.summary.fault} fault.`
});
ledger.entries = ledger.entries.slice(-1000);

await fs.writeFile('data/health.json', JSON.stringify(out, null, 2) + '\n');
await fs.writeFile('data/reliability.json', JSON.stringify(reliability, null, 2) + '\n');
await fs.writeFile('data/ledger.json', JSON.stringify(ledger, null, 2) + '\n');
console.log(JSON.stringify(out.summary));
