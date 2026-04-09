---
phase: 01-foundation-auth
plan: 03
subsystem: ui
tags: [shadcn, tailwind, next.js, react, radix-ui, sonner, gnb, footer]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Monorepo structure with apps/web Next.js project, Pretendard font, globals.css"
provides:
  - "shadcn/ui component library (9 components: button, input, label, checkbox, tabs, dialog, separator, sonner, form)"
  - "App shell: GNB with logo/genre tabs/search/auth, Footer with legal links"
  - "Home empty state page with CTA"
  - "Auth component primitives: SocialLoginButton, StepIndicator, PasswordInput"
  - "Grapit design tokens as CSS custom properties"
  - "cn() utility for class merging"
affects: [01-05, 02-catalog]

# Tech tracking
tech-stack:
  added: [clsx, tailwind-merge, class-variance-authority, "@radix-ui/react-slot", "@radix-ui/react-label", "@radix-ui/react-checkbox", "@radix-ui/react-tabs", "@radix-ui/react-dialog", "@radix-ui/react-separator", sonner, lucide-react, react-hook-form, "@hookform/resolvers"]
  patterns: [shadcn-new-york-style, css-custom-properties-design-tokens, client-component-with-use-client]

key-files:
  created:
    - apps/web/components.json
    - apps/web/lib/cn.ts
    - apps/web/components/ui/button.tsx
    - apps/web/components/ui/input.tsx
    - apps/web/components/ui/label.tsx
    - apps/web/components/ui/checkbox.tsx
    - apps/web/components/ui/tabs.tsx
    - apps/web/components/ui/dialog.tsx
    - apps/web/components/ui/separator.tsx
    - apps/web/components/ui/sonner.tsx
    - apps/web/components/ui/form.tsx
    - apps/web/components/layout/gnb.tsx
    - apps/web/components/layout/footer.tsx
    - apps/web/components/layout/mobile-menu.tsx
    - apps/web/components/auth/social-login-button.tsx
    - apps/web/components/auth/step-indicator.tsx
    - apps/web/components/auth/password-input.tsx
    - apps/web/public/icons/kakao.svg
    - apps/web/public/icons/naver.svg
    - apps/web/public/icons/google.svg
  modified:
    - apps/web/app/globals.css
    - apps/web/app/layout.tsx
    - apps/web/app/page.tsx
    - apps/web/package.json

key-decisions:
  - "shadcn/ui New York style with Radix UI primitives for component foundation"
  - "Grapit brand colors as CSS custom properties in @theme block for Tailwind v4 integration"
  - "Sonner toast configured with brand colors, top-center position, 3s/5s durations"

patterns-established:
  - "shadcn component pattern: forwardRef + cn() + cva variants"
  - "Layout component pattern: GNB (client) + Footer (server) in root layout"
  - "Auth component pattern: self-contained 'use client' components with typed props"

requirements-completed: [AUTH-01, AUTH-02]

# Metrics
duration: 13min
completed: 2026-03-27
---

# Phase 01 Plan 03: Frontend App Shell + Design System Summary

**shadcn/ui design system with 9 components, app shell (GNB/Footer/Home), and auth UI primitives (SocialLoginButton/StepIndicator/PasswordInput) using Grapit brand palette**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-27T08:23:37Z
- **Completed:** 2026-03-27T08:36:54Z
- **Tasks:** 2
- **Files modified:** 24

## Accomplishments
- shadcn/ui initialized with New York style, 9 Radix UI-based components installed and themed with Grapit brand colors
- App shell complete: sticky GNB with logo, disabled genre tabs, disabled search bar, and login button; Footer with legal links (개인정보처리방침 bold per Korean law); responsive mobile hamburger menu
- Home empty state page with brand heading, description, and CTA linking to /auth per UI-SPEC
- Auth component primitives ready for Plan 05: branded social login buttons (Kakao/Naver/Google with self-hosted SVG icons), 3-step registration progress indicator, password input with eye toggle

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize shadcn/ui, install components, and set up Grapit design tokens** - `eb67065` (feat)
2. **Task 2: Build GNB, Footer, Home page, and reusable auth components** - `f7a6f18` (feat)
3. **Housekeeping: next-env.d.ts** - `55ae533` (chore)

