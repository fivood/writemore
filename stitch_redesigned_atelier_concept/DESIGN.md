# Design System Specification: High-End Editorial Bento

## 1. Overview & Creative North Star
**Creative North Star: "The Digital Curator"**

This design system is built to transform information into a curated gallery experience. Moving away from the generic "dashboard" look, it utilizes the Bento UI philosophy—not as a rigid grid, but as a sophisticated arrangement of content "vessels." 

The system achieves a premium feel through **intentional asymmetry** and **tonal depth**. By combining the precision of modern sans-serif UI with the high-contrast elegance of serif editorial type, we create a space that feels both technologically advanced and literarily grounded. It is designed for deep focus, using a dark-mode-first approach to minimize cognitive load while highlighting content through soft, luminous glows.

---

## 2. Colors & Surface Philosophy

The color palette is anchored in a near-black obsidian base, using vibrant accents sparingly to denote genre and action.

### Color Tokens (Material Design Convention)
- **Background/Surface:** `#100e0d` (Deep Obsidian)
- **Primary:** `#ba9eff` (Luminous Lavender)
- **Secondary:** `#69f6b8` (Emerald Mint)
- **Tertiary:** `#ffb148` (Amber Glow)
- **Surface Container Highest:** `#282523` (Card elevated state)
- **Outline Variant:** `#4b4746` (Used for Ghost Borders)

### The "No-Line" Rule
Standard 1px solid borders are strictly prohibited for defining sections. Layout boundaries must be established through **Tonal Transitions**. Use `surface-container-low` against the `background` to create a region. Visual separation is a result of light and shadow, not drawing lines.

### Surface Hierarchy & Nesting
Treat the interface as a physical stack of semi-transparent materials.
- **Base Layer:** `surface` (`#100e0d`)
- **Primary Containers:** `surface-container` (`#1c1918`)
- **Nested Elements:** `surface-container-high` (`#221f1d`)
This nesting creates a "matryoshka" effect of depth, guiding the eye from the general to the specific without clutter.

### The "Glass & Gradient" Rule
Floating elements (modals, tooltips, navigation bars) must utilize **Glassmorphism**. 
- **Recipe:** Background: `surface` at 60% opacity + `backdrop-blur: 20px`.
- **Signature Textures:** Main CTAs should use a subtle linear gradient from `primary` to `primary-container` at a 135-degree angle to provide "soul" and a sense of light source.

---

## 3. Typography: The Editorial Contrast

The system relies on a "High-Low" typographic pairing: **Newsreader** (Serif) for narrative soul and **Manrope** (Sans-Serif) for functional precision.

| Token | Font Family | Size | Purpose |
| :--- | :--- | :--- | :--- |
| **display-lg** | Newsreader | 3.5rem | Hero moments, Literary titles |
| **headline-md** | Newsreader | 1.75rem | Section headers, Chapter titles |
| **title-lg** | Manrope | 1.375rem | Card titles, Functional headers |
| **body-md** | Manrope | 0.875rem | Primary reading text, descriptions |
| **label-md** | Manrope | 0.75rem | Metadata, Micro-copy, Buttons |

**Director's Note:** Always use tight letter-spacing for Display styles and slightly increased tracking for Labels to ensure a premium, bespoke feel.

---

## 4. Elevation & Depth

Hierarchy is conveyed through **Tonal Layering** rather than structural scaffolding.

- **The Layering Principle:** Place a `surface-container-lowest` card inside a `surface-container-low` section. The subtle shift in hex value creates a natural "lift."
- **Ambient Shadows:** For floating Bento cards, use an extra-diffused shadow: `0 20px 40px rgba(0,0,0,0.4)`. The shadow should feel like a soft cloud, not a hard edge.
- **The "Ghost Border":** When high-density content requires containment, use the `outline-variant` token at **15% opacity**. This creates a hint of an edge that disappears into the glass effect.
- **Soft Glows:** Important interactive cards should emit a subtle outer glow using the `primary` or `secondary` color at 5% opacity, simulating a backlit screen.

---

## 5. Components

### Cards (The Bento Unit)
- **Corner Radius:** `xl` (1.5rem) for main containers; `md` (0.75rem) for nested items.
- **Styling:** No dividers. Use Spacing `8` (2.75rem) to separate content blocks within a card. Use `surface-variant` for hover states.

### Buttons
- **Primary:** Gradient fill (`primary` to `primary-container`), Manrope Bold, `full` (pill) radius.
- **Secondary:** Ghost Border (15% opacity `outline`), blur background, white text.
- **Tertiary:** Text-only with an underline that appears only on hover.

### Input Fields
- **Base:** `surface-container-highest` background.
- **Active State:** A 1px "Ghost Border" using `primary` at 40% opacity and a soft `primary-dim` outer glow.
- **Labels:** Always `label-sm` in `on-surface-variant` for a sophisticated, understated look.

### Interactive "Pills" (Chips)
- Use for genres or tags.
- Background: `surface-variant` at 40% opacity. 
- Border: `outline-variant` at 10% opacity.

---

## 6. Do's and Don'ts

### Do:
- **Use Asymmetric Grids:** In a Bento layout, let one card be significantly larger to establish a focal point.
- **Embrace Negative Space:** Use Spacing `12` or `16` between major Bento groups to let the "Glass" breathe.
- **Vary Glass Opacity:** Use higher opacity for cards with heavy text to ensure readability against the dark background.

### Don't:
- **Don't use pure white borders:** This breaks the immersion of the dark, obsidian environment.
- **Don't use "Drop Shadows" on flat cards:** Only floating elements get shadows; docked cards rely on tonal shifts.
- **Don't mix font roles:** Never use Newsreader for functional UI elements (like "Submit" buttons); keep it reserved for the "voice" of the content.
- **Don't use dividers:** If you feel the need for a line, increase the vertical spacing (`1.4rem` or more) instead.