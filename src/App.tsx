import { useEffect, useMemo, useRef, useState } from 'react';

// ── 填入你的 GitHub 用户名/仓库名 ──────────────────────────────
const GITHUB_REPO = 'fivood/writemore';
declare const __APP_VERSION__: string;
const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
const CUSTOM_CATEGORY_STORAGE_KEY = 'writemore_custom_categories_v1';
const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
import { useStore } from './store';
import { Sparkles, Landmark, Star, BookOpen, Bot, Cloud, RefreshCw, Moon, Sun, Info, X, Dices, MoonStar, User, PencilLine, Mountain, CircleHelp, ArrowLeft, Download, Shuffle, ChevronsLeft, ChevronsRight, Lock, LockOpen, LoaderCircle, Save, Upload, PanelLeft, MessageSquareText, Maximize, Flame, Timer, Rocket, Search, BookText, Heart, Sword, Building2, ScrollText, Ghost, Brain, Users, Mic, Accessibility, History, Eye, Package, Zap, Layers, Map as MapIcon, Tag, Home } from 'lucide-react';
import { drawRandomWords, loadUserData, pickRandomGenre } from './data/wordEngine';
import { saveDraftToDb, toggleFavoriteWordSet, isPromptFavorited, togglePromptFavorite } from './data/draftEngine';
import { pickRandomScene } from './data/scenes';
import { pickRandomChallenge } from './data/challenges';
import { pickRandomCharacterPrompt, CHARACTER_LAYERS, BUILTIN_CHARACTER_PROMPTS } from './data/characterPrompts';
import type { CharacterLayerId } from './data/characterPrompts';
import { db } from './db';
import type { Draft, Word, WritingMode } from './types';
import { WORD_CATEGORIES, WRITING_MODES } from './types';
import MDEditor from '@uiw/react-md-editor';
import HistoryPage from './components/HistoryPage';
import FavoritesPage from './components/FavoritesPage';
import LibraryPage from './components/LibraryPage';
import InspirationPalace from './components/InspirationPalace';
import AiSettingsModal from './components/AiSettingsModal';
import CloudLoginModal from './components/CloudLoginModal';
import { chatCompletion, chatCompletionStream } from './services/ai';
import { buildWordInspirationPrompt, buildSceneGeneratePrompt, buildSceneDeepDivePrompt, buildChallengeGeneratePrompt, buildCharacterDeepPrompt, buildCharacterGeneratePrompt, buildContinueWritingPrompt, buildWritingFeedbackPrompt, buildDreamInterpretationPrompt } from './services/prompts';
import { supabase, pushDraft, pullDrafts, pushWordSet, pullWordSets, SUPABASE_ENABLED } from './services/supabase';

