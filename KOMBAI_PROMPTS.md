# Kombai AI Prompts — SouHimBou AI Frontend Upgrade
# Access via Google Antigravity IDE Extension → Kombai

These are exact prompts to give Kombai. Paste them verbatim into the Kombai chat panel.
Each prompt is self-contained and references the existing file paths so Kombai
has full context.

---

## PROMPT 1 — Natural Language Chat Panel (NL Security Assistant)

**Paste this into Kombai:**

```
I need you to add a floating NL chat panel to my React/Vite frontend at `src/`.

CONTEXT:
- The app uses React 18, Vite, shadcn/ui, Radix UI, TanStack Query, Tailwind CSS
- The routing is in `src/App.tsx` (React Router v6)
- The design uses a dark theme: bg-background, text-foreground, border classes
- Authentication is handled by `src/hooks/useAuth.tsx` (provides `user`, `session`, `supabaseClient`)
- The Supabase client is at `src/integrations/supabase/client.ts`

TASK:
Create `src/components/NLChatPanel.tsx` — a floating chat widget that:

1. Renders as a floating button (bottom-right, z-50) with an AI sparkle icon (✦ or use a Lucide icon)
2. Clicking the button opens a slide-up panel (320px wide, 480px tall, fixed bottom-right)
3. The panel has:
   - Header: "Khepra AI" title + "AdinKhepra v2" badge + close button
   - Message list with alternating user/AI bubbles (dark card styling)
   - Animated "thinking" indicator (3-dot pulse) while waiting
   - Text input + Send button (Enter to send, Shift+Enter for new line)
4. On submit, POST to `/api/v1/mcp/ask` with body:
   `{ "query": userText, "session_id": sessionId, "max_tools": 5 }`
   Include header `X-Khepra-PQC-Token: ${localStorage.getItem('khepra_pqc_token') || ''}` if token exists
5. Render the AI response. If `tools_called` array is in the response, show small badge chips below the message
6. The session_id should be a `useRef` initialized to `crypto.randomUUID()` on mount
7. Persist last 20 messages in `useState` only (no localStorage — security requirement)
8. Add the component to `src/App.tsx` just before the closing `</BrowserRouter>` tag so it appears on all pages

Use shadcn/ui Card, ScrollArea, Input, Button components. Match existing dark theme.
Export as default. No external dependencies beyond what's already in package.json.
```

---

## PROMPT 2 — Security Dashboard Upgrade (UltimateDashboard.tsx)

**Paste this into Kombai:**

```
I need you to upgrade `src/views/UltimateDashboard.tsx`.

CONTEXT:
- File: `src/views/UltimateDashboard.tsx` — read this file first
- Uses React 18, TanStack Query, Recharts, shadcn/ui
- Supabase client: `import { supabase } from '@/integrations/supabase/client'`
- Auth hook: `import { useAuth } from '@/hooks/useAuth'`

TASK — Add a "Backup Health" card to the dashboard:

1. Add a new card section titled "Storage Backup Health (CMMC CP-9)"
2. Use TanStack Query to call Supabase RPC:
   `supabase.rpc('get_storage_backup_health', { p_bucket_id: 'all' })`
   Query key: `['storage-backup-health']`, refetchInterval: 300000 (5 min)
3. Display a 2×2 grid of metric tiles:
   - Total Objects (count from result)
   - Backed Up (covered objects)
   - Coverage % (as a circular progress ring using Recharts RadialBarChart)
   - Last Backup (formatted as "X hours ago" using date-fns or built-in)
4. Color the coverage ring: green ≥90%, amber 70-89%, red <70%
5. Add a "Run Backup Now" button that calls:
   `supabase.functions.invoke('storage-backup-worker', { body: { dry_run: false } })`
   Show a toast on success/failure (use the existing Sonner toast from `@/components/ui/sonner`)
6. If RPC returns error, show a muted "Backup health data unavailable" placeholder

Place this card after the existing compliance score cards.
Use existing shadcn/ui Card, CardContent, CardHeader, Badge components.
```

---

## PROMPT 3 — STIG Dashboard NL Query Bar

**Paste this into Kombai:**

```
I need you to add a Natural Language query bar to `src/views/STIGDashboard.tsx`.

CONTEXT:
- File: `src/views/STIGDashboard.tsx` — read this file first
- Uses React 18, shadcn/ui components, Tailwind CSS dark theme
- The dashboard shows STIG findings in a table

TASK — Add an NL query bar above the STIG findings table:

1. Add a full-width search bar at the top of the page content (below the page header):
   - Placeholder: "Ask about STIG findings in plain English... e.g. 'Show all critical CAT I findings for RHEL 8'"
   - A "Search" button and a keyboard shortcut hint "⌘K"
   - A small "AI-powered" badge next to the label
2. On submit, POST to `/api/v1/mcp/ask` with:
   `{ "query": inputText, "context": { "view": "stig_dashboard" }, "max_tools": 3 }`
3. Show results in a highlighted card below the search bar:
   - AI answer text (formatted, allow line breaks)
   - If `tools_called` includes `khepra_query_stig`, show a "STIG Rule Details" expandable section
   - A "Clear" button to dismiss
4. While loading, show a skeleton loader in place of the results card
5. Add keyboard shortcut: Cmd+K / Ctrl+K focuses the search input (use a useEffect with keydown listener)

Style to match the existing page. Use shadcn/ui Input, Button, Card, Skeleton, Collapsible components.
```

---

## PROMPT 4 — Mobile-Responsive Navigation

**Paste this into Kombai:**

