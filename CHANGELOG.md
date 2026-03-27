# Changelog

All notable changes to this project will be documented in this file.

## [0.1.2] - 2026-03-27

### Added
- Added `@custom-variant dark` in Tailwind v4 to align `dark:` utilities with `.dark` class behavior.
- Added runtime synchronization for `meta theme-color`, `color-scheme`, and `data-color-mode` to improve mobile browser theme consistency.
- Added Google Fonts optimization with `preconnect` and narrowed Material Symbols axis request.
- Added Service Worker font caching strategy for `fonts.googleapis.com` and `fonts.gstatic.com`.

### Changed
- Changed theme mode from `light/dark/system` to `light/dark` only.
- Changed persisted store migration to convert legacy `system` theme to explicit `light` or `dark`.
- Changed empty draft save logic to skip saves when editor content is blank.
- Changed Tauri bundle identifier from `com.writemore.app` to `com.writemore.desktop`.

### Fixed
- Fixed mobile light theme text contrast issue in character AI deep-dive panel.
- Fixed mismatch where mobile Chrome title/navigation bar colors did not follow in-app light mode.
- Fixed Markdown editor toolbar showing dark styling under light mode on mobile browsers.

## [0.1.1] - 2026-03-27

### Changed
- Version bump for desktop release packaging.

## [0.1.0] - 2026-03-27

### Added
- Initial public release.
