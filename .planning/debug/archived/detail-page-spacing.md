---
status: resolved
trigger: "Performance detail page padding/margin inconsistencies — UAT Test 3 cosmetic issue"
created: 2026-03-31T12:00:00Z
updated: 2026-03-31T12:05:00Z
---

## Current Focus

hypothesis: Multiple spacing issues compound to create poor visual rhythm on the detail page
test: Compared spacing patterns across all pages and component hierarchy
expecting: Specific mismatches in padding, margin, and structural gaps
next_action: Report diagnosis

## Symptoms

expected: Performance detail page renders with proper spacing and layout — all tab panels show real content with consistent padding/margin
actual: "전부 다 보이는데, 패딩, 마진 등이 이상해서 수정해야됨" — everything shows but spacing is off
errors: None — cosmetic only
reproduction: Visit /performance/:id
started: Discovered during Phase 2 UAT

## Eliminated

- hypothesis: LayoutShell or GNB/Footer inject unexpected spacing
  evidence: LayoutShell only wraps children in `flex flex-1 flex-col` with no padding. GNB is sticky h-16. Footer has mt-auto. No extra spacing injected.
  timestamp: 2026-03-31T12:02:00Z

- hypothesis: globals.css overrides cause spacing issues
  evidence: globals.css only defines theme tokens and body font. No element-level padding/margin overrides.
  timestamp: 2026-03-31T12:02:30Z

## Evidence

- timestamp: 2026-03-31T12:01:00Z
  checked: Container pattern across all pages
  found: All pages use `mx-auto max-w-[1200px] px-6` consistently (home, genre, detail). This is fine.
  implication: Container width/padding is not the problem

- timestamp: 2026-03-31T12:01:30Z
  checked: Tab section spacing in detail page (lines 164-248)
  found: Tabs container has `mt-8` but TabsContent base class has `mt-4` (from tabs.tsx line 47) PLUS page applies `py-8` on each TabsContent. This creates double spacing — mt-4 gap from component + py-8 top padding = 48px visual gap between TabsList and content. Compared to genre page which uses `mt-6`, `mt-8` spacing directly without Tabs wrapper.
  implication: Tab content has excessive top spacing (mt-4 + pt-8 = 48px) creating a disconnected feel between tab headers and content

- timestamp: 2026-03-31T12:02:00Z
  checked: Mobile bottom CTA bar overlap with page content
  found: Fixed bottom bar is h-16 (64px) at line 252, but main content has no bottom padding to compensate. Last TabsContent ends with py-8 (32px bottom padding) which is less than the 64px bar height. On mobile, the bottom of tab content can be obscured by the fixed CTA bar.
  implication: Content gets cut off behind the fixed CTA bar on mobile viewports

- timestamp: 2026-03-31T12:03:00Z
  checked: Poster and info panel layout on mobile
  found: On mobile (< lg breakpoint), poster has no max-width constraint — it's `w-full` with aspect-[2/3], so it fills the entire viewport width minus px-6 padding. A full-width 2:3 poster on a 390px phone = ~357px wide x ~536px tall, pushing all info content far below the fold. The lg:max-w-[380px] only applies at lg+ breakpoint.
  implication: On mobile, the poster dominates the viewport with no width cap, making the page feel poorly proportioned

- timestamp: 2026-03-31T12:03:30Z
  checked: Info panel sticky positioning
  found: Info panel has `lg:sticky lg:top-20 lg:self-start` but top-20 (80px) with GNB at h-16 (64px) means only 16px clearance from the GNB bottom edge. The info panel can overlap or feel too close to the header on scroll.
  implication: Minor but contributes to "spacing feels off" impression at desktop

- timestamp: 2026-03-31T12:04:00Z
  checked: Tab section has no horizontal containment
  found: Tabs section sits inside the same container as poster+info. But casting grid uses `grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4` which may produce different visual density than the poster section above. The prose content in detail/sales tabs uses `max-w-none` which stretches text to full 1200px — very wide for comfortable reading.
  implication: Text content in detail/sales tabs has no readable max-width, creating uncomfortable line lengths. Standard prose reading is typically 60-80ch (~650-800px).

- timestamp: 2026-03-31T12:04:30Z
  checked: Separator spacing in price table
  found: Separator has `my-4` (16px top/bottom margin), then price list follows with no additional spacing before the CTA button, which has `mt-6`. The visual rhythm from info items -> separator -> prices -> button is 8px gap -> 16px -> 0px -> 24px — inconsistent.
  implication: Price section spacing is uneven compared to the info section above it

## Resolution

root_cause: Multiple compounding spacing issues in /performance/[id]/page.tsx — (1) TabsContent double top spacing (component mt-4 + page py-8), (2) no mobile bottom padding to clear the fixed h-16 CTA bar, (3) mobile poster has no max-width causing it to fill viewport, (4) prose text in detail/sales tabs has max-w-none stretching to full container width (poor readability), (5) inconsistent vertical rhythm in info panel sections
fix:
verification:
files_changed: []
