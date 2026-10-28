# Security

## Reporting a vulnerability

Please report security issues privately through GitHub's **Report a vulnerability** button on this repository (Security → Advisories) rather than in a public issue. Include steps to reproduce and the impact you expect. You can expect an acknowledgement within a few days.

## How the app is protected

| Area                    | Measure                                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secrets                 | The Gemini API key lives only in server environment variables, is sent in a request header (never a URL) and never reaches the browser. `.env` is git-ignored.                      |
| Transport and framing   | HSTS, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy`.                                                           |
| Content Security Policy | `default-src 'self'`; no inline scripts or styles, no `eval`, no third-party origins.                                                                                               |
| Cross-site requests     | State-changing API calls are rejected with 403 when Fetch Metadata or the `Origin` header shows they came from another site (`src/http.js`).                                        |
| Input                   | Allow-list validation of every field, prototype-safe enum checks, control and bidi-override characters stripped, length caps, a 16 KB body limit and a strict `Content-Type` check. |
| Abuse                   | Per-client token-bucket rate limits (12/min for AI endpoints, 240/min otherwise) with bounded memory.                                                                               |
| Prompt injection        | User text is fenced in tags and declared untrusted; model output must match a JSON schema and is validated field by field before use.                                               |
| Output                  | All dynamic text is rendered with `textContent`; no HTML from users or the model is ever injected.                                                                                  |
| Errors                  | Internal errors are logged server-side; clients only see a generic message.                                                                                                         |
| Static files            | Served only from an in-memory allow-list built at startup, so path traversal is impossible.                                                                                         |
| Supply chain            | Zero runtime dependencies; development tools are pinned and `npm audit` runs in CI.                                                                                                 |
| Container               | Runs as the unprivileged `node` user.                                                                                                                                               |
