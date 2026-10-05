# Design guide

Rules for typography, radius, layout and motion in Srcflow. Read this before touching
text size, `rounded-*` or a `*.module.css` file.

- Sections 1–6 apply to Tailwind `className`s (the pages you build).
- Editor components are styled with CSS Modules (`src/components/editor/*.module.css`)
  and use the **tokens in section 12** instead — no raw px outside the scale.
- Section 8 (modal width) applies to both.

The `@utility` classes below are defined in [src/app/globals.css](src/app/globals.css).

---

## 1. Font rules

- **Don't** use raw Tailwind font sizes — `text-xs`, `text-sm`, `text-base`, `text-lg`,
  `text-2xl`, `text-[18px]`, `sm:text-*`, …
- **Don't** add `font-medium` / `font-semibold` / `font-bold` to a role — the role sets the weight.
- **Don't** add `leading-*` — the role sets the line height.
- Use one class from the table in section 2 per element.
- Roles are already responsive — **don't** add `md:` / `lg:` to them.
- Text color is separate: use `var(--foreground)` / `var(--muted)` / `var(--accent)` or the
  `@theme` utilities (`text-foreground`, `text-accent`).

If no role fits, open an issue rather than adding a `text-[..px]`.

## 2. Type scale

Breakpoints: mobile < 768px · tablet ≥ 768px (`md`) · desktop ≥ 1024px (`lg`).

| class | mobile | tablet | desktop | line-height | weight |
|---|---|---|---|---|---|
| `text-display-lg` | 40px | 64px | 96px | 1.05 | 400 |
| `text-display-md` | 36px | 48px | 64px | 1.1 | 400 |
| `text-display-sm` | 32px | 40px | 56px | 1.1 | 400 |
| `text-headline-lg` | 28px | 36px | 48px | 1.2 | 400 |
| `text-headline-md` | 24px | 32px | 40px | 1.2 | 400 |
| `text-headline-sm` | 20px | 28px | 36px | 1.3 | 400 |
| `text-title-lg` | 20px | 24px | 28px | 1.4 | 500 |
| `text-title-md` | 18px | 20px | 24px | 1.4 | 500 |
| `text-title-sm` | 16px | 18px | 20px | 1.4 | 500 |
| `text-body-lg` | 16px | 18px | 18px | 1.6 | 400 |
| `text-body-md` | 16px | 16px | 16px | 1.5 | 400 |
| `text-body-sm` | 14px | 14px | 14px | 1.5 | 400 |
| `text-label-lg` | 16px | 16px | 16px | 1.5 | 500 |
| `text-label-md` | 14px | 14px | 14px | 1.4 | 500 |
| `text-label-sm` | 12px | 12px | 12px | 1.35 | 500 |

The body font is `--font-sans`, set by the **Theme Manager** — change it there, not by
editing `globals.css`.

## 3. Which role when

- **display** — hero / landing only, one per page. `lg` main hero, `md` secondary hero,
  `sm` closing line of a big section.
- **headline** — section titles. `lg` main section, `md` sub-section or large card, `sm`
  heading inside a section.
- **title** — component / card / list-row titles. `lg` featured card or dialog, `md` regular
  card, `sm` list row or column header.
- **body** — running text. `lg` lead paragraph, `md` default (**use this when unsure**),
  `sm` secondary text, notes, help text.
- **label** — non-sentence text: buttons, tabs, chips, badges, captions. `lg` primary
  button, `md` small button / tab / chip, `sm` badge / caption / counter.

## 4. Example

```tsx
// ✗
<h2 className="text-2xl md:text-3xl font-bold leading-tight">Plans</h2>
<p className="text-sm opacity-60">Choose an amount</p>
<button className="text-xs font-medium">Confirm</button>

// ✓
<h2 className="text-headline-md">Plans</h2>
<p className="text-body-sm opacity-60">Choose an amount</p>
<button className="text-label-md">Confirm</button>
```

## 5. Migrating raw sizes

