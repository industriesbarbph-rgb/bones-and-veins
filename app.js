const $ = s => document.querySelector(s);
let registry = { properties: [], machine: {} };
let runtime = { google: {} };
let health = { properties: [], summary: {} };
let google = { properties: [], summary: {}, status: 'not_connected' };
let ledger = { entries: [] };
let ai = { reports: [] };
let googleAccessToken = null;

const fmt = n => n == null ? '—' : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
function startClock() {
  const c = $('#clock'), d = $('#dateStamp');
  const tick = () => {
    const n = new Date();
    c.textContent = n.toLocaleTimeString('en-GB', { hour12: false });
    d.textContent = n.toLocaleDateString('en-CA');
  };
  tick();
  setInterval(tick, 1000);
}

const norm = u => {
  try {
    const x = new URL(u);
    x.hash = '';
    return x.href.replace(/\/$/, '');
  } catch {
    return u || '';
  }
};

async function j(path, fallback) {
  try {
    const r = await fetch(path + (path.includes('?') ? '&' : '?') + 'v=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } catch {
    return fallback;
  }
}

async function jRemote(remoteUrl, localPath, fallback) {
  if (remoteUrl) {
    try {
      const r = await fetch(remoteUrl + (remoteUrl.includes('?') ? '&' : '?') + 'v=' + Date.now(), { cache: 'no-store' });
      if (r.ok) return await r.json();
    } catch {}
  }
  return j(localPath, fallback);
}

function statusFor(p) {
  const h = health.properties?.find(x => x.id === p.id);
  if (!p.url) return { state: 'warning', label: 'REGISTRATION INCOMPLETE' };
  return h || { state: 'observing', label: 'OBSERVING' };
}

function renderRegistry() {
  const el = $('#productList');
  el.innerHTML = '';
  registry.properties.forEach(p => {
    const s = statusFor(p);
    const d = document.createElement('div');
    d.className = 'product';
    d.innerHTML = `<div><strong>${esc(p.name)}</strong><div class="sub">${esc(p.url || 'NO LIVE URL CONFIGURED')}</div></div><span class="status ${s.state}">${esc((s.label || s.state).toUpperCase())}</span>`;
    d.onclick = () => showProduct(p, s);
    el.appendChild(d);
  });
}

function renderHealth() {
  const s = health.summary || {};
  $('#totalCount').textContent = s.total ?? registry.properties.length;
  $('#healthyCount').textContent = (s.healthy || 0) + (s.thriving || 0);
  $('#warningCount').textContent = s.warning || 0;
  $('#faultCount').textContent = s.fault || 0;
  $('#observingCount').textContent = s.observing ?? registry.properties.length;

  const faults = (health.properties || []).flatMap(p =>
    (p.findings || [])
      .filter(f => ['warning', 'fault'].includes(f.severity))
      .map(f => ({ ...f, property: p }))
  );

  $('#cureCount').textContent = faults.filter(f => f.cure).length;
  $('#faultBadge').textContent = `${faults.length} OPEN`;
  $('#faultList').innerHTML = faults.length ? '' : `<div class="tiny">No open faults.</div>`;

  faults.slice(0, 30).forEach(f => {
    const d = document.createElement('div');
    d.className = 'fault-card ' + (f.severity === 'fault' ? 'red' : '');
    d.innerHTML = `<div class="fault-title"><h4>${esc(f.property.name)} — ${esc(f.code)}</h4><span class="status ${f.severity}">${f.severity.toUpperCase()}</span></div><div class="mono">DIAGNOSIS: ${esc(f.diagnosis || '')}
PROPOSED CURE: ${esc(f.cure || 'Manual review required.')}
POLICY: APPROVAL REQUIRED</div><div class="controls section"><button class="btn primary">PREPARE CURE TICKET</button></div>`;
    d.querySelector('button').onclick = () => prepareCure(f);
    $('#faultList').appendChild(d);
  });

  const dominant = s.fault ? 'FAULT' : s.warning ? 'WARNING' : (s.healthy || s.thriving) ? 'HEALTHY' : 'OBSERVING';
  $('#overallHealth').textContent = dominant;
  setVeins(dominant.toLowerCase());
}

function setVeins(state) {
  document.querySelectorAll('.vein').forEach(v => {
    v.className.baseVal = 'vein ' + (state === 'healthy' ? '' : state);
  });
}

function renderGoogle() {
  const s = google.summary || {};
  $('#gscState').textContent = (google.status || 'not_connected').replaceAll('_', ' ').toUpperCase();
  $('#gClicks').textContent = fmt(s.clicks);
  $('#gImpressions').textContent = fmt(s.impressions);
  $('#gCtr').textContent = s.ctr == null ? '—' : (Number(s.ctr) * 100).toFixed(1) + '%';
  $('#gPosition').textContent = fmt(s.position);
  $('#gIndexed').textContent = s.indexed == null ? '—' : `${s.indexed}/${s.total || registry.properties.length}`;
  $('#gSitemap').textContent = (s.sitemapStatus || '—').toString().toUpperCase();
  $('#gProperty').textContent = google.property || registry.machine.searchConsoleProperty || '—';

  const b = $('#googleDetails');
  if (!runtime.google?.clientId) b.textContent = 'GOOGLE SETUP PENDING';
  else if (google.status === 'connected') b.textContent = 'VIEW GOOGLE BAY';
  else if (google.status === 'connecting') b.textContent = 'CONNECTING…';
  else b.textContent = 'CONNECT GOOGLE';
}

function renderLedger() {
  const e = ledger.entries || [];
  $('#ledgerCount').textContent = `${e.length} ENTRIES`;
  $('#ledger').innerHTML = e.length ? '' : `<div class="tiny">Ledger is empty until the first scanner run.</div>`;
  e.slice().reverse().slice(0, 100).forEach(x => {
    const d = document.createElement('div');
    d.className = 'ledger-row';
    d.innerHTML = `<time>${esc(x.at || '')}</time><br>${esc(x.type || 'EVENT')} — ${esc(x.message || '')}`;
    $('#ledger').appendChild(d);
  });
}

function renderAi() {
  const r = ai.reports || [];
  $('#aiState').textContent = (ai.status || 'not_connected').replaceAll('_', ' ').toUpperCase();
  $('#aiReports').textContent = r.length;
  $('#aiLast').textContent = r[0]?.at ? new Date(r[0].at).toLocaleDateString() : '—';
}

function showProduct(p, s) {
  const h = health.properties?.find(x => x.id === p.id);
  const g = google.properties?.find(x => x.id === p.id);
  show(`<h2>${esc(p.name)}</h2><div class="mono">LIVE URL: ${esc(p.url || 'NOT CONFIGURED')}
CATEGORY: ${esc(p.category || '—')}
BONES STATUS: ${esc((h?.state || s.state || 'observing').toUpperCase())}
GOOGLE INDEX: ${esc(g?.indexVerdict || 'PENDING GOOGLE CONNECTION')}
SOURCE MAPPING: ${esc((p.sourceMapping || 'pending').toUpperCase())}
CURE POLICY: APPROVAL REQUIRED
PUBLISH POLICY: SEPARATE APPROVAL REQUIRED</div>${h?.findings?.length ? '<h3>FINDINGS</h3>' + h.findings.map(x => `<div class="fault-card ${x.severity === 'fault' ? 'red' : ''}"><b>${esc(x.code)}</b><div class="mono">${esc(x.diagnosis || '')}</div></div>`).join('') : ''}`);
}

function prepareCure(f) {
  const ticket = {
    schemaVersion: 1,
    type: 'cure_approval_ticket',
    createdAt: new Date().toISOString(),
    property: { id: f.property.id, name: f.property.name, url: f.property.url },
    fault: { code: f.code, diagnosis: f.diagnosis },
    proposedCure: f.cure,
    consent: { cureApproved: false, publishApproved: false },
    guardrail: 'No source change may occur until cureApproved=true. No production publish may occur until publishApproved=true.'
  };

  show(`<h2>CURE TICKET</h2><div class="mono">${esc(JSON.stringify(ticket, null, 2))}</div><div class="controls section"><button class="btn primary" id="approveLocal">APPROVE CURE PREPARATION</button><button class="btn" id="downloadTicket">DOWNLOAD TICKET</button></div><p class="tiny">This approval is local to this browser until a secure cure gateway is connected. It cannot touch a product by itself.</p>`);
  $('#approveLocal').onclick = () => {
    ticket.consent.cureApproved = true;
    localStorage.setItem('bv-cure-' + Date.now(), JSON.stringify(ticket));
    alert('Cure preparation approved locally. No product or deployment was changed.');
  };
  $('#downloadTicket').onclick = () => download(JSON.stringify(ticket, null, 2), `bones-veins-cure-${f.property.id}.json`, 'application/json');
}

function show(html) {
  $('#modalContent').innerHTML = html;
  $('#modal').classList.add('open');
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function download(text, name, type = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function reportText() {
  const lines = [];
  lines.push('BONES & VEINS — BarbPH SEO Health');
  lines.push('Generated: ' + new Date().toISOString());
  lines.push('');
  lines.push('SOURCE: BONES & VEINS');
  lines.push(`Monitored: ${registry.properties.length}`);
  lines.push(`Healthy: ${$('#healthyCount').textContent} | Warning: ${$('#warningCount').textContent} | Fault: ${$('#faultCount').textContent}`);
  lines.push('');
  lines.push('SOURCE: GOOGLE SEARCH CONSOLE');
  lines.push(`Status: ${(google.status || 'not_connected').toUpperCase()}`);
  lines.push(`Clicks: ${$('#gClicks').textContent} | Impressions: ${$('#gImpressions').textContent} | CTR: ${$('#gCtr').textContent} | Avg Position: ${$('#gPosition').textContent}`);
  lines.push(`Indexed: ${$('#gIndexed').textContent} | Sitemap: ${$('#gSitemap').textContent}`);
  lines.push('');
  lines.push('PROPERTY HEALTH');
  registry.properties.forEach(p => {
    const s = statusFor(p);
    lines.push(`${p.name} | ${p.url || 'NO URL'} | ${(s.label || s.state).toUpperCase()}`);
  });
  lines.push('');
  lines.push('OPEN FINDINGS');
  (health.properties || []).forEach(p => (p.findings || []).forEach(f => {
    if (['warning', 'fault'].includes(f.severity)) lines.push(`${p.name} | ${f.code} | ${f.diagnosis || ''} | CURE: ${f.cure || 'Manual review'}`);
  }));
  lines.push('');
  lines.push('POLICY: ALL PRODUCTS = APPROVAL REQUIRED. PUBLISH REQUIRES SEPARATE APPROVAL.');
  return lines.join('\n');
}

function makePdf(text) {
  const lines = text.split('\n');
  const pages = [];
  for (let i = 0; i < lines.length; i += 48) pages.push(lines.slice(i, i + 48));
  const objs = [];
  const add = s => { objs.push(s); return objs.length; };
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
  const pageIds = [], contentIds = [];
  for (const pg of pages) {
    const content = ['BT', '/F1 9 Tf', '40 800 Td', '12 TL'];
    for (const line of pg) {
      const safe = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
      content.push(`(${safe.slice(0, 110)}) Tj`, 'T*');
    }
    content.push('ET');
    const stream = content.join('\n');
    contentIds.push(add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`));
    pageIds.push(add('PENDING'));
  }
  const pagesId = add('PENDING');
  pageIds.forEach((id, i) => objs[id - 1] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${contentIds[i]} 0 R >>`);
  objs[pagesId - 1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id => id + ' 0 R').join(' ')}] >>`;
  const catalog = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  let pdf = '%PDF-1.4\n', offs = [0];
  objs.forEach((o, i) => { offs.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offs.length; i++) pdf += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

function generatePdf() {
  const b = makePdf(reportText());
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = `BONES-VEINS-REPORT-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function copyAi() {
  const packet = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    machine: registry.machine,
    registry: registry.properties,
    health,
    google,
    ledger,
    policy: { cure: 'APPROVAL REQUIRED', publish: 'SEPARATE APPROVAL REQUIRED' }
  };
  navigator.clipboard.writeText(JSON.stringify(packet, null, 2)).then(() => alert('Diagnostic package copied for AI inspection.'));
}

function registerProduct() {
  show(`<h2>REGISTER NEW PRODUCT</h2><div class="form-grid"><div class="field"><label>PRODUCT NAME</label><input id="rName"></div><div class="field"><label>LIVE URL</label><input id="rUrl" placeholder="https://..."></div><div class="field"><label>CATEGORY</label><input id="rCat"></div><div class="field"><label>INDEXING INTENT</label><select id="rIndex"><option value="index">INDEXABLE</option><option value="noindex">DO NOT INDEX</option></select></div><div class="field full"><label>SEARCH PURPOSE / TARGET TOPICS</label><textarea id="rTopics" rows="4"></textarea></div></div><div class="controls section"><button class="btn primary" id="makeRegistration">CREATE REGISTRATION REQUEST</button></div><p class="tiny">Until a secure registry gateway is connected, this creates a registration request file. It does not silently edit the master registry.</p>`);
  $('#makeRegistration').onclick = () => {
    const req = {
      schemaVersion: 1,
      type: 'product_registration_request',
      createdAt: new Date().toISOString(),
      name: $('#rName').value.trim(),
      url: $('#rUrl').value.trim(),
      category: $('#rCat').value.trim(),
      indexingIntent: $('#rIndex').value,
      targetTopics: $('#rTopics').value.trim(),
      curePolicy: 'approval_required',
      publishPolicy: 'separate_approval_required'
    };
    download(JSON.stringify(req, null, 2), `bones-veins-register-${(req.name || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`, 'application/json');
  };
}

function googleDates() {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 2);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  const ds = d => d.toISOString().slice(0, 10);
  return { startDate: ds(start), endDate: ds(end) };
}

async function gFetch(url, options = {}) {
  if (!googleAccessToken) throw new Error('Google access token is missing.');
  const r = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${googleAccessToken}`,
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!r.ok) throw new Error(`Google API ${r.status}: ${await r.text()}`);
  return r.json();
}

async function gQuery(siteUrl, body) {
  return gFetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

async function loadGoogleSearchConsole() {
  const siteUrl = registry.machine.searchConsoleProperty || 'sc-domain:barbph.com';
  const { startDate, endDate } = googleDates();
  google = { status: 'connecting', property: siteUrl, summary: {}, properties: [], queries: [], sitemaps: [] };
  renderGoogle();

  const aggregate = await gQuery(siteUrl, { startDate, endDate, type: 'web', rowLimit: 1 });
  const a = aggregate.rows?.[0] || {};
  const pages = await gQuery(siteUrl, { startDate, endDate, type: 'web', dimensions: ['page'], rowLimit: 25000 });
  const queries = await gQuery(siteUrl, { startDate, endDate, type: 'web', dimensions: ['query'], rowLimit: 25 });
  const pageMap = new Map((pages.rows || []).map(r => [norm(r.keys?.[0]), r]));

  let sitemaps = [];
  try {
    const sm = await gFetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`, { method: 'GET' });
    sitemaps = sm.sitemap || [];
  } catch {}

  const properties = [];
  let indexed = 0;
  const inspectable = registry.properties.filter(p => p.url);

  for (let i = 0; i < inspectable.length; i++) {
    const p = inspectable[i];
    $('#gscState').textContent = `INSPECTING ${i + 1}/${inspectable.length}`;
    let ix = null;
    try {
      const inspection = await gFetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
        method: 'POST',
        body: JSON.stringify({ inspectionUrl: p.url, siteUrl, languageCode: 'en-US' })
      });
      ix = inspection.inspectionResult?.indexStatusResult || null;
    } catch {}

    if (ix?.verdict === 'PASS') indexed++;
    const perf = pageMap.get(norm(p.url)) || null;
    properties.push({
      id: p.id,
      name: p.name,
      url: p.url,
      clicks: perf?.clicks ?? 0,
      impressions: perf?.impressions ?? 0,
      ctr: perf?.ctr ?? 0,
      position: perf?.position ?? null,
      indexVerdict: ix?.verdict || 'UNKNOWN',
      coverageState: ix?.coverageState || null,
      lastCrawlTime: ix?.lastCrawlTime || null,
      pageFetchState: ix?.pageFetchState || null,
      robotsTxtState: ix?.robotsTxtState || null,
      indexingState: ix?.indexingState || null,
      googleCanonical: ix?.googleCanonical || null,
      userCanonical: ix?.userCanonical || null
    });
  }

  if (registry.properties.some(p => !p.url)) {
    registry.properties.filter(p => !p.url).forEach(p => properties.push({ id: p.id, name: p.name, url: null, indexVerdict: 'NO URL' }));
  }

  const sitemapStatus = sitemaps.some(s => !Number(s.errors || 0) && !Number(s.warnings || 0)) ? 'success' : sitemaps.length ? 'warning' : 'none';
  google = {
    generatedAt: new Date().toISOString(),
    source: 'GOOGLE SEARCH CONSOLE',
    status: 'connected',
    property: siteUrl,
    period: { startDate, endDate },
    summary: {
      clicks: a.clicks ?? 0,
      impressions: a.impressions ?? 0,
      ctr: a.ctr ?? 0,
      position: a.position ?? null,
      indexed,
      total: registry.properties.length,
      sitemapStatus
    },
    properties,
    queries: (queries.rows || []).map(r => ({ query: r.keys?.[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position })),
    sitemaps: sitemaps.map(s => ({ path: s.path, lastSubmitted: s.lastSubmitted, lastDownloaded: s.lastDownloaded, isPending: s.isPending, warnings: s.warnings, errors: s.errors }))
  };

  renderGoogle();
  renderRegistry();
  localStorage.setItem('bv-google-last-connected-at', google.generatedAt);
}

