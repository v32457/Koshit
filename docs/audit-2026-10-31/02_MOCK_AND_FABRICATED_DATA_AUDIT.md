# Mock and Fabricated Data Audit

Findings:
- src/data/seedData.ts contains INITIAL_USERS and classification masters; consumed by authService. Must be restricted to dev/test.
- normalizeStoredPartners (tested) downgrades VERIFIED records lacking provider evidence and removes fabricated logs.
- Fake dashboard/activity feeds: not confirmed in sampled code; requires full review.
- GST print module explicitly labels third-party data and empty history; no fabricated records.

Severity: Medium (seed users in production auth path). Remediation: gate seed loading behind NODE_ENV !== production or explicit seed flag.
