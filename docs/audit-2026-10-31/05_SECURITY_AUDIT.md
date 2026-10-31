# Security Audit

- GST API key server-side only: confirmed in code paths.
- Print HTML escapes provider/partner values: tested.
- No production DB password exposure in reports (redacted).
- Further: dependency audit and secret scanning not run (tooling not invoked).