```
I need you to make the main navigation in my React/Vite app mobile-responsive.

CONTEXT:
- Read `src/App.tsx` to understand the route structure
- Check `src/components/` for any existing navigation component (look for Navbar, Nav, Sidebar, Header files)
- The app uses shadcn/ui, Radix UI, Tailwind CSS with a dark theme
- Auth: `import { useAuth } from '@/hooks/useAuth'`

TASK:

1. Find or create the main navigation component
2. Make it mobile-responsive with these behaviors:
   - Desktop (≥768px): horizontal top nav with: Logo | STIG | Compliance | Assets | Reports | [Auth buttons]
   - Mobile (<768px): hamburger menu button (top-right) that opens a slide-down drawer
   - The drawer should overlay the content with a semi-transparent backdrop
   - Menu items in the drawer should be large touch targets (min 48px height)
3. Add a persistent bottom navigation bar for mobile (≤640px) with 5 icons:
   - Home (House icon), STIG (Shield), Compliance (CheckCircle), Chat (MessageSquare), Settings (Settings)
   - Active tab highlighted with accent color
   - The Chat tab should open the NLChatPanel (if it exists) or navigate to /command-center
4. The hamburger menu should close when a route is clicked (use useNavigate + close handler)
5. Ensure the nav respects auth state: show Login button when not authenticated,
   user avatar + logout when authenticated

Use Radix UI Sheet for the mobile drawer, Lucide React icons throughout.
Do not change the desktop layout — only add mobile behavior on top of what exists.
```

---

## PROMPT 5 — PQC Auth Token UI (Settings Page)

**Paste this into Kombai:**

```
I need you to add a PQC Token management section to the user settings or profile page.

CONTEXT:
- Read `src/views/` for a Settings, Profile, or Account page (check for Settings.tsx, Profile.tsx, Account.tsx)
- If none exists, add the section to the existing Billing page at `src/views/SimpleBilling.tsx`
- Uses React 18, shadcn/ui, Supabase client at `src/integrations/supabase/client.ts`
- The DEMARC API endpoint for token exchange is `/api/v1/auth/token` (POST)

TASK — Add "PQC Security Token" card:

1. Add a card titled "AdinKhepra PQC Authentication Token"
   Subtitle: "Post-quantum cryptography token for air-gapped and CLI access"
2. Show current token status:
   - If `localStorage.getItem('khepra_pqc_token')` is set: show "Active" green badge + last 8 chars of token
   - Otherwise: show "Not configured" muted badge
3. "Generate Token" button:
   - POST to `/api/v1/auth/token` with body `{ "supabase_jwt": session?.access_token }`
   - On success, store token in `localStorage.setItem('khepra_pqc_token', data.token)`
   - Show the full token once in a copyable code block (with a Copy button using clipboard API)
   - After 30 seconds, replace the full token display with the masked version
4. "Revoke Token" button (destructive variant):
   - Clear `localStorage.removeItem('khepra_pqc_token')`
   - Show confirmation dialog using shadcn/ui AlertDialog before revoking
5. Add an info section explaining:
   "This token uses ML-DSA-65 (NIST FIPS 204) — quantum-resistant authentication.
   Use it with: khepra-client --pqc-token <token>"

Use shadcn/ui Card, Badge, Button, AlertDialog, Input components.
```

---

## PROMPT 6 — n8n Integration Status Widget

**Paste this into Kombai:**

```
I need you to add an n8n integration status widget to `src/views/IntegrationsPage.tsx`.

CONTEXT:
- File: `src/views/IntegrationsPage.tsx` — read this file first (if it exists, else use `src/views/IntegrationEnhancement.tsx`)
- The app uses Supabase: `import { supabase } from '@/integrations/supabase/client'`
- TanStack Query for data fetching

TASK — Add "n8n Automation" integration card:

1. Add a card in the integrations list for "n8n Workflow Automation":
   - Icon: use a simple workflow/nodes SVG or Lucide GitBranch icon
   - Title: "n8n Automation" with "Community Node" badge
   - Description: "Trigger security scans, receive alerts, and run compliance workflows from n8n"
2. Status indicators:
   - Query `security_alerts` table: `supabase.from('security_alerts').select('id', { count: 'exact', head: true }).eq('source', 'n8n')`
   - If count > 0: show "Active — {count} events received" in green
   - Otherwise: show "Ready — awaiting first event" in muted
3. Quick setup instructions (collapsible):
   - Step 1: "Install n8n-nodes-khepra in your n8n instance: npm install n8n-nodes-khepra"
   - Step 2: "Configure KhepraApi credential with your API URL and PQC token"
   - Step 3: "Webhook URL for receiving n8n events: {window.location.origin}/functions/v1/n8n-webhook-receiver"
   - Each step has a copy button for the command/URL
4. "Open n8n Docs" external link button (opens https://docs.n8n.io/integrations/community-nodes/)

Use shadcn/ui Card, Badge, Collapsible, Button components.
```

---

## Notes for Kombai Usage

1. **Give prompts one at a time** — let Kombai complete each before starting the next
2. **After each prompt**, review the generated code and ask Kombai to "fix TypeScript errors" if any
3. **For Prompt 1 (Chat Panel)**, after Kombai generates it, follow up with:
   `"Add a loading skeleton while waiting for the API response and handle network errors gracefully by showing an error message in the chat"`
4. **For Prompt 4 (Mobile Nav)**, after generation, follow up with:
   `"Ensure the mobile bottom nav is hidden when the keyboard is open on iOS/Android by using a CSS environment variable for safe-area-inset-bottom"`
5. **TypeScript**: All components should be typed — if Kombai produces `any`, ask it to add proper types
