# WriteMore · 每日写作灵感

一个中文创意写作练习工具。通过随机词条、场景描写、写作挑战等多种模式激发灵感，帮助写作者养成每日练笔的习惯。

数据优先存储在浏览器本地（IndexedDB），可选登录账号后自动同步到云端，多设备共享草稿。

## 快速开始

### 网页版（无需安装）

直接访问：**https://fivood.github.io/writemore/**

数据存储在浏览器本地，登录账号可同步到云端。

#### iPad / iPhone 安装为 App

1. Safari 打开上方网址
2. 点击底部 **分享按钮**（方块+箭头图标）
3. 选择 **「添加到主屏幕」**
4. 主屏幕出现图标后，点击即可全屏运行

---

### Windows 桌面版

前往 [Releases 页面](https://github.com/fivood/writemore/releases/latest) 下载最新版本：

| 文件 | 说明 |
|------|------|
| `WriteMore_*_x64-setup.exe` | 安装包（推荐） |
| `WriteMore_*_x64_en-US.msi` | MSI 安装包 |
| `app.exe`（在 zip 内） | 绿色版，解压后直接双击运行 |

> **提示**：首次运行需要 [WebView2 Runtime](https://developer.microsoft.com/zh-cn/microsoft-edge/webview2/)。Windows 11 / Windows 10 21H2+ 已内置，无需单独安装。

## 功能

### 六种写作模式

| 模式 | 说明 |
|------|------|
| **词汇灵感** | 从 9 大分类词库中随机抽取词条，围绕它们展开想象 |
| **场景描写** | 多个精心设计的场景提示，练习感官描写能力 |
| **写作挑战** | 涵盖展示型写作、陈词滥调改造、感官练习等多种挑战题目 |
| **人物描写** | 从内心、关系、声音、身体、历史、边缘视角六个维度深挖角色 |
| **梦境记录** | 自由记录梦境，捕捉潜意识的素材 |
| **自由发挥** | 无提示、无限制，纯粹的自由书写 |

### 词库系统

- **9 大词汇分类**：意象、实物、动作、状态、感官、抽象、人物、地名、典故
- **8 种写作风格**：科幻、悬疑、奇幻、言情、武侠、都市、历史、恐怖
- **词库管理**：支持自定义词条的增删改、批量导入导出（JSON）、按分类筛选
- **词条锁定**：抽取时可锁定满意的词条，只刷新其余位置

### AI 写作辅助

- **词汇灵感 AI**：基于当前词条生成创作灵感提示
- **场景生成 / 深挖**：AI 扩写场景描述，或从特定视角深挖细节
- **AI 出题**：根据风格偏好生成定制写作挑战，自动保存到挑战库
- **人物深挖**：AI 为角色生成心理、历史、关系背景
- **灵感再创作**：在灵感宫殿中，AI 基于历史草稿重新组合创意
- **AI 续写**：流式输出，实时追加到当前编辑内容
- **AI 写后反馈**：完成后获取写作亮点与改进建议

### 编辑器

- **Markdown 编辑器**：支持 Markdown 格式书写
- **限时写作**：10 / 15 / 20 / 30 分钟倒计时模式
- **自动保存**：每 30 秒自动存档，登录后同步到云端
- **导出**：一键导出为 `.md` 文件
- **全屏专注模式**：沉浸式写作体验

### 数据管理

- **灵感宫殿**：浏览所有历史草稿，按写作模式筛选和关键词搜索，一键恢复继续写作
- **收藏**：收藏喜欢的词条组合，随时回顾使用
- **历史热力图**：类 GitHub 贡献图的写作日历，可视化写作习惯
- **连续打卡**：记录连续写作天数

### 云同步

- 注册 / 登录账号后，草稿和词集自动备份到云端
- 多设备数据合并（以最后修改时间为准）
- 支持手动触发全量同步

### 其他特性

- 亮色 / 暗色 / 跟随系统三种主题
- 支持导入自定义写作挑战和角色提示（`.md` 文件，每行一条）
- **PWA**：可在 iOS / Android / 桌面浏览器中"添加到主屏幕"，全屏离线使用
- **Windows 桌面应用**：提供 `.exe` / `.msi` 安装包
- 键盘快捷键：`Space` 抽取词条，`Ctrl+S` 保存，`Enter` 聚焦编辑器
- 版本更新检测：有新版本时顶栏提示

## 技术栈

- **React 19** + **TypeScript**
- **Vite** — 开发与构建
- **Tailwind CSS 4** — 样式
- **Zustand** — 状态管理（含持久化）
- **Dexie (IndexedDB)** — 本地数据持久化
- **Supabase** — 云端认证与数据同步
- **Material Symbols** — 图标
- **vite-plugin-singlefile** — 构建为单文件
- **Tauri 2** — Windows 桌面应用打包

## 开发

```bash
# 安装依赖
npm install

# 启动 Web 开发服务器
npm run dev

# 启动 Tauri 桌面开发模式
npm run tauri:dev

# 类型检查
npx tsc --noEmit

# 构建 Web 版本（输出到 dist/index.html）
npm run build

# 构建 Windows 桌面安装包
npm run tauri:build
```

## 部署

### GitHub Pages（自动）

推送到 `main` 分支后，GitHub Actions 自动构建并发布到 Pages。

### 桌面安装包

运行 `npm run tauri:build`，产物位于：
- `src-tauri/target/release/bundle/nsis/WriteMore_x64-setup.exe`
- `src-tauri/target/release/bundle/msi/WriteMore_x64_en-US.msi`

### PWA 安装（iPad / iPhone / Android）

在浏览器中打开部署后的网页，点击"分享 → 添加到主屏幕"即可安装为全屏应用，支持离线使用。

## 项目结构

```
src/
├── App.tsx                  # 主界面与写作模式逻辑
├── store.ts                 # Zustand 全局状态
├── db.ts                    # Dexie 数据库定义
├── types.ts                 # 类型与常量
├── index.css                # 全局样式与暗色主题
├── components/
│   ├── InspirationPalace.tsx  # 灵感宫殿（草稿管理）
│   ├── FavoritesPage.tsx      # 收藏页
│   ├── HistoryPage.tsx        # 历史与热力图
│   └── LibraryPage.tsx        # 词库管理
├── services/
│   ├── ai.ts                  # AI 接口封装（支持任意 OpenAI 兼容 API）
│   ├── prompts.ts             # 所有 AI prompt 构造函数
│   └── supabase.ts            # Supabase 认证与云同步
└── data/
    ├── wordEngine.ts          # 词条抽取引擎
    ├── words.json             # 内置词库数据
    └── draftEngine.ts         # 草稿处理工具
public/
├── manifest.json            # PWA 清单
├── sw.js                    # Service Worker（离线缓存）
└── icons/                   # PWA 图标
src-tauri/                   # Tauri 桌面应用配置
.github/workflows/
└── deploy.yml               # GitHub Pages 自动部署
```

## 许可

MIT
