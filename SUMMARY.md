# Map Copilot follow-ups — summary

Implements `.hermes-handoff-map-copilot-followups.md` (highlight_features, get_visible_region, web parity) plus set_time_range and a hardened web gateway.

## New agent tools
- `highlight_features` (client-executed): items `{ id?, type?, label?, lat?, lon? }`, `durationMs` clamped 800–8000 (default 3000). Asset id+type pairs flash through `MapContainer.flashAssets`; lat/lon pins recenter the camera. — `src-tauri/sidecar/agent-tool-registry.mjs`, `src/services/map-agent-bridge.ts`
- `get_visible_region` (server-answered): reads the `mapViewport` snapshot that `AgentChatPanel` attaches to every chat request (center, zoom, bounds, span, flat/globe mode). Returns a clear error when no viewport was sent. — `agent-gateway.mjs`, `MapContainer.getViewport`, `DeckGLMap.ts`
- `set_time_range` (client-executed): accepts 1h/6h/24h/48h/7d/all, aliases ("this week", "today") or `hours`. Other lookbacks snap up to the smallest window that covers them, and the clientAction echoes `requested` so the model can tell the analyst which window it applied.
- The system prompt lists all of the new tools. Client-executed tools stay off MCP listings.

## Web parity
- The agent chat panel now mounts on web as well as desktop. — `src/app/event-handlers.ts`
- `api/agent-gateway/{status,chat,test-connector,mcp}.js` are thin wrappers around `api/_agent-gateway-handler.js`, which reuses the sidecar's `handleAgentGateway` (Node runtime, 60s max) and applies the CORS rules in `api/_cors.js`.
- `api/_agent-gateway-guard.js`: chat, mcp and test-connector require a verified Firebase ID token. They are rate-limited per uid: 20 per minute and 200 per day by default (env `AGENT_GATEWAY_RATE_LIMIT_PER_MINUTE` / `_PER_DAY`). Limits use Upstash when it's configured and fall back to an in-memory counter per instance, so the guard never fails open. `/status` stays public.
- `api/_rate-limit.js`: new `checkIdentifierRateLimit` that limits on a uid instead of an IP.
- `src/services/agent-gateway.ts` and `api-auth-fetch.ts`: on web, the client sends the Firebase token instead of the desktop token, along with connectors from localStorage.

## Security hardening (connector SSRF)
Users can supply connector endpoints on web, so `validateConnectorEndpoint` now also blocks 0.0.0.0, 127.x, IPv4-mapped IPv6, IPv6 ULA/link-local and CGNAT 100.64/10 (which covers Tailscale). On Vercel it also refuses localhost, which on that host means the serverless box rather than the user's machine. Desktop still allows localhost for local models.

## Verify
- `node --experimental-strip-types --test src-tauri/sidecar/agent-map-tools.test.mjs src-tauri/sidecar/agent-copilot-demo.test.mjs api/_agent-gateway-handler.test.mjs` → 31/31
- `npm run typecheck` → clean
- `npx vite build` → OK

## Follow-ups
- DNS-rebinding: hostname checks don't resolve DNS, so a public name that resolves to a private IP still gets through. Resolve the name and pin the IP before fetching, if web connectors go public.
- Configure Upstash in production. The in-memory fallback limit applies per instance, not globally.
- Run an end-to-end smoke test on a Vercel preview with a real Firebase user.