| raw | without font-weight | with font-bold / medium |
|---|---|---|
| `text-xs` | `text-label-sm` | `text-label-sm` |
| `text-sm` | `text-body-sm` | `text-label-md` |
| `text-base` | `text-body-md` | `text-label-lg` |
| `text-lg` | `text-body-lg` | `text-title-md` |
| `text-xl` | `text-headline-sm` | `text-title-lg` |
| `text-2xl` | `text-headline-md` | `text-headline-md` |
| `text-3xl` | `text-headline-lg` | `text-headline-lg` |
| `text-4xl` / `text-5xl` | `text-display-md` | `text-display-md` |
| `text-6xl`+ | `text-display-lg` | `text-display-lg` |

For responsive pairs (`text-sm md:text-base`), pick the role by the **mobile** size and
drop the variants — the role grows on its own. A lone `font-bold` / `font-semibold` with
no size becomes `text-label-lg`.

## 6. Radius

`--radius` (12px by default, adjustable in the Theme Manager) maps to three Tailwind steps:

| class | value | use for |
|---|---|---|
| `rounded-full` | circle | avatars, round icon buttons, pills |
| `rounded-xl` | `--radius + 6` (18) | large boxes — modal, panel, section |
| `rounded-lg` | `--radius` (12) | cards, content boxes |
| `rounded-md` | `--radius − 2` (10) | buttons, inputs, small nested items |
| `rounded-none` | 0 | a side that butts against another box |

**Avoid** `rounded-2xl` / `rounded-3xl` (not tied to `--radius`), `rounded-sm` / `rounded-xs`,
bare `rounded`, and arbitrary values like `rounded-[12px]`.

**Nesting:** inner radius = outer radius − padding. Pairs that work: `rounded-xl` + `p-1.5`
→ `rounded-lg`; `rounded-lg` + `p-0.5` → `rounded-md`.

## 7. Building new UI

- Find the closest existing screen or component and follow it — same patterns, same theme.
- Reuse components in `src/components/editor/` before writing a new primitive.
- Colors come from CSS variables (`--foreground`, `--accent`, `--muted`, `--surface`) or
  `@theme` utilities — no raw colors or `bg-[#...]`.
- Mobile first: add `md:` / `lg:` only for layout (grid, flex, gap, padding, width), never
  for font size. Wide content scrolls inside its own box (`overflow-x-auto`); the page
  never scrolls sideways. Tap targets must work on touch screens.

## 8. Modal width

Every modal uses **`max-width: 680px`** — let height and inner scrolling adapt to the
content instead of picking another width. (680px comes from the Route Manager tree, which
needs the room.)

## 9. Scroll areas — `OverlayScroll`

Every scrollable area uses [`OverlayScroll`](src/components/editor/OverlayScroll.tsx). It
hides the native scrollbar and draws a slim overlay thumb that appears on hover/scroll.

```tsx
<OverlayScroll viewportClassName={styles.body} inset={{ top: 16, right: 6, bottom: 16 }}>
  …
</OverlayScroll>
```

- `viewportClassName` — padding / gap / flex only; **no `overflow` or `scrollbar-width`**.
- `inset` — keeps the thumb clear of edges and sticky headers (default `{ top: 4, right: 3, bottom: 4 }`).
- `viewportRef` — pass a ref when you need the scrolling element.
- It recalculates on resize and content changes by itself. Don't copy its thumb logic
  into another component.

## 10. Floating action bar

Tool screens with a main action (e.g. save) use a pill bar floating at the bottom center,
like `.structBar` in `ElementInspector.module.css`:

```css
position: fixed; left: 50%; transform: translateX(-50%); bottom: 24px;
display: flex; align-items: center; gap: 12px; padding: 8px 12px 8px 16px;
border-radius: 999px;
background: var(--surface);
border: 1px solid color-mix(in srgb, var(--foreground) 10%, transparent);
box-shadow: var(--shadow-lg);
```

- Controls inside share one height (`--control-md`, 36px) and pill corners.
- Long pages leave bottom padding so the bar never covers content.

## 11. Component library (`src/app/ui/components`)

Reusable components users can drop into pages (like Webflow symbols).

- Layout: `src/app/ui/components/<category>/<name>/` — e.g. `base/button/` holds
  `Button.tsx`, `button.classes.ts` and the editor page.
