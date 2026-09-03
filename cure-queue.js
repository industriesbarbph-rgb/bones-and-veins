(() => {
  const LOCAL_QUEUE = 'data/cure-candidates.json';
  const DEFAULT_REMOTE = 'https://raw.githubusercontent.com/industriesbarbph-rgb/bones-and-veins/main/data/cure-candidates.json';
  let queue = null;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  async function getJson(url) {
    const sep = url.includes('?') ? '&' : '?';
    const response = await fetch(`${url}${sep}v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function loadQueue() {
    let remote = DEFAULT_REMOTE;
    try {
      const config = await getJson('config/runtime.json');
      remote = config.cureQueueDataUrl || remote;
    } catch {}

    try {
      queue = await getJson(remote);
    } catch {
      try { queue = await getJson(LOCAL_QUEUE); } catch { queue = null; }
    }
    renderQueue();
  }

  function renderQueue() {
    if (!queue) return;
    const summary = queue.summary || {};
    const total = summary.totalCandidates ?? queue.tickets?.length ?? 0;
    const pending = summary.pendingApproval ?? (queue.tickets || []).filter(t => t.status === 'PENDING APPROVAL').length;

    const count = document.querySelector('#cureCount');
    if (count) count.textContent = total;

    const board = document.querySelector('.cure-board');
    if (!board) return;

    let status = document.querySelector('#cureQueueStatus');
    if (!status) {
      status = document.createElement('p');
      status.id = 'cureQueueStatus';
      board.appendChild(status);
    }
    status.textContent = `${pending} PENDING APPROVAL · CURE LOCKED · PUBLISH LOCKED`;

    let button = document.querySelector('#viewCureQueue');
    if (!button) {
      button = document.createElement('button');
      button.id = 'viewCureQueue';
      button.className = 'text-button';
      button.textContent = 'VIEW CURE QUEUE →';
      button.addEventListener('click', showQueue);
      board.appendChild(button);
    }
  }

  function showQueue() {
    if (!queue) return;
    const tickets = queue.tickets || [];
    const summary = queue.summary || {};
    const rows = tickets.map(t => `
      <div class="fault-card ${t.severity === 'fault' ? 'red' : ''}">
        <div class="fault-title"><h4>${escapeHtml(t.propertyName)} — ${escapeHtml(t.findingCode)}</h4><span class="status warning">${escapeHtml(t.status || 'PENDING APPROVAL')}</span></div>
        <div class="mono">CURE APPROVAL: ${t.cureApproval === true ? 'APPROVED' : 'LOCKED / FALSE'}\nPUBLISH APPROVAL: ${t.publishApproval === true ? 'APPROVED' : 'LOCKED / FALSE'}\nACTION: ${escapeHtml(t.action || '')}\nPROPOSED VALUE: ${escapeHtml(t.proposedValue ?? 'CONTENT REVIEW REQUIRED')}\nSOURCE MAPPING: ${escapeHtml((t.sourceMapping || 'pending').toUpperCase())}</div>
      </div>`).join('');

    const html = `<h2>CURE QUEUE</h2><div class="mono">SOURCE: BONES & VEINS GENERATED CURE QUEUE\nTOTAL CANDIDATES: ${escapeHtml(summary.totalCandidates ?? tickets.length)}\nPENDING APPROVAL: ${escapeHtml(summary.pendingApproval ?? tickets.length)}\nCONTENT REVIEW REQUIRED: ${escapeHtml(summary.contentReviewRequired ?? '—')}\nSOURCE MAPPING PENDING: ${escapeHtml(summary.sourceMappingPending ?? '—')}\n\nPOLICY: CURE APPROVAL REQUIRED\nPOLICY: PUBLISH APPROVAL IS SEPARATE</div><div class="section">${rows}</div>`;

    if (typeof window.show === 'function') window.show(html);
    else {
      const modal = document.querySelector('#modal');
      const content = document.querySelector('#modalContent');
      if (modal && content) { content.innerHTML = html; modal.classList.add('open'); }
    }
  }

  loadQueue();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') loadQueue();
  });
})();
