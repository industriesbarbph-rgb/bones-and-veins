# BONES & VEINS — Pre-Deploy Gate

This document records the deployment gate for `https://seohealth.barbph.com`.

## Passed

- [x] BONES & VEINS control-room UI built and visually approved.
- [x] Day-1 registry contains BarbPH + 19 published products (20 monitored properties).
- [x] All 20 monitored properties now have registered live URLs.
- [x] Scanner reliability gate implemented: one transport miss does not become FAULT; repeated scheduled failures escalate.
- [x] First scheduled GitHub Actions health scan completed successfully.
- [x] Registry changes trigger an immediate health scan in addition to the hourly schedule.
- [x] First real scan confirmed BarbPH and IKL healthy and produced SEO findings without classifying any property as an outage fault.
- [x] Hourly workflow writes health/reliability/ledger/AI diagnostic data and commits with `[skip netlify]`.
- [x] Google Search Console API enabled by the operator.
- [x] Google OAuth public Client ID configured in `config/runtime.json`.
- [x] Google scope is read-only: `https://www.googleapis.com/auth/webmasters.readonly`.
- [x] Browser Google access token is memory-only; no token is committed to GitHub or stored in static files.
- [x] Obsolete Client Secret / refresh-token helper path removed from the public repository.
- [x] Dashboard has `noindex,nofollow,noarchive` protection and restrictive security headers.
- [x] Google Identity Services script/frame/connect/style origins allowed by CSP.
- [x] ALL PRODUCTS = APPROVAL REQUIRED.
- [x] Cure approval and publish approval are separate.
- [x] No automatic Netlify deploy is permitted by the machine.

## First live findings (diagnosis only — no cures applied)

Historical snapshot from the first scheduled scan:

- 15 missing meta descriptions.
- 16 missing self-referencing canonicals.
- 1 canonical mismatch: Watch Tower declares the old Netlify URL rather than the registered `watchtower.barbph.com` URL.
- 1 registration gap: Map of Computer Science & IT had no live URL configured at scan time.
- 0 missing titles.
- 0 unexpected `noindex` findings.
- 0 confirmed outage faults.

## Resolution after first scan

- [x] Map of Computer Science & IT live URL recovered from the BarbPH internal master archive and registered as `https://comscie-it-map.barbph.com/`.
- [x] The original first-scan finding remains recorded above as historical truth rather than being erased.
- [x] Immediate registry-change scan verified the map at HTTP 200 on the registered URL.
- [x] The map's title is present: `Map of Computer Science & IT`.
- [x] Registration gap is resolved.
- [ ] SEO attention remains for that page: meta description missing and self-referencing canonical missing.

## Operator / deployment gates still pending

- [ ] Confirm the Search Console Google account is present under Google Auth Platform → Audience → Test users while the OAuth app remains in testing mode.
- [ ] Confirm the OAuth Web Client authorized JavaScript origin includes exactly `https://seohealth.barbph.com`.
- [ ] Explicit operator approval to create/publish the BONES & VEINS Netlify deployment.
- [ ] Create/link the Netlify project without changing any existing product project.
- [ ] Attach `seohealth.barbph.com` to the new BONES & VEINS project and complete required DNS mapping.
- [ ] Verify production response, CSP, noindex headers, mobile layout, and raw GitHub health-data freshness.
- [ ] On the live origin, press CONNECT GOOGLE and complete Google's real ALLOW consent.
- [ ] Verify clicks, impressions, CTR, position, sitemap results and URL Inspection results display as GOOGLE SEARCH CONSOLE data only.

## Credit policy

The recurring scanner is a GitHub Actions job. Its normal health-data commits use `[skip netlify]`. Netlify is reserved for deliberately approved website publication, not recurring monitoring.
