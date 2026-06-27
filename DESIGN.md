# DESIGN.md — Griskus Design System

Last updated: 2026-06-26 via `/design-consultation`.

---

## Product Context

- **What this is:** A 25+ year archive of the Pat Griskus Memorial Triathlon (Bantam Lake, Morris CT). Not a lookup tool — a personal sports record.
- **Who it's for:** Returning athletes first (checking their history, spotting trends, feeling the story). Race directors second (field trends, year-over-year data). First-timers third.
- **The one thing to remember:** "This isn't just results — there's something to learn here about yourself and the race."
- **Project type:** Data-dense web app / personal sports archive

---

## Aesthetic Direction

- **Direction:** Industrial/Utilitarian with Editorial spine
- **Decoration level:** Intentional — hairline dividers, grid lines in charts, no illustrations, no decorative blobs. The numbers are the decoration.
- **Mood:** Serious sports history, not a spreadsheet. A returning athlete landing on their page should feel like a headline, not a row in a table.
- **Reference:** Strava (athlete as hero, numbers as achievements, identity over data) — applied to a community race archive that spans generations.

**What we deliberately avoided:** Every other triathlon results site is a data dump — white background, generic sans-serif, small crowded tables, zero personality. Athlinks, RunSignup, iResultsLive all treat the result as the product and the presentation as purely functional. Griskus is already something else.

---

## Typography

| Role | Typeface | Tailwind class | Rationale |
|------|----------|----------------|-----------|
| Display / nameplate | Barlow Condensed 700–800 | `font-display` | Angular, athletic, takes up space confidently. Earns identity moments. |
| Body + UI labels | DM Sans 400/500/600 | (default) | Cleaner than Inter, better optical sizing at 11–12px where axis labels live. Warmer letter shapes. |
| Data / times | Geist Mono (tabular-nums) | `font-data tabular-nums` | Monospaced numerals keep time columns aligned without switching to a code font. |

**Scale:**
- Athlete nameplate: `text-5xl sm:text-6xl font-bold tracking-tight uppercase` (Barlow Condensed 800)
- Section headers (inside cards): `font-display text-base font-semibold tracking-tight uppercase`
- Stat values: `font-display text-3xl font-bold leading-tight`
- Stat labels: `text-xs font-semibold tracking-wide uppercase` (DM Sans)
- Fine print / axis labels: `text-[10px]` or `text-xs` (DM Sans)
- Body / table rows: `text-sm` (DM Sans)
- Times in tables and charts: Geist Mono, `tabular-nums`

**Rule:** Never `system-ui` or `-apple-system` as primary. Never Inter (too common, no personality at 11px). DM Sans is the new default body font.

---

## Color System

All tokens defined in `frontend/tailwind.config.js`.

### Brand (deep navy-teal)

| Token | Hex | Usage |
|-------|-----|-------|
| `brand-50` | `#eef4f9` | Hover backgrounds, very light tints |
| `brand-100` | `#d0e4f0` | Claim badge borders, light accents |
| `brand-300` | `#6aaed1` | Claim button border |
| `brand-400` | `#3d92bf` | Loading spinner, light interactive |
| `brand-500` | `#2378a8` | Primary interactive (links, tags) |
| `brand-700` | `#1a5078` | Claim button text, secondary headings, Olympic race type |
| `brand-900` | `#0e2d44` | Athlete name, section headers, stat values, nav background |

The deep teal stays. Returning athletes have associated it with this race since 2005 — changing it would break brand recognition for the exact audience that matters most.

### Finish / Achievement (copper-amber — restricted)

| Token | Hex | Usage |
|-------|-----|-------|
| `finish-400` | `#d4923a` | Hover state for PB elements |
| `finish-500` | `#c87f3e` | PB dots, personal best time display, podium callouts |
| `finish-600` | `#a8662e` | PB text on light backgrounds (contrast) |

**Rule:** `finish-*` is reserved for personal bests and podium moments only. No race result site uses warm color — ours does, and that means something. When an athlete sees copper, they know it's special. Overuse destroys the signal. Never use for decoration, dividers, or general UI chrome.