function connectGoogle() {
  if (!runtime.google?.clientId) {
    show(`<h2>GOOGLE SEARCH CONSOLE</h2><div class="mono">AUTHORIZATION STATUS: SETUP PENDING
PROPERTY: ${esc(registry.machine.searchConsoleProperty || 'sc-domain:barbph.com')}
SCOPE: READ-ONLY SEARCH CONSOLE

The interface is already wired. The remaining setup is to create the Google OAuth web client and place its public Client ID in config/runtime.json. No client secret belongs in Page 1.</div>`);
    return;
  }
  if (!window.google?.accounts?.oauth2) {
    show('<h2>GOOGLE SEARCH CONSOLE</h2><p>Google Identity Services has not finished loading. Try the button again in a moment.</p>');
    return;
  }

  google.status = 'connecting';
  renderGoogle();
  const tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: runtime.google.clientId,
    scope: runtime.google.scope || 'https://www.googleapis.com/auth/webmasters.readonly',
    callback: async response => {
      if (response.error) {
        google = { status: 'authorization_failed', summary: {}, properties: [] };
        renderGoogle();
        show(`<h2>GOOGLE AUTHORIZATION FAILED</h2><div class="mono">${esc(response.error_description || response.error)}</div>`);
        return;
      }
      googleAccessToken = response.access_token;
      try {
        await loadGoogleSearchConsole();
        showGoogleBay();
      } catch (error) {
        google.status = 'api_error';
        renderGoogle();
        show(`<h2>GOOGLE SEARCH CONSOLE API ERROR</h2><div class="mono">${esc(error.message || error)}</div><p class="tiny">No BarbPH product was changed. This only affects Google data display.</p>`);
      }
    }
  });
  tokenClient.requestAccessToken({ prompt: '' });
}

