import fs from 'node:fs';

function update(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after !== before) fs.writeFileSync(path, after);
}

update('app.js', text => {
  if (!text.includes("const systemHealthState = $('#systemHealthState');")) {
    const old = `  const dominant = s.fault ? 'FAULT' : s.warning ? 'WARNING' : (s.healthy || s.thriving) ? 'HEALTHY' : 'OBSERVING';
  $('#overallHealth').textContent = dominant;
  setVeins(dominant.toLowerCase());
}

function setVeins(state) {
  document.querySelectorAll('.vein').forEach(v => {
    v.className.baseVal = 'vein ' + (state === 'healthy' ? '' : state);
  });
}`;
    const next = `  const dominant = s.fault ? 'FAULT' : s.warning ? 'WARNING' : (s.healthy || s.thriving) ? 'HEALTHY' : 'OBSERVING';
  $('#overallHealth').textContent = dominant;
  const systemHealthState = $('#systemHealthState');
  if (systemHealthState) systemHealthState.textContent = dominant;
  setVeins(dominant.toLowerCase());
}

function setVeins(state) {
  const stage = document.querySelector('.organism-stage');
  if (!stage) return;
  stage.dataset.healthState = state;
}`;
    if (!text.includes(old)) throw new Error('Expected renderHealth/setVeins block not found.');
    text = text.replace(old, next);
  }

  if (!text.includes("const feed = $('#activityFeed');")) {
    const anchor = `  e.slice().reverse().slice(0, 100).forEach(x => {
    const d = document.createElement('div');
    d.className = 'ledger-row';
    d.innerHTML = \`<time>\${esc(x.at || '')}</time><br>\${esc(x.type || 'EVENT')} — \${esc(x.message || '')}\`;
    $('#ledger').appendChild(d);
  });`;
    const replacement = `${anchor}

  const feed = $('#activityFeed');
  if (feed) {
    const recent = e.slice().reverse().slice(0, 4);
    feed.innerHTML = recent.length ? '' : '<p><time>--:--</time><i></i> Waiting for the first machine-ledger event.</p>';
    recent.forEach(x => {
      const p = document.createElement('p');
      const stamp = x.at ? new Date(x.at) : null;
      const time = stamp && !Number.isNaN(stamp.valueOf())
        ? stamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '--:--';
      p.innerHTML = \`<time>\${esc(time)}</time><i></i> \${esc(x.message || x.type || 'Machine event')}\`;
      feed.appendChild(p);
    });
  }`;
    if (!text.includes(anchor)) throw new Error('Expected renderLedger anchor not found.');
    text = text.replace(anchor, replacement);
  }

  return text.replace("lines.push('BONES & VEINS — BarbPH SEO Health');", "lines.push('BONES & VEINS - BarbPH SEO Health');");
});

update('index.html', html => {
  html = html.replace(
    '<span>OVERALL STATE</span><strong>OBSERVING</strong><p>Scanner safety gate active.',
    '<span>OVERALL STATE</span><strong id="systemHealthState">OBSERVING</strong><p>Scanner safety gate active.'
  );
  return html.replace(
    '        <div class="stage-corner tl"></div><div class="stage-corner tr"></div><div class="stage-corner bl"></div><div class="stage-corner br"></div>\n',
    ''
  );
});

update('styles.css', css => {
  css = css.replace(/\.stage-corner\{[^}]*\}\.stage-corner\.tl\{[^}]*\}\.stage-corner\.tr\{[^}]*\}\.stage-corner\.bl\{[^}]*\}\.stage-corner\.br\{[^}]*\}/, '');
  if (css.includes('/* organism health-state colors */')) return css;
  return css + `

/* organism health-state colors */
.organism-stage[data-health-state="warning"] .vein-flow{stroke:var(--amber)}
.organism-stage[data-health-state="warning"] .vein-capillary{stroke:#a99139}
.organism-stage[data-health-state="fault"] .vein-flow{stroke:var(--red)}
.organism-stage[data-health-state="fault"] .vein-capillary{stroke:#8e4545}
.organism-stage[data-health-state="observing"] .vein-flow{stroke:#73b586}
.organism-stage[data-health-state="observing"] .vein-capillary{stroke:#4b7c59}
`;
});

const app = fs.readFileSync('app.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const styles = fs.readFileSync('styles.css', 'utf8');
if (!app.includes("stage.dataset.healthState = state")) throw new Error('Vein state wiring missing after polish.');
if (!app.includes("const feed = $('#activityFeed');")) throw new Error('Live activity wiring missing after polish.');
if (!index.includes('id="systemHealthState"')) throw new Error('Overall state target missing after polish.');
if (index.includes('stage-corner')) throw new Error('Decorative organism corner frames still present after polish.');
if (styles.includes('.stage-corner')) throw new Error('Decorative organism corner frame CSS still present after polish.');
if (!styles.includes('/* organism health-state colors */')) throw new Error('Organism state styles missing after polish.');

console.log('Final UI polish applied and verified.');