- **Classes are data** in `*.classes.ts` (`base` / `size` / `styles[variant][tone]`) so the
  editor can rewrite them and Tailwind can scan them — it must be `.ts`, not `.json`.
- Built-in tones `accent` / `danger` use theme colors (`bg-accent`, `bg-(--danger)`), so
  they follow the Theme Manager.
- An instance on a page is opaque (`data-component`): edit it on its component page and
  every import updates.
- Pages under `/ui/components` are tools, not content: the Element Inspector is disabled
  there because `.map()` / state would break its element numbering.

## 12. CSS Module scale

Defined in `:root` in [src/app/globals.css](src/app/globals.css) (the "UI scale" block,
outside the Theme Manager markers). Use `var(--…)` for these properties — no raw px.

| group | token | value | use for |
|---|---|---|---|
| font size | `--fs-xs` | 12px | small labels, badges, kbd, captions |
| | `--fs-sm` | 14px | tool text, buttons, inputs — **default** |
| | `--fs-md` | 16px | modal titles, element names |
| | `--fs-lg` | 18px | dialog / drawer titles |
| control height | `--control-xs` | 28px | tiny icon buttons in a row |
| | `--control-sm` | 32px | icon buttons in modal / panel headers, search boxes |
| | `--control-md` | 36px | **every text button, input and select** |
| | `--control-lg` | 40px | floating buttons and triggers |
| radius | `--radius-control` | `--radius − 2` | buttons, inputs, chips |
| | `--radius-card` | `--radius` | cards, boxes, popovers |
| | `--radius-panel` | `--radius + 6` | modals, panels, sheets |
| shadow | `--shadow-sm` | subtle | selected segment / tab |
| | `--shadow-md` | floating | floating buttons, tooltips |
| | `--shadow-lg` | overlay | modals, panels, floating bars |

- Font weight: `500` / `600` only.
- Gap and padding: multiples of 4 (`1px` / `2px` allowed for borders and tiny badges).
- Non-control numbers (dots, swatches, absolute positions) can use plain px.
- No z-index tokens yet — check the layers in `ElementInspector.module.css` /
  `DrawerLayout.module.css` before adding one.

### Shared buttons — `src/components/editor/ui.module.css`

Compose from it instead of restyling: `btnPrimary`, `btnGhost`, `btnDanger`, `iconBtn`,
`modalHead` / `modalTitle`.

```css
.structSave {
  composes: btnPrimary from "./ui.module.css";
  border-radius: 999px;
}
```

`composes` must sit in a single-class rule (`.x { }`), not in a selector group or a nested
selector — Turbopack rejects it. Hover / disabled / focus styles come with the shared class.

## 13. Motion

Every visible state change eases — nothing snaps.

- Toggles, hover and selected states: transition `background`, `border-color`, `color`,
  `box-shadow` (~0.15–0.3s). Give every `.xxxOn` a `.xxxOn:hover` twin, otherwise `:hover`
  outranks it and the change is invisible while the pointer is on it.
- Show / hide: never mount or unmount UI abruptly. Use `usePresence(show, ms)`
  (`src/lib/usePresence.ts`) to play an exit class, or `Collapse` for height.
  An exit class must be declared after any rule that sets its own `animation`.
- Animate the source, not a follower: in the inspector, the outline tracks the element's
  live box, so easing the element moves the outline with it.
- Reuse the easing already in the file (`cubic-bezier(0.32, 0.72, 0, 1)`).

## 14. Right drawer (Info)

The left drawer is site-wide (routes, theme, layout); the right drawer is **the current
page** — put new page-level tools there.

| section | file | purpose |
|---|---|---|
| This page | `src/components/editor/PageInfo.tsx` | page file, language, screen size, page checks (alt, h1, heading order, links without a locale) — clicking an item opens that element in the inspector |
| Shortcuts | `src/components/editor/ShortcutHelp.tsx` | keyboard shortcuts — **update it whenever a key changes in `DrawerLayout` / `ElementInspector`** |

Unsaved structure edits live in the floating `.structBar`, not the drawer (the drawer is
hidden while selecting elements). Each entry's label comes from `pushUndo(label)`, so a new
structural operation must pass one.
