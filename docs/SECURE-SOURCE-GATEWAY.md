# Secure source gateway

The browser dashboard is intentionally not the place where product repository names, Netlify site IDs, write tokens, OAuth secrets or deployment credentials live.

`registry.json` contains public operational identity only: product name, live URL, category and a generic source-mapping state.

Actual source/deployment mapping belongs in a secure backend or protected CI secret/configuration layer that conforms to `config/source-map.schema.json`.

## Required cure flow

1. Scanner detects a finding.
2. Dashboard prepares a cure ticket.
3. User separately approves cure preparation.
4. Secure gateway resolves the product to a known source mapping.
5. Gateway refuses to proceed if mapping is missing or ambiguous.
6. Proposed source diff is produced and validated.
7. User separately approves production publishing.
8. Only then may the deployment provider be invoked.
9. Live result is verified and written to the ledger.

No browser-side JavaScript may contain GitHub write tokens, Netlify tokens, OAuth client secrets or private deployment IDs.
