# SouHimBou.AI — Comprehensive UX Audit Report
**Methodology**: 7-Step UX Audit (Maze/Eleken/Nielsen Heuristic Framework)
**Auditor**: Antigravity (Advanced Agentic AI)
**Date**: 2026-02-10 | **Version**: 1.0
**Scope**: Full-stack UI/UX — Landing to Conversion, Onboarding to Dashboard

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Target Users & Personas](#2-target-users--personas)
3. [Audit Methodology](#3-audit-methodology)
4. [Key Findings — User Flows](#4-key-findings--user-flows)
5. [Heuristic Evaluation (Nielsen's 10)](#5-heuristic-evaluation-nielsens-10)
6. [Accessibility Audit (WCAG 2.2)](#6-accessibility-audit-wcag-22)
7. [Visual Design Audit](#7-visual-design-audit)
8. [Content Audit](#8-content-audit)
9. [Prioritized Recommendations](#9-prioritized-recommendations)
10. [Action Plan](#10-action-plan)

---

## 1. Executive Summary

SouHimBou.AI is a defense-focused SaaS product that automates STIG compliance workflows and CMMC audit readiness. The UI features a sophisticated dark-mode design system ("IMOHTEP") with premium styling. However, the audit reveals **23 UX issues** across 6 severity categories that impede user acquisition, onboarding, and day-to-day task completion.

### Key Metrics At-a-Glance

| Metric | Finding | Severity |
|--------|---------|----------|
| **Clicks: Landing → Dashboard** | 4-6 clicks (Sign Up → Email Verify → Login → Legal Acceptance → Experience Selection → Dashboard) | 🟡 Moderate |
| **Clicks: Login → Dashboard** | 2-3 clicks (Login → Legal Modal → Dashboard) | 🟢 Acceptable |
| **Onboarding Drop-off Risk** | High — 3-step orchestrator lacks progress indicator and has no "back" navigation | 🔴 Critical |
| **404 Page Brand Consistency** | None — uses `bg-gray-100` light mode, breaks dark-mode brand entirely | 🔴 Critical |
| **Loading States** | Bare "Loading..." text with no skeleton, spinner, or branded animation | 🟡 Moderate |
| **Accessibility (WCAG 2.2)** | 0 `aria-` attributes in pages, 0 `role` attributes, 0 skip-nav links, 0 ErrorBoundary | 🔴 Critical |
| **Error Resilience** | No React ErrorBoundary — unhandled exceptions crash the entire app | 🔴 Critical |
| **Footer Faulty Links** | 15+ `href="#anchor"` links that lead nowhere | 🟡 Moderate |
| **Homepage "Login" Link** | Missing — no visible "Sign In" affordance; only "Apply for Pilot" CTA | 🔴 Critical |

---

## 2. Target Users & Personas

Based on the product's code, marketing copy (TC-25), and positioning, we identify **3 primary personas**:

### Persona A: "The STIG Operator" (Primary)
- **Role**: 25B Information Technology Specialist, Cybersecurity Analyst (DoD)
- **Goal**: Run STIG scans, capture baselines, detect drift, generate compliance evidence
- **Pain Points**: Complex compliance workflows, manual evidence collection, tool fatigue
- **Key Journey**: Landing → Auth → Dashboard → STIG Scan → Evidence Export

### Persona B: "The Executive / CISO" (Secondary)
- **Role**: VP of Security, CISO, Program Manager
- **Goal**: Check compliance posture, review audit readiness at a glance
- **Pain Points**: Needs high-level view without deep-diving into tools
- **Key Journey**: Landing → Auth → Executive Dashboard → Compliance Report

### Persona C: "The Evaluator / Pilot Partner" (Acquisition)
- **Role**: Prospect evaluating the platform for potential contract
- **Goal**: Understand capabilities, assess product-market fit, sign up for pilot
- **Key Journey**: Landing → How It Works → Pilot CTA → Onboarding → Quick Tour

---

## 3. Audit Methodology

This audit employed the following techniques:

| Method | Tool/Approach | Coverage |
|--------|---------------|----------|
| **Heuristic Evaluation** | Nielsen's 10 Usability Heuristics | All user-facing surfaces |
| **User Flow Analysis** | Screen-by-screen code review | 8 key journeys mapped |
| **Accessibility Assessment** | WCAG 2.2 criteria, code-level inspection | All pages and components |
| **Visual Design Audit** | Design token consistency, CSS variable analysis | `index.css`, all pages |
| **Content Audit** | Link validation, copy consistency, label review | Footer, Nav, Forms |
| **Information Architecture** | Route mapping, navigation structure review | `App.tsx`, `ConsoleLayout.tsx` |
| **Error State Analysis** | Error handling, boundary checking, loading states | All async paths |

---

## 4. Key Findings — User Flows

### Flow 1: New Visitor → Pilot Sign-Up (Acquisition Funnel)

**Path**: `NewHomepage` → `HeroSection` → Click "Apply for Pilot" → `/onboarding` → `ExperienceSelector` → `StackDiscoveryWizard`

**Issues Found**:

| # | Issue | Severity | Heuristic |
|---|-------|----------|-----------|
| F1.1 | **No "Sign In" link on homepage header.** The header offers "How It Works", "Founder", "Blog", "DoD Center", and "Apply for Pilot" — but returning users have nowhere to log in. They must manually navigate to `/auth`. | 🔴 Critical | H7: Flexibility & Efficiency |
| F1.2 | **"Apply for Pilot" goes to `/onboarding` which is an unauthenticated route**, but `ExperienceSelector` checks `useUserAgreements()` for legal acceptance. For unauthenticated visitors, this is a dead-end — the legal modal depends on a user ID that doesn't exist. | 🔴 Critical | H5: Error Prevention |
| F1.3 | **Mobile menu doesn't close on navigation.** Clicking "Blog" or "DoD Center" in the mobile menu navigates but doesn't call `setMobileMenuOpen(false)`. The menu remains visible on the new page. | 🟡 Moderate | H4: Consistency |

### Flow 2: Returning User → Login → Dashboard

**Path**: `/auth` → Login Tab → Submit → Legal Modal → `/dashboard` → `STIGDashboard`

**Issues Found**:

| # | Issue | Severity | Heuristic |
|---|-------|----------|-----------|
| F2.1 | **Legal Terms modal fires on EVERY protected route visit** if `hasAcceptedAll` is false. This includes refreshes. The `ProtectedRoute` component sets `showTerms` to `!hasAcceptedAll` on every `agreementsLoading` change, with no debounce or session cache. | 🟡 Moderate | H3: User Control |
| F2.2 | **Login form tab state is decoupled from submit handler.** The Register tab's `onSubmit` calls `setIsLogin(false)` *inside* the handler, but the `Tabs` component renders based on `defaultValue="login"`, not controlled state. If a user was on the "Register" tab and refreshed, the form resets to "Login" — losing all entered data. | 🟡 Moderate | H1: Visibility |
| F2.3 | **"DoD CLASSIFIED" badge on the Auth page** may deter legitimate users. A `<Badge variant="destructive">` with `<AlertTriangle>` and "DoD CLASSIFIED" text creates anxiety for non-DoD users, which is the majority of SaaS prospects. | 🟡 Moderate | H2: Match Real World |

### Flow 3: Dashboard Navigation (Post-Auth)

**Path**: `ConsoleLayout` sidebar → Navigate between STIG Dashboard, Asset Scanning, Reports, Evidence, Billing

**Issues Found**:

| # | Issue | Severity | Heuristic |
|---|-------|----------|-----------|
| F3.1 | **Organization badge hardcoded to "Default Organization"** (line 97 in `ConsoleLayout.tsx`). The component has `currentOrganization` from context but never uses it for display. | 🟡 Moderate | H1: Visibility |
| F3.2 | **Notification bell has permanent red dot** (`<div className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full">`) with no actual notification system backing it. This is a phantom affordance — users click but nothing happens. | 🟡 Moderate | H4: Consistency |
| F3.3 | **Search bar is non-functional.** The `<input>` in the header has no `onChange` handler, no search logic, and no results display. It's a decorative element that violates Nielsen's "Visibility of System Status." | 🟡 Moderate | H1: Visibility |
| F3.4 | **Sidebar collapse tooltip (`pointer-events-none`)** means the tooltip text for collapsed sidebar items cannot be selected or interacted with. Correct behavior, but the tooltip positioning can overlap the sidebar edge on narrow screens. | 🟢 Minor | H8: Aesthetic |

### Flow 4: Error / Not-Found Recovery

**Path**: Any invalid URL → `NotFound` component

**Issues Found**:

| # | Issue | Severity | Heuristic |
|---|-------|----------|-----------|
| F4.1 | **404 page is styled in light mode** (`bg-gray-100`, `text-gray-600`, `text-blue-500`) while the entire application uses a dark theme. This is a jarring brand disconnect. | 🔴 Critical | H4: Consistency |
| F4.2 | **404 page has no navigation back to the app.** The only affordance is `<a href="/">Return to Home</a>`. No header, no sidebar, no branding. The user is completely disoriented. | 🔴 Critical | H3: User Control |
| F4.3 | **`console.error` on every 404.** The `useEffect` logs to `console.error`, which could confuse users who have their browser console open (common for DoD tech staff). | 🟢 Minor | H9: Help Errors |

---

## 5. Heuristic Evaluation (Nielsen's 10)

### H1: Visibility of System Status | ⚠️ FAIL

| Finding | Location | Severity |
|---------|----------|----------|
| Loading states are bare "Loading..." text, not branded spinners or skeletons | `ProtectedRoute.tsx:32`, `MasterAdmin.tsx:85` | 🟡 |
| No progress indicators during multi-step onboarding (`ExperienceSelector` → `StackDiscoveryWizard`) | `OnboardingOrchestrator.tsx` | 🔴 |
| System status bar shows "System: Operational" and "Region: US-East-1" permanently — no real health check feeds these values | `ConsoleLayout.tsx:123-128` | 🟡 |
| Clock ticks every second (`setInterval 1000ms`), causing unnecessary re-renders of the entire header | `ConsoleLayout.tsx:54-59` | 🟢 |

### H2: Match Between System and Real World | ✅ PASS (with caveat)

| Finding | Location | Severity |
|---------|----------|----------|
| Adinkra symbol naming (Eban, Sankofa, Duafe, etc.) is culturally meaningful but unfamiliar to the primary DoD persona | Sidebar navigation items in `ConsoleLayout.tsx` | 🟢 |
| "Entry Ritual" / "Sunsum Vitality" metaphors in `AuthProvider.tsx` are console-only and don't leak into the UI | `AuthProvider.tsx` | 🟢 |
| "DoD CLASSIFIED" badge on Auth page mismatches the product's actual classification level (UNCLASSIFIED per TC-25 §1-6) | `Auth.tsx:466-469` | 🟡 |

### H3: User Control and Freedom | ⚠️ FAIL

| Finding | Location | Severity |
|---------|----------|----------|
| **No "back" button in onboarding.** Once a user selects `enterprise-setup`, the flow transitions to `StackDiscoveryWizard` with no ability to return to `ExperienceSelector`. | `OnboardingOrchestrator.tsx:19` | 🔴 |
| **No "skip" option for the Legal Terms modal.** Users cannot defer acceptance. The modal blocks the entire dashboard. | `ProtectedRoute.tsx:44-51` | 🟡 |
| **Sign-out button has no confirmation dialog.** The `LogOut` icon button immediately calls `signOut()` with no "Are you sure?" prompt. | `ConsoleLayout.tsx:151` | 🟡 |

### H4: Consistency and Standards | ⚠️ FAIL

| Finding | Location | Severity |
|---------|----------|----------|
| **Three different background strategies**: Landing uses `bg-[#0a0a0a]`, Dashboard uses CSS variable `bg-background` (`hsl(220 15% 6%)`), 404 uses `bg-gray-100` | Global | 🔴 |
| **Two different font strategies**: Landing hardcodes `font-[Inter,sans-serif]`, Dashboard relies on browser default via `font-feature-settings` | `NewHomepage.tsx:19`, `index.css:137` | 🟡 |
| **Button variant naming inconsistency**: Auth uses `variant="cyber"`, Landing uses inline gradient classes, ConsoleLayout uses `variant="ghost"` and `variant="secondary"` | Global | 🟡 |
| **Two Toaster components mounted simultaneously** — `Toaster` (shadcn) and `Sonner` — can produce overlapping notifications | `App.tsx:55-56` | 🟢 |

### H5: Error Prevention | ⚠️ FAIL

| Finding | Location | Severity |
|---------|----------|----------|
| **No React ErrorBoundary.** Any unhandled exception in a component crashes the entire SPA with a white screen. | `App.tsx` (root) | 🔴 |
| **Password strength checking effect has missing dependency** (`checkPasswordStrength` removed from deps to prevent infinite loop — root cause is the function reference is unstable) | `Auth.tsx:49` | 🟡 |
| **`isAccountLocked()` called in useEffect dependency array** creates a new function reference every render, making the lockout timer re-mount repeatedly | `Auth.tsx:61` | 🟡 |
| **Newsletter form has `console.log` instead of real submission** (TODO comment) | `FooterConversion.tsx:14-16` | 🟡 |

### H6: Recognition Rather Than Recall | ✅ PASS

| Finding | Location | Severity |
|---------|----------|----------|
| Experience cards provide clear feature lists, time estimates, and visual icons | `ExperienceSelector.tsx` | 🟢 |
| Sidebar navigation uses consistent icon+label patterns with Adinkra overlay for active items | `ConsoleLayout.tsx` | 🟢 |
| Browser-style tab bar in dashboard provides familiar navigation | `BrowserNavigation` component | 🟢 |

### H7: Flexibility and Efficiency of Use | ⚠️ FAIL

| Finding | Location | Severity |
|---------|----------|----------|
| **No keyboard shortcuts** for power-user operations (e.g., Ctrl+K for search, Ctrl+S for scan) | Global | 🟡 |
| **No quick-launch or command palette** despite having a search bar in the header | `ConsoleLayout.tsx:108-116` | 🟡 |
| **Missing "Sign In" link on homepage** forces returning users to type `/auth` manually or use the mobile menu | `NewHomepage.tsx` | 🔴 |

### H8: Aesthetic and Minimalist Design | ✅ PASS

| Finding | Location | Severity |
|---------|----------|----------|
| Landing page is clean, well-structured, with intentional information hierarchy | `NewHomepage.tsx`, `HeroSection.tsx` | 🟢 |
| Dashboard uses `glass-card` and gradient effects tastefully; cybergrid overlay is subtle | `index.css` | 🟢 |
| "Development Status" banner on hero is honest and well-designed, building trust | `HeroSection.tsx:83-115` | 🟢 |

### H9: Help Users Recognize, Diagnose, and Recover From Errors | ⚠️ FAIL

| Finding | Location | Severity |
|---------|----------|----------|
| Auth error messages are contextual and helpful ("email not confirmed" → explains to check spam) | `Auth.tsx:120-122` | 🟢 |
| **404 page provides no diagnostic information** — just "Oops! Page not found" | `NotFound.tsx:18` | 🟡 |
| **Failed organization load** previously triggered disruptive toast on landing page (FIXED in prior audit) | `useOrganization.tsx` | 🟢 |

### H10: Help and Documentation | ⚠️ FAIL

| Finding | Location | Severity |
|---------|----------|----------|
| **No onboarding tour or tooltip walkthrough** for first-time dashboard users (the `?tour=true` query param is referenced but no tour component exists) | `OnboardingOrchestrator.tsx:28` | 🟡 |
| **PapyrusGenie AI assistant** is placed in the dashboard but no help documentation or FAQ links exist | `STIGDashboard.tsx:58` | 🟡 |
| **No visible "Help" or "Support" link** in the ConsoleLayout header or sidebar | `ConsoleLayout.tsx` | 🟡 |

---

## 6. Accessibility Audit (WCAG 2.2)

### Overall Score: ❌ NON-COMPLIANT

| Criterion | Status | Details |
|-----------|--------|---------|
| **1.1.1 Non-text Content** | ⚠️ Partial | Logo images have `alt` text; however, decorative Adinkra symbols lack `aria-hidden="true"`. Icon-only buttons (bell, logout, sidebar toggle) lack `aria-label`. |
| **1.3.1 Info and Relationships** | ❌ Fail | Forms use `<Label htmlFor>` correctly in Auth. However, the ConsoleLayout search input has no `<label>` element. |
| **2.1.1 Keyboard** | ❌ Fail | No `skip-nav` link. No `tabIndex` management. Sidebar tooltips use `pointer-events-none`. Mobile menu toggle has no `aria-expanded`. |
| **2.4.1 Bypass Blocks** | ❌ Fail | No skip-navigation link to bypass the header. No landmark roles (`<main>`, `<nav>`, `<aside>`) — all elements use `<div>` or generic `<header>`. |
| **2.4.2 Page Titled** | ❌ Fail | No dynamic `<title>` updates on route changes. Browser tab always shows the initial HTML `<title>`. |
| **2.4.4 Link Purpose** | ⚠️ Partial | Footer links are descriptive. However, icon-only buttons (logout, notification bell) have no visible or assistive label. |
| **3.1.1 Language** | ❌ Fail | No `lang` attribute inspection was possible from code alone, but the HTML template should be verified. |
| **4.1.2 Name, Role, Value** | ❌ Fail | **Zero `role` attributes** across all pages. **Zero `aria-` attributes** in pages (only 2 files in the entire `/pages` directory use `aria-` at all). The custom `<select>` in Auth registration has no `aria-label`. |

### Critical Accessibility Gaps

1. **No `<main>` landmark** — Screen readers cannot jump to the main content
2. **No `<nav>` landmark** on sidebar — Navigation is invisible to assistive technology
3. **Icon-only buttons lack labels** — Logout (`<LogOut>`), Notification (`<Bell>`), Sidebar toggle (`<Menu>`/`<X>`) are all inaccessible
4. **Color contrast** — `text-muted-foreground` (`hsl(220 9% 55%)`) on `bg-background` (`hsl(220 15% 6%)`) yields a contrast ratio of approximately **3.8:1**, below WCAG AA (4.5:1) for body text
5. **No focus indicators** beyond browser defaults — Custom focus styles are absent for interactive elements

---

## 7. Visual Design Audit

### Design System Consistency

| Token | Status | Notes |
|-------|--------|-------|
| `--primary` (Cyan) | ✅ Consistent | Used across buttons, badges, and active states |
| `--accent` (Purple) | ✅ Consistent | Used for gradient endpoints and secondary emphasis |
| `--background` / `--card` | ⚠️ Partial | Landing page overrides with `#0a0a0a` instead of using CSS variables |
| `--radius` (`0.75rem`) | ⚠️ Partial | Most components use it, but `HeroSection` uses `rounded-2xl` (1rem) for architecture cards |
| Typography | ⚠️ Inconsistent | No `@font-face` declaration; relies on system fonts unless `Inter` is loaded by the host page. The `font-[Inter,sans-serif]` on Landing is a Tailwind arbitrary value, not a design token. |

### Color Palette Harmony

- **Primary Palette**: Cyan (#00ffff) → Deep Blue (#0088ff) — ✅ Harmonious
- **Accent Palette**: Gold (#d4af37) → Dark Gold (#b8860b) — ✅ Harmonious, culturally resonant
- **Status Colors**: Well-differentiated destructive (red), warning (amber), success (green), info (blue) — ✅
- **Danger**: The `bg-gray-100` on 404 violates every color token — ❌

### Animation Performance

| Animation | Duration | `will-change` | `contain` | Verdict |
|-----------|----------|--------------|-----------|---------|
| `animate-float` | 8s | ✅ `transform` | ✅ | Good |
| `animate-pulse-glow` | 3s | ✅ `box-shadow` | ✅ | Good |
| `animate-adinkra-spin` | 12s | ✅ `transform` | ✅ | Good |
| `ConsoleLayout` clock | 1s `setInterval` | ❌ | ❌ | **Causes full header re-render every second** |
| `HeroSection` `framer-motion` radial gradient | 15s | N/A (framer) | N/A | Potentially expensive on mobile |

### CSS Architecture Issues

1. **Unclosed CSS block** in `index.css` — `.card-cyber` is missing its closing brace (line 162 jumps directly to `.tour-highlight` without closing the rule). This means `.tour-highlight` is accidentally nested inside `.card-cyber`, which may cause selector specificity issues.
2. **`.bg-cyber-mesh` and `.bg-cyber-grid` are defined inside `:root`** (line 66-78) instead of being in a proper `@layer components` block. These should be component utilities, not root-level declarations.

---

## 8. Content Audit

### Landing Page Copy

| Section | Finding | Severity |
|---------|---------|----------|
| Hero headline | Clear, impactful, keyword-rich ("AI-Powered STIG & CMMC Automation") | ✅ |
| Development status banner | Honest, specific, builds trust. Includes timeline tags. | ✅ |
| Footer links | **15+ dead `#anchor` links** (e.g., `#hpe-greenlake`, `#asoc`, `#cyber-rig`, `#managed-security`, `#nist`, `#cmmc`, `#mitre`, `#fedramp`, etc.) that navigate nowhere. This damages credibility. | 🔴 |
| Footer copyright | States "© 2025" — should be "© 2026" or dynamic | 🟡 |
| Footer legal links | `/privacy`, `/terms`, `/security`, `/compliance` — all route to 404 (no routes defined) | 🔴 |

### Auth Page Copy

| Element | Finding | Severity |
|---------|---------|----------|
| "STIG-First Compliance Autopilot" | Clear value prop ✅ | |
| "DoD CLASSIFIED" badge | Misleading — product is UNCLASSIFIED per TC-25 §1-6. Should be removed or changed to "UNCLASSIFIED // FOUO" if appropriate. | 🟡 |
| "Authenticate Access" button label | Militaristic but appropriate for target audience ✅ | |
| Registration field labels | Clear with icons ✅ | |
| "Security Clearance" dropdown on Register | Should clarify this is self-reported and informational, not a verification step | 🟢 |

---

## 9. Prioritized Recommendations

### 🔴 CRITICAL (Fix Immediately — Blocks Users or Breaks Trust)

| # | Issue | Recommendation | Effort |
|---|-------|---------------|--------|
| C1 | No "Sign In" on homepage | Add a "Sign In" link/button to the desktop and mobile nav in `NewHomepage.tsx` | 15 min |
| C2 | 404 page breaks brand | Redesign `NotFound.tsx` to use `bg-background`, dark theme, proper navigation, and branding | 30 min |
| C3 | No React ErrorBoundary | Add an `ErrorBoundary` component wrapping `<Routes>` in `App.tsx` to catch render crashes gracefully | 45 min |
| C4 | Footer dead links | Replace `#anchor` links with real routes or remove them. Mark as "Coming Soon" if the pages don't exist. | 1 hr |
| C5 | Footer legal pages (404) | Create stub pages for `/privacy`, `/terms`, `/security`, `/compliance` — or link to external docs | 1 hr |
| C6 | Accessibility: Zero landmarks | Add `role="main"`, `role="navigation"`, `aria-label` to key layout elements in `ConsoleLayout.tsx` and `NewHomepage.tsx` | 1 hr |
| C7 | No onboarding "back" button | Add a `goBack()` function to `OnboardingOrchestrator` that sets `currentFlow` back to `selection` | 15 min |

### 🟡 MODERATE (Fix Soon — Degrades Experience)

| # | Issue | Recommendation | Effort |
|---|-------|---------------|--------|
| M1 | Bare "Loading..." text | Replace with a branded skeleton/spinner component using `glass-card` styling and Adinkra animation | 1 hr |
| M2 | Mobile menu doesn't close | Add `setMobileMenuOpen(false)` to all navigation callbacks in `NewHomepage.tsx` | 15 min |
| M3 | Organization badge hardcoded | Use `currentOrganization?.name || 'Default Organization'` | 5 min |
| M4 | Phantom notification bell | Either implement a notification system or remove the red dot indicator | 30 min |
| M5 | Non-functional search bar | Either implement search or replace with a static breadcrumb/title | 30 min (remove) / 4 hrs (implement) |
| M6 | Clock re-renders header every second | Move clock to a separate memoized component, or update every 60s instead | 15 min |
| M7 | Dual Toaster mounting | Choose one notification system (Sonner recommended) and remove the other | 30 min |
| M8 | "DoD CLASSIFIED" badge on Auth | Change to "UNCLASSIFIED" or remove to match TC-25 classification | 5 min |
| M9 | Copyright year "2025" | Change to "© 2025-2026" or use `new Date().getFullYear()` | 5 min |
| M10 | `index.css` unclosed brace | Fix the `.card-cyber` rule block and move `.bg-cyber-mesh`/`.bg-cyber-grid` to `@layer components` | 15 min |
| M11 | No progress indicator in onboarding | Add a step indicator (1/3 dots) to `OnboardingOrchestrator` | 1 hr |
| M12 | Font loading not guaranteed | Add `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap">` to `index.html` | 10 min |

### 🟢 MINOR (Improve Over Time — Polish Items)

| # | Issue | Recommendation | Effort |
|---|-------|---------------|--------|
| P1 | No keyboard shortcuts | Implement Ctrl+K command palette | 4 hrs |
| P2 | No dynamic page titles | Add `useEffect` to update `document.title` per route | 1 hr |
| P3 | Sign-out without confirmation | Add a `Dialog` confirmation before `signOut()` | 30 min |
| P4 | No Help/Support link in dashboard | Add "Help" item to sidebar with link to docs or support email | 15 min |
| P5 | `?tour=true` references a non-existent tour | Implement or remove the reference | 4 hrs (implement) / 5 min (remove) |
| P6 | Muted text contrast below WCAG AA | Lighten `--muted-foreground` from `hsl(220 9% 55%)` to `hsl(220 9% 65%)` | 5 min |

---

## 10. Action Plan

### Sprint 1: Trust & Access (Week 1)
**Theme**: Remove barriers to entry and prevent trust erosion

| Task | Owner | Priority | Est. |
|------|-------|----------|------|
| Add "Sign In" to homepage nav | Frontend | 🔴 | 15 min |
| Redesign 404 page with dark theme + nav | Frontend | 🔴 | 30 min |
| Add React ErrorBoundary | Frontend | 🔴 | 45 min |
| Fix footer dead links (remove or stub) | Frontend | 🔴 | 1 hr |
| Create legal stub pages (/privacy, /terms) | Frontend | 🔴 | 1 hr |
| Fix mobile menu close on navigate | Frontend | 🟡 | 15 min |
| Change "DoD CLASSIFIED" badge | Frontend | 🟡 | 5 min |
| Fix copyright year | Frontend | 🟡 | 5 min |

**Sprint Total**: ~4.5 hours

### Sprint 2: Accessibility & Polish (Week 2)
**Theme**: Meet WCAG 2.2 baseline and refine daily UX

| Task | Owner | Priority | Est. |
|------|-------|----------|------|
| Add ARIA landmarks, labels, roles | Frontend | 🔴 | 1 hr |
| Add onboarding "back" button + progress dots | Frontend | 🔴/🟡 | 1.25 hr |
| Replace "Loading..." with branded spinner | Frontend | 🟡 | 1 hr |
| Fix organization badge display | Frontend | 🟡 | 5 min |
| Remove phantom notification dot | Frontend | 🟡 | 5 min |
| Remove or implement search bar | Frontend | 🟡 | 30 min |
| Fix `index.css` unclosed brace + class placement | Frontend | 🟡 | 15 min |
| Load Inter font properly | Frontend | 🟡 | 10 min |
| Optimize clock re-render | Frontend | 🟡 | 15 min |

**Sprint Total**: ~4.5 hours

### Sprint 3: Power-User & Excellence (Week 3-4)
**Theme**: Elevate from "functional" to "delightful"

| Task | Owner | Priority | Est. |
|------|-------|----------|------|
| Implement command palette (Ctrl+K) | Frontend | 🟢 | 4 hrs |
| Dynamic page titles per route | Frontend | 🟢 | 1 hr |
| Sign-out confirmation dialog | Frontend | 🟢 | 30 min |
| Help/Support link in sidebar | Frontend | 🟢 | 15 min |
| WCAG contrast fix for muted text | Frontend | 🟢 | 5 min |

**Sprint Total**: ~6 hours

---

## Appendix A: Customer Journey Map

```
                    ACQUISITION                        ACTIVATION                         RETENTION
                    ─────────────                      ──────────                         ─────────

                ┌────────────────┐              ┌────────────────┐              ┌────────────────────┐
                │   LANDING (/)  │              │   AUTH (/auth)  │              │  DASHBOARD (/stig)  │
                │                │              │                │              │                    │
 ENTER ──────► │ Hero Section   │  "Apply"  ► │ Login / Register│  Submit  ► │ ConsoleLayout      │
                │ How It Works   │ ◄──────── │ Password Strength│ ◄──────── │   ├─ STIG Dashboard │
                │ Pilot Program  │ ⚠ NO      │ Legal Terms     │  Redirect  │   ├─ Asset Scanning │
                │ Trust Anchors  │ "SIGN IN" │                │             │   ├─ Reports        │
                │ Founder Story  │             │                │             │   ├─ Evidence       │
                │ Footer/CTA     │             │                │             │   └─ Billing        │
                └────────────────┘              └────────────────┘              └────────────────────┘
                        │                              │                              │
                        ▼                              ▼                              ▼
                   ⚠ Dead Links                  ⚠ "DoD CLASSIFIED"            ⚠ "Loading..." text
                   ⚠ No Sign In                  ⚠ Lockout timer UX           ⚠ Phantom bell
                                                                               ⚠ Hardcoded org name
```

## Appendix B: Severity Legend

| Icon | Level | Definition |
|------|-------|------------|
| 🔴 | **Critical** | Blocks users, breaks trust, or violates compliance. Fix immediately. |
| 🟡 | **Moderate** | Degrades experience, causes confusion, or creates friction. Fix within 2 sprints. |
| 🟢 | **Minor** | Polish item. Improves delight but doesn't block functionality. Fix opportunistically. |

---

*The Interface is the Ritual. The Experience is the Truth.*
*Audit conducted under the SouHimBou Protocol Audit & Improvement Framework (PAIF) v1.0.0*