function showGoogleBay() {
  if (google.status !== 'connected') {
    connectGoogle();
    return;
  }
  const top = (google.queries || []).slice(0, 10).map(q => `${q.query} | ${fmt(q.clicks)} clicks | ${fmt(q.impressions)} impressions`).join('\n') || 'No query rows returned.';
  show(`<h2>GOOGLE SEARCH CONSOLE</h2><div class="mono">SOURCE: GOOGLE SEARCH CONSOLE
PROPERTY: ${esc(google.property)}
PERIOD: ${esc(google.period?.startDate || '—')} → ${esc(google.period?.endDate || '—')}
CLICKS: ${esc(fmt(google.summary?.clicks))}
IMPRESSIONS: ${esc(fmt(google.summary?.impressions))}
CTR: ${esc(google.summary?.ctr == null ? '—' : (google.summary.ctr * 100).toFixed(2) + '%')}
AVG POSITION: ${esc(fmt(google.summary?.position))}
INDEXED URLS: ${esc(google.summary?.indexed ?? '—')}/${esc(google.summary?.total ?? registry.properties.length)}
SITEMAP: ${esc((google.summary?.sitemapStatus || '—').toUpperCase())}

TOP QUERIES
${esc(top)}</div><p class="tiny">Google access is read-only and kept in memory for this browser session. BONES & VEINS does not place the access token in its static files.</p>`);
}

