import fs from 'node:fs/promises';

const [registry, health] = await Promise.all([
  fs.readFile('registry.json', 'utf8').then(JSON.parse),
  fs.readFile('data/health.json', 'utf8').then(JSON.parse)
]);

const byId = new Map(registry.properties.map(p => [p.id, p]));
const tickets = [];
let staleFindingsSkipped = 0;

function planFor(code, property, finding) {
  const url = property.url || null;
  switch (code) {
    case 'CANONICAL_MISSING':
      return {
        action: 'Add a self-referencing canonical tag after source mapping is confirmed.',
        proposedValue: url,
        requiresContentReview: false,
        requiresAuthorityConfirmation: false,
        publishRequired: true
      };
    case 'CANONICAL_MISMATCH':
      return {
        action: 'Confirm the registered URL is authoritative, then replace the declared canonical if approved.',
        proposedValue: url,
        requiresContentReview: false,
        requiresAuthorityConfirmation: true,
        publishRequired: true
      };
    case 'META_DESCRIPTION_MISSING':
      return {
        action: 'Draft a concise product-specific meta description from approved page/source context, then present the exact copy for approval.',
        proposedValue: null,
        requiresContentReview: true,
        requiresAuthorityConfirmation: false,
        publishRequired: true
      };
    case 'TITLE_MISSING':
      return {
        action: 'Draft a product-specific title from approved page/source context, then present the exact title for approval.',
        proposedValue: null,
        requiresContentReview: true,
        requiresAuthorityConfirmation: false,
        publishRequired: true
      };
    case 'UNEXPECTED_NOINDEX':
      return {
        action: 'Confirm this page is intended for Google indexing before proposing removal of the noindex directive.',
        proposedValue: 'index,follow',
        requiresContentReview: false,
        requiresAuthorityConfirmation: true,
        publishRequired: true
      };
    default:
      return {
        action: finding.cure || 'Review the evidence and prepare a source-specific cure for approval.',
        proposedValue: null,
        requiresContentReview: false,
        requiresAuthorityConfirmation: true,
        publishRequired: true
      };
  }
}

for (const result of health.properties || []) {
  const property = byId.get(result.id) || { id: result.id, name: result.name, url: result.url, sourceMapping: 'pending' };
  for (const finding of result.findings || []) {
    if (finding.code === 'LIVE_URL_MISSING' && property.url) {
      staleFindingsSkipped += 1;
      continue;
    }
    const plan = planFor(finding.code, property, finding);
    tickets.push({
      ticketId: `${property.id}:${finding.code}`,
      propertyId: property.id,
      propertyName: property.name,
      registeredUrl: property.url || null,
      findingCode: finding.code,
      severity: finding.severity || 'warning',
      diagnosis: finding.diagnosis,
      evidence: finding.evidence || {},
      sourceMapping: property.sourceMapping || 'pending',
      status: 'PENDING APPROVAL',
      cureApproval: false,
      publishApproval: false,
      ...plan
    });
  }
}

const out = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  basedOnHealthGeneratedAt: health.generatedAt || null,
  policy: {
    cure: 'APPROVAL REQUIRED',
    publish: 'SEPARATE APPROVAL REQUIRED',
    silentEdits: false,
    automaticProductionDeploys: false
  },
  summary: {
    totalCandidates: tickets.length,
    pendingApproval: tickets.filter(t => !t.cureApproval).length,
    contentReviewRequired: tickets.filter(t => t.requiresContentReview).length,
    authorityConfirmationRequired: tickets.filter(t => t.requiresAuthorityConfirmation).length,
    sourceMappingPending: tickets.filter(t => t.sourceMapping === 'pending').length,
    staleFindingsSkipped
  },
  tickets
};

await fs.writeFile('data/cure-candidates.json', JSON.stringify(out, null, 2) + '\n');
console.log(`Cure queue built: ${out.summary.totalCandidates} candidates, ${staleFindingsSkipped} stale finding(s) skipped.`);
