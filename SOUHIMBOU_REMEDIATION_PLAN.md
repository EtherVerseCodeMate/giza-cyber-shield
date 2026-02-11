# SouHimBou.AI — Improved Remediation Plan
**Version**: 2.0 (Audited & Executed)
**Date**: 2026-02-10
**Status**: Sprint 1 ✅ COMPLETE | Sprint 2 Queued | Sprint 3 Planned

---

## Original Plan Audit — Issues Identified & Corrected

| # | Issue in Original Plan | Correction Applied |
|---|---|---|
| 1 | **Track overlap**: Tracks 2 (UX Foundation) and 3 (Accessibility) both covered landmarks, ARIA, and focus styles | **Merged** accessibility work into Sprint 1 (critical) and Sprint 2 (remaining) |
| 2 | **Missing dependency ordering**: ErrorBoundary must exist before legal stubs (which might crash if imports fail) | **Reordered**: ErrorBoundary created first, then legal pages, then routes |
| 3 | **CSS cleanup underestimated**: Original plan called it "15 min" but the `.card-cyber` unclosed brace caused cascading selector scope corruption | **Scoped correctly**: Fixed `.card-cyber` close brace + orphaned `}` at line 261, moved glow utilities inside `@layer components` |
| 4 | **Track 6 (Content Integrity) labeled as optional**: Dead footer links damage trust immediately, not "over time" | **Promoted to Sprint 1**: All 15+ dead `#anchor` links replaced with real routes or external links |
| 5 | **Missing critical fix**: `/onboarding` is public but `ExperienceSelector` depends on auth state via `useUserAgreements` | **Noted**: This requires auth guard refactoring, tracked for Sprint 2 |
| 6 | **Track 7 is premature**: Session replay, i18n, RBAC UI are Q2+ items that distract from the current focus | **Removed from execution scope**: Left as future backlog items only |
| 7 | **No mention of phantom notification bell**: Fake red dot creates "boy who cried wolf" UX anti-pattern | **Fixed in Sprint 1**: Removed red dot, added `aria-label="Notifications"` |

---

## Sprint 1: Trust & Access ✅ COMPLETE

### Files Modified (12 files)

| File | Changes | Status |
|------|---------|--------|
| `src/components/ErrorBoundary.tsx` | **NEW** — Global crash recovery component with branded dark-mode UI, reload/home actions | ✅ |
| `src/App.tsx` | Added `ErrorBoundary` wrapper, `LegalPage` import, 4 legal routes (`/privacy`, `/terms`, `/security`, `/compliance`) | ✅ |
| `src/pages/NotFound.tsx` | **REWRITTEN** — Dark-mode, branded 404 with route display, "Go Back" button, quick nav links | ✅ |
| `src/pages/LegalPage.tsx` | **NEW** — Data-driven legal pages (Privacy, Terms, Security, Compliance) with real substantive content | ✅ |
| `src/pages/NewHomepage.tsx` | Added "Sign In" link (desktop + mobile), skip-nav, `aria-label`, `role`, mobile menu close-on-navigate, `X` icon toggle | ✅ |
| `src/pages/Auth.tsx` | Changed "DoD CLASSIFIED" → "UNCLASSIFIED // FOUO", removed unused `AlertTriangle` import | ✅ |
| `src/components/onboarding/OnboardingOrchestrator.tsx` | Added "Back" button, step progress indicator (1/2 dots), `getStepClassName` helper | ✅ |
| `src/components/console/ConsoleLayout.tsx` | Dynamic org name, ARIA landmarks (`role="banner"`, `<nav>`, `role="main"`), aria-labels on icon buttons, removed phantom bell dot, cleaned imports | ✅ |
| `src/components/funnel/FooterConversion.tsx` | Replaced 15+ dead `#anchor` links with real routes/external links, dynamic copyright year | ✅ |
| `src/index.css` | Fixed `.card-cyber` unclosed brace, removed orphaned `}`, moved glow utilities inside `@layer components` | ✅ |
| `index.html` | Added Google Fonts preconnect + Inter font family loading | ✅ |

### Issues Resolved (Mapped to Audit IDs)