### Race type accent colors

Defined in `frontend/src/constants/raceTypes.js`. Used consistently across all chart and badge components.

| Race type | Hex | Badge style |
|-----------|-----|-------------|
| Olympic | `#1a5078` (brand-700) | `bg-blue-100 text-blue-800` |
| Sprint | `#10b981` | `bg-emerald-100 text-emerald-800` |
| Duathlon | `#8b5cf6` | `bg-violet-100 text-violet-800` |
| Total / combined | `#6366f1` | indigo — neutral, not tied to a race type |

### Slate neutrals

Standard Tailwind slate scale:
- `slate-50` / `slate-100` — page background (`#fafaf8` warm off-white), hover states
- `slate-200` — card borders, dividers, chart grid lines
- `slate-400` — axis ticks, sort indicators, disabled states
- `slate-500` — subheadings, column headers, muted labels
- `slate-600` — body text in tooltips and cards
- `slate-900` — default body text

### Page background

`bg-[#fafaf8]` — warm off-white, not pure white. Defined on `body` in `index.css`. Keeps the page from feeling clinical.

---

## Surface / Card Pattern

The canonical card:
```
rounded-xl border border-slate-200 bg-white shadow-sm p-4
```

**Rules:**
- `shadow-sm` only — no `shadow-md` or `shadow-lg`. Decorative shadows are banned.
- `rounded-xl` is the standard card radius.
- Cards are always white on the warm off-white background.
- No card-in-card nesting. If content belongs together, it's one card with internal structure.

**Stat card** (`StatCard.jsx`) — slightly tighter than panel cards:
```
rounded-lg bg-white border border-slate-200 px-4 py-3 text-center shadow-sm
```

---

## Layout

- **Approach:** Hybrid — strict grid for data tables and stat cards (predictable, fast to scan), editorial typographic scale for nameplates and section headers.
- **Max content width:** Constrained via `App.jsx` wrapper, centered.
- **Vertical rhythm:** `space-y-6` between sections.
- **Stat grid:** `grid grid-cols-2 sm:grid-cols-3 gap-3`
- **Alignment:** Left-aligned throughout. Race results are scanned vertically, not read like a poster. Left alignment keeps the eye moving down.

**Section order in athlete profile (top → bottom):**
1. Back nav + share link
2. Athlete nameplate (name, years, race count, claim button)
3. Stat grid (6 cards: Total Races, Best Finish, Olympic PB, adaptive 4th, Best Div Rank, Est. Miles)
4. Your Griskus Story (FunStats — warm narrative, sets the identity tone before data)
5. Finish Time History (TimelineChart)
6. Career Arc (split trend charts by race type)
7. Discipline DNA (radar — 3 columns: Sprint | Olympic | Total)
8. Race result tables (Olympic, Sprint, Duathlon)

FunStats comes before the charts intentionally — the narrative framing ("you've spent 43 hours racing this") makes the data sections that follow feel personal rather than generic.

---

## Interactive Components

### Toggle buttons (race type selector, mobile tabs)
```
px-2.5 py-1 rounded-full text-xs font-medium transition-colors
Active:   bg-brand-900 text-white
Inactive: bg-slate-100 text-slate-600 hover:bg-slate-200
```
Always include `aria-pressed={isActive}`.

### Back navigation
```
flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors
```

### Icon-only buttons
Always include `aria-label` on the button element. Always add `aria-hidden="true"` to the SVG. `title` attribute alone is not sufficient for accessibility.

### Claim / "This is me" button
```
rounded-full border border-brand-300 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50
```
Claimed state: plain `text-xs text-emerald-600 font-medium` + `text-xs text-slate-400 underline` remove link.

### Popover (TriScorePopover)
Triggered by `onMouseEnter`/`onMouseLeave` + `onFocus`/`onBlur` for keyboard access.
```
z-50 w-56 rounded-lg border border-slate-200 bg-white shadow-lg p-3 text-left pointer-events-none
```

---

## Charts (Recharts)

All charts use `ResponsiveContainer`. Standard visual tokens:

