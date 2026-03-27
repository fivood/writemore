
# Changelog

All notable changes to this project will be documented in this file.

## [0.1.7] - 2026-03-27

### 0.1.7 Changed

- 更新打包图标，无功能变更。

## [0.1.6] - 2026-03-27

### 0.1.6 Added

- Added prompt-level favorites for `场景描写`、`写作挑战`、`人物描写` with a star button directly beside the current prompt.
- Added support for favoriting AI-generated prompts in the same flow.
- Added a dedicated `题目收藏` section in Favorites with source module badges (`场景描写` / `写作挑战` / `人物描写`) and AI marker.

### 0.1.6 Changed

- Updated Favorites overview and search to cover both word-set favorites and prompt favorites.

## [0.1.5] - 2026-03-27

### 0.1.5 Changed

- Version bump release for latest stability and UX updates already merged on `main`.

## [0.1.4] - 2026-03-27

### 0.1.4 Added

- Added full-text preview modals in Inspiration Palace and History so clicking cards opens an in-place reader/editor.
- Added modal editing conveniences: `Esc` to close, `Ctrl/Cmd+S` to save, unsaved-change confirmation on close, and a lightweight saved status hint.
- Added an explicit `AI 续写` markdown section separator so AI-generated continuation is clearly distinguishable from original text.

### 0.1.4 Fixed

- Fixed word-tag carryover in word inspiration mode by resetting stale draft/word-set linkage when drawing a new word set.
- Fixed draft updates to correctly persist latest `wordSetId` and writing metadata (mode/scene/challenge/character IDs) on existing entries.
- Fixed empty dream ghost records repeatedly appearing after refresh by filtering/cleaning invalid drafts during sync and list loading.
- Fixed tab behavior so returning to `灵感` from other tabs lands on the mode selection page instead of reopening previous editor context.

## [0.1.3] - 2026-03-27

### 0.1.3 Changed

- Replaced remaining Material Symbols usage with `lucide-react` SVG icons across the main app, history, favorites, library, and inspiration palace views.
- Removed unused `@fontsource/material-symbols-outlined` dependency and related global CSS.

### 0.1.3 Fixed

- Fixed character prompt layer switching so selecting a dimension immediately loads prompts from the correct layer.
- Fixed GitHub Pages clients staying on stale cached app shell content by making app shell requests network-first in the service worker.
- Fixed web deployments where word category icons could remain missing after release because an older cached single-file bundle was still being served.

## [0.1.2] - 2026-03-27

### 0.1.2 Added

- Added `@custom-variant dark` in Tailwind v4 to align `dark:` utilities with `.dark` class behavior.
- Added runtime synchronization for `meta theme-color`, `color-scheme`, and `data-color-mode` to improve mobile browser theme consistency.
- Added Google Fonts optimization with `preconnect` and narrowed Material Symbols axis request.
- Added Service Worker font caching strategy for `fonts.googleapis.com` and `fonts.gstatic.com`.

### 0.1.2 Changed

- Changed theme mode from `light/dark/system` to `light/dark` only.
- Changed persisted store migration to convert legacy `system` theme to explicit `light` or `dark`.
- Changed empty draft save logic to skip saves when editor content is blank.
- Changed Tauri bundle identifier from `com.writemore.app` to `com.writemore.desktop`.

### 0.1.2 Fixed

- Fixed mobile light theme text contrast issue in character AI deep-dive panel.
- Fixed mismatch where mobile Chrome title/navigation bar colors did not follow in-app light mode.
- Fixed Markdown editor toolbar showing dark styling under light mode on mobile browsers.

## [0.1.1] - 2026-03-27

### 0.1.1 Changed

- Version bump for desktop release packaging.

## [0.1.0] - 2026-03-27

### 0.1.0 Added

- Initial public release.
