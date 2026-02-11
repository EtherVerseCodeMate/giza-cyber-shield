# SouHimBou.AI — Improved Remediation Plan
**Version**: 2.1 (Sprint 2 Complete)
**Date**: 2026-02-10
**Status**: Sprint 1 ✅ COMPLETE | Sprint 2 ✅ COMPLETE | Sprint 3 Queued

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

## Sprint 2: Accessibility & Polish ✅ COMPLETE

### Files Created (3 new)

| File | Purpose |
|------|--------|
| `src/components/LoadingScreen.tsx` | Branded loading spinner with Adinkra-themed rotating ring, pulsing Shield icon, shimmer progress bar |
| `src/components/console/HeaderClock.tsx` | Self-contained clock component preventing header re-renders every second |
| `src/hooks/useDocumentTitle.ts` | Dynamic `<title>` per route for SEO and tab identification |

### Files Modified (5 existing)

| File | Changes |
|------|--------|
| `src/components/ProtectedRoute.tsx` | Replaced bare "Loading..." with branded `LoadingScreen` |
| `src/pages/MasterAdmin.tsx` | Replaced bare "Loading..." with branded `LoadingScreen`, removed unused `Scale` import, added `aria-label` to sign-out button |
| `src/components/console/ConsoleLayout.tsx` | Extracted clock into `HeaderClock`, removed timer `useEffect`, preventing full-layout re-renders every second |
| `src/index.css` | Improved `--muted-foreground` contrast (55% → 65% lightness for WCAG AA), added global `:focus-visible` ring styles, added `@keyframes shimmer` |
| `src/App.tsx` | Added `DocumentTitle` component calling `useDocumentTitle` hook inside router |

### Issues Resolved

| ID | Issue | Resolution |
|----|-------|------------|
| S2.1 | Bare "Loading..." text | ✅ Branded `LoadingScreen` with spinner, shimmer, contextual messages |
| S2.2 | Missing aria-labels | ✅ Added to MasterAdmin sign-out button (ConsoleLayout was done in Sprint 1) |
| S2.3 | No dynamic `<title>` per route | ✅ `useDocumentTitle` hook with 16 route mappings + blog prefix matching |
| S2.4 | No visible focus styles | ✅ Global `*:focus-visible` with cyan 2px outline |
| S2.6 | Muted text fails WCAG AA | ✅ Lightness increased from 55% → 65% |
| S2.7 | Clock causes full header re-render | ✅ Extracted to standalone `HeaderClock` component |
| S2.9 | Unused `Scale` import in MasterAdmin | ✅ Removed |

### Remaining for Future Sprints

| # | Task | Priority | Notes |
|---|------|----------|-------|
| S2.5 | `/onboarding` auth guard | 🔴 | Requires arch decision: protect route or make ExperienceSelector handle unauth |
| S2.8 | Search bar (fake or real) | 🟡 | Currently non-functional — needs either implementation or removal |
| S2.10 | Sign-out confirmation dialog | 🟢 | Nice-to-have, low risk |

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