| Element | Value |
|---------|-------|
| Grid lines | `stroke="#e2e8f0"` `strokeDasharray="3 3"` |
| Axis ticks | `fontSize: 10`, fill `#94a3b8` (minor) or `#64748b` (major) |
| Axis lines | `axisLine={false}` `tickLine={false}` |
| PB / highlight dots | `fill="#c87f3e"` (finish-500 copper) |
| Regular dots | `r={3}`, series color fill, `stroke="#fff" strokeWidth={1.5}` |
| Median / reference lines | `strokeDasharray="4 3" strokeOpacity={0.5}` |
| Tooltip | `fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0'` |

**Dual Y-axis pattern** (CareerArc `DisciplineChart`): left axis = time (reversed), right axis = field % (0–100). Both use `axisLine={false}`.

**PB dot key prop:** The Recharts dot render prop must destructure `key` at the call site: `dot={({ key, ...props }) => <PBDot key={key} {...props} />}`. Spreading `key` via `{...props}` triggers a React warning.

**Accessibility rule:** Every interactive chart must include a visually-hidden `<table className="sr-only" aria-label="...">` containing the same data. Hover-only tooltips are inaccessible to keyboard and screen reader users.

---

## Motion

- **Approach:** Minimal-functional — only motion that aids comprehension.
- Chart lines draw in on mount: `300ms ease-out`
- Tabs, toggles, hover states: `150ms` fade/transition
- No decorative animation, no scroll-driven effects, no entrance choreography

---

## Loading States

| Context | Pattern |
|---------|---------|
| Full view (AthleteView loading/error) | Centered `animate-spin` SVG, `h-8 w-8 text-brand-500` |
| Lazy chart sections | `animate-pulse` card placeholder with explicit height matching expected content |
| Inline data fetch (DisciplineRadar field data) | `animate-spin h-6 w-6 text-brand-400` centered in a fixed-height container |

Placeholder heights: FunStats `h-[140px]`, TimelineChart `h-[252px]`, CareerArc `h-[200px]`, DisciplineRadar `h-[280px]`.

---

## Empty / Placeholder States

Every panel that can have no data must show a card (not `null`):

```jsx
<div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 text-center">
  <p className="text-sm text-slate-400">[Primary reason]</p>
  <p className="text-xs text-slate-300 mt-1">[Context / when it unlocks]</p>
</div>
```

Never return `null` silently from a section-level component when data is absent — the missing section breaks the visual rhythm of the athlete profile.

---

## Routing

No router library. Athlete/race links use callback props (`onSelectAthlete`, `onViewRace`) passed from `App.jsx` — never `<a href>` (causes full page reload, breaks SPA UX). See `frontend/src/App.jsx` and the `spa-card-navigation` pitfall in gstack learnings.

---

## API Calls

All fetches use `api('/api/...')` from `frontend/src/utils/api.js` for subpath deployment compatibility at `/griskus`. Never use bare `/api/...` paths.

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-26 | DM Sans replaces Inter as body font | Better optical sizing at 11–12px, warmer letter shapes, distinguishes Griskus from generic data tools |
| 2026-06-26 | Geist Mono for tabular time data | Monospaced numerals align time columns without the code-font feel of JetBrains Mono |
| 2026-06-26 | Copper/amber (#c87f3e) reserved for PBs and podium only | Scarcity creates meaning — no other race results site uses warm color as an achievement signal |
| 2026-06-26 | Barlow Condensed pushed to text-5xl/6xl on nameplates | Returns athletes should feel like a headline, not a table row |
| 2026-06-26 | FunStats narrative placed above charts | Sets identity context before data — "43 hours racing Griskus" makes the charts that follow feel personal |
| 2026-06-26 | DisciplineRadar: 3 columns (Sprint / Olympic / Total) | Parallel view is more revealing than toggling; Total column uses indigo to signal cross-type aggregate |
| 2026-06-26 | sr-only tables required on all interactive charts | Recharts hover tooltips are inaccessible to keyboard/AT users; hidden tables are the correct solution |
| 2026-06-26 | Deep teal brand color kept unchanged | 25+ years of brand recognition for the returning-athlete audience; changing it would be disorienting |
