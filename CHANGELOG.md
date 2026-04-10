
# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **词库扩充（+106 条）**：针对原有感官/状态/典故/抽象薄弱领域系统补充：
  - 武侠：感官 ×8（刀气、剑鸣、铁腥、松涛、弦鸣、幽篁、霜寒、马蹄声）、状态 ×7（负伤、走火入魔、被通缉等）
  - 历史：典故 ×8（三顾茅庐、破釜沉舟、卧薪尝胆等）、感官 ×5（墨香、铜锈气、香篆、战鼓声、丝竹）、状态 ×3
  - 言情：感官 ×10（心跳漏拍、脸颊滚烫、喉咙发紧、眼眶发酸等细腻身体感知）、抽象 ×5（错过、心意、缘起、甘愿、眷恋）
  - 都市：感官 ×8（地铁轰鸣、咖啡香、雨后沥青等）、抽象 ×5（落差、边界、存在感、内耗等）、典故 ×2（围城、西西弗斯）
  - 科幻：人物 ×7（时间旅行者、星际难民、觉醒AI、记忆猎人等）、状态 ×7（失重、意识分裂、时间错位等）、感官 ×5（真空寂静、数据涌入等）
  - 奇幻：感官 ×7（魔力涌动、灵气清冽、符文灼印、圣光温热等，从零开始）
  - 悬疑：感官 ×5（纸张霉气、消毒水气等）、抽象 ×5（第六感、盲点、拼图缺口、证据链等）
  - 恐怖：感官 ×4（腐臭、毛发竖立等）、抽象 ×5（不可名状、恐怖谷、禁忌知识等）
  - 不常见词语均附说明（幽篁、囹圄、香篆、丝竹、恐怖谷、西西弗斯等）

### Changed

- **词库分类全面修正**：审查全部 1748 条词条，修正 42 条明确分类错误，包括：
  - 「激光」感官→实物；「虫洞」地名→实物；「穹顶」抽象→实物；「磁悬浮」抽象→实物
  - 「冷冻休眠」人物→动作；「星际殖民」地名→动作；「意识上传」实物→动作
  - 「末日」实物→意象；「灵魂」人物→意象；「阴影」感官→意象（×2）
  - 「真相」人物→抽象（×2）；「空间」地名→抽象
  - 「幻觉」感官→状态（×2）；「骇人」「瘆人」人物→状态
  - 「密道」「隧道」抽象→地名（×3）；「古道」「茶马古道」「官道」「栈道」「水路」抽象/实物→地名
  - 「攻城」「守城」地名→动作；「互市」地名→动作；「起义」抽象→动作
  - 「拜师」「牵手」「结义」「下山」「论剑」「试探」人物/实物/抽象→动作
  - 「兵法」「阵法」动作→实物；「榜眼」「探花」实物→人物
  - 「溺水」实物→状态

- **多义词扩充**：
  - 「混沌」(w0424) 补充凶兽含义并改为人物分类，与 w0414「天地未分的混沌状态」（抽象）形成对照
  - 新增「克隆人」（人物/科幻），与 w0009「克隆」（动作）区分动作与人物两种语义
  - 新增「信」（实物/书信），与 w1457「信」（抽象/诚信）区分物件与道德两种语义

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
