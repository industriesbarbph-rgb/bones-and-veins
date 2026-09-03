# BONES & VEINS
## BarbPH SEO Health

**BONES = structure. VEINS = search circulation.**

BONES & VEINS is the SEO health control system for BarbPH's current and future product estate.

## Locked operating policy

- ALL PRODUCTS = APPROVAL REQUIRED.
- Diagnosis may never change a product by itself.
- Cure approval and production publish approval are separate events.
- Monitoring must not trigger Netlify deployments.
- The public browser never receives GitHub write tokens, Netlify tokens, Google client secrets, or private deployment IDs.
- Page 1 contains a permanent handoff port for the future multi-AI diagnostic page.

## Day-1 registry

20 monitored properties: the BarbPH parent site plus 19 published products from the BarbPH admin sheet.

`Map of Computer Science & IT` is intentionally marked **REGISTRATION INCOMPLETE** because the current product registry has no live URL for it.

## Data sources

### BONES & VEINS

Hourly public-site checks cover reachability, HTTP response, title, description, canonical, robots directives, robots.txt, sitemap evidence, registration completeness and fault/cure diagnostics.

The reliability gate prevents a single scanner/network miss from becoming a false product fault. See `docs/SCANNER-RELIABILITY.md`.

### GOOGLE SEARCH CONSOLE

Google data is clearly labeled and kept separate. Page 1 is wired for the read-only Search Console scope and can load clicks, impressions, CTR, average position, top queries, sitemap status, and URL Inspection results after explicit Google authorization.

Primary mode: **interactive browser authorization**. The public OAuth Client ID will live in `config/runtime.json`; no client secret is needed in Page 1.

## Freshness without Netlify credit burn

The intended repository is `industriesbarbph-rgb/bones-and-veins`.

The dashboard is already configured to try the repository's raw `data/health.json` and `data/ledger.json` first, then fall back to bundled data while the repository is not yet available. Hourly GitHub Action commits use `[skip netlify]`, so health refreshes do not require a Netlify deploy.

Private Search Console metrics are loaded directly from Google after the operator authorizes the session rather than being committed to the public health stream.

See `docs/DATA-FRESHNESS.md`.

## Reports

Page 1 can generate a PDF machine report locally in the browser and can copy/export a structured diagnostic package for AI inspection.

## Secure source cures

The public registry contains only a generic mapping status. Actual GitHub repository and Netlify project/site mapping belongs behind a secure cure gateway. See `docs/SECURE-SOURCE-GATEWAY.md`.

## Deployment target

`https://seohealth.barbph.com`

The dashboard declares `noindex,nofollow` and ships with restrictive crawler headers. Google authorization has a dedicated privacy page.

## Useful commands

```bash
npm run check
npm run scan
npm run ai-package
```
