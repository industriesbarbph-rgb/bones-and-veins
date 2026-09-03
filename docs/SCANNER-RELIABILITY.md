# Scanner reliability policy

BONES & VEINS must distinguish a product failure from a checker failure.

## Escalation rule

- A successful HTTP response confirms network reachability, even when the returned status itself is unhealthy.
- Each live URL gets up to three connection attempts in one scheduled scan.
- One scheduled scan with no connection = **OBSERVING / NETWORK RECHECK PENDING**.
- Two consecutive scheduled scans with no connection = **WARNING / RECHECKING NETWORK**.
- Three or more consecutive scheduled scans with no connection = **FAULT / CONFIRMED UNREACHABLE**.
- A later successful connection clears the transport-failure streak immediately.

This prevents transient DNS, TLS, runner, routing, or internet problems from being reported as product outages.

## HTTP evidence

When an HTTP response is received, the scanner classifies the actual response separately:

- `404` / `410`: fault because the registered public page is confirmed missing.
- `5xx`: warning first; persistent server failures should be investigated rather than blamed on the scanner.
- Other `4xx`: warning because access/indexing intent may need review.

## SEO checks

Metadata, canonical, robots meta, robots.txt and sitemap checks run only when the scanner has usable evidence. No cure is applied automatically.

## Cure policy

Every finding is diagnostic only. Source changes require cure approval. Production publishing requires a separate approval.