export default function App() {
    const store = useStore();
    const [toast, setToast] = useState('');
    const [wordsSubView, setWordsSubView] = useState<'write' | 'library'>('write');
    const [todayOtherDraftsWords, setTodayOtherDraftsWords] = useState(0);
    const [showAiSettings, setShowAiSettings] = useState(false);
    const [showCloudLogin, setShowCloudLogin] = useState(false);
    const lastSavedContentRef = useRef('');
    const [cloudSyncing, setCloudSyncing] = useState(false);
    const [updateBanner, setUpdateBanner] = useState<{ version: string; url: string } | null>(null);
    const [updateDownloading, setUpdateDownloading] = useState(false);
    const [updateProgress, setUpdateProgress] = useState(0);
    const [updateInstalled, setUpdateInstalled] = useState(false);
    const [manualCheckLoading, setManualCheckLoading] = useState(false);
    const updateObjRef = useRef<any>(null);
    const [aiWordHint, setAiWordHint] = useState('');
    const [aiWordHintLoading, setAiWordHintLoading] = useState(false);
    const [aiSceneExtra, setAiSceneExtra] = useState('');
    const [aiSceneLoading, setAiSceneLoading] = useState(false);
    const [aiChallengeLoading, setAiChallengeLoading] = useState(false);
    const [aiCharacterExtra, setAiCharacterExtra] = useState('');
    const [aiCharacterLoading, setAiCharacterLoading] = useState(false);
    const [aiCharacterGenLoading, setAiCharacterGenLoading] = useState(false);
    const [aiContinueLoading, setAiContinueLoading] = useState(false);
    const [aiFeedback, setAiFeedback] = useState('');
    const [aiFeedbackLoading, setAiFeedbackLoading] = useState(false);
    const [aiDreamInterpret, setAiDreamInterpret] = useState('');
    const [aiDreamInterpretLoading, setAiDreamInterpretLoading] = useState(false);
    const editorRef = useRef<HTMLTextAreaElement>(null);
    const isSavingRef = useRef(false);
    // Incremented whenever a new draw/mode-switch session begins, so that an
    // in-flight handleSave won't overwrite currentWordSetId after the session resets.
    const wordSessionRef = useRef(0);
    // AbortController for in-flight AI requests — allows cancellation on mode switch
    const aiAbortRef = useRef<AbortController | null>(null);
    // Ref-based lock to prevent concurrent AI calls (faster than useState for race conditions)
    const aiLockRef = useRef(false);
    const [isSceneFavorited, setIsSceneFavorited] = useState(false);
    const [isChallengeFavorited, setIsChallengeFavorited] = useState(false);
    const [isCharacterFavorited, setIsCharacterFavorited] = useState(false);
    const [isFlipping, setIsFlipping] = useState(false);
    const [isOpeningBox, setIsOpeningBox] = useState(false);

    const [mobilePanel, setMobilePanel] = useState(false);
    const [isDarkTheme, setIsDarkTheme] = useState(false);
    const [customCategoryIconKeyMap, setCustomCategoryIconKeyMap] = useState<Record<string, string>>({});

    const customCategoryIconPool: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
        tag: Tag,
        sparkles: Sparkles,
        package: Package,
        zap: Zap,
        layers: Layers,
        eye: Eye,
        brain: Brain,
        user: User,
        map: MapIcon,
        scroll: ScrollText,
        book: BookOpen,
        pencil: PencilLine,
    };

    const loadCustomCategoryIconKeyMap = () => {
        try {
            const raw = localStorage.getItem(CUSTOM_CATEGORY_STORAGE_KEY);
            if (!raw) return {};
            const list = JSON.parse(raw);
            if (!Array.isArray(list)) return {};
            const next: Record<string, string> = {};
            list.forEach((item: any) => {
                if (item && typeof item.name === 'string' && typeof item.iconKey === 'string') {
                    const name = item.name.trim();
                    const iconKey = item.iconKey.trim();
                    if (name) next[name] = iconKey;
                }
            });
            return next;
        } catch {
            return {};
        }
    };

    // Theme
    useEffect(() => {
        const el = document.documentElement;

        const apply = (t: string) => {
            const dark = t === 'dark';
            el.classList.toggle('dark', dark);
            el.setAttribute('data-color-mode', dark ? 'dark' : 'light');
            setIsDarkTheme(dark);

            // Keep browser chrome (Android title/nav bars) aligned with in-app theme.
            const themeMeta = document.querySelector('meta[name="theme-color"]');
            if (themeMeta) themeMeta.setAttribute('content', dark ? '#100e0d' : '#fbf9f5');

            // Hint UA form controls / virtual keyboard / scrollbars to follow current theme.
            el.style.colorScheme = dark ? 'dark' : 'light';

            const appleStatus = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
            if (appleStatus) appleStatus.setAttribute('content', dark ? 'black-translucent' : 'default');
        };

        apply(store.theme);
    }, [store.theme]);

    // Init
    useEffect(() => {
        loadUserData();
        store.updateStreak();

        // 一次性数据迁移：老版本没有 writingMode 字段的 Draft 修复
        async function migrateLegacyDrafts() {
            try {
                const drafts = await db.drafts.toArray();
                const legacy = drafts.filter(d => !d.writingMode);
                if (legacy.length === 0) return;
                
                for (const d of legacy) {
                    const wordSet = d.wordSetId ? await db.wordSets.get(d.wordSetId) : undefined;
                    const mode = (wordSet && wordSet.words.length > 0) ? 'words' : 'free';
                    await db.drafts.update(d.id, { writingMode: mode });
                }
                console.log(`✨ 成功迁移了 ${legacy.length} 篇老版本草稿数据`);
            } catch (e) {
                console.error('Legacy drafts migration failed', e);
            }
        }
        migrateLegacyDrafts();
    }, []);

    // Rescue any unsaved content from the previous session.
    // writingMode is reset to null on hydration (onRehydrateStorage), so the app always
    // opens at the home screen. If the user had meaningful content in the editor that
    // wasn't saved before they closed the app, persist it to DB now before it
    // disappears when they next enter a mode and clearAiTransientOutputs resets everything.
    useEffect(() => {
        const s = useStore.getState();
        if (s.editorContent.replace(/[\s\u200B-\u200D\uFEFF]/g, '').length > 0) {
            handleSave().then(() => {
                store.setEditorTitle('');
                store.setEditorContent('');
            });
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const updateCustomCategoryIcons = () => setCustomCategoryIconKeyMap(loadCustomCategoryIconKeyMap());
        updateCustomCategoryIcons();
        window.addEventListener('writemore:custom-categories-updated', updateCustomCategoryIcons as EventListener);
        window.addEventListener('storage', updateCustomCategoryIcons);
        return () => {
            window.removeEventListener('writemore:custom-categories-updated', updateCustomCategoryIcons as EventListener);
            window.removeEventListener('storage', updateCustomCategoryIcons);
        };
    }, []);

    // Cloud auth 初始化
    useEffect(() => {
        if (!SUPABASE_ENABLED) return;
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                store.setCloudUser({ id: session.user.id, email: session.user.email! });
                syncFromCloud(session.user.id);
            }
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                store.setCloudUser({ id: session.user.id, email: session.user.email! });
            } else {
                store.setCloudUser(null);
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    async function syncFromCloud(userId: string) {
        if (!SUPABASE_ENABLED) return;
        try {
            setCloudSyncing(true);

            // ── Draft 双向同步 ──
            const cloudDraftsRaw = await pullDrafts(userId);
            const localDraftsRaw = await db.drafts.toArray();

            const cloudDrafts = cloudDraftsRaw.filter(d => !isGhostDreamDraft(d));
            const localDrafts = localDraftsRaw.filter(d => !isGhostDreamDraft(d));

            // 清理本地历史遗留的空梦境草稿，避免刷新后重复出现。
            for (const d of localDraftsRaw) {
                if (isGhostDreamDraft(d)) {
                    await db.drafts.delete(d.id);
                }
            }

            // 云端 → 本地：云端更新的覆盖本地，且本地覆盖前执行快照备份
            for (const cd of cloudDrafts) {
                const local = localDrafts.find(d => d.id === cd.id);
                if (!local) {
                    await db.drafts.put(cd);
                } else if (new Date(cd.updatedAt) > new Date(local.updatedAt)) {
                    if (local.content !== cd.content) {
                        const backupId = `${local.id}_backup_${Date.now()}`;
                        await db.drafts.put({
                            ...local,
                            id: backupId,
                            title: `[冲突备份] ${local.title || '无标题'}`,
                            deletedFromPalace: true,
                            updatedAt: new Date(),
                        });
                    }
                    await db.drafts.put(cd);
                }
            }

            // 本地 → 云端：本地有但云端没有、或本地更新的推上去
            const cloudIdSet = new Set(cloudDrafts.map(d => d.id));
            for (const ld of localDrafts) {
                const cloud = cloudDrafts.find(d => d.id === ld.id);
                if (!cloudIdSet.has(ld.id) || (cloud && new Date(ld.updatedAt) > new Date(cloud.updatedAt))) {
                    await pushDraft(ld, userId);
                }
            }

            // ── WordSet 双向同步 ──
            const cloudWordSets = await pullWordSets(userId);
            const localWordSets = await db.wordSets.toArray();

            for (const cws of cloudWordSets) {
                const local = localWordSets.find(w => w.id === cws.id);
                if (!local) {
                    await db.wordSets.put(cws);
                }
            }

            const cloudWsIdSet = new Set(cloudWordSets.map(w => w.id));
            for (const lws of localWordSets) {
                if (!cloudWsIdSet.has(lws.id)) {
                    await pushWordSet(lws, userId);
                }
            }

        } catch (e) {
            console.error('Cloud sync failed', e);
        } finally {
            setCloudSyncing(false);
        }
    }



    // 版本更新检测
    useEffect(() => {
        if (IS_TAURI) {
            // Tauri 桌面端：优先使用插件（可在应用内下载安装），失败则用 GitHub API 兜底
            const timer = setTimeout(async () => {
                let pluginHandled = false;
                try {
                    const { check } = await import('@tauri-apps/plugin-updater');
                    const update = await check();
                    if (update?.available) {
                        updateObjRef.current = update;
                        setUpdateBanner({ version: update.version, url: '' });
                        pluginHandled = true;
                    }
                } catch {
                    // latest.json 不存在或网络错误，尝试 GitHub API fallback
                }
                // Fallback：GitHub Releases API（不依赖 latest.json）
                if (!pluginHandled && GITHUB_REPO && !GITHUB_REPO.startsWith('your-')) {
                    try {
                        const r = await fetch(
                            `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
                            { headers: { Accept: 'application/vnd.github+json' } }
                        );
                        if (r.ok) {
                            const data = await r.json();
                            const latestVer = (data.tag_name as string).replace(/^v/, '');
                            if (latestVer !== APP_VERSION) {
                                setUpdateBanner({ version: data.tag_name, url: data.html_url });
                            }
                        }
                    } catch { /* 网络错误，静默忽略 */ }
                }
            }, 3000);
            return () => clearTimeout(timer);
        } else {
            // Web 版：GitHub API 检查（每天一次），跳转到 Release 页面
            const CHECK_KEY = 'update_last_check';
            const last = localStorage.getItem(CHECK_KEY);
            const today = new Date().toISOString().slice(0, 10);
            if (last === today) return;
            if (!GITHUB_REPO || GITHUB_REPO.startsWith('your-')) return;
            fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
                headers: { Accept: 'application/vnd.github+json' },
            })
                .then(r => r.ok ? r.json() : null)
                .then(data => {
                    if (!data) return;
                    localStorage.setItem(CHECK_KEY, today);
                    const latest = (data.tag_name as string).replace(/^v/, '');
                    if (latest !== APP_VERSION) {
                        setUpdateBanner({ version: data.tag_name, url: data.html_url });
                    }
                })
                .catch(() => {/* 离线时静默失败 */ });
        }
    }, []);

    // Timer
    useEffect(() => {
        if (!store.timerActive) return;
        const id = setInterval(() => {
            const next = store.timerSeconds + 1;
            if (next >= store.timerDuration * 60) {
                store.setTimerActive(false);
                store.setTimerSeconds(0);
                showToast('⏰ 时间到！写得不错~');
            } else {
                store.setTimerSeconds(next);
            }
        }, 1000);
        return () => clearInterval(id);
    }, [store.timerActive, store.timerSeconds, store.timerDuration]);

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const inEditor = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable;

            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                handleSave();
                return;
            }
            if (inEditor) return;
            if (e.key === ' ' && store.writingMode === 'words') { e.preventDefault(); handleDraw(); }
            if (e.key === 'Enter') { e.preventDefault(); editorRef.current?.focus(); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [store.currentWords, store.selectedGenres, store.wordCount, store.lockedIndices, store.editorContent, store.editorTitle, store.writingMode]);

    function hasMeaningfulContent(content: string) {
        // Ignore whitespace and zero-width characters that can be produced by IME/editor internals.
        return content.replace(/[\s\u200B-\u200D\uFEFF]/g, '').length > 0;
    }

    function isGhostDreamDraft(draft: Pick<Draft, 'writingMode' | 'content' | 'wordCount'>) {
        return draft.writingMode === 'dream' && !hasMeaningfulContent(draft.content) && (draft.wordCount ?? 0) === 0;
    }

    function clearAiTransientOutputs() {
        setAiWordHint('');
        setAiSceneExtra('');
        setAiCharacterExtra('');
        setAiFeedback('');
        setAiDreamInterpret('');
        // 取消正在进行的 AI 请求
        if (aiAbortRef.current) {
            aiAbortRef.current.abort();
            aiAbortRef.current = null;
        }
        aiLockRef.current = false;
    }

    /**
     * 从 AI 返回的文本中提取 JSON（兼容 markdown 代码块包裹）
     */
    function extractJSON(text: string): string {
        const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (fenced) return fenced[1].trim();
        const braced = text.match(/\{[\s\S]*\}/);
        if (braced) return braced[0];
        return text;
    }

    /** 创建新的 AbortController 并注册到 ref（自动取消上一个） */
    function newAiAbort(): AbortSignal {
        if (aiAbortRef.current) aiAbortRef.current.abort();
        const controller = new AbortController();
        aiAbortRef.current = controller;
        return controller.signal;
    }

    function mergeAiFeedbackIntoContent(content: string, feedback: string) {
        const trimmedFeedback = feedback.trim();
        if (!trimmedFeedback) return content;
        if (content.includes('（AI点评：')) return content;
        return `${content}\n\n（AI点评：\n${trimmedFeedback}\n）`;
    }

    // ── Mode Selection ──
    function selectMode(mode: WritingMode) {
        if (hasMeaningfulContent(store.editorContent)) {
            handleSave();
        }
        clearAiTransientOutputs();
        setWordsSubView('write');
        store.setWritingMode(mode);
        store.setEditorTitle('');
        store.setEditorContent('');
        wordSessionRef.current++;
        store.setCurrentWordSetId(null);
        store.setCurrentDraftId(null);
        store.setIsCurrentWordSetFavorite(false);

        if (mode === 'words') {
            handleDraw();
        } else if (mode === 'scene') {
            store.setCurrentScene(pickRandomScene());
            store.setCurrentWords([]);
        } else if (mode === 'dream') {
            store.setCurrentWords([]);
            store.setCurrentScene(null);
            store.setCurrentChallenge(null);
            store.setEditorTitle('梦境记录 · ' + new Date().toLocaleDateString('zh-CN'));
        } else if (mode === 'challenge') {
            store.setCurrentWords([]);
            store.setCurrentScene(null);
            pickAndSetChallenge();
        } else if (mode === 'character') {
            store.setCurrentWords([]);
            store.setCurrentScene(null);
            store.setCurrentChallenge(null);
            store.setSelectedCharacterLayer(null);
            pickAndSetCharacterPrompt();
        } else {
            store.setCurrentWords([]);
            store.setCurrentScene(null);
            store.setCurrentChallenge(null);
        }
    }

    function handleBackToModeSelect() {
        if (hasMeaningfulContent(store.editorContent)) {
            handleSave();
        }
        clearAiTransientOutputs();
        setWordsSubView('write');
        store.setWritingMode(null);
        store.setCurrentWords([]);
        store.setCurrentScene(null);
        store.setCurrentChallenge(null);
        store.setCurrentCharacterPrompt(null);
        store.setSelectedCharacterLayer(null);
        store.setEditorTitle('');
        store.setEditorContent('');
        wordSessionRef.current++;
        store.setCurrentWordSetId(null);
        store.setCurrentDraftId(null);
    }

    function handleTopTabChange(tab: string) {
        if (tab === 'inspire' && store.activeTab !== 'inspire') {
            // Re-entering Inspire from other tabs should always land on mode selection.
            clearAiTransientOutputs();
            setWordsSubView('write');
            setMobilePanel(false);
            store.setWritingMode(null);
            store.setCurrentWords([]);
            store.setCurrentScene(null);
            store.setCurrentChallenge(null);
            store.setCurrentCharacterPrompt(null);
            store.setSelectedCharacterLayer(null);
        }
        store.setActiveTab(tab);
    }

    async function pickAndSetChallenge(excludeId?: string) {
        const userChallenges = await db.challenges.toArray();
        store.setCurrentChallenge(pickRandomChallenge(excludeId, userChallenges));
    }

    async function pickAndSetCharacterPrompt(excludeId?: string, layerOverride?: CharacterLayerId | null) {
        const userPrompts = await db.characterPrompts.toArray();
        const layer = layerOverride !== undefined ? layerOverride : store.selectedCharacterLayer;
        store.setCurrentCharacterPrompt(
            pickRandomCharacterPrompt(layer, excludeId, userPrompts)
        );
        setAiCharacterExtra('');
    }

    async function handleDraw() {
        setIsFlipping(true);
        wordSessionRef.current++;
        const locked = new Map<number, Word>();
        store.lockedIndices.forEach(i => {
            if (store.currentWords[i]) locked.set(i, store.currentWords[i]);
        });
        const words = drawRandomWords(store.wordCount, store.selectedCategories, locked);

        // 300ms 后在卡片翻转至 90 度侧面时，静默替换词卡文字
        setTimeout(() => {
            // New draw means a new inspiration set; break linkage to previously opened draft/word set.
            store.setCurrentWordSetId(null);
            store.setCurrentDraftId(null);
            store.setIsCurrentWordSetFavorite(false);
            store.setCurrentWords(words);
            store.setDrawnGenre(pickRandomGenre(store.selectedGenres));
            store.updateStreak();
            setAiWordHint('');
        }, 300);

        // 600ms 后动画播放完毕，恢复状态
        setTimeout(() => {
            setIsFlipping(false);
        }, 600);
    }

    async function handleOpenDailyBox() {
        if (isOpeningBox) return;
        setIsOpeningBox(true);
        setTimeout(() => {
            const todayStr = new Date().toISOString().slice(0, 10);
            const words = drawRandomWords(3, [], new Map());
            
            const rand = Math.random();
            let promptType: 'scene' | 'challenge' = 'scene';
            let promptData: any = null;
            if (rand > 0.5) {
                promptData = pickRandomScene();
                promptType = 'scene';
            } else {
                promptData = pickRandomChallenge();
                promptType = 'challenge';
            }
            
            const boxData = {
                words,
                promptType,
                promptData
            };
            
            store.setDailyBoxOpenedDate(todayStr);
            store.setDailyBoxData(boxData);
            setIsOpeningBox(false);
            showToast('🎁 今日盲盒已拆开！');
        }, 1200);
    }

    function handleStartDailyWriting() {
        const data = store.dailyBoxData;
        if (!data) return;
        
        store.setCurrentWords(data.words);
        store.setCurrentWordSetId(null);
        store.setCurrentDraftId(null);
        store.setIsCurrentWordSetFavorite(false);
        store.clearLocks();
        
        if (data.promptType === 'scene') {
            store.setWritingMode('scene');
            store.setCurrentScene(data.promptData);
            store.setCurrentChallenge(null);
            store.setCurrentCharacterPrompt(null);
        } else {
            store.setWritingMode('challenge');
            store.setCurrentChallenge(data.promptData);
            store.setCurrentScene(null);
            store.setCurrentCharacterPrompt(null);
        }
        
        store.setEditorTitle('');
        store.setEditorContent('');
        clearAiTransientOutputs();
        setWordsSubView('write');
        wordSessionRef.current++;
        
        showToast('✍️ 开始今日限定挑战！');
    }

    async function handleToggleFavorite() {
        if (store.currentWords.length === 0) return;
        try {
            const { wordSetId, isFavorite } = await toggleFavoriteWordSet(
                store.currentWords,
                store.currentWordSetId,
                store.isCurrentWordSetFavorite
            );
            store.setCurrentWordSetId(wordSetId);
            store.setIsCurrentWordSetFavorite(isFavorite);
            showToast(isFavorite ? '⭐ 已收藏本组词条' : '取消收藏');
        } catch (e) {
            console.error('Failed to toggle favorite', e);
        }
    }

    async function handleToggleSceneFavorite() {
        const scene = store.currentScene;
        if (!scene) return;
        try {
            const isFavorite = await togglePromptFavorite({
                module: 'scene',
                itemId: scene.id,
                title: scene.title,
                description: scene.description,
                tags: scene.tags,
                isAi: scene.id.startsWith('ai_'),
            });
            setIsSceneFavorited(isFavorite);
            showToast(isFavorite ? '⭐ 已收藏场景题目' : '取消收藏');
        } catch (e) {
            console.error('Failed to toggle scene favorite', e);
        }
    }

    async function handleToggleChallengeFavorite() {
        const challenge = store.currentChallenge;
        if (!challenge) return;
        try {
            const isFavorite = await togglePromptFavorite({
                module: 'challenge',
                itemId: challenge.id,
                title: challenge.text,
                isAi: challenge.id.startsWith('ai_'),
            });
            setIsChallengeFavorited(isFavorite);
            showToast(isFavorite ? '⭐ 已收藏挑战题目' : '取消收藏');
        } catch (e) {
            console.error('Failed to toggle challenge favorite', e);
        }
    }

    async function handleToggleCharacterFavorite() {
        const prompt = store.currentCharacterPrompt;
        if (!prompt) return;
        const layer = CHARACTER_LAYERS.find(l => l.id === prompt.layer);
        try {
            const isFavorite = await togglePromptFavorite({
                module: 'character',
                itemId: prompt.id,
                title: prompt.text,
                description: layer ? `维度：${layer.name}` : undefined,
                isAi: prompt.id.startsWith('ai_'),
            });
            setIsCharacterFavorited(isFavorite);
            showToast(isFavorite ? '⭐ 已收藏人物题目' : '取消收藏');
        } catch (e) {
            console.error('Failed to toggle character favorite', e);
        }
    }

    async function handleSave() {
        if (isSavingRef.current) return;
        // 每次都从 store 读最新状态，避免 setTimeout 捕获的 stale closure 导致重复创建草稿
        const s = useStore.getState();
        const contentToSave = mergeAiFeedbackIntoContent(s.editorContent, aiFeedback);
        // 内容为空时不保存（标题可能是自动生成的，不算有效内容）
        if (!hasMeaningfulContent(contentToSave)) return;
        isSavingRef.current = true;
        // Snapshot session counter so we can detect if a new draw started while we awaited.
        const sessionAtSaveStart = wordSessionRef.current;
        try {
            const { wordSetId, draftId } = await saveDraftToDb(
                s.editorTitle || '未命名灵感',
                contentToSave,
                s.currentWords,
                s.currentWordSetId,
                s.currentDraftId,
                s.drawnGenre,
                s.writingMode,
                s.currentScene?.id,
                s.currentChallenge?.id,
                s.currentCharacterPrompt?.id,
            );
            // Only update session IDs if no new draw/mode-switch happened while we were saving.
            // Otherwise currentWordSetId would point to the old session, corrupting favourites.
            if (wordSessionRef.current === sessionAtSaveStart) {
                store.setCurrentWordSetId(wordSetId);
                store.setCurrentDraftId(draftId);
            }
            showToast(`💾 已保存 (${contentToSave.replace(/\s/g, '').length}字)`);
            // 传入本次保存得到的 draftId，避免闭包读到过时的 currentDraftId 导致双重计数
            refreshTodayWords(draftId);
            // 后台推送到云端
            if (SUPABASE_ENABLED && s.cloudUser) {
                const saved = await db.drafts.get(draftId);
                if (saved) pushDraft(saved, s.cloudUser.id).catch(console.error);
            }
        } catch (e) {
            console.error('Failed to save draft', e);
        } finally {
            isSavingRef.current = false;
        }
    }

    function handleExport() {
        const title = store.editorTitle || '未命名灵感';
        const content = `# ${title}\n\n${store.editorContent}`;
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.md`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ── AI 增强功能 ──

    async function handleAiWordHint() {
        if (!store.aiEnabled || store.currentWords.length === 0 || aiLockRef.current) return;
        aiLockRef.current = true;
        setAiWordHintLoading(true);
        setAiWordHint('');
        const signal = newAiAbort();
        try {
            const msgs = buildWordInspirationPrompt(store.currentWords, store.drawnGenre);
            const result = await chatCompletion(store.aiConfig, msgs, { maxTokens: 200, signal });
            setAiWordHint(result);
        } catch (e) {
            if (!signal.aborted) showToast('AI 生成失败，请检查设置');
            console.error(e);
        } finally {
            aiLockRef.current = false;
            setAiWordHintLoading(false);
        }
    }

    async function handleAiScene() {
        if (!store.aiEnabled || aiLockRef.current) return;
        aiLockRef.current = true;
        setAiSceneLoading(true);
        const signal = newAiAbort();
        try {
            const existing = store.currentScene ? [store.currentScene.title] : [];
            const msgs = buildSceneGeneratePrompt(existing);
            const result = await chatCompletion(store.aiConfig, msgs, { maxTokens: 300, signal });
            const parsed = JSON.parse(extractJSON(result));
            if (parsed.title && parsed.description) {
                const newScene = {
                    id: `ai_${Date.now()}`,
                    title: parsed.title,
                    description: parsed.description,
                    tags: parsed.tags || [],
                };
                store.setCurrentScene(newScene);
                // 持久化 AI 生成的场景到收藏表，使其可被灵感宫殿引用
                await db.promptFavorites.put({
                    id: `scene_${newScene.id}`,
                    module: 'scene',
                    itemId: newScene.id,
                    title: newScene.title,
                    description: newScene.description,
                    tags: newScene.tags,
                    isAi: true,
                    createdAt: new Date(),
                });
            }
        } catch (e) {
            if (!signal.aborted) showToast('AI 场景生成失败');
            console.error(e);
        } finally {
            aiLockRef.current = false;
            setAiSceneLoading(false);
        }
    }

    async function handleAiSceneDeepDive() {
        if (!store.aiEnabled || !store.currentScene || aiLockRef.current) return;
        aiLockRef.current = true;
        setAiSceneLoading(true);
        setAiSceneExtra('');
        const signal = newAiAbort();
        try {
            const msgs = buildSceneDeepDivePrompt(store.currentScene.title, store.currentScene.description);
            const result = await chatCompletion(store.aiConfig, msgs, { maxTokens: 200, signal });
            setAiSceneExtra(result);
        } catch (e) {
            if (!signal.aborted) showToast('AI 生成失败');
            console.error(e);
        } finally {
            aiLockRef.current = false;
            setAiSceneLoading(false);
        }
    }

    async function handleAiChallenge() {
        if (!store.aiEnabled || aiLockRef.current) return;
        aiLockRef.current = true;
        setAiChallengeLoading(true);
        const signal = newAiAbort();
        try {
            const existing = store.currentChallenge ? [store.currentChallenge.text] : [];
            const msgs = buildChallengeGeneratePrompt(existing, store.drawnGenre);
            const result = await chatCompletion(store.aiConfig, msgs, { maxTokens: 300, signal });
            // Strip leading numbering/bullets that the model sometimes adds despite instructions
            // e.g. "1. ", "①", "- ", "• ", "（1）" etc.
            const stripPrefix = (s: string) => s.replace(/^[\s\uff08（(]*[\d①②③一二三][\s.、.）).\uff09]*/, '').replace(/^[-•*]\s*/, '').trim();
            const lines = result.split('\n').map(l => stripPrefix(l.trim())).filter(l => l.length > 0);
            if (lines.length > 0) {
                const picked = lines[Math.floor(Math.random() * lines.length)];
                const newChallenge = {
                    id: `ai_${Date.now()}`,
                    text: picked,
                    source: 'user' as const,
                };
                store.setCurrentChallenge(newChallenge);
                // 同时存入本地数据库，其余两条也存入
                await db.challenges.bulkPut(
                    lines.map((text, i) => ({ id: `ai_${Date.now()}_${i}`, text, source: 'user' as const }))
                );
                showToast(`✨ AI 出了 ${lines.length} 道题并已保存到题库`);
            }
        } catch (e) {
            if (!signal.aborted) showToast('AI 出题失败');
            console.error(e);
        } finally {
            aiLockRef.current = false;
            setAiChallengeLoading(false);
        }
    }

    async function handleAiCharacterDeep() {
        if (!store.aiEnabled || !store.currentCharacterPrompt || aiLockRef.current) return;
        aiLockRef.current = true;
        setAiCharacterLoading(true);
        setAiCharacterExtra('');
        const signal = newAiAbort();
        try {
            const layerName = CHARACTER_LAYERS.find(l => l.id === store.currentCharacterPrompt!.layer)?.name || '';
            const msgs = buildCharacterDeepPrompt(store.currentCharacterPrompt.text, layerName);
            const result = await chatCompletion(store.aiConfig, msgs, { maxTokens: 200, signal });
            setAiCharacterExtra(result);
        } catch (e) {
            if (!signal.aborted) showToast('AI 生成失败');
            console.error(e);
        } finally {
            aiLockRef.current = false;
            setAiCharacterLoading(false);
        }
    }

    async function handleTauriUpdate() {
        if (!updateObjRef.current) return;
        setUpdateDownloading(true);
        setUpdateProgress(0);
        try {
            let downloaded = 0;
            let total = 0;
            await updateObjRef.current.downloadAndInstall((event: { event: string; data: { contentLength?: number; chunkLength?: number } }) => {
                if (event.event === 'Started') {
                    total = event.data.contentLength ?? 0;
                } else if (event.event === 'Progress') {
                    downloaded += event.data.chunkLength ?? 0;
                    if (total > 0) setUpdateProgress(Math.round(downloaded / total * 100));
                } else if (event.event === 'Finished') {
                    setUpdateInstalled(true);
                    setUpdateDownloading(false);
                }
            });
        } catch {
            showToast('更新下载失败，请前往 GitHub 手动下载');
            setUpdateDownloading(false);
        }
    }

    async function handleTauriRelaunch() {
        try {
            const { relaunch } = await import('@tauri-apps/plugin-process');
            await relaunch();
        } catch {
            showToast('请手动重启应用以完成更新');
        }
    }

    async function handleManualCheckUpdate() {
        if (manualCheckLoading || updateDownloading) return;
        // 如果已检测到更新且有插件对象，直接开始下载
        if (updateBanner && updateObjRef.current) {
            void handleTauriUpdate();
            return;
        }
        // Web 版已有更新横幅，直接打开 Release 页面
        if (updateBanner && updateBanner.url) {
            window.open(updateBanner.url, '_blank', 'noopener,noreferrer');
            return;
        }
        setManualCheckLoading(true);
        try {
            let found = false;
            // 优先使用 tauri 插件（可应用内安装）
            try {
                const { check } = await import('@tauri-apps/plugin-updater');
                const update = await check();
                if (update?.available) {
                    updateObjRef.current = update;
                    setUpdateBanner({ version: update.version, url: '' });
                    found = true;
                }
            } catch { /* latest.json 不存在或网络错误，继续 fallback */ }
            // Fallback: GitHub Releases API
            if (!found) {
                const r = await fetch(
                    `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
                    { headers: { Accept: 'application/vnd.github+json' } }
                );
                if (r.ok) {
                    const data = await r.json();
                    const latestVer = (data.tag_name as string).replace(/^v/, '');
                    if (latestVer !== APP_VERSION) {
                        setUpdateBanner({ version: data.tag_name, url: data.html_url });
                        found = true;
                    }
                }
            }
            if (!found) showToast('✅ 已是最新版本');
        } catch {
            showToast('检查更新失败，请检查网络连接');
        } finally {
            setManualCheckLoading(false);
        }
    }

    async function handleAiCharacterGenerate() {
        if (!store.aiEnabled || aiLockRef.current) return;
        aiLockRef.current = true;
        setAiCharacterGenLoading(true);
        const signal = newAiAbort();
        try {
            const currentLayer = store.currentCharacterPrompt
                ? CHARACTER_LAYERS.find(l => l.id === store.currentCharacterPrompt!.layer)
                : CHARACTER_LAYERS.find(l => l.id === (store.selectedCharacterLayer || 'inner'));
            const layer = currentLayer || CHARACTER_LAYERS[0];
            const userPrompts = await db.characterPrompts.toArray();
            const allTexts = [...BUILTIN_CHARACTER_PROMPTS, ...userPrompts]
                .filter(p => p.layer === layer.id)
                .map(p => p.text);
            const msgs = buildCharacterGeneratePrompt({
                layerId: layer.id,
                layerName: layer.name,
                layerDescription: layer.description,
                genre: store.drawnGenre,
                existingTexts: allTexts,
            });
            const result = await chatCompletion(store.aiConfig, msgs, { maxTokens: 400, signal });
            const stripPrefix = (s: string) => s.replace(/^[\s\uff08（(]*[\d①②③一二三][\s.、.）).\uff09]*/, '').replace(/^[-•*]\s*/, '').trim();
            const lines = result.split('\n').map(l => stripPrefix(l.trim())).filter(l => l.length > 0);
            if (lines.length > 0) {
                const newPrompts = lines.map((text, i) => ({
                    id: `ai_cp_${Date.now()}_${i}`,
                    text,
                    layer: layer.id as CharacterLayerId,
                    source: 'user' as const,
                }));
                await db.characterPrompts.bulkPut(newPrompts);
                store.setCurrentCharacterPrompt(newPrompts[0]);
                setAiCharacterExtra('');
                showToast(`✨ AI 出了 ${lines.length} 道角色题并已保存到题库`);
            }
        } catch (e) {
            if (!signal.aborted) showToast('AI 出题失败');
            console.error(e);
        } finally {
            aiLockRef.current = false;
            setAiCharacterGenLoading(false);
        }
    }

    async function handleAiContinue() {
        if (!store.aiEnabled || !store.editorContent.trim() || aiLockRef.current) return;
        aiLockRef.current = true;
        setAiContinueLoading(true);
        const baseContent = store.editorContent;
        const aiSectionPrefix = '\n\n---\n\n### AI 续写\n\n';
        const accumulated = { text: '' };
        let rafId = 0;
        const signal = newAiAbort();
        try {
            const contentLen = baseContent.replace(/\s/g, '').length;
            const msgs = buildContinueWritingPrompt(store.editorTitle, baseContent, store.writingMode);
            if (contentLen > 600) showToast('📝 AI 仅参考最后 600 字进行续写');
            await chatCompletionStream(store.aiConfig, msgs, (chunk) => {
                accumulated.text += chunk;
                // 使用 rAF 节流，避免每个 token 都触发 re-render
                cancelAnimationFrame(rafId);
                rafId = requestAnimationFrame(() => {
                    store.setEditorContent(baseContent + aiSectionPrefix + accumulated.text);
                });
            }, { maxTokens: 400, signal });
            // 确保最终内容被写入
            cancelAnimationFrame(rafId);
            store.setEditorContent(baseContent + aiSectionPrefix + accumulated.text);
        } catch (e) {
            if (!signal.aborted) showToast('AI 续写失败');
            console.error(e);
        } finally {
            aiLockRef.current = false;
            setAiContinueLoading(false);
        }
    }

    async function handleAiFeedback() {
        if (!store.aiEnabled || !store.editorContent.trim() || aiLockRef.current) return;
        aiLockRef.current = true;
        setAiFeedbackLoading(true);
        setAiFeedback('');
        const signal = newAiAbort();
        try {
            const contentLen = store.editorContent.replace(/\s/g, '').length;
            if (contentLen > 800) showToast('📝 AI 仅分析前 800 字');
            const msgs = buildWritingFeedbackPrompt(store.editorTitle, store.editorContent);
            const result = await chatCompletion(store.aiConfig, msgs, { maxTokens: 300, signal });
            setAiFeedback(result);
        } catch (e) {
            if (!signal.aborted) showToast('AI 反馈失败');
            console.error(e);
        } finally {
            aiLockRef.current = false;
            setAiFeedbackLoading(false);
        }
    }

    async function handleAiDreamInterpret() {
        if (!store.aiEnabled || !store.editorContent.trim() || aiLockRef.current) return;
        aiLockRef.current = true;
        setAiDreamInterpretLoading(true);
        setAiDreamInterpret('');
        const signal = newAiAbort();
        try {
            const msgs = buildDreamInterpretationPrompt(store.editorTitle, store.editorContent);
            const result = await chatCompletion(store.aiConfig, msgs, { maxTokens: 500, signal });
            setAiDreamInterpret(result);
        } catch (e) {
            if (!signal.aborted) showToast('AI 解梦失败');
            console.error(e);
        } finally {
            aiLockRef.current = false;
            setAiDreamInterpretLoading(false);
        }
    }

    // Auto-save
    // 短延迟防抖自动保存 (2.5s)
    useEffect(() => {
        if (store.activeTab !== 'inspire' || store.writingMode === null) return;
        if (!hasMeaningfulContent(store.editorContent)) return;
        if (store.editorContent === lastSavedContentRef.current) return;

        const timer = setTimeout(() => {
            handleSave();
            lastSavedContentRef.current = store.editorContent;
        }, 2500);

        return () => clearTimeout(timer);
    }, [store.activeTab, store.writingMode, store.editorContent]);

    // 周期性节流自动保存 (60s)
    useEffect(() => {
        if (store.activeTab !== 'inspire' || store.writingMode === null) return;

        const interval = setInterval(() => {
            const currentContent = useStore.getState().editorContent;
            if (hasMeaningfulContent(currentContent) && currentContent !== lastSavedContentRef.current) {
                handleSave();
                lastSavedContentRef.current = currentContent;
            }
        }, 60000);

        return () => clearInterval(interval);
    }, [store.activeTab, store.writingMode]);

    function showToast(msg: string) {
        setToast(msg);
        setTimeout(() => setToast(''), 2500);
    }

    async function refreshTodayWords(excludeDraftId?: string | null) {
        try {
            const todayStr = new Date().toISOString().slice(0, 10);
            // 使用传入的参数；若未传则从 store 取最新值（避免闭包过时）
            const currentId = excludeDraftId !== undefined ? excludeDraftId : useStore.getState().currentDraftId;
            const drafts = await db.drafts.toArray();
            const total = drafts
                .filter(d => !d.deletedFromPalace)
                .filter(d => new Date(d.updatedAt).toISOString().slice(0, 10) === todayStr)
                .filter(d => d.id !== currentId)
                .reduce((sum, d) => sum + (d.wordCount || 0), 0);
            setTodayOtherDraftsWords(total);
        } catch { }
    }

    useEffect(() => { refreshTodayWords(); }, [store.currentDraftId]);

    // 切换 tab 或退出写作模式时也刷新今日字数，避免字数长时间不更新
    useEffect(() => {
        if (store.activeTab !== 'inspire' || store.writingMode === null) {
            refreshTodayWords();
        }
    }, [store.activeTab, store.writingMode]);

    useEffect(() => {
        let cancelled = false;
        if (!store.currentScene) {
            setIsSceneFavorited(false);
            return;
        }
        isPromptFavorited('scene', store.currentScene.id)
            .then(v => { if (!cancelled) setIsSceneFavorited(v); })
            .catch(() => { if (!cancelled) setIsSceneFavorited(false); });
        return () => { cancelled = true; };
    }, [store.currentScene?.id]);

    useEffect(() => {
        let cancelled = false;
        if (!store.currentChallenge) {
            setIsChallengeFavorited(false);
            return;
        }
        isPromptFavorited('challenge', store.currentChallenge.id)
            .then(v => { if (!cancelled) setIsChallengeFavorited(v); })
            .catch(() => { if (!cancelled) setIsChallengeFavorited(false); });
        return () => { cancelled = true; };
    }, [store.currentChallenge?.id]);

    useEffect(() => {
        let cancelled = false;
        if (!store.currentCharacterPrompt) {
            setIsCharacterFavorited(false);
            return;
        }
        isPromptFavorited('character', store.currentCharacterPrompt.id)
            .then(v => { if (!cancelled) setIsCharacterFavorited(v); })
            .catch(() => { if (!cancelled) setIsCharacterFavorited(false); });
        return () => { cancelled = true; };
    }, [store.currentCharacterPrompt?.id]);

    const currentEditorWords = store.editorContent.replace(/\s/g, '').length;
    const wordCount = todayOtherDraftsWords + currentEditorWords;

    const today = new Date();
    const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日 · 星期${['日', '一', '二', '三', '四', '五', '六'][today.getDay()]}`;

    const genreStyleMap: Record<string, { bg: string; icon: string }> = {
        '科幻': { bg: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-500/10 dark:border-blue-400/15 dark:text-blue-300', icon: 'rocket_launch' },
        '悬疑': { bg: 'bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-500/10 dark:border-purple-400/15 dark:text-purple-300', icon: 'search' },
        '奇幻': { bg: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-500/10 dark:border-green-400/15 dark:text-green-300', icon: 'auto_stories' },
        '言情': { bg: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-500/10 dark:border-red-400/15 dark:text-red-300', icon: 'favorite' },
        '武侠': { bg: 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-500/10 dark:border-orange-400/15 dark:text-orange-300', icon: 'swords' },
        '都市': { bg: 'bg-teal-50 border-teal-200 text-teal-800 dark:bg-teal-500/10 dark:border-teal-400/15 dark:text-teal-300', icon: 'location_city' },
        '历史': { bg: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-400/15 dark:text-amber-300', icon: 'history_edu' },
        '恐怖': { bg: 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-500/10 dark:border-rose-400/15 dark:text-rose-300', icon: 'sentiment_very_dissatisfied' },
    };

    const genreIconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
        '科幻': Rocket,
        '悬疑': Search,
        '奇幻': BookText,
        '言情': Heart,
        '武侠': Sword,
        '都市': Building2,
        '历史': ScrollText,
        '恐怖': Ghost,
    };

    const writingModeIconMap: Record<WritingMode, React.ComponentType<{ size?: number; className?: string }>> = {
        words: Dices,
        free: PencilLine,
        scene: Mountain,
        dream: MoonStar,
        challenge: CircleHelp,
        character: User,
    };

    const characterLayerIconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
        inner: Brain,
        relationship: Users,
        voice: Mic,
        body: Accessibility,
        history: History,
        edge: Eye,
    };

    const categoryIconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = useMemo(() => {
        const base: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
            '意象': Sparkles,
            '实物': Package,
            '动作': Zap,
            '状态': Layers,
            '感官': Eye,
            '抽象': Brain,
            '人物': User,
            '地名': MapIcon,
            '典故': ScrollText,
        };
        Object.entries(customCategoryIconKeyMap).forEach(([name, iconKey]) => {
            const Icon = customCategoryIconPool[iconKey];
            if (Icon) base[name] = Icon;
        });
        return base;
    }, [customCategoryIconKeyMap]);

    const isWriting = store.writingMode !== null && store.activeTab === 'inspire';


    return (
        <div className="bg-background text-on-surface font-body selection:bg-primary-container selection:text-on-primary-container min-h-screen">
            {/* TopNavBar */}
            <header className="fixed top-0 left-0 right-0 z-50 glass-panel bg-surface/70 dark:bg-[#100e0d]/75 border-b border-outline-variant/10 flex justify-between items-center px-4 md:px-8 py-3 md:py-4 max-w-full safe-area-top">
                <div className="flex items-baseline gap-2">
                    <div className="text-lg md:text-xl font-bold text-primary font-headline tracking-tight">灵感是橡果</div>
                    <span className="text-[11px] font-label text-on-surface-variant/50 hidden md:inline">v{APP_VERSION}</span>
                </div>
                <nav className="hidden md:flex space-x-8 items-center font-headline text-base tracking-tight">
                    {isWriting && (
                        <button
                            onClick={handleBackToModeSelect}
                            className="flex items-center space-x-1.5 transition-all duration-300 ease-in-out text-on-surface-variant hover:text-primary"
                        >
                            <Home size={20} />
                            <span>首页</span>
                        </button>
                    )}
                    <button className={`flex items-center space-x-1.5 transition-all duration-300 ease-in-out ${store.activeTab === 'inspire' ? 'text-primary border-b-2 border-primary pb-1 font-bold' : 'text-on-surface-variant hover:text-primary'}`} onClick={() => handleTopTabChange('inspire')}>
                        <Sparkles size={20} />
                        <span>灵感</span>
                    </button>
                    <button className={`flex items-center space-x-1.5 transition-all duration-300 ease-in-out ${store.activeTab === 'palace' ? 'text-primary border-b-2 border-primary pb-1 font-bold' : 'text-on-surface-variant hover:text-primary'}`} onClick={() => handleTopTabChange('palace')}>
                        <Landmark size={20} />
                        <span>灵感宫殿</span>
                    </button>
                    <button className={`flex items-center space-x-1.5 transition-all duration-300 ease-in-out ${store.activeTab === 'favorites' ? 'text-primary border-b-2 border-primary pb-1 font-bold' : 'text-on-surface-variant hover:text-primary'}`} onClick={() => handleTopTabChange('favorites')}>
                        <Star size={20} />
                        <span>收藏</span>
                    </button>
                    <button className={`flex items-center space-x-1.5 transition-all duration-300 ease-in-out ${store.activeTab === 'history' ? 'text-primary border-b-2 border-primary pb-1 font-bold' : 'text-on-surface-variant hover:text-primary'}`} onClick={() => handleTopTabChange('history')}>
                        <BookOpen size={20} />
                        <span>历史</span>
                    </button>
                </nav>
                <div className="flex items-center space-x-1 md:space-x-2">
                    {/* 检查更新按钮 */}
                    <button
                        onClick={handleManualCheckUpdate}
                        title={updateBanner ? `发现新版本 ${updateBanner.version}，点击下载安装` : `检查更新（当前 v${APP_VERSION}）`}
                        disabled={manualCheckLoading || updateDownloading}
                        className={`p-2 rounded-full hover:bg-surface-container transition-colors disabled:opacity-50 ${
                            updateBanner ? 'text-primary animate-pulse' : 'text-on-surface-variant'
                        }`}
                    >
                        {manualCheckLoading
                            ? <LoaderCircle size={22} className="animate-spin" />
                            : <Download size={22} />}
                    </button>
                    <button
                        onClick={() => setShowAiSettings(true)}
                        title="AI 设置"
                        className={`p-2 rounded-full hover:bg-surface-container transition-colors ${store.aiEnabled ? 'text-primary' : 'text-on-surface-variant'}`}
                    >
                        <Bot size={22} />
                    </button>
                    {/* 云同步按钮 */}
                    <button
                        onClick={() => store.cloudUser ? (syncFromCloud(store.cloudUser.id), showToast('☁️ 同步中…')) : setShowCloudLogin(true)}
                        title={store.cloudUser ? `已登录: ${store.cloudUser.email}（点击同步）` : '登录云同步'}
                        className={`p-2 rounded-full hover:bg-surface-container transition-colors relative ${store.cloudUser ? 'text-primary' : 'text-on-surface-variant'
                            }`}
                    >
                        {cloudSyncing ? <RefreshCw size={22} className="animate-spin" /> : <Cloud size={22} />}
                        {cloudSyncing && <span className="absolute inset-0 rounded-full animate-spin border-2 border-primary/30 border-t-primary" />}
                    </button>
                    <button
                        onClick={() => store.setTheme(store.theme === 'dark' ? 'light' : 'dark')}
                        title={store.theme === 'dark' ? '切换到浅色' : '切换到深色'}
                        className="p-2 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant"
                    >
                        {store.theme === 'dark' ? <Moon size={22} /> : <Sun size={22} />}
                    </button>
                </div>
            </header>

            {/* 更新横幅 */}
            {updateBanner && (
                <div className="fixed left-0 right-0 z-40 bg-primary text-on-primary text-xs font-label" style={{ top: 'calc(64px + env(safe-area-inset-top, 0px))' }}>
                    {/* 进度条（下载中时显示） */}
                    {updateDownloading && (
                        <div className="h-0.5 bg-on-primary/20">
                            <div
                                className="h-full bg-on-primary transition-all duration-300"
                                style={{ width: `${updateProgress}%` }}
                            />
                        </div>
                    )}
                    <div className="flex items-center justify-between px-6 py-2">
                        <span className="flex items-center gap-1.5">
                            <Info size={16} />
                            新版本 <strong>{updateBanner.version}</strong> 已发布！
                        </span>
                        <div className="flex items-center gap-3">
                            {updateObjRef.current ? (
                                /* Tauri 桌面端：下载安装 */
                                updateInstalled ? (
                                    <button
                                        onClick={handleTauriRelaunch}
                                        className="flex items-center gap-1 font-semibold underline underline-offset-2 hover:opacity-80"
                                    >
                                        <RefreshCw size={14} /> 重启以完成更新
                                    </button>
                                ) : updateDownloading ? (
                                    <span className="flex items-center gap-1 opacity-80">
                                        <LoaderCircle size={14} className="animate-spin" />
                                        {updateProgress > 0 ? `${updateProgress}%` : '准备下载…'}
                                    </span>
                                ) : (
                                    <button
                                        onClick={handleTauriUpdate}
                                        className="flex items-center gap-1 font-semibold underline underline-offset-2 hover:opacity-80"
                                    >
                                        <Download size={14} /> 立即下载安装
                                    </button>
                                )
                            ) : (
                                /* Web 版：跳转 GitHub */
                                <a
                                    href={updateBanner.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline underline-offset-2 hover:opacity-80"
                                >查看更新内容</a>
                            )}
                            <button onClick={() => setUpdateBanner(null)} className="opacity-70 hover:opacity-100 transition-opacity">
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile bottom tab bar */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass-panel bg-surface/90 dark:bg-[#100e0d]/90 border-t border-outline-variant/10 flex justify-around items-center h-14 safe-area-bottom">
                {[
                    { tab: 'inspire', Icon: Sparkles, label: '灵感' },
                    { tab: 'palace', Icon: Landmark, label: '宫殿' },
                    { tab: 'favorites', Icon: Star, label: '收藏' },
                    { tab: 'history', Icon: BookOpen, label: '历史' },
                ].map(t => {
                    const isHomeBtn = isWriting && t.tab === 'inspire';
                    const BtnIcon = isHomeBtn ? Home : t.Icon;
                    return (
                        <button
                            key={t.tab}
                            onClick={isHomeBtn ? handleBackToModeSelect : () => handleTopTabChange(t.tab)}
                            className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${store.activeTab === t.tab ? 'text-primary' : 'text-on-surface-variant'}`}
                        >
                            <BtnIcon size={22} />
                            <span className="text-[10px] font-label mt-0.5">{isHomeBtn ? '首页' : t.label}</span>
                        </button>
                    );
                })}
            </nav>

            <div className="flex h-screen h-[100dvh] pb-[56px] md:pb-[45px]" style={{ paddingTop: 'calc(64px + env(safe-area-inset-top, 0px))' }}>

                {/* ━━━ Mode Selection Screen (Bento) ━━━ */}
                {store.activeTab === 'inspire' && !isWriting && (
                    <main className="flex-1 bg-background relative overflow-y-auto">
                        <div className="max-w-5xl mx-auto pt-8 md:pt-16 pb-32 px-4 md:px-8">
                            {/* Hero */}
                            <div className="mb-8 md:mb-12">
                                <p className="text-outline text-xs font-label uppercase tracking-[0.2em] mb-3">{dateStr}</p>
                                <h1 className="font-headline italic text-3xl md:text-5xl lg:text-6xl text-on-surface mb-3 tracking-tight leading-none">今天想写什么？</h1>
                                <p className="text-on-surface-variant font-label text-sm max-w-md leading-relaxed">当然，什么都不写也没问题。一切在我。</p>
                            </div>

                            {/* Bento Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-12 gap-3 md:gap-4 auto-rows-[140px] md:auto-rows-[180px]">

                                {/* 🎁 今日灵感盲盒 — fullwidth (12 cols, 1 row) */}
                                {(() => {
                                    const todayStr = new Date().toISOString().slice(0, 10);
                                    const isOpened = store.dailyBoxOpenedDate === todayStr && store.dailyBoxData;
                                    return (
                                        <div className="col-span-2 md:col-span-12 row-span-1 bento-ring-wrapper">
                                            <div className="w-full h-full glass-panel bg-gradient-to-r from-violet-500/5 to-fuchsia-500/5 dark:from-violet-500/10 dark:to-fuchsia-500/10 rounded-2xl border border-outline-variant/15 p-5 md:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 overflow-hidden relative z-[1]">
                                                {/* background decorations */}
                                                <div className="absolute right-12 -top-12 w-48 h-48 bg-violet-400/5 blur-[60px] rounded-full pointer-events-none"></div>
                                                <div className="absolute left-1/3 -bottom-12 w-48 h-48 bg-fuchsia-400/5 blur-[60px] rounded-full pointer-events-none"></div>

                                                {!isOpened ? (
                                                    // 未开启状态
                                                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-between">
                                                        <div className="flex items-center gap-3.5 text-center sm:text-left flex-col sm:flex-row">
                                                            <span className={`p-3 rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 shrink-0 ${isOpeningBox ? 'animate-jiggle' : 'hover:animate-jiggle'}`}>
                                                                <Sparkles size={36} className={isOpeningBox ? 'animate-jiggle' : ''} />
                                                            </span>
                                                            <div>
                                                                <h2 className="font-headline text-lg font-bold text-on-surface flex items-center gap-1.5 justify-center sm:justify-start">
                                                                    今日限定灵感盲盒 🌰
                                                                </h2>
                                                                <p className="text-on-surface-variant text-xs mt-1">AI 与算法联袂特调，每日专供一次限定盲盒，开启你的今日奇思妙想</p>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={handleOpenDailyBox}
                                                            disabled={isOpeningBox}
                                                            className="px-5 py-2.5 bg-primary text-on-primary rounded-xl font-label text-xs font-bold shadow-md hover:bg-primary-dim transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                                                        >
                                                            {isOpeningBox ? (
                                                                <>
                                                                    <LoaderCircle size={16} className="animate-spin" />
                                                                    <span>正在拆开盲盒…</span>
                                                                </>
                                                            ) : (
                                                                <span>拆开今日盲盒</span>
                                                            )}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    // 已开启状态
                                                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-between">
                                                        <div className="flex-1 w-full text-center sm:text-left">
                                                            <div className="flex items-center gap-2 mb-2 justify-center sm:justify-start">
                                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-label tracking-widest uppercase bg-violet-500/15 text-violet-700 dark:text-[#a78bfa] border border-violet-400/20">
                                                                    今日限定
                                                                </span>
                                                                <span className="text-xs text-on-surface-variant font-label">
                                                                    {store.dailyBoxData.promptType === 'scene' ? '🏞️ 场景任务' : '⚔️ 挑战任务'}
                                                                </span>
                                                            </div>
                                                            {/* 3个词条展示 */}
                                                            <div className="flex flex-wrap gap-1.5 mb-2.5 justify-center sm:justify-start">
                                                                {store.dailyBoxData.words.map((w: any) => (
                                                                    <span key={w.id} className="px-2.5 py-1 bg-surface-container border border-outline-variant/20 rounded-lg text-xs text-on-surface font-label font-medium">
                                                                        {w.text}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                            <p className="text-on-surface-variant text-xs line-clamp-1">
                                                                任务：{store.dailyBoxData.promptType === 'scene' ? store.dailyBoxData.promptData.description : store.dailyBoxData.promptData.text}
                                                            </p>
                                                        </div>
                                                        <button 
                                                            onClick={handleStartDailyWriting}
                                                            className="px-5 py-2.5 bg-violet-500 text-white rounded-xl font-label text-xs font-bold shadow-md hover:bg-violet-600 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                                                        >
                                                            <span>以此开启写作 →</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* 词汇灵感 — large (8 cols, 2 rows) */}
                                <div className="col-span-2 md:col-span-8 row-span-2 bento-ring-wrapper">
                                <button onClick={() => selectMode('words')}
                                    className="w-full h-full glass-panel bg-surface-container dark:bg-surface-container rounded-2xl border border-outline-variant/10 p-5 md:p-8 flex flex-col justify-between group bento-glow-amber transition-all duration-500 overflow-hidden relative z-[1] text-left active:scale-[0.99]"
                                >
                                    <div className="absolute -right-16 -top-16 w-56 h-56 bg-amber-400/5 dark:bg-[#ffb148]/5 blur-[80px] rounded-full group-hover:bg-amber-400/10 dark:group-hover:bg-[#ffb148]/10 transition-colors pointer-events-none"></div>
                                    <div>
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="p-3 rounded-lg bg-amber-500/10 text-amber-600 dark:text-[#ffb148]">
                                                <Dices size={30} />
                                            </span>
                                            <h2 className="font-headline text-lg md:text-2xl text-on-surface">词汇灵感</h2>
                                        </div>
                                        <p className="text-orange-700 text-sm leading-relaxed max-w-sm">让我悦耳之声你华丽英勇的冲淡。</p>
                                        <p className="text-on-surface-variant text-sm leading-relaxed max-w-sm">这句话是什么意思？什么意思都没有！那它的意义何在？它解开了束缚着我的语法规则。</p>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="font-label text-[11px] md:text-[12px] uppercase tracking-widest text-on-surface-variant hidden md:inline">含词库管理 · Space 键抽取</span>
                                        <span className="px-3 md:px-5 py-1.5 md:py-2 bg-amber-500/15 text-amber-700 dark:text-[#ffb148] rounded-full font-label text-xs font-bold border border-amber-400/20 group-hover:bg-amber-500/25 transition-all">开始写作 →</span>
                                    </div>
                                </button>
                                </div>

                                {/* 梦境记录 — small (4 cols, 1 row) */}
                                <div className="col-span-1 md:col-span-4 row-span-1 bento-ring-wrapper">
                                <button onClick={() => selectMode('dream')}
                                    className="w-full h-full glass-panel bg-surface-container dark:bg-surface-container rounded-2xl border border-outline-variant/10 p-4 md:p-6 flex flex-col justify-between group bento-glow-violet transition-all duration-500 overflow-hidden relative z-[1] text-left active:scale-[0.99]"
                                >
                                    <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-violet-400/5 dark:bg-[#ba9eff]/5 blur-[60px] rounded-full group-hover:bg-violet-400/10 dark:group-hover:bg-[#ba9eff]/10 transition-colors pointer-events-none"></div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="p-2 rounded-lg bg-violet-500/10 text-violet-600 dark:text-[#ba9eff]">
                                            <MoonStar size={22} />
                                        </span>
                                        <h2 className="font-headline text-lg text-on-surface">梦境记录</h2>
                                    </div>
                                    <p className="text-on-surface-variant text-xs leading-relaxed">我有过一个梦。一个出生的梦。一个死亡的梦。一个鸟巢。</p>
                                </button>
                                </div>

                                {/* 角色描写 — small (4 cols, 1 row) */}
                                <div className="col-span-1 md:col-span-4 row-span-1 bento-ring-wrapper">
                                <button onClick={() => selectMode('character')}
                                    className="w-full h-full glass-panel bg-surface-container dark:bg-surface-container rounded-2xl border border-outline-variant/10 p-4 md:p-6 flex flex-col justify-between group bento-glow-fuchsia transition-all duration-500 overflow-hidden relative z-[1] text-left active:scale-[0.99]"
                                >
                                    <div className="absolute -left-8 -top-8 w-36 h-36 bg-fuchsia-400/5 dark:bg-fuchsia-300/5 blur-[60px] rounded-full group-hover:bg-fuchsia-400/10 transition-colors pointer-events-none"></div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="p-2 rounded-lg bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300">
                                            <User size={22} />
                                        </span>
                                        <h2 className="font-headline text-lg text-on-surface">角色描写</h2>
                                    </div>
                                    <p className="text-on-surface-variant text-xs leading-relaxed">“到底什么是‘真相’？”有一天，兔子这样问道。</p>
                                </button>
                                </div>

                                {/* 自由发挥 — medium (5 cols, 1 row) */}
                                <div className="col-span-1 md:col-span-5 row-span-1 bento-ring-wrapper">
                                <button onClick={() => selectMode('free')}
                                    className="w-full h-full glass-panel bg-surface-container dark:bg-surface-container rounded-2xl border border-outline-variant/10 p-4 md:p-6 flex flex-col justify-between group bento-glow-green transition-all duration-500 overflow-hidden relative z-[1] text-left active:scale-[0.99]"
                                >
                                    <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-emerald-400/5 dark:bg-[#69f6b8]/5 blur-[80px] rounded-full group-hover:bg-emerald-400/10 dark:group-hover:bg-[#69f6b8]/10 transition-colors pointer-events-none"></div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-[#69f6b8]">
                                            <PencilLine size={22} />
                                        </span>
                                        <h2 className="font-headline text-lg text-on-surface">自由发挥</h2>
                                    </div>
                                    <p className="text-on-surface-variant text-xs leading-relaxed">潦草、不假思索、一往无前、冲动而且诚实。我想不出来任何东西去写。</p>
                                </button>
                                </div>

                                {/* 场景描写 — medium (4 cols, 1 row) */}
                                <div className="col-span-1 md:col-span-4 row-span-1 bento-ring-wrapper">
                                <button onClick={() => selectMode('scene')}
                                    className="w-full h-full glass-panel bg-surface-container dark:bg-surface-container rounded-2xl border border-outline-variant/10 p-4 md:p-6 flex flex-col justify-between group bento-glow-blue transition-all duration-500 overflow-hidden relative z-[1] text-left active:scale-[0.99]"
                                >
                                    <div className="absolute right-0 top-0 w-full h-full pointer-events-none opacity-20 group-hover:opacity-30 transition-opacity">
                                        <div className="w-full h-full bg-gradient-to-br from-blue-400/20 to-transparent rounded-2xl"></div>
                                    </div>
                                    <div className="flex items-center gap-2 mb-2 relative">
                                        <span className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-300">
                                            <Mountain size={22} />
                                        </span>
                                        <h2 className="font-headline text-lg text-on-surface">场景描写</h2>
                                    </div>
                                    <p className="text-on-surface-variant text-xs leading-relaxed relative">空气里有静止的灰尘、疯狂的灰尘和正要爆发的灰尘。</p>
                                </button>
                                </div>

                                {/* 写作挑战 — medium (3 cols, 1 row) */}
                                <div className="col-span-2 md:col-span-3 row-span-1 bento-ring-wrapper">
                                <button onClick={() => selectMode('challenge')}
                                    className="w-full h-full glass-panel bg-surface-container dark:bg-surface-container rounded-2xl border border-outline-variant/10 p-4 md:p-6 flex flex-col justify-between group bento-glow-rose transition-all duration-500 overflow-hidden relative z-[1] text-left active:scale-[0.99]"
                                >
                                    <div className="absolute -right-8 -top-8 w-36 h-36 bg-rose-400/5 dark:bg-rose-300/5 blur-[60px] rounded-full group-hover:bg-rose-400/10 transition-colors pointer-events-none"></div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-300">
                                            <CircleHelp size={22} />
                                        </span>
                                        <h2 className="font-headline text-lg text-on-surface">写作挑战</h2>
                                    </div>
                                    <p className="text-on-surface-variant text-xs leading-relaxed">为什么那个人行道上的男人推着一个空的婴儿车？</p>
                                </button>
                                </div>

                            </div>

                            {/* Streak footer */}

                        </div>
                    </main>
                )}

                {/* ━━━ Writing Interface ━━━ */}
                {store.activeTab === 'inspire' && isWriting && (
                    <>
                        {/* Sidebar */}
                        <aside className={`transition-all duration-300 hidden md:flex ${store.sidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-64 glass-panel bg-surface-container-low/40 flex-col p-6 border-r border-outline-variant/10 shrink-0'}`}>
                            <button onClick={handleBackToModeSelect} className="flex items-center space-x-2 text-on-surface-variant hover:text-primary transition-colors mb-6 group">
                                <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                                <span className="font-label text-xs">返回选择</span>
                            </button>

                            {/* Words mode sidebar */}
                            {store.writingMode === 'words' && (
                                <>
                                    <div className="mb-6">
                                        <h2 className="font-headline text-lg font-semibold text-on-surface">词汇分类</h2>
                                        <p className="text-[12px] font-label uppercase tracking-widest text-on-surface-variant mt-1">筛选词条类型</p>
                                    </div>
                                    <nav className="space-y-1 flex-1 overflow-y-auto pr-2">
                                        {WORD_CATEGORIES.map(cat => {
                                            const active = store.selectedCategories.includes(cat);
                                            return (
                                                <button key={cat}
                                                    onClick={() => store.toggleCategory(cat)}
                                                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 ${active ? 'bg-surface-container-high text-primary shadow-sm dark:shadow-[0_0_15px_rgba(186,158,255,0.12)] active:scale-95' : 'text-on-surface-variant hover:bg-surface-container dark:hover:bg-white/5 hover:translate-x-1'}`}>
                                                    {(() => { const CatIcon = categoryIconMap[cat]; return CatIcon ? <CatIcon size={20} /> : <Tag size={20} />; })()}
                                                    <span className="font-label text-xs uppercase tracking-widest flex-1 text-left">{cat}</span>
                                                    {active && <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>}
                                                </button>
                                            );
                                        })}
                                        <div className="pt-6 pb-2">
                                            <h3 className="font-headline text-[15px] font-semibold text-on-surface mb-3">词条数量</h3>
                                            <div className="flex space-x-2">
                                                {[3, 4, 5].map(n => (
                                                    <button key={n} onClick={() => store.setWordCount(n as any)}
                                                        className={`flex-1 py-1.5 rounded text-xs font-label transition-colors ${store.wordCount === n ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-highest'}`}>
                                                        {n}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="pt-4">
                                            <button
                                                onClick={() => setWordsSubView(v => v === 'library' ? 'write' : 'library')}
                                                className={`w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-xs font-label transition-all ${wordsSubView === 'library'
                                                        ? 'bg-amber-100 text-amber-800 font-medium dark:bg-amber-500/15 dark:text-[#ffb148]'
                                                        : 'bg-surface-container-high text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-highest hover:text-[#ffb148]'
                                                    }`}
                                            >
                                                <BookOpen size={16} />
                                                <span>词库管理</span>
                                            </button>
                                        </div>
                                    </nav>
                                </>
                            )}

                            {/* Scene mode sidebar */}
                            {store.writingMode === 'scene' && (
                                <>
                                    <div className="mb-6">
                                        <h2 className="font-headline text-lg font-semibold text-on-surface">场景描写</h2>
                                        <p className="text-[12px] font-label uppercase tracking-widest text-on-surface-variant mt-1">用文字描绘画面</p>
                                    </div>
                                    <div className="flex-1 flex flex-col space-y-3">
                                        <button onClick={() => { store.setCurrentScene(pickRandomScene(store.currentScene?.id)); setAiSceneExtra(''); }} className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-surface-container-high border border-outline-variant/30 rounded-lg text-sm font-label text-on-surface-variant hover:text-primary hover:border-primary/30 transition-all">
                                            <RefreshCw size={18} />
                                            <span>换一个场景</span>
                                        </button>

                                        {store.aiEnabled && (
                                            <>
                                                <button
                                                    onClick={handleAiSceneDeepDive}
                                                    disabled={aiSceneLoading || !store.currentScene}
                                                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50/60 dark:bg-blue-500/5 border border-blue-200/40 dark:border-blue-400/10 rounded-lg text-xs font-label text-blue-700 dark:text-blue-400 hover:bg-blue-100/60 dark:hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                                                >
                                                    {aiSceneLoading ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                                    <span>{aiSceneLoading ? '生成中…' : 'AI 补充感官细节'}</span>
                                                </button>
                                                <button
                                                    onClick={handleAiScene}
                                                    disabled={aiSceneLoading}
                                                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50/60 dark:bg-blue-500/5 border border-blue-200/40 dark:border-blue-400/10 rounded-lg text-xs font-label text-blue-700 dark:text-blue-400 hover:bg-blue-100/60 dark:hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                                                >
                                                    <Bot size={16} />
                                                    <span>AI 生成新场景</span>
                                                </button>
                                                {aiSceneExtra && (
                                                    <div className="bg-blue-50/60 dark:bg-blue-500/5 border border-blue-200/40 dark:border-blue-400/10 rounded-lg p-3">
                                                        <p className="text-[12px] font-label uppercase tracking-widest text-blue-600 dark:text-blue-600 mb-1.5 flex items-center gap-1">
                                                            <Sparkles size={14} />感官引导
                                                        </p>
                                                        <p className="text-sm text-blue-900 dark:text-blue-700 leading-relaxed whitespace-pre-line">{aiSceneExtra}</p>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* Dream mode sidebar */}
                            {store.writingMode === 'dream' && (
                                <>
                                    <div className="mb-6">
                                        <h2 className="font-headline text-lg font-semibold text-on-surface">梦境记录</h2>
                                        <p className="text-[12px] font-label uppercase tracking-widest text-on-surface-variant mt-1">记录你的梦</p>
                                    </div>
                                    <div className="flex-1 space-y-4">
                                        <div className="bg-stone-50/80 dark:bg-stone-500/10 border border-violet-200/60 dark:border-violet-400/15 rounded-lg p-4">
                                            <p className="font-headline text-sm font-medium text-violet-600 dark:text-violet-500 mb-2">让梦指引你</p>
                                            <ul className="text-xs text-violet-600/70 dark:text-violet-600/80 space-y-1.5 leading-relaxed">
                                            <li>梦能够到达我们的理性到达不了的地方。</li>
                                                <li>• 先写下印象最深的画面</li>
                                                <li>• 描述梦中的情绪和感受</li>
                                                <li>• 记录出现的人物和场所</li>
                                                <li>• 注意颜色、气味、声音</li>
                                                <li>• 不必追求逻辑，忠于感受</li>
                                            </ul>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Free mode sidebar */}
                            {store.writingMode === 'free' && (
                                <>
                                    <div className="mb-6">
                                        <h2 className="font-headline text-lg font-semibold text-on-surface">自由发挥</h2>
                                        <p className="text-[12px] font-label uppercase tracking-widest text-on-surface-variant mt-1">想到什么写什么</p>
                                    </div>
                                    <div className="flex-1 space-y-4">
                                        <div className="bg-emerald-50/80 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-400/15 rounded-lg p-4">
                                            <p className="font-headline text-sm font-medium text-emerald-900 dark:text-emerald-600 mb-2">✍ 自由模式</p>
                                            <p className="text-xs text-emerald-800/70 dark:text-emerald-600/70 leading-relaxed">没有提示、没有限制。把脑子里的想法直接咀尾到纸上。想写什么就写什么。</p>
                                        </div>
                                    </div>
                                </>
                            )}
                            {/* Challenge mode sidebar */}
                            {store.writingMode === 'challenge' && (
                                <>
                                    <div className="mb-6">
                                        <h2 className="font-headline text-lg font-semibold text-on-surface">写作挑战</h2>
                                        <p className="text-[12px] font-label uppercase tracking-widest text-on-surface-variant mt-1">你问我不一定答</p>
                                    </div>
                                    <div className="flex-1 flex flex-col space-y-4">
                                        <div className="bg-rose-50/80 dark:bg-rose-500/10 border border-rose-200/60 dark:border-rose-400/15 rounded-lg p-4">
                                            <p className="font-headline text-sm font-medium text-rose-900 dark:text-rose-500 mb-2">💭 练习提示</p>
                                            <ul className="text-xs text-rose-800/70 dark:text-rose-600/70 space-y-1.5 leading-relaxed">
                                                <li>• 不必写出「标准答案」</li>
                                                <li>• 尽可能尝试多种表达方式</li>
                                                <li>• 允许自己「错」和「奇思妙想」</li>
                                                <li>• 换一题继续就好</li>
                                            </ul>
                                        </div>
                                        <label className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-surface-container-high border border-outline-variant/30 rounded-lg text-xs font-label text-on-surface-variant hover:text-error hover:border-error/30 transition-all cursor-pointer">
                                            <Download size={18} />
                                            <span>导入提示 (.md)</span>
                                            <input type="file" accept=".md,.txt" className="hidden" onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                const text = await file.text();
                                                const lines = text.split('\n')
                                                    .map(l => l.trim())
                                                    .filter(l => l.length > 0)
                                                    .map(l => l.replace(/^[\u25cf\u2022\-*]\s*/, ''));
                                                if (lines.length === 0) return;
                                                const newChallenges = lines.map((t, i) => ({
                                                    id: `user_${Date.now()}_${i}`,
                                                    text: t,
                                                    source: 'user' as const,
                                                }));
                                                await db.challenges.bulkPut(newChallenges);
                                                pickAndSetChallenge(store.currentChallenge?.id);
                                                e.target.value = '';
                                            }} />
                                        </label>
                                        <div className="bg-surface-container-low dark:bg-surface-container-high border border-outline-variant/15 rounded-lg px-3 py-2.5 text-[12px] font-label text-on-surface-variant leading-relaxed">
                                            <p className="text-on-surface-variant font-medium mb-1">文件格式示例</p>
                                            <p className="text-[14px] text-outline mb-1.5">每行一条提示，空行忽略，支持 - / * / • 开头</p>
                                            <pre className="font-mono text-[14px] text-on-surface-variant whitespace-pre-wrap leading-relaxed">{`- 只用动作展示愤怒，不提情绪\n用感官细节描写一场分离\n• 在对话中藏一个人说谎的信号`}</pre>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Character mode sidebar */}
                            {store.writingMode === 'character' && (
                                <>
                                    <div className="mb-5">
                                        <h2 className="font-headline text-lg font-semibold text-on-surface">角色描写</h2>
                                        <p className="text-[12px] font-label uppercase tracking-widest text-on-surface-variant mt-1">六个维度深挖角色</p>
                                    </div>
                                    <div className="flex-1 flex flex-col space-y-2 overflow-y-auto">
                                        {/* Layer filter */}
                                        <p className="text-[12px] font-label text-on-surface-variant uppercase tracking-widest mb-1">切换维度</p>
                                        <button
                                            onClick={() => { store.setSelectedCharacterLayer(null); pickAndSetCharacterPrompt(store.currentCharacterPrompt?.id, null); }}
                                            className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left text-xs font-label transition-all ${store.selectedCharacterLayer === null
                                                    ? 'bg-stone-100 text-fuchsia-800 font-medium dark:bg-[rgb(136_41_211/40%)] dark:text-[#c7b8ed]'
                                                    : 'text-on-surface-variant hover:bg-surface-container dark:hover:bg-white/5'
                                                }`}
                                        >
                                            <Shuffle size={16} />
                                            <span>全部维度</span>
                                        </button>
                                        {CHARACTER_LAYERS.map(layer => (
                                            <button
                                                key={layer.id}
                                                onClick={() => {
                                                    store.setSelectedCharacterLayer(layer.id);
                                                    pickAndSetCharacterPrompt(store.currentCharacterPrompt?.id, layer.id);
                                                }}
                                                className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left text-xs font-label transition-all ${store.selectedCharacterLayer === layer.id
                                                        ? `${layer.color} font-medium`
                                                        : 'text-on-surface-variant hover:bg-surface-container dark:hover:bg-white/5'
                                                    }`}
                                            >
                                                {(() => {
                                                    const LayerIcon = characterLayerIconMap[layer.id] || User;
                                                    return <LayerIcon size={16} />;
                                                })()}
                                                <div className="flex-1 min-w-0">
                                                    <div>{layer.name}</div>
                                                </div>
                                            </button>
                                        ))}

                                        <div className="pt-3 space-y-2">
                                            <label className="flex items-center justify-center space-x-2 px-3 py-2 bg-surface-container-high border border-outline-variant/30 rounded-lg text-xs font-label text-on-surface-variant hover:text-fuchsia-300 hover:border-fuchsia-400/30 transition-all cursor-pointer">
                                                <Download size={16} />
                                                <span>导入提示 (.md)</span>
                                                <input type="file" accept=".md,.txt" className="hidden" onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    const text = await file.text();
                                                    const lines = text.split('\n')
                                                        .map(l => l.trim())
                                                        .filter(l => l.length > 0)
                                                        .map(l => l.replace(/^[\u25cf\u2022\-*]\s*/, ''));
                                                    if (lines.length === 0) return;
                                                    const layer = store.selectedCharacterLayer || 'inner';
                                                    const newPrompts = lines.map((t, i) => ({
                                                        id: `char_user_${Date.now()}_${i}`,
                                                        text: t,
                                                        layer,
                                                        source: 'user' as const,
                                                    }));
                                                    await db.characterPrompts.bulkPut(newPrompts);
                                                    pickAndSetCharacterPrompt(store.currentCharacterPrompt?.id);
                                                    e.target.value = '';
                                                }} />
                                            </label>
                                            <div className="bg-surface-container-low dark:bg-surface-container-high border border-outline-variant/15 rounded-lg px-3 py-2.5 text-[12px] font-label text-on-surface-variant leading-relaxed">
                                                <p className="text-on-surface-variant font-medium mb-1">文件格式示例</p>
                                                <p className="text-[14px] text-outline mb-1.5">每行一条提示，将归入当前选中维度</p>
                                                <pre className="font-mono text-[14px] text-on-surface-variant whitespace-pre-wrap leading-relaxed">{`- 他最害怕失去什么？\n她能原谅什么，不能原谅什么？\n• 他的沉默意味着什么`}</pre>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                            {/* Timer (all modes) */}
                            <div className="pt-4 pb-2 border-t border-outline-variant/15 mt-auto">
                                <h3 className="font-headline text-[15px] font-semibold text-on-surface mb-3">限时写作</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {[10, 15, 20, 30].map(n => (
                                        <button key={n} onClick={() => store.setTimerDuration(n as any)}
                                            className={`py-1.5 rounded text-[12px] font-label transition-colors ${store.timerDuration === n ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-highest'}`}>
                                            {n}分
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4">
                                <button onClick={() => store.toggleSidebar()} className="w-full py-2 flex items-center justify-center space-x-2 text-on-surface-variant hover:text-on-surface transition-colors text-xs font-label border border-transparent hover:border-outline-variant/30 rounded">
                                    <ChevronsLeft size={16} />
                                    <span>收起侧边栏</span>
                                </button>
                            </div>
                        </aside>

                        {store.sidebarCollapsed && (
                            <button className="fixed left-0 top-1/2 -translate-y-1/2 z-40 p-2 bg-surface/80 dark:bg-surface-container/80 border border-outline-variant/15 rounded-r-md shadow-sm opacity-50 hover:opacity-100 transition-all text-on-surface-variant hover:text-primary" onClick={() => store.toggleSidebar()}>
                                <ChevronsRight size={20} />
                            </button>
                        )}

                        {/* Word Inspiration Panel */}
                        {store.writingMode === 'words' && wordsSubView !== 'library' && (
                            <>
{/* 移动端遮罩 */}
                            {mobilePanel && (
                                <div 
                                    className="md:hidden fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm transition-opacity duration-300"
                                    onClick={() => setMobilePanel(false)}
                                />
                            )}
                            <section className={`
                                ${mobilePanel 
                                    ? 'fixed right-0 top-0 bottom-0 w-[85%] max-w-[360px] z-[60] bg-surface-container-low shadow-2xl translate-x-0' 
                                    : 'fixed right-0 top-0 bottom-0 w-[85%] max-w-[360px] z-[60] translate-x-full md:translate-x-0'
                                } 
                                transition-transform duration-300 ease-in-out overflow-y-auto pt-4 px-4 pb-20
                                md:relative md:block md:w-80 md:bg-surface-container-low md:overflow-y-auto md:shrink-0 md:border-r md:border-outline-variant/10 md:z-auto
                            `}>
                                <div className="p-5 md:p-8 flex flex-col space-y-6">
                                    <button onClick={() => setMobilePanel(false)} className="md:hidden mb-2 flex items-center gap-1 text-sm text-on-surface-variant"><X size={18} />收起</button>
                                    <div className="mb-2">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-label text-[12px] uppercase tracking-[0.2em] text-outline">词汇灵感</span>
                                            <div className="flex space-x-1">
                                                <button onClick={handleToggleFavorite} className="p-1 hover:bg-surface-container rounded group transition-all" title="收藏">
                                                    <Star size={20} className={`transition-colors ${store.isCurrentWordSetFavorite ? 'text-amber-500 fill-current' : 'text-outline group-hover:text-amber-500 dark:group-hover:text-[#ffb148]'}`} />
                                                </button>
                                                <button className="p-1 hover:bg-surface-container rounded group transition-all" title="换一组 (Space)" onClick={handleDraw}>
                                                    <Dices size={20} className="text-outline group-hover:text-primary transition-colors" />
                                                </button>
                                            </div>
                                        </div>
                                        <h3 className="font-headline text-2xl text-on-surface">写作灵感</h3>
                                    </div>

                                    {store.currentWords.length > 0 && (
                                        <div className={`flex items-center space-x-2 px-4 py-3 rounded-lg border ${store.drawnGenre ? (genreStyleMap[store.drawnGenre]?.bg ?? 'bg-stone-100 border-stone-200') : 'bg-surface-container-high border-outline-variant/30'}`}>
                                            {(() => {
                                                const GenreIcon = (store.drawnGenre && genreIconMap[store.drawnGenre]) || Sparkles;
                                                return <GenreIcon size={20} />;
                                            })()}
                                            <div className="flex-1">
                                                <p className="text-[12px] font-label uppercase tracking-widest text-on-surface-variant">写作风格</p>
                                                <p className="font-headline font-bold text-base leading-tight">{store.drawnGenre || '不限风格'}</p>
                                            </div>
                                            <button onClick={() => store.setDrawnGenre(pickRandomGenre(store.selectedGenres))} className="p-1 rounded hover:bg-surface-container transition-colors" title="换一个风格">
                                                <RefreshCw size={18} className="text-outline" />
                                            </button>
                                            <button onClick={() => store.setDrawnGenre(null)} className="p-1 rounded hover:bg-surface-container transition-colors" title="清除风格约束">
                                                <X size={18} className="text-outline" />
                                            </button>
                                        </div>
                                    )}

                                    {/* AI 写作引导 */}
                                    {store.aiEnabled && store.currentWords.length > 0 && (
                                        <div className="bg-amber-50/60 dark:bg-amber-500/5 border border-amber-200/40 dark:border-amber-400/10 rounded-lg p-3">
                                            {aiWordHint ? (
                                                <div>
                                                    <p className="text-[12px] font-label uppercase tracking-widest text-amber-600 dark:text-amber-500 mb-1.5 flex items-center gap-1">
                                                        <Sparkles size={14} />AI 灵感引导
                                                    </p>
                                                    <p className="text-sm text-amber-900 dark:text-amber-600 leading-relaxed">{aiWordHint}</p>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={handleAiWordHint}
                                                    disabled={aiWordHintLoading}
                                                    className="w-full flex items-center justify-center gap-1.5 py-1 text-xs font-label text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 transition-colors disabled:opacity-50"
                                                >
                                                    {aiWordHintLoading ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                                    <span>{aiWordHintLoading ? 'AI 思考中…' : 'AI 帮我找灵感'}</span>
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        {store.currentWords.map((w, i) => {
                                            const CATEGORY_STYLE: Record<string, { badge: string; glow: string }> = {
                                                '意象': { badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300', glow: 'word-glow-indigo' },
                                                '实物': { badge: 'bg-amber-100  text-amber-700', glow: 'word-glow-amber' },
                                                '动作': { badge: 'bg-emerald-100 text-emerald-700', glow: 'word-glow-emerald' },
                                                '状态': { badge: 'bg-pink-100   text-pink-700   dark:bg-pink-400/15   dark:text-pink-300', glow: 'word-glow-pink' },
                                                '感官': { badge: 'bg-cyan-100   text-cyan-700   dark:bg-cyan-400/15   dark:text-cyan-300', glow: 'word-glow-cyan' },
                                                '抽象': { badge: 'bg-violet-100 text-violet-700', glow: 'word-glow-violet' },
                                                '人物': { badge: 'bg-orange-100 text-orange-700', glow: 'word-glow-orange' },
                                                '地名': { badge: 'bg-teal-100   text-teal-700', glow: 'word-glow-teal' },
                                                '典故': { badge: 'bg-stone-100  text-stone-600  dark:bg-surface-variant dark:text-on-surface-variant', glow: 'word-glow-stone' },
                                            };
                                            const cat = w.category || w.genres?.[0] || '意象';
                                            const catStyle = CATEGORY_STYLE[cat] ?? CATEGORY_STYLE['意象'];
                                            const flipping = isFlipping && !store.lockedIndices.has(i);
                                            return (
                                                <div key={`${w.id}_${i}`} className="card-perspective">
                                                    <div className={`${catStyle.glow} bg-surface-container p-6 rounded-lg border border-outline-variant/10 custom-shadow dark:shadow-none relative overflow-hidden group transition-all hover:bg-surface-container-high ${flipping ? 'card-flipping' : ''}`}>
                                                        <div className="flex justify-between items-start mb-4 relative z-10">
                                                            <span className={`px-2 py-1 text-[12px] font-bold font-label rounded-lg tracking-wider uppercase ${catStyle.badge}`}>
                                                                {w.category || w.genres?.[0] || '意象'}
                                                            </span>
                                                            <button onClick={() => store.toggleLock(i)} className={`text-sm transition-colors ${store.lockedIndices.has(i) ? 'text-primary' : 'text-stone-300 dark:text-outline hover:text-stone-500 dark:hover:text-on-surface-variant'}`}>
                                                                {store.lockedIndices.has(i) ? <Lock size={16} /> : <LockOpen size={16} />}
                                                            </button>
                                                        </div>
                                                        <h4 className="font-headline text-2xl font-bold mb-3 text-stone-900 dark:text-on-surface leading-tight relative z-10">{w.text}</h4>
                                                        {w.explanation && (
                                                            <p className="text-sm text-stone-700 dark:text-on-surface-variant leading-relaxed relative z-10">{w.explanation}</p>
                                                        )}
                                                        <div className="absolute inset-0 opacity-[0.03] dark:opacity-0 pointer-events-none paper-texture"></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </section></>
                        )}

                        {/* Scene Prompt Panel */}
                        {store.writingMode === 'scene' && store.currentScene && (
                            <>
{/* 移动端遮罩 */}
                            {mobilePanel && (
                                <div 
                                    className="md:hidden fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm transition-opacity duration-300"
                                    onClick={() => setMobilePanel(false)}
                                />
                            )}
                            <section className={`
                                ${mobilePanel 
                                    ? 'fixed right-0 top-0 bottom-0 w-[85%] max-w-[360px] z-[60] bg-surface-container-low shadow-2xl translate-x-0' 
                                    : 'fixed right-0 top-0 bottom-0 w-[85%] max-w-[360px] z-[60] translate-x-full md:translate-x-0'
                                } 
                                transition-transform duration-300 ease-in-out overflow-y-auto pt-4 px-4 pb-20
                                md:relative md:block md:w-80 md:bg-surface-container-low md:overflow-y-auto md:shrink-0 md:border-r md:border-outline-variant/10 md:z-auto
                            `}>
                                <div className="p-5 md:p-8 flex flex-col space-y-6">
                                    <button onClick={() => setMobilePanel(false)} className="md:hidden mb-2 flex items-center gap-1 text-sm text-on-surface-variant"><X size={18} />收起</button>
                                    <div className="mb-2">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-label text-[12px] uppercase tracking-[0.2em] text-outline">场景描写</span>
                                        </div>
                                        <h3 className="font-headline text-2xl text-on-surface">描写挑战</h3>
                                    </div>

                                    <div className="bg-surface-container p-6 rounded-lg border border-outline-variant/10 relative overflow-hidden transition-all hover:bg-surface-container-high">
                                        <Mountain size={34} className="text-blue-400 dark:text-[#69a8f6] mb-4 block" />
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <h4 className="font-headline text-xl font-bold text-stone-900 dark:text-on-surface">{store.currentScene.title}</h4>
                                            <button onClick={handleToggleSceneFavorite} className="p-1 hover:bg-surface-container rounded group transition-all" title={isSceneFavorited ? '取消收藏' : '收藏题目'}>
                                                <Star size={20} className={`transition-colors ${isSceneFavorited ? 'text-amber-500 fill-current' : 'text-outline group-hover:text-amber-500 dark:group-hover:text-[#ffb148]'}`} />
                                            </button>
                                        </div>
                                        <p className="text-sm text-stone-700 dark:text-on-surface-variant leading-relaxed mb-4">{store.currentScene.description}</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {store.currentScene.tags.map(tag => (
                                                <span key={tag} className="px-2.5 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-700 text-[12px] font-label rounded-full border border-blue-200/50 dark:border-blue-400/20">{tag}</span>
                                            ))}
                                        </div>
                                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none paper-texture"></div>
                                    </div>

                                </div>
                            </section></>
                        )}

                        {/* Challenge Panel */}
                        {store.writingMode === 'challenge' && store.currentChallenge && (
                            <>
{/* 移动端遮罩 */}
                            {mobilePanel && (
                                <div 
                                    className="md:hidden fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm transition-opacity duration-300"
                                    onClick={() => setMobilePanel(false)}
                                />
                            )}
                            <section className={`
                                ${mobilePanel 
                                    ? 'fixed right-0 top-0 bottom-0 w-[85%] max-w-[360px] z-[60] bg-surface-container-low shadow-2xl translate-x-0' 
                                    : 'fixed right-0 top-0 bottom-0 w-[85%] max-w-[360px] z-[60] translate-x-full md:translate-x-0'
                                } 
                                transition-transform duration-300 ease-in-out overflow-y-auto pt-4 px-4 pb-20
                                md:relative md:block md:w-80 md:bg-surface-container-low md:overflow-y-auto md:shrink-0 md:border-r md:border-outline-variant/10 md:z-auto
                            `}>
                                <div className="p-5 md:p-8 flex flex-col space-y-6">
                                    <button onClick={() => setMobilePanel(false)} className="md:hidden mb-2 flex items-center gap-1 text-sm text-on-surface-variant"><X size={18} />收起</button>
                                    <div className="mb-2">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-label text-[12px] uppercase tracking-[0.2em] text-outline">写作挑战</span>
                                            <button className="p-1 hover:bg-surface-container rounded group transition-all" title="换一题" onClick={() => pickAndSetChallenge(store.currentChallenge?.id)}>
                                                <RefreshCw size={20} className="text-outline group-hover:text-primary transition-colors" />
                                            </button>
                                        </div>
                                        <h3 className="font-headline text-2xl text-on-surface">习作题目</h3>
                                    </div>

                                    <div className="bg-surface-container p-6 rounded-lg border border-outline-variant/10 relative overflow-hidden transition-all hover:bg-surface-container-high">
                                        <CircleHelp size={34} className="text-rose-400 dark:text-rose-300 mb-4 block" />
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="text-base text-stone-800 dark:text-on-surface leading-relaxed font-medium">{store.currentChallenge.text}</p>
                                            <button onClick={handleToggleChallengeFavorite} className="p-1 hover:bg-surface-container rounded group transition-all" title={isChallengeFavorited ? '取消收藏' : '收藏题目'}>
                                                <Star size={20} className={`transition-colors ${isChallengeFavorited ? 'text-amber-500 fill-current' : 'text-outline group-hover:text-amber-500 dark:group-hover:text-[#ffb148]'}`} />
                                            </button>
                                        </div>
                                        {store.currentChallenge.id.startsWith('ai_') && (
                                            <span className="mt-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100/80 dark:bg-rose-500/10 border border-rose-200/50 dark:border-rose-400/20 text-[12px] font-label text-rose-600 dark:text-rose-400">
                                                <Sparkles size={13} />AI 出题
                                            </span>
                                        )}
                                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none paper-texture"></div>
                                    </div>

                                    {/* AI 出题 */}
                                    {store.aiEnabled && (
                                        <button
                                            onClick={handleAiChallenge}
                                            disabled={aiChallengeLoading}
                                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50/60 dark:bg-rose-500/5 border border-rose-200/40 dark:border-rose-400/10 rounded-lg text-xs font-label text-rose-700 dark:text-rose-400 hover:bg-rose-100/60 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                                        >
                                            {aiChallengeLoading ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                            <span>{aiChallengeLoading ? '出题中…' : 'AI 出一道题'}</span>
                                        </button>
                                    )}
                                </div>
                            </section></>
                        )}

                        {/* Character Prompt Panel */}
                        {store.writingMode === 'character' && store.currentCharacterPrompt && (() => {
                            const layer = CHARACTER_LAYERS.find(l => l.id === store.currentCharacterPrompt!.layer);
                            return (
                                <>
                                {/* 移动端遮罩 */}
                                {mobilePanel && (
                                    <div 
                                        className="md:hidden fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm transition-opacity duration-300"
                                        onClick={() => setMobilePanel(false)}
                                    />
                                )}
                                <section className={`
                                    ${mobilePanel 
                                        ? 'fixed right-0 top-0 bottom-0 w-[85%] max-w-[360px] z-[60] bg-surface-container-low shadow-2xl translate-x-0' 
                                        : 'fixed right-0 top-0 bottom-0 w-[85%] max-w-[360px] z-[60] translate-x-full md:translate-x-0'
                                    } 
                                    transition-transform duration-300 ease-in-out overflow-y-auto pt-4 px-4 pb-20
                                    md:relative md:block md:w-80 md:bg-surface-container-low md:overflow-y-auto md:shrink-0 md:border-r md:border-outline-variant/10 md:z-auto
                                `}>
                                    <div className="p-5 md:p-8 flex flex-col space-y-6">
                                        <button onClick={() => setMobilePanel(false)} className="md:hidden mb-2 flex items-center gap-1 text-sm text-on-surface-variant"><X size={18} />收起</button>
                                        <div className="mb-2">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-label text-[12px] uppercase tracking-[0.2em] text-outline">角色描写</span>
                                                <button className="p-1 hover:bg-surface-container rounded group transition-all" title="换一题" onClick={() => pickAndSetCharacterPrompt(store.currentCharacterPrompt?.id)}>
                                                    <RefreshCw size={20} className="text-outline group-hover:text-primary transition-colors" />
                                                </button>
                                            </div>
                                            <h3 className="font-headline text-2xl text-on-surface">角色练习</h3>
                                        </div>

                                        {layer && (
                                            <div className={`flex items-start space-x-2 px-3 py-2 rounded-lg border text-xs font-label ${layer.color}`}>
                                                {(() => {
                                                    const LayerIcon = characterLayerIconMap[layer.id] || User;
                                                    return <LayerIcon size={16} className="shrink-0 mt-0.5" />;
                                                })()}
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-medium">{layer.name}</span>
                                                    <span className="opacity-70 leading-relaxed mt-0.5">{layer.description}</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="bg-surface-container p-6 rounded-lg border border-outline-variant/10 relative overflow-hidden transition-all hover:bg-surface-container-high">
                                            <User size={30} className="text-fuchsia-400 dark:text-fuchsia-300 mb-4 block" />
                                            <div className="flex items-start justify-between gap-3">
                                                <p className="text-base text-stone-800 dark:text-on-surface leading-relaxed font-medium">{store.currentCharacterPrompt.text}</p>
                                                <button onClick={handleToggleCharacterFavorite} className="p-1 hover:bg-surface-container rounded group transition-all" title={isCharacterFavorited ? '取消收藏' : '收藏题目'}>
                                                    <Star size={20} className={`transition-colors ${isCharacterFavorited ? 'text-amber-500 fill-current' : 'text-outline group-hover:text-amber-500 dark:group-hover:text-[#ffb148]'}`} />
                                                </button>
                                            </div>
                                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none paper-texture"></div>
                                        </div>

                                        {/* AI 角色深挖 */}
                                        {store.aiEnabled && (
                                            <div className="space-y-2">
                                                <button
                                                    onClick={handleAiCharacterDeep}
                                                    disabled={aiCharacterLoading}
                                                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-fuchsia-50/60 dark:bg-fuchsia-500/5 border border-fuchsia-200/40 dark:border-fuchsia-400/10 rounded-lg text-xs font-label text-fuchsia-700 dark:text-fuchsia-400 hover:bg-fuchsia-100/60 dark:hover:bg-fuchsia-500/10 transition-colors disabled:opacity-50"
                                                >
                                                    {aiCharacterLoading ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                                    <span>{aiCharacterLoading ? '思考中…' : 'AI 深挖角色'}</span>
                                                </button>
                                                <button
                                                    onClick={handleAiCharacterGenerate}
                                                    disabled={aiCharacterGenLoading}
                                                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-fuchsia-50/60 dark:bg-fuchsia-500/5 border border-fuchsia-200/40 dark:border-fuchsia-400/10 rounded-lg text-xs font-label text-fuchsia-700 dark:text-fuchsia-400 hover:bg-fuchsia-100/60 dark:hover:bg-fuchsia-500/10 transition-colors disabled:opacity-50"
                                                >
                                                    {aiCharacterGenLoading ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                                    <span>{aiCharacterGenLoading ? '出题中…' : 'AI 出一道角色题'}</span>
                                                </button>
                                                {aiCharacterExtra && (
                                                    <div className="bg-fuchsia-50/60 dark:bg-fuchsia-500/5 border border-fuchsia-200/40 dark:border-fuchsia-400/10 rounded-lg p-3">
                                                        <p className="text-[12px] font-label uppercase tracking-widest text-fuchsia-600 dark:text-fuchsia-600 mb-1.5 flex items-center gap-1">
                                                            <Sparkles size={14} />AI 追问
                                                        </p>
                                                        <p className="text-sm text-fuchsia-900 dark:text-fuchsia-700 leading-relaxed">{aiCharacterExtra}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </section></>
                            );
                        })()}
                        {store.writingMode === 'words' && wordsSubView === 'library' ? <LibraryPage /> : (
                            <main className="flex-1 bg-surface relative overflow-y-auto">
                                {store.timerActive && (
                                    <div className="absolute top-0 left-0 right-0 h-1 bg-surface-dim">
                                        <div className="h-full bg-primary transition-all duration-1000 ease-linear" style={{ width: `${(store.timerSeconds / (store.timerDuration * 60)) * 100}%` }}></div>
                                    </div>
                                )}

                                <div className="max-w-3xl mx-auto pt-8 md:pt-24 pb-32 px-4 md:px-12 min-h-full flex flex-col">
                                    <div className="mb-6 md:mb-12">
                                        <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                                            <div className="flex items-center space-x-3">
                                                <button onClick={handleBackToModeSelect} className="md:hidden flex items-center text-on-surface-variant hover:text-primary transition-colors">
                                                    <ArrowLeft size={20} />
                                                </button>
                                                <div className="text-outline text-xs font-label">{dateStr}</div>
                                                {store.writingMode && (
                                                    <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[12px] font-label font-medium border ${WRITING_MODES.find(m => m.mode === store.writingMode)?.color || ''}`}>
                                                        {(() => {
                                                            const mode = store.writingMode!;
                                                            const ModeIcon = writingModeIconMap[mode] || Sparkles;
                                                            return <ModeIcon size={14} />;
                                                        })()}
                                                        <span>{WRITING_MODES.find(m => m.mode === store.writingMode)?.label}</span>
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex space-x-2">
                                                {/* Mobile: show prompt panel toggle */}
                                                {store.writingMode !== 'free' && (
                                                    <button onClick={() => setMobilePanel(true)} className="md:hidden flex items-center space-x-1 px-3 py-1.5 bg-surface-container text-on-surface-variant rounded-md text-xs font-label font-medium">
                                                        <PanelLeft size={18} />
                                                        <span>灵感</span>
                                                    </button>
                                                )}
                                                <button onClick={handleSave} className="flex items-center space-x-1 px-3 py-1.5 bg-surface-container dark:bg-surface-container-high text-primary hover:bg-surface-container-high dark:hover:bg-surface-container-highest rounded-md transition-colors text-xs font-label font-medium">
                                                    <Save size={18} />
                                                    <span className="hidden sm:inline">存入灵感宫殿</span>
                                                    <span className="sm:hidden">保存</span>
                                                </button>
                                                <button onClick={handleExport} className="hidden sm:flex items-center space-x-1 px-3 py-1.5 bg-primary text-on-primary hover:bg-primary-dim rounded-md transition-colors text-xs font-label font-medium shadow-sm">
                                                    <Upload size={18} />
                                                    <span>导出 .md</span>
                                                </button>
                                            </div>
                                        </div>
                                        <input
                                            className="w-full bg-transparent border-none focus:ring-0 font-headline text-2xl md:text-4xl font-black text-on-surface placeholder:text-surface-dim outline-none mb-4 md:mb-6"
                                            placeholder={store.writingMode === 'dream' ? '给你的梦起个名字...' : store.writingMode === 'scene' ? '给这段描写起个标题...' : store.writingMode === 'challenge' ? '就这题写点什么...' : store.writingMode === 'character' ? '这个角色叫什么名字...' : '给你的灵感起个名字...'}
                                            type="text"
                                            value={store.editorTitle}
                                            onChange={(e) => store.setEditorTitle(e.target.value)}
                                        />
                                    </div>

                                    <div
                                        className="flex-1 w-full relative -mx-4 overflow-visible markdown-editor-container"
                                        data-color-mode={isDarkTheme ? 'dark' : 'light'}
                                    >
                                        <MDEditor
                                            value={store.editorContent}
                                            onChange={(val) => store.setEditorContent(val || '')}
                                            preview="edit"
                                            height="100%"
                                            visibleDragbar={false}
                                            className="w-full h-full bg-transparent font-headline text-xl leading-loose border-none shadow-none text-on-surface outline-none"
                                            textareaProps={{
                                                placeholder: store.writingMode === 'dream'
                                                    ? "闭上眼回忆一下，你梦见了什么..."
                                                    : store.writingMode === 'scene'
                                                        ? "仔细想象这个场景，描写你看到的、听到的、感受到的..."
                                                        : store.writingMode === 'challenge'
                                                            ? "看看题目，写下你的想法" : store.writingMode === 'character'
                                                                ? "就这个提示，写下关于这个角色的一个片段…" : "在这里开始你的故事（支持 Markdown 格式）..."
                                            }}
                                            style={{ backgroundColor: 'transparent', boxShadow: 'none' }}
                                        />
                                    </div>

                                    {/* AI 写后反馈面板 */}
                                    {aiFeedback && (
                                        <div className="mt-6 bg-emerald-50/70 dark:bg-emerald-500/5 border border-emerald-200/40 dark:border-emerald-400/10 rounded-lg p-5">
                                            <div className="flex items-center justify-between mb-3">
                                                <p className="text-[12px] font-label uppercase tracking-widest text-emerald-600 dark:text-emerald-600 flex items-center gap-1">
                                                    <MessageSquareText size={15} />AI 写作反馈
                                                </p>
                                                <button onClick={() => setAiFeedback('')} className="text-emerald-500/60 hover:text-emerald-500 transition-colors">
                                                    <X size={18} />
                                                </button>
                                            </div>
                                            <p className="text-sm text-emerald-900 dark:text-emerald-700 leading-relaxed whitespace-pre-line">{aiFeedback}</p>
                                        </div>
                                    )}

                                    {/* AI 解梦面板 */}
                                    {aiDreamInterpret && (
                                        <div className="mt-6 bg-violet-50/70 dark:bg-violet-500/5 border border-violet-200/40 dark:border-violet-400/10 rounded-lg p-5">
                                            <div className="flex items-center justify-between mb-3">
                                                <p className="text-[12px] font-label uppercase tracking-widest text-violet-600 dark:text-violet-600 flex items-center gap-1">
                                                    <MoonStar size={15} />AI 解梦
                                                </p>
                                                <button onClick={() => setAiDreamInterpret('')} className="text-violet-500/60 hover:text-violet-500 transition-colors">
                                                    <X size={18} />
                                                </button>
                                            </div>
                                            <p className="text-sm text-violet-900 dark:text-violet-700 leading-relaxed whitespace-pre-line">{aiDreamInterpret}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Zen Toolbar */}
                                <div className="fixed right-3 bottom-16 md:right-12 md:bottom-auto md:top-1/2 md:-translate-y-1/2 flex flex-row md:flex-col space-x-2 md:space-x-0 md:space-y-4 p-2 glass-panel bg-surface-container-low/80 rounded-full custom-shadow z-30">
                                    <button className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-primary transition-all" title="限时挑战" onClick={() => { store.setTimerActive(!store.timerActive); if (store.timerActive) store.setTimerSeconds(0); }}>
                                        <Timer size={20} className={store.timerActive ? 'text-primary' : ''} />
                                    </button>
                                    <button className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-primary transition-all" title="保存 (Ctrl+S)" onClick={handleSave}>
                                        <Save size={20} />
                                    </button>
                                    {store.aiEnabled && store.editorContent.trim().length > 20 && (
                                        <>
                                            <button
                                                onClick={handleAiContinue}
                                                disabled={aiContinueLoading}
                                                title="AI 续写"
                                                className="w-10 h-10 rounded-full flex items-center justify-center text-violet-500 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all disabled:opacity-40"
                                            >
                                                {aiContinueLoading ? <LoaderCircle size={22} className="animate-spin" /> : <Sparkles size={22} />}
                                            </button>
                                            <button
                                                onClick={handleAiFeedback}
                                                disabled={aiFeedbackLoading}
                                                title="AI 写后反馈"
                                                className="w-10 h-10 rounded-full flex items-center justify-center text-emerald-500 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all disabled:opacity-40"
                                            >
                                                {aiFeedbackLoading ? <LoaderCircle size={22} className="animate-spin" /> : <MessageSquareText size={22} />}
                                            </button>
                                            {store.writingMode === 'dream' && (
                                                <button
                                                    onClick={handleAiDreamInterpret}
                                                    disabled={aiDreamInterpretLoading}
                                                    title="AI 解梦"
                                                    className="w-10 h-10 rounded-full flex items-center justify-center text-violet-500 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all disabled:opacity-40"
                                                >
                                                    {aiDreamInterpretLoading ? <LoaderCircle size={22} className="animate-spin" /> : <MoonStar size={22} />}
                                                </button>
                                            )}
                                        </>
                                    )}
                                    <div className="h-px w-6 bg-outline-variant/20 mx-auto"></div>
                                    <button className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-primary transition-all" title="全屏专注" onClick={() => {
                                        if (document.fullscreenElement) { document.exitFullscreen(); } else { document.documentElement.requestFullscreen(); }
                                    }}>
                                        <Maximize size={20} />
                                    </button>
                                </div>
                            </main>
                        )}
                    </>
                )}

                {/* Other tabs */}
                {store.activeTab === 'palace' && <InspirationPalace />}
                {store.activeTab === 'history' && <HistoryPage />}
                {store.activeTab === 'favorites' && <FavoritesPage />}
            </div>

            {/* Footer - hidden on mobile (bottom tab bar used instead) */}
            <footer className="hidden md:flex fixed bottom-0 left-0 right-0 z-50 bg-surface/90 glass-panel border-t border-outline-variant/10 justify-between items-center px-10 py-2 w-full h-[45px]">
                <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2">
                        <Flame size={14} className="text-primary" />
                        <span className="font-label text-[13px] font-medium text-primary">连续打卡: {store.streak} 天</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <PencilLine size={14} className="text-outline" />
                        <span className="font-label text-[13px] font-medium text-on-surface-variant">今日字数: {wordCount}</span>
                    </div>
                </div>
                <div className="flex items-center space-x-6 text-[13px] font-label font-medium text-stone-400 dark:text-outline">
                    <span className="text-stone-500 dark:text-on-surface-variant">© 今天你写了吗</span>
                </div>
            </footer>

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-16 left-1/2 -translate-x-1/2 bg-surface-container-high text-on-surface border border-outline/20 shadow-lg px-6 py-3 rounded-full font-label text-sm z-[100] animate-toast-in">
                    {toast}
                </div>
            )}

            {/* AI Settings Modal */}
            <AiSettingsModal 
                isOpen={showAiSettings} 
                onClose={() => setShowAiSettings(false)} 
            />

            {/* Cloud Login Modal */}
            <CloudLoginModal 
                isOpen={showCloudLogin} 
                onClose={() => setShowCloudLogin(false)} 
                showToast={showToast}
                syncFromCloud={syncFromCloud}
                cloudSyncing={cloudSyncing}
            />
        </div>
    );
}
