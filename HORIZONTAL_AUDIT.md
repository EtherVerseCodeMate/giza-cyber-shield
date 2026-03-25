# Horizontal Audit: Cross-Cutting Concerns
**Scope**: Consistency across Go, Python, TypeScript, and SQL
**Methodology**: Comparing patterns for Error Handling, Configuration, and Logging.

## 1. Error Handling Patterns

| Layer | Language | Pattern | Status |
| :--- | :--- | :--- | :--- |
| **Engine** | Go | returns `error` interface. Logs via `logrus` or `log`. Exits on fatal. | **Consistent**. Migrated away from `log.Fatal` in libraries. |
| **Service** | Python | `try...except Exception`. Returns `HTTP 500` JSON. | **Consistent**. Catches subprocess errors gracefully. |
| **Worker** | JS | `try...catch`. Returns `HTTP 500` JSON `Response`. | **Consistent**. Maps exceptions to JSON error fields. |
| **Frontend** | TS | `fetch` -> `!response.ok` check -> `throw Error`. `React Query` handles UI state. | **Consistent**. Standard React pattern. |

**Observation**: The stack uses a "JSON Error Envelope" pattern (`{ "error": "message" }`) consistently across HTTP boundaries.

## 2. Configuration Management

| Variable | Go (CLI) | Python (API) | Worker (JS) | Frontend (Vite) |
| :--- | :--- | :--- | :--- | :--- |
| **Environment** | `os.Getenv` | `pydantic-settings` / `os.environ` | `env` object (Cloudflare) | `import.meta.env` |
| **License Key** | CLI Arg / Env | passed to CLI args | `env.TELEMETRY_PUBLIC_KEY` | N/A (Consumed via API) |
| **API Keys** | N/A | Headers | Verified in Code | `VITE_API_KEY` (Build time) |

**Finding**: Mixed use of `os.environ` and Pydantic in Python.
**Recommendation**: Standardize on `pydantic-settings` for all Python config to ensure type safety and validation at startup.

## 3. Logging Standards

*   **Go**: Structured logging (Text/JSON).
*   **Python**: Standard `logging` module.
*   **Worker**: `console.log` / `console.error`.
*   **Gap**: Cloudflare Worker logs are ephemeral unless forwarded.
*   **Fix**: Worker code contains `forwardSecurityEvent` to DEMARC, ensuring critical security logs are persisted.

## 4. Security Headers (Horizontal View)

*   **API**: `CORS` headers manually set in `index.js` and `FastAPI`.
*   **Finding**: `Access-Control-Allow-Origin: *` is present in `api.py` (via FastAPI default or middleware) and explicit in `index.js`.
*   **Risk**: Wildcard CORS is acceptable for public APIs but risky for internal dashboards.
*   **Refinement**: Ensure production builds restrict Origin to the specific domain.

## Conclusion
The application shows high consistency in error handling and data formats. Configuration management has been tightened in Python using Pydantic. Security headers are present, with a recommendation to restrict CORS in production.
