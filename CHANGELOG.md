
# Changelog

All notable changes to this project will be documented in this file.

## [0.1.8] - 2026-04-10

### Added

- **写作挑战 AI 出题**：`buildChallengeGeneratePrompt` 新增 `genre` 参数，出题时传入当前抽取的写作风格，让挑战题目具备明确的风格语感；prompt 内置好题范例（感官锚点 + 悬念钩子），避免生成纯技巧说明式的空洞题目。
- **角色描写 AI 出题**：新增 `buildCharacterGeneratePrompt` prompt 函数，按当前维度（内心/关系/声音/身体/历史/边缘）和风格生成新角色引导题，附有各维度 few-shot 范例；新增 `handleAiCharacterGenerate` 函数，生成后存入本地题库并切换到首条新题。角色面板新增「AI 出一道角色题」按钮。
- **首页按钮**：桌面端导航栏和移动端底部标签栏在写作模式中新增「首页」按钮（Home 图标），点击保存草稿并返回模式选择页。

### Changed

- **重新打开回到首页**：`onRehydrateStorage` 在 zustand 水合阶段重置 `writingMode = null`，应用重启后直接显示 Bento 首页；mount 阶段自动保存上次未持久化的草稿内容。
- **暗色 AI 面板对比度**：5 个 AI 信息面板文字颜色改为暗色下实际亮色的 `*-600/*-700` 档次，消除低对比度问题。
- **浅色模式层次感**：`on-surface-variant` 从 `#3d3f3c` 调整为 `#6e706b`，次级文字与主文字形成清晰轻重层次。
- **MDEditor 浅色工具栏**：新增浅色覆盖样式，工具栏背景匹配暖奶油色调。
- **Toast 动画**：`animate-bounce` 改为淡入上移（0.2s ease-out），减少写作中断感。

## [0.1.7] - 2026-03-27

### 0.1.7 Changed

- 更新打包图标，无功能变更。

## [0.1.6] - 2026-03-27

### 0.1.6 Added

- Added prompt-level favorites for `场景描写`、`写作挑战`、`角色描写` with a star button directly beside the current prompt.
- Added support for favoriting AI-generated prompts in the same flow.
- Added a dedicated `题目收藏` section in Favorites with source module badges (`场景描写` / `写作挑战` / `角色描写`) and AI marker.

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