## Files Created/Modified
- `apps/web/components.json` - shadcn/ui configuration (New York style, CSS variables)
- `apps/web/lib/cn.ts` - Class merging utility (clsx + tailwind-merge)
- `apps/web/components/ui/button.tsx` - Button with 6 variants (default/destructive/outline/secondary/ghost/link) and 4 sizes
- `apps/web/components/ui/input.tsx` - 44px input with Grapit focus ring
- `apps/web/components/ui/label.tsx` - Radix UI label with error styling
- `apps/web/components/ui/checkbox.tsx` - 20px checkbox with primary fill + check icon
- `apps/web/components/ui/tabs.tsx` - Tabs with primary underline for active state
- `apps/web/components/ui/dialog.tsx` - Modal dialog with overlay, close button, header/footer sections
- `apps/web/components/ui/separator.tsx` - Horizontal/vertical separator
- `apps/web/components/ui/sonner.tsx` - Toast wrapper: top-center, brand colors, 3s success / 5s error
- `apps/web/components/ui/form.tsx` - react-hook-form integration with FormField/FormItem/FormLabel/FormControl/FormMessage
- `apps/web/components/layout/gnb.tsx` - Sticky 64px GNB: logo, 5 genre tabs (disabled), search (disabled), login/profile dropdown, mobile hamburger
- `apps/web/components/layout/footer.tsx` - Gray-100 footer with legal links, copyright, 개인정보처리방침 bold
- `apps/web/components/layout/mobile-menu.tsx` - Slide-in overlay with auth link, genre tabs, body scroll lock
- `apps/web/components/auth/social-login-button.tsx` - Branded buttons for Kakao (#FEE500), Naver (#03C75A), Google (#FFFFFF + border), loading spinner
- `apps/web/components/auth/step-indicator.tsx` - 3-step dots with lines, active/completed/future states, Lucide Check icon
- `apps/web/components/auth/password-input.tsx` - Input with Eye/EyeOff toggle, same 44px height as standard Input
- `apps/web/public/icons/kakao.svg` - Kakao speech bubble brand icon
- `apps/web/public/icons/naver.svg` - Naver "N" brand icon
- `apps/web/public/icons/google.svg` - Google multicolor "G" brand icon
- `apps/web/app/globals.css` - Grapit design tokens: primary #6C3CE0, gray scale, semantic colors, spacing scale
- `apps/web/app/layout.tsx` - Root layout with GNB, Footer, Toaster, flex column, min-h-screen
- `apps/web/app/page.tsx` - Home empty state: brand logo, heading, description, CTA to /auth

## Decisions Made
- shadcn/ui New York style chosen as component foundation (matches D-10 through D-16 design decisions)
- Grapit brand colors configured via Tailwind v4 `@theme` block instead of `:root` CSS variables, enabling `bg-primary` / `text-gray-900` etc. in utility classes
- Sonner toast positioned top-center per UI-SPEC interaction patterns
- Social login SVG icons self-hosted in `/public/icons/` rather than using Lucide (per UI-SPEC mandate for brand-accurate icons)

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None -- no external service configuration required.

## Known Stubs
None -- all components render their intended content. Auth state defaults to `isAuthenticated=false` (intentional; full auth wiring in Plan 05).

## Next Phase Readiness
- All shadcn components and auth primitives are ready for Plan 05 (Frontend auth pages + API integration)
- GNB and Footer render in root layout; Plan 05 will wire auth state to GNB
- SocialLoginButton, StepIndicator, PasswordInput are exported and typed for direct use in /auth page

## Self-Check: PASSED

All 20 created files verified present. All 3 commits (eb67065, f7a6f18, 55ae533) verified in git log. Next.js build passes.

---
*Phase: 01-foundation-auth*
*Completed: 2026-03-27*