| Audit ID | Issue | Resolution |
|----------|-------|------------|
| C1 | No "Sign In" on homepage | ✅ Added to desktop + mobile nav with `LogIn` icon |
| C2 | 404 page breaks brand | ✅ Complete dark-mode redesign |
| C3 | No React ErrorBoundary | ✅ Global boundary wrapping all Routes |
| C4 | Footer dead links | ✅ 15+ links replaced with real destinations |
| C5 | Footer legal pages 404 | ✅ 4 legal pages created with real content |
| C6 | Zero accessibility landmarks | ✅ `role="banner"`, `<nav>`, `role="main"`, `aria-label`, skip-nav |
| C7 | No onboarding "back" button | ✅ Back button + step progress dots |
| M2 | Mobile menu doesn't close | ✅ All nav callbacks close menu |
| M3 | Org badge hardcoded | ✅ Uses `currentOrganization?.organization?.name` |
| M4 | Phantom notification bell | ✅ Red dot removed |
| M8 | "DoD CLASSIFIED" badge | ✅ Changed to "UNCLASSIFIED // FOUO" |
| M9 | Copyright year "2025" | ✅ Dynamic `new Date().getFullYear()` |
| M10 | CSS unclosed brace | ✅ Fixed `.card-cyber` + orphaned `}` |
| M12 | Font loading not guaranteed | ✅ Inter loaded via `<link>` preconnect in `index.html` |

---

## Sprint 2: Accessibility & Polish (Week 2) — QUEUED

### Remaining Tasks

| # | Task | Priority | Est. | Depends On |
|---|------|----------|------|------------|
| S2.1 | Replace "Loading..." text with branded skeleton/spinner | 🟡 | 1 hr | — |
| S2.2 | Add `aria-label` to all remaining icon-only buttons across the app | 🟡 | 45 min | — |
| S2.3 | Implement dynamic `<title>` per route (React Helmet or useEffect) | 🟢 | 1 hr | — |
| S2.4 | Add visible focus ring styles for keyboard navigation (`:focus-visible`) | 🟡 | 30 min | — |
| S2.5 | Fix `/onboarding` auth guard — either protect the route or make `ExperienceSelector` handle unauthenticated users gracefully | 🔴 | 1 hr | Arch decision |
| S2.6 | Improve color contrast for `--muted-foreground` to meet WCAG AA (4.5:1) | 🟢 | 5 min | — |
| S2.7 | Memoize clock component to prevent header re-render every second | 🟢 | 15 min | — |
| S2.8 | Either implement search in ConsoleLayout or replace with breadcrumb | 🟡 | 30 min (remove) | — |
| S2.9 | Consolidate dual Toaster components (keep Sonner, remove shadcn Toaster) | 🟡 | 30 min | Migration check |
| S2.10 | Sign-out confirmation dialog | 🟢 | 30 min | — |

**Sprint Total**: ~6 hours

---

## Sprint 3: UX Delight Layer (Week 3-4) — PLANNED

| # | Task | Priority | Est. |
|---|------|----------|------|
| S3.1 | Command Palette (Ctrl+K) with fuzzy search, quick nav, scan launch | 🟢 | 4 hrs |
| S3.2 | Implement `?tour=true` onboarding walkthrough | 🟢 | 4 hrs |
| S3.3 | Upgrade PapyrusGenie to visible "Help" assistant | 🟢 | 2 hrs |
| S3.4 | Add "Help/Support" link to sidebar | 🟢 | 15 min |
| S3.5 | Create `tokens.json` design system source-of-truth | 🟢 | 2 hrs |

**Sprint Total**: ~12 hours

---

## Phase 4+: Strategic (Q2 2026) — BACKLOG

| Initiative | Benefit | Status |
|------------|---------|--------|
| Session Replay (PostHog) | Real user heatmaps | Not started |
| Real-Time System Health UI | Live status instead of static "Operational" | Not started |
| RBAC UI for multi-org | Role-based views and permissions | Not started |
| i18n Foundation | Translation support | Not started |
| axe-core integration in CI | Automated a11y testing | Not started |

---

## Architectural Note

The remaining `@tailwind` and `@apply` lint warnings in `index.css` are **standard false positives** from the VS Code CSS linter when using Tailwind. These are resolved by adding a `css.customData` entry or installing the Tailwind CSS IntelliSense extension. They do not affect build or runtime behavior.

The deprecated `Linkedin`, `Twitter`, `Github` icon warnings in `FooterConversion.tsx` are from lucide-react deprecating old brand icon names in favor of newer ones (`LinkedinIcon` → use external brand SVGs). These are cosmetic and don't affect functionality.