async function init() {
  [registry, runtime] = await Promise.all([
    j('registry.json', { properties: [], machine: {} }),
    j('config/runtime.json', { google: {} })
  ]);

  [health, ledger, ai] = await Promise.all([
    jRemote(runtime.healthDataUrl, 'data/health.json', { properties: [], summary: {} }),
    jRemote(runtime.ledgerDataUrl, 'data/ledger.json', { entries: [] }),
    j('data/ai-reports.json', { reports: [] })
  ]);

  google = { status: 'not_connected', property: registry.machine.searchConsoleProperty, summary: {}, properties: [] };

  renderRegistry();
  renderHealth();
  renderGoogle();
  renderLedger();
  renderAi();
  $('#systemState').textContent = 'ONLINE';
  $('#engineState').textContent = health.generatedAt ? 'LIVE DATA' : 'READY';
}

$('#closeModal').onclick = () => $('#modal').classList.remove('open');
const ol = $('#openLedger');
if (ol) ol.onclick = () => show(`<h2>MACHINE LEDGER</h2><div class="mono">${esc(JSON.stringify(ledger, null, 2))}</div>`);
$('#reportBtn').onclick = generatePdf;
$('#copyBtn').onclick = copyAi;
$('#registerBtn').onclick = registerProduct;
$('#exportAi').onclick = () => download(reportText(), 'bones-veins-ai-diagnostic.txt');
$('#googleDetails').onclick = () => google.status === 'connected' ? showGoogleBay() : connectGoogle();

startClock();
init();
