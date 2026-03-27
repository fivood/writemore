import { useEffect, useRef, useState } from 'react';

// ── 填入你的 GitHub 用户名/仓库名 ──────────────────────────────
const GITHUB_REPO = 'fivood/writemore';
declare const __APP_VERSION__: string;
const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
import { useStore } from './store';
import { Sparkles, Landmark, Star, BookOpen, Bot, Cloud, RefreshCw, Moon, Sun, Info, X, Dices, MoonStar, User, PencilLine, Mountain, CircleHelp, ArrowLeft, Download, Shuffle, ChevronsLeft, ChevronsRight, Lock, LockOpen, LoaderCircle, Save, Upload, PanelLeft, MessageSquareText, Maximize, Flame, Timer, Rocket, Search, BookText, Heart, Sword, Building2, ScrollText, Ghost } from 'lucide-react';
import { drawRandomWords, loadUserData, pickRandomGenre } from './data/wordEngine';
import { saveDraftToDb, toggleFavoriteWordSet } from './data/draftEngine';
import { pickRandomScene } from './data/scenes';
import { pickRandomChallenge } from './data/challenges';
import { pickRandomCharacterPrompt, CHARACTER_LAYERS } from './data/characterPrompts';
import { db } from './db';
import type { Word, WritingMode } from './types';
import { WORD_CATEGORIES, CATEGORY_META, WRITING_MODES } from './types';
import MDEditor from '@uiw/react-md-editor';
import HistoryPage from './components/HistoryPage';
import FavoritesPage from './components/FavoritesPage';
import LibraryPage from './components/LibraryPage';
import InspirationPalace from './components/InspirationPalace';
import { API_PRESETS, testConnection, chatCompletion, chatCompletionStream } from './services/ai';
import { buildWordInspirationPrompt, buildSceneGeneratePrompt, buildSceneDeepDivePrompt, buildChallengeGeneratePrompt, buildCharacterDeepPrompt, buildContinueWritingPrompt, buildWritingFeedbackPrompt } from './services/prompts';
import { supabase, signIn, signUp, signOut, pushDraft, pullDrafts, pushWordSet, pullWordSets, SUPABASE_ENABLED } from './services/supabase';

export default function App() {
  const store = useStore();
  const [toast, setToast] = useState('');
  const [wordsSubView, setWordsSubView] = useState<'write' | 'library'>('write');
  const [todayOtherDraftsWords, setTodayOtherDraftsWords] = useState(0);
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [aiTestStatus, setAiTestStatus] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle');
  const [aiTestError, setAiTestError] = useState('');
  const [aiAvailModels, setAiAvailModels] = useState<string[]>([]);
  const [aiModelsLoading, setAiModelsLoading] = useState(false);
  const [showCloudLogin, setShowCloudLogin] = useState(false);
  const [cloudEmail, setCloudEmail] = useState('');
  const [cloudPassword, setCloudPassword] = useState('');
  const [cloudAuthMode, setCloudAuthMode] = useState<'login' | 'register'>('login');
  const [cloudAuthLoading, setCloudAuthLoading] = useState(false);
  const [cloudAuthError, setCloudAuthError] = useState('');
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [updateBanner, setUpdateBanner] = useState<{ version: string; url: string } | null>(null);
  const [aiWordHint, setAiWordHint] = useState('');
  const [aiWordHintLoading, setAiWordHintLoading] = useState(false);
  const [aiSceneExtra, setAiSceneExtra] = useState('');
  const [aiSceneLoading, setAiSceneLoading] = useState(false);
  const [aiChallengeLoading, setAiChallengeLoading] = useState(false);
  const [aiCharacterExtra, setAiCharacterExtra] = useState('');
  const [aiCharacterLoading, setAiCharacterLoading] = useState(false);
  const [aiContinueLoading, setAiContinueLoading] = useState(false);
  const [aiFeedback, setAiFeedback] = useState('');
  const [aiFeedbackLoading, setAiFeedbackLoading] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const isSavingRef = useRef(false);

  const [mobilePanel, setMobilePanel] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);

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
      const cloudDrafts = await pullDrafts(userId);
      const localDrafts = await db.drafts.toArray();

      // 云端 → 本地：云端更新的覆盖本地
      for (const cd of cloudDrafts) {
        const local = localDrafts.find(d => d.id === cd.id);
        if (!local || new Date(cd.updatedAt) > new Date(local.updatedAt)) {
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

  async function handleCloudAuth() {
    setCloudAuthLoading(true);
    setCloudAuthError('');
    try {
      const fn = cloudAuthMode === 'login' ? signIn : signUp;
      const { error } = await fn(cloudEmail, cloudPassword);
      if (error) {
        const msg = error.message;
        if (msg.includes('Invalid login credentials')) throw new Error('邮箱或密码错误，或邮箱尚未验证');
        if (msg.includes('Email not confirmed')) throw new Error('邮箱未验证，请先去邮箱点击确认链接');
        if (msg.includes('User already registered')) throw new Error('该邮箱已注册，请直接登录');
        throw error;
      }
      if (cloudAuthMode === 'register') {
        showToast('📧 注册成功！请去邮箱点击确认链接后再登录');
        setCloudAuthMode('login');
      } else {
        setShowCloudLogin(false);
        showToast('☁️ 登录成功，数据将自动同步');
      }
    } catch (e) {
      setCloudAuthError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setCloudAuthLoading(false);
    }
  }

  // 版本更新检测（每天检查一次）
  useEffect(() => {
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
      .catch(() => {/* 离线时静默失败 */});
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

  // ── Mode Selection ──
  function selectMode(mode: WritingMode) {
    if (store.editorContent.trim()) {
      handleSave();
    }
    setWordsSubView('write');
    store.setWritingMode(mode);
    store.setEditorTitle('');
    store.setEditorContent('');
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
    if (store.editorContent.trim()) {
      handleSave();
    }
    setWordsSubView('write');
    store.setWritingMode(null);
    store.setCurrentWords([]);
    store.setCurrentScene(null);
    store.setCurrentChallenge(null);
    store.setCurrentCharacterPrompt(null);
    store.setSelectedCharacterLayer(null);
    store.setEditorTitle('');
    store.setEditorContent('');
    store.setCurrentWordSetId(null);
    store.setCurrentDraftId(null);
  }

  async function pickAndSetChallenge(excludeId?: string) {
    const userChallenges = await db.challenges.toArray();
    store.setCurrentChallenge(pickRandomChallenge(excludeId, userChallenges));
  }

  async function pickAndSetCharacterPrompt(excludeId?: string) {
    const userPrompts = await db.characterPrompts.toArray();
    store.setCurrentCharacterPrompt(
      pickRandomCharacterPrompt(store.selectedCharacterLayer, excludeId, userPrompts)
    );
    setAiCharacterExtra('');
  }

  async function handleDraw() {
    const locked = new Map<number, Word>();
    store.lockedIndices.forEach(i => {
      if (store.currentWords[i]) locked.set(i, store.currentWords[i]);
    });
    const words = drawRandomWords(store.wordCount, store.selectedCategories, locked);
    store.setCurrentWords(words);
    store.setDrawnGenre(pickRandomGenre(store.selectedGenres));
    store.updateStreak();
    setAiWordHint('');
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

  async function handleSave() {
    if (isSavingRef.current) return;
    // 每次都从 store 读最新状态，避免 setTimeout 捕获的 stale closure 导致重复创建草稿
    const s = useStore.getState();
    // 内容为空时不保存（标题可能是自动生成的，不算有效内容）
    if (!s.editorContent.trim()) return;
    isSavingRef.current = true;
    try {
      const { wordSetId, draftId } = await saveDraftToDb(
        s.editorTitle || '未命名灵感',
        s.editorContent,
        s.currentWords,
        s.currentWordSetId,
        s.currentDraftId,
        s.drawnGenre,
        s.writingMode,
        s.currentScene?.id,
        s.currentChallenge?.id,
        s.currentCharacterPrompt?.id,
      );
      store.setCurrentWordSetId(wordSetId);
      store.setCurrentDraftId(draftId);
      showToast(`💾 已保存 (${s.editorContent.replace(/\s/g, '').length}字)`);
      refreshTodayWords();
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
    if (!store.aiEnabled || store.currentWords.length === 0) return;
    setAiWordHintLoading(true);
    setAiWordHint('');
    try {
      const msgs = buildWordInspirationPrompt(store.currentWords, store.drawnGenre);
      const result = await chatCompletion(store.aiConfig, msgs, { maxTokens: 200 });
      setAiWordHint(result);
    } catch (e) {
      showToast('AI 生成失败，请检查设置');
      console.error(e);
    } finally {
      setAiWordHintLoading(false);
    }
  }

  async function handleAiScene() {
    if (!store.aiEnabled) return;
    setAiSceneLoading(true);
    try {
      const existing = store.currentScene ? [store.currentScene.title] : [];
      const msgs = buildSceneGeneratePrompt(existing);
      const result = await chatCompletion(store.aiConfig, msgs, { maxTokens: 300 });
      const parsed = JSON.parse(result);
      if (parsed.title && parsed.description) {
        store.setCurrentScene({
          id: `ai_${Date.now()}`,
          title: parsed.title,
          description: parsed.description,
          tags: parsed.tags || [],
        });
      }
    } catch (e) {
      showToast('AI 场景生成失败');
      console.error(e);
    } finally {
      setAiSceneLoading(false);
    }
  }

  async function handleAiSceneDeepDive() {
    if (!store.aiEnabled || !store.currentScene) return;
    setAiSceneLoading(true);
    setAiSceneExtra('');
    try {
      const msgs = buildSceneDeepDivePrompt(store.currentScene.title, store.currentScene.description);
      const result = await chatCompletion(store.aiConfig, msgs, { maxTokens: 200 });
      setAiSceneExtra(result);
    } catch (e) {
      showToast('AI 生成失败');
      console.error(e);
    } finally {
      setAiSceneLoading(false);
    }
  }

  async function handleAiChallenge() {
    if (!store.aiEnabled) return;
    setAiChallengeLoading(true);
    try {
      const existing = store.currentChallenge ? [store.currentChallenge.text] : [];
      const msgs = buildChallengeGeneratePrompt(existing);
      const result = await chatCompletion(store.aiConfig, msgs, { maxTokens: 300 });
      const lines = result.split('\n').map(l => l.trim()).filter(l => l.length > 0);
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
      showToast('AI 出题失败');
      console.error(e);
    } finally {
      setAiChallengeLoading(false);
    }
  }

  async function handleAiCharacterDeep() {
    if (!store.aiEnabled || !store.currentCharacterPrompt) return;
    setAiCharacterLoading(true);
    setAiCharacterExtra('');
    try {
      const layerName = CHARACTER_LAYERS.find(l => l.id === store.currentCharacterPrompt!.layer)?.name || '';
      const msgs = buildCharacterDeepPrompt(store.currentCharacterPrompt.text, layerName);
      const result = await chatCompletion(store.aiConfig, msgs, { maxTokens: 200 });
      setAiCharacterExtra(result);
    } catch (e) {
      showToast('AI 生成失败');
      console.error(e);
    } finally {
      setAiCharacterLoading(false);
    }
  }

  async function handleAiContinue() {
    if (!store.aiEnabled || !store.editorContent.trim()) return;
    setAiContinueLoading(true);
    const baseContent = store.editorContent;
    const accumulated = { text: '' };
    try {
      const msgs = buildContinueWritingPrompt(store.editorTitle, baseContent, store.writingMode);
      await chatCompletionStream(store.aiConfig, msgs, (chunk) => {
        accumulated.text += chunk;
        store.setEditorContent(baseContent + '\n\n' + accumulated.text);
      }, { maxTokens: 400 });
    } catch (e) {
      showToast('AI 续写失败');
      console.error(e);
    } finally {
      setAiContinueLoading(false);
    }
  }

  async function handleAiFeedback() {
    if (!store.aiEnabled || !store.editorContent.trim()) return;
    setAiFeedbackLoading(true);
    setAiFeedback('');
    try {
      const msgs = buildWritingFeedbackPrompt(store.editorTitle, store.editorContent);
      const result = await chatCompletion(store.aiConfig, msgs, { maxTokens: 300 });
      setAiFeedback(result);
    } catch (e) {
      showToast('AI 反馈失败');
      console.error(e);
    } finally {
      setAiFeedbackLoading(false);
    }
  }

  // Auto-save
  useEffect(() => {
    if (!store.editorContent.trim() && !store.editorTitle.trim()) return;
    const timer = setTimeout(handleSave, 30000);
    return () => clearTimeout(timer);
  }, [store.editorContent, store.editorTitle]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  async function refreshTodayWords() {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const drafts = await db.drafts.toArray();
      const total = drafts
        .filter(d => !d.deletedFromPalace)
        .filter(d => new Date(d.updatedAt).toISOString().slice(0, 10) === todayStr)
        .filter(d => d.id !== store.currentDraftId)
        .reduce((sum, d) => sum + (d.wordCount || 0), 0);
      setTodayOtherDraftsWords(total);
    } catch {}
  }

  useEffect(() => { refreshTodayWords(); }, [store.currentDraftId]);

  const currentEditorWords = store.editorContent.replace(/\s/g, '').length;
  const wordCount = todayOtherDraftsWords + currentEditorWords;
  
  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日 · 星期${['日', '一', '二', '三', '四', '五', '六'][today.getDay()]}`;

  const genreStyleMap: Record<string, { bg: string; icon: string }> = {
    '科幻': { bg: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-500/10 dark:border-blue-400/15 dark:text-blue-300',      icon: 'rocket_launch' },
    '悬疑': { bg: 'bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-500/10 dark:border-purple-400/15 dark:text-purple-300', icon: 'search' },
    '奇幻': { bg: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-500/10 dark:border-green-400/15 dark:text-green-300',    icon: 'auto_stories' },
    '言情': { bg: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-500/10 dark:border-red-400/15 dark:text-red-300',            icon: 'favorite' },
    '武侠': { bg: 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-500/10 dark:border-orange-400/15 dark:text-orange-300',  icon: 'swords' },
    '都市': { bg: 'bg-teal-50 border-teal-200 text-teal-800 dark:bg-teal-500/10 dark:border-teal-400/15 dark:text-teal-300',        icon: 'location_city' },
    '历史': { bg: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-400/15 dark:text-amber-300',    icon: 'history_edu' },
    '恐怖': { bg: 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-500/10 dark:border-rose-400/15 dark:text-rose-300',        icon: 'sentiment_very_dissatisfied' },
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

  const isWriting = store.writingMode !== null && store.activeTab === 'inspire';

  return (
    <div className="bg-background text-on-surface font-body selection:bg-primary-container selection:text-on-primary-container min-h-screen">
      {/* TopNavBar */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-panel bg-surface/70 dark:bg-[#100e0d]/75 border-b border-outline-variant/10 flex justify-between items-center px-4 md:px-8 py-3 md:py-4 max-w-full safe-area-top">
        <div className="text-lg md:text-xl font-bold text-primary italic font-headline tracking-tight">每日写作灵感</div>
        <nav className="hidden md:flex space-x-8 items-center font-headline text-base tracking-tight">
          <button className={`flex items-center space-x-1.5 transition-all duration-300 ease-in-out ${store.activeTab === 'inspire' ? 'text-primary border-b-2 border-primary pb-1 font-bold' : 'text-on-surface-variant hover:text-primary'}`} onClick={() => store.setActiveTab('inspire')}>
            <Sparkles size={20} />
            <span>灵感</span>
          </button>
          <button className={`flex items-center space-x-1.5 transition-all duration-300 ease-in-out ${store.activeTab === 'palace' ? 'text-primary border-b-2 border-primary pb-1 font-bold' : 'text-on-surface-variant hover:text-primary'}`} onClick={() => store.setActiveTab('palace')}>
            <Landmark size={20} />
            <span>灵感宫殿</span>
          </button>
          <button className={`flex items-center space-x-1.5 transition-all duration-300 ease-in-out ${store.activeTab === 'favorites' ? 'text-primary border-b-2 border-primary pb-1 font-bold' : 'text-on-surface-variant hover:text-primary'}`} onClick={() => store.setActiveTab('favorites')}>
            <Star size={20} />
            <span>收藏</span>
          </button>
          <button className={`flex items-center space-x-1.5 transition-all duration-300 ease-in-out ${store.activeTab === 'history' ? 'text-primary border-b-2 border-primary pb-1 font-bold' : 'text-on-surface-variant hover:text-primary'}`} onClick={() => store.setActiveTab('history')}>
            <BookOpen size={20} />
            <span>历史</span>
          </button>
        </nav>
        <div className="flex items-center space-x-1 md:space-x-2">
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
            className={`p-2 rounded-full hover:bg-surface-container transition-colors relative ${
              store.cloudUser ? 'text-primary' : 'text-on-surface-variant'
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
        <div className="fixed left-0 right-0 z-40 flex items-center justify-between px-6 py-2 bg-primary text-on-primary text-xs font-label" style={{ top: 'calc(64px + env(safe-area-inset-top, 0px))' }}>
          <span className="flex items-center gap-1.5">
            <Info size={16} />
            新版本 <strong>{updateBanner.version}</strong> 已发布！
          </span>
          <div className="flex items-center gap-3">
            <a
              href={updateBanner.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:opacity-80"
            >查看更新内容</a>
            <button onClick={() => setUpdateBanner(null)} className="opacity-70 hover:opacity-100 transition-opacity">
              <X size={18} />
            </button>
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
        ].map(t => (
          <button key={t.tab} onClick={() => store.setActiveTab(t.tab)} className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${store.activeTab === t.tab ? 'text-primary' : 'text-on-surface-variant'}`}>
            <t.Icon size={22} />
            <span className="text-[10px] font-label mt-0.5">{t.label}</span>
          </button>
        ))}
      </nav>

      <div className="flex h-screen pb-[56px] md:pb-[45px]" style={{ paddingTop: 'calc(64px + env(safe-area-inset-top, 0px))' }}>

        {/* ━━━ Mode Selection Screen (Bento) ━━━ */}
        {store.activeTab === 'inspire' && !isWriting && (
          <main className="flex-1 bg-background relative overflow-y-auto">
            <div className="max-w-5xl mx-auto pt-8 md:pt-16 pb-32 px-4 md:px-8">
              {/* Hero */}
              <div className="mb-8 md:mb-12">
                <p className="text-outline text-xs font-label uppercase tracking-[0.2em] mb-3">{dateStr}</p>
                <h1 className="font-headline italic text-3xl md:text-5xl lg:text-6xl text-on-surface mb-3 tracking-tight leading-none">今天想写什么？</h1>
                <p className="text-on-surface-variant font-label text-sm max-w-md leading-relaxed">选择一种写作方式，开始今天的创作练习</p>
              </div>

              {/* Bento Grid */}
              <div className="grid grid-cols-2 md:grid-cols-12 gap-3 md:gap-4 auto-rows-[140px] md:auto-rows-[180px]">

                {/* 词汇灵感 — large (8 cols, 2 rows) */}
                <button onClick={() => selectMode('words')}
                  className="col-span-2 md:col-span-8 row-span-2 glass-panel bg-surface-container/60 dark:bg-surface-container/60 rounded-[1.5rem] border border-outline-variant/10 p-5 md:p-8 flex flex-col justify-between group bento-glow-amber transition-all duration-500 overflow-hidden relative text-left active:scale-[0.99]"
                >
                  <div className="absolute -right-16 -top-16 w-56 h-56 bg-amber-400/5 dark:bg-[#ffb148]/5 blur-[80px] rounded-full group-hover:bg-amber-400/10 dark:group-hover:bg-[#ffb148]/10 transition-colors pointer-events-none"></div>
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-[#ffb148]">
                        <Dices size={30} />
                      </span>
                      <h2 className="font-headline text-lg md:text-2xl text-on-surface">词汇灵感</h2>
                    </div>
                    <p className="text-on-surface-variant text-sm leading-relaxed max-w-sm">随机抽取词条，围绕它们展开想象——侘寂、余晖、熵……每一个词都是一扇门</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-label text-[11px] md:text-[12px] uppercase tracking-widest text-on-surface-variant hidden md:inline">含词库管理 · Space 键抽取</span>
                    <span className="px-3 md:px-5 py-1.5 md:py-2 bg-amber-500/15 text-amber-700 dark:text-[#ffb148] rounded-full font-label text-xs font-bold border border-amber-400/20 group-hover:bg-amber-500/25 transition-all">开始写作 →</span>
                  </div>
                </button>

                {/* 梦境记录 — small (4 cols, 1 row) */}
                <button onClick={() => selectMode('dream')}
                  className="col-span-1 md:col-span-4 row-span-1 glass-panel bg-surface-container/60 dark:bg-surface-container/60 rounded-[1.5rem] border border-outline-variant/10 p-4 md:p-6 flex flex-col justify-between group bento-glow-violet transition-all duration-500 overflow-hidden relative text-left active:scale-[0.99]"
                >
                  <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-violet-400/5 dark:bg-[#ba9eff]/5 blur-[60px] rounded-full group-hover:bg-violet-400/10 dark:group-hover:bg-[#ba9eff]/10 transition-colors pointer-events-none"></div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="p-2 rounded-xl bg-violet-500/10 text-violet-600 dark:text-[#ba9eff]">
                      <MoonStar size={22} />
                    </span>
                    <h2 className="font-headline text-lg text-on-surface">梦境记录</h2>
                  </div>
                  <p className="text-on-surface-variant text-xs leading-relaxed">趁记忆还热乎，捕捉潜意识的幻象</p>
                </button>

                {/* 人物描写 — small (4 cols, 1 row) */}
                <button onClick={() => selectMode('character')}
                  className="col-span-1 md:col-span-4 row-span-1 glass-panel bg-surface-container/60 dark:bg-surface-container/60 rounded-[1.5rem] border border-outline-variant/10 p-4 md:p-6 flex flex-col justify-between group bento-glow-fuchsia transition-all duration-500 overflow-hidden relative text-left active:scale-[0.99]"
                >
                  <div className="absolute -left-8 -top-8 w-36 h-36 bg-fuchsia-400/5 dark:bg-fuchsia-300/5 blur-[60px] rounded-full group-hover:bg-fuchsia-400/10 transition-colors pointer-events-none"></div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="p-2 rounded-xl bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300">
                      <User size={22} />
                    </span>
                    <h2 className="font-headline text-lg text-on-surface">人物描写</h2>
                  </div>
                  <p className="text-on-surface-variant text-xs leading-relaxed">六个维度，深挖你笔下的角色</p>
                </button>

                {/* 自由发挥 — medium (5 cols, 1 row) */}
                <button onClick={() => selectMode('free')}
                  className="col-span-1 md:col-span-5 row-span-1 glass-panel bg-surface-container/60 dark:bg-surface-container/60 rounded-[1.5rem] border border-outline-variant/10 p-4 md:p-6 flex flex-col justify-between group bento-glow-green transition-all duration-500 overflow-hidden relative text-left active:scale-[0.99]"
                >
                  <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-emerald-400/5 dark:bg-[#69f6b8]/5 blur-[80px] rounded-full group-hover:bg-emerald-400/10 dark:group-hover:bg-[#69f6b8]/10 transition-colors pointer-events-none"></div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-[#69f6b8]">
                      <PencilLine size={22} />
                    </span>
                    <h2 className="font-headline text-lg text-on-surface">自由发挥</h2>
                  </div>
                  <p className="text-on-surface-variant text-xs leading-relaxed">今天不用提示，让思想在纸面上自由奔跑</p>
                </button>

                {/* 场景描写 — medium (4 cols, 1 row) */}
                <button onClick={() => selectMode('scene')}
                  className="col-span-1 md:col-span-4 row-span-1 glass-panel bg-surface-container/60 dark:bg-surface-container/60 rounded-[1.5rem] border border-outline-variant/10 p-4 md:p-6 flex flex-col justify-between group bento-glow-blue transition-all duration-500 overflow-hidden relative text-left active:scale-[0.99]"
                >
                  <div className="absolute right-0 top-0 w-full h-full pointer-events-none opacity-20 group-hover:opacity-30 transition-opacity">
                    <div className="w-full h-full bg-gradient-to-br from-blue-400/20 to-transparent rounded-[1.5rem]"></div>
                  </div>
                  <div className="flex items-center gap-2 mb-2 relative">
                    <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-300">
                      <Mountain size={22} />
                    </span>
                    <h2 className="font-headline text-lg text-on-surface">场景描写</h2>
                  </div>
                  <p className="text-on-surface-variant text-xs leading-relaxed relative">雨中古城，或寂静深林——练习感官的敏锐度</p>
                </button>

                {/* 写作挑战 — medium (3 cols, 1 row) */}
                <button onClick={() => selectMode('challenge')}
                  className="col-span-2 md:col-span-3 row-span-1 glass-panel bg-surface-container/60 dark:bg-surface-container/60 rounded-[1.5rem] border border-outline-variant/10 p-4 md:p-6 flex flex-col justify-between group bento-glow-rose transition-all duration-500 overflow-hidden relative text-left active:scale-[0.99]"
                >
                  <div className="absolute -right-8 -top-8 w-36 h-36 bg-rose-400/5 dark:bg-rose-300/5 blur-[60px] rounded-full group-hover:bg-rose-400/10 transition-colors pointer-events-none"></div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-300">
                      <CircleHelp size={22} />
                    </span>
                    <h2 className="font-headline text-lg text-on-surface">写作挑战</h2>
                  </div>
                  <p className="text-on-surface-variant text-xs leading-relaxed">你问我不一定答</p>
                </button>

              </div>

              {/* Streak footer */}
              
            </div>
          </main>
        )}

        {/* ━━━ Writing Interface ━━━ */}
        {store.activeTab === 'inspire' && isWriting && (
          <>
            {/* Sidebar */}
            <aside className={`transition-all duration-300 hidden md:flex ${store.sidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-64 glass-panel bg-surface-container-low/80 flex-col p-6 border-r border-outline-variant/10 shrink-0'}`}>
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
                      const meta = CATEGORY_META[cat];
                      const active = store.selectedCategories.includes(cat);
                      return (
                        <button key={cat}
                          onClick={() => store.toggleCategory(cat)}
                          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 ${active ? 'bg-surface-container-high text-primary shadow-sm dark:shadow-[0_0_15px_rgba(186,158,255,0.12)] active:scale-95' : 'text-on-surface-variant hover:bg-surface-container dark:hover:bg-white/5 hover:translate-x-1'}`}>
                          <span className="material-symbols-outlined text-[20px] leading-none">{meta?.icon ?? 'label'}</span>
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
                        className={`w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-xs font-label transition-all ${
                          wordsSubView === 'library'
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
                  <div className="flex-1 flex flex-col">
                    {store.currentScene && (
                      <div className="bg-blue-50/80 dark:bg-blue-500/10 border border-blue-200/60 dark:border-blue-400/15 rounded-xl p-4 mb-4">
                        <p className="text-[12px] font-label uppercase tracking-widest text-blue-500 dark:text-blue-400 mb-2">当前场景</p>
                        <h4 className="font-headline text-base font-bold text-blue-900 dark:text-blue-200 mb-2">{store.currentScene.title}</h4>
                        <p className="text-sm text-blue-800/80 dark:text-blue-300/70 leading-relaxed">{store.currentScene.description}</p>
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {store.currentScene.tags.map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[12px] font-label rounded-full">{tag}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <button onClick={() => store.setCurrentScene(pickRandomScene(store.currentScene?.id))} className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-surface-container-high border border-outline-variant/30 rounded-lg text-sm font-label text-on-surface-variant hover:text-primary hover:border-primary/30 transition-all">
                      <RefreshCw size={18} />
                      <span>换一个场景</span>
                    </button>
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
                    <div className="bg-violet-50/80 dark:bg-violet-500/10 border border-violet-200/60 dark:border-violet-400/15 rounded-xl p-4">
                      <p className="font-headline text-sm font-medium text-violet-900 dark:text-violet-200 mb-2">💡 写作小贴士</p>
                      <ul className="text-xs text-violet-800/70 dark:text-violet-300/70 space-y-1.5 leading-relaxed">
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
                    <div className="bg-emerald-50/80 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-400/15 rounded-xl p-4">
                      <p className="font-headline text-sm font-medium text-emerald-900 dark:text-emerald-200 mb-2">✍ 自由模式</p>
                      <p className="text-xs text-emerald-800/70 dark:text-emerald-300/70 leading-relaxed">没有提示、没有限制。把脑子里的想法直接咀尾到纸上。想写什么就写什么。</p>
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
                    <div className="bg-rose-50/80 dark:bg-rose-500/10 border border-rose-200/60 dark:border-rose-400/15 rounded-xl p-4">
                      <p className="font-headline text-sm font-medium text-rose-900 dark:text-rose-200 mb-2">💭 练习提示</p>
                      <ul className="text-xs text-rose-800/70 dark:text-rose-300/70 space-y-1.5 leading-relaxed">
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
                    <h2 className="font-headline text-lg font-semibold text-on-surface">人物描写</h2>
                    <p className="text-[12px] font-label uppercase tracking-widest text-on-surface-variant mt-1">六个维度深挖角色</p>
                  </div>
                  <div className="flex-1 flex flex-col space-y-2 overflow-y-auto">
                    {/* Layer filter */}
                    <p className="text-[12px] font-label text-on-surface-variant uppercase tracking-widest mb-1">切换维度</p>
                    <button
                      onClick={() => { store.setSelectedCharacterLayer(null); pickAndSetCharacterPrompt(store.currentCharacterPrompt?.id); }}
                      className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left text-xs font-label transition-all ${
                        store.selectedCharacterLayer === null
                          ? 'bg-fuchsia-100 text-fuchsia-800 font-medium dark:bg-[rgb(136_41_211/40%)] dark:text-[#c7b8ed]'
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
                          pickAndSetCharacterPrompt(store.currentCharacterPrompt?.id);
                        }}
                        className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left text-xs font-label transition-all ${
                          store.selectedCharacterLayer === layer.id
                            ? `${layer.color} font-medium dark:bg-[rgb(136_41_211/40%)] dark:text-[#c7b8ed] dark:border-transparent`
                            : 'text-on-surface-variant hover:bg-surface-container dark:hover:bg-white/5'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">{layer.icon}</span>
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
              <section className={`${mobilePanel ? 'fixed inset-0 z-[60] bg-surface-container-low overflow-y-auto pt-4' : 'hidden'} md:relative md:block md:w-80 md:bg-surface-container-low md:overflow-y-auto md:shrink-0 md:border-r md:border-outline-variant/10 md:z-auto`}>
                <div className="p-5 md:p-8 flex flex-col space-y-6">
                <button onClick={() => setMobilePanel(false)} className="md:hidden mb-2 flex items-center gap-1 text-sm text-on-surface-variant"><X size={18} />收起</button>
                <div className="mb-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-label text-[12px] uppercase tracking-[0.2em] text-outline">词汇灵感</span>
                    <div className="flex space-x-1">
                      <button onClick={handleToggleFavorite} className="p-1 hover:bg-surface-container rounded group transition-all" title="收藏">
                        <Star size={20} className={`transition-colors ${store.isCurrentWordSetFavorite ? 'text-amber-500 fill-current' : 'text-outline group-hover:text-amber-500 dark:group-hover:text-[#ffb148]'}`} />
                      </button>
                      <button className="p-1 hover:bg-surface-container rounded group transition-all" title="抄取 (Space)" onClick={handleDraw}>
                        <Dices size={20} className="text-outline group-hover:text-primary transition-colors" />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-headline text-2xl text-on-surface">写作灵感</h3>
                </div>

                {store.drawnGenre && (
                  <div className={`flex items-center space-x-2 px-4 py-3 rounded-xl border ${genreStyleMap[store.drawnGenre]?.bg ?? 'bg-stone-100 border-stone-200'}`}>
                    {(() => {
                      const GenreIcon = genreIconMap[store.drawnGenre] || Sparkles;
                      return <GenreIcon size={20} />;
                    })()}
                    <div className="flex-1">
                      <p className="text-[12px] font-label uppercase tracking-widest text-on-surface-variant">写作风格</p>
                      <p className="font-headline font-bold text-base leading-tight">{store.drawnGenre}</p>
                    </div>
                    <button onClick={() => store.setDrawnGenre(pickRandomGenre(store.selectedGenres))} className="p-1 rounded hover:bg-surface-container transition-colors" title="换一个风格">
                      <RefreshCw size={18} className="text-outline" />
                    </button>
                  </div>
                )}

                {/* AI 写作引导 */}
                {store.aiEnabled && store.currentWords.length > 0 && (
                  <div className="bg-amber-50/60 dark:bg-amber-500/5 border border-amber-200/40 dark:border-amber-400/10 rounded-xl p-3">
                    {aiWordHint ? (
                      <div>
                        <p className="text-[12px] font-label uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1.5 flex items-center gap-1">
                          <Sparkles size={14} />AI 灵感引导
                        </p>
                        <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">{aiWordHint}</p>
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
                      '意象': { badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300', glow: 'word-glow-indigo'  },
                      '实物': { badge: 'bg-amber-100  text-amber-700',                                              glow: 'word-glow-amber'   },
                      '动作': { badge: 'bg-emerald-100 text-emerald-700',                                          glow: 'word-glow-emerald' },
                      '状态': { badge: 'bg-pink-100   text-pink-700   dark:bg-pink-400/15   dark:text-pink-300',   glow: 'word-glow-pink'   },
                      '感官': { badge: 'bg-cyan-100   text-cyan-700   dark:bg-cyan-400/15   dark:text-cyan-300',   glow: 'word-glow-cyan'   },
                      '抽象': { badge: 'bg-violet-100 text-violet-700',                                            glow: 'word-glow-violet'  },
                      '人物': { badge: 'bg-orange-100 text-orange-700',                                            glow: 'word-glow-orange'  },
                      '地名': { badge: 'bg-teal-100   text-teal-700',                                              glow: 'word-glow-teal'   },
                      '典故': { badge: 'bg-stone-100  text-stone-600  dark:bg-surface-variant dark:text-on-surface-variant', glow: 'word-glow-stone' },
                    };
                    const cat = w.category || w.genres?.[0] || '意象';
                    const catStyle = CATEGORY_STYLE[cat] ?? CATEGORY_STYLE['意象'];
                    return (
                      <div key={`${w.id}_${i}`} className={`${catStyle.glow} bg-surface-container p-6 rounded-3xl border border-outline-variant/10 custom-shadow dark:shadow-none relative overflow-hidden group transition-all hover:bg-surface-container-high`}>
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
                    );
                  })}
                </div>
                </div>
              </section>
            )}

            {/* Scene Prompt Panel */}
            {store.writingMode === 'scene' && store.currentScene && (
              <section className={`${mobilePanel ? 'fixed inset-0 z-[60] bg-surface-container-low overflow-y-auto pt-4' : 'hidden'} md:relative md:block md:w-80 md:bg-surface-container-low md:overflow-y-auto md:shrink-0 md:border-r md:border-outline-variant/10 md:z-auto`}>
                <div className="p-5 md:p-8 flex flex-col space-y-6">
                <button onClick={() => setMobilePanel(false)} className="md:hidden mb-2 flex items-center gap-1 text-sm text-on-surface-variant"><X size={18} />收起</button>
                <div className="mb-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-label text-[12px] uppercase tracking-[0.2em] text-outline">场景描写</span>
                    <button className="p-1 hover:bg-surface-container rounded group transition-all" title="换一个场景" onClick={() => store.setCurrentScene(pickRandomScene(store.currentScene?.id))}>
                      <RefreshCw size={20} className="text-outline group-hover:text-primary transition-colors" />
                    </button>
                  </div>
                  <h3 className="font-headline text-2xl text-on-surface">描写挑战</h3>
                </div>

                <div className="bg-surface-container p-6 rounded-3xl border border-outline-variant/10 relative overflow-hidden transition-all hover:bg-surface-container-high">
                  <Mountain size={34} className="text-blue-400 dark:text-[#69a8f6] mb-4 block" />
                  <h4 className="font-headline text-xl font-bold mb-3 text-stone-900 dark:text-on-surface">{store.currentScene.title}</h4>
                  <p className="text-sm text-stone-700 dark:text-on-surface-variant leading-relaxed mb-4">{store.currentScene.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {store.currentScene.tags.map(tag => (
                      <span key={tag} className="px-2.5 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[12px] font-label rounded-full border border-blue-200/50 dark:border-blue-400/20">{tag}</span>
                    ))}
                  </div>
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none paper-texture"></div>
                </div>

                {/* AI 场景增强 */}
                {store.aiEnabled && (
                  <div className="space-y-2">
                    <button
                      onClick={handleAiSceneDeepDive}
                      disabled={aiSceneLoading}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50/60 dark:bg-blue-500/5 border border-blue-200/40 dark:border-blue-400/10 rounded-xl text-xs font-label text-blue-700 dark:text-blue-400 hover:bg-blue-100/60 dark:hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                    >
                      {aiSceneLoading ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      <span>{aiSceneLoading ? '生成中…' : 'AI 补充感官细节'}</span>
                    </button>
                    <button
                      onClick={handleAiScene}
                      disabled={aiSceneLoading}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50/60 dark:bg-blue-500/5 border border-blue-200/40 dark:border-blue-400/10 rounded-xl text-xs font-label text-blue-700 dark:text-blue-400 hover:bg-blue-100/60 dark:hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                    >
                      <Bot size={16} />
                      <span>AI 生成新场景</span>
                    </button>
                    {aiSceneExtra && (
                      <div className="bg-blue-50/60 dark:bg-blue-500/5 border border-blue-200/40 dark:border-blue-400/10 rounded-xl p-3">
                        <p className="text-[12px] font-label uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-1.5 flex items-center gap-1">
                          <Sparkles size={14} />感官引导
                        </p>
                        <p className="text-sm text-blue-900 dark:text-blue-200 leading-relaxed whitespace-pre-line">{aiSceneExtra}</p>
                      </div>
                    )}
                  </div>
                )}
                </div>
              </section>
            )}

            {/* Challenge Panel */}
            {store.writingMode === 'challenge' && store.currentChallenge && (
              <section className={`${mobilePanel ? 'fixed inset-0 z-[60] bg-surface-container-low overflow-y-auto pt-4' : 'hidden'} md:relative md:block md:w-80 md:bg-surface-container-low md:overflow-y-auto md:shrink-0 md:border-r md:border-outline-variant/10 md:z-auto`}>
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

                <div className="bg-surface-container p-6 rounded-3xl border border-outline-variant/10 relative overflow-hidden transition-all hover:bg-surface-container-high">
                  <CircleHelp size={34} className="text-rose-400 dark:text-rose-300 mb-4 block" />
                  <p className="text-base text-stone-800 dark:text-on-surface leading-relaxed font-medium">{store.currentChallenge.text}</p>
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
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50/60 dark:bg-rose-500/5 border border-rose-200/40 dark:border-rose-400/10 rounded-xl text-xs font-label text-rose-700 dark:text-rose-400 hover:bg-rose-100/60 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                  >
                    {aiChallengeLoading ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    <span>{aiChallengeLoading ? '出题中…' : 'AI 出一道题'}</span>
                  </button>
                )}
                </div>
              </section>
            )}

            {/* Character Prompt Panel */}
            {store.writingMode === 'character' && store.currentCharacterPrompt && (() => {
              const layer = CHARACTER_LAYERS.find(l => l.id === store.currentCharacterPrompt!.layer);
              return (
                <section className={`${mobilePanel ? 'fixed inset-0 z-[60] bg-surface-container-low overflow-y-auto pt-4' : 'hidden'} md:relative md:block md:w-80 md:bg-surface-container-low md:overflow-y-auto md:shrink-0 md:border-r md:border-outline-variant/10 md:z-auto`}>
                  <div className="p-5 md:p-8 flex flex-col space-y-6">
                  <button onClick={() => setMobilePanel(false)} className="md:hidden mb-2 flex items-center gap-1 text-sm text-on-surface-variant"><X size={18} />收起</button>
                  <div className="mb-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-label text-[12px] uppercase tracking-[0.2em] text-outline">人物描写</span>
                    <button className="p-1 hover:bg-surface-container rounded group transition-all" title="换一题" onClick={() => pickAndSetCharacterPrompt(store.currentCharacterPrompt?.id)}>
                      <RefreshCw size={20} className="text-outline group-hover:text-primary transition-colors" />
                      </button>
                    </div>
                    <h3 className="font-headline text-2xl text-on-surface">角色练习</h3>
                  </div>

                  {layer && (
                    <div className={`flex items-start space-x-2 px-3 py-2 rounded-lg border text-xs font-label ${layer.color}`}>
                      <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">{layer.icon}</span>
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium">{layer.name}</span>
                        <span className="opacity-70 leading-relaxed mt-0.5">{layer.description}</span>
                      </div>
                    </div>
                  )}

                  <div className="bg-surface-container p-6 rounded-3xl border border-outline-variant/10 relative overflow-hidden transition-all hover:bg-surface-container-high">
                    <User size={30} className="text-fuchsia-400 dark:text-fuchsia-300 mb-4 block" />
                    <p className="text-base text-stone-800 dark:text-on-surface leading-relaxed font-medium">{store.currentCharacterPrompt.text}</p>
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none paper-texture"></div>
                  </div>

                  {/* AI 角色深挖 */}
                  {store.aiEnabled && (
                    <div className="space-y-2">
                      <button
                        onClick={handleAiCharacterDeep}
                        disabled={aiCharacterLoading}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-fuchsia-50/60 dark:bg-fuchsia-500/5 border border-fuchsia-200/40 dark:border-fuchsia-400/10 rounded-xl text-xs font-label text-fuchsia-700 dark:text-fuchsia-400 hover:bg-fuchsia-100/60 dark:hover:bg-fuchsia-500/10 transition-colors disabled:opacity-50"
                      >
                        {aiCharacterLoading ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        <span>{aiCharacterLoading ? '思考中…' : 'AI 深挖角色'}</span>
                      </button>
                      {aiCharacterExtra && (
                        <div className="bg-fuchsia-50/60 dark:bg-fuchsia-500/5 border border-fuchsia-200/40 dark:border-fuchsia-400/10 rounded-xl p-3">
                          <p className="text-[12px] font-label uppercase tracking-widest text-fuchsia-600 dark:text-fuchsia-400 mb-1.5 flex items-center gap-1">
                            <Sparkles size={14} />AI 追问
                          </p>
                          <p className="text-sm text-fuchsia-900 dark:text-fuchsia-200 leading-relaxed">{aiCharacterExtra}</p>
                        </div>
                      )}
                    </div>
                  )}
                  </div>
                </section>
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
                        ? "看看题目，写下你的想法"                        : store.writingMode === 'character'
                        ? "就这个提示，写下关于这个角色的一个片段…"                        : "在这里开始你的故事（支持 Markdown 格式）..."
                    }}
                    style={{ backgroundColor: 'transparent', boxShadow: 'none' }}
                  />
                </div>

                {/* AI 写后反馈面板 */}
                {aiFeedback && (
                  <div className="mt-6 bg-emerald-50/70 dark:bg-emerald-500/5 border border-emerald-200/40 dark:border-emerald-400/10 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[12px] font-label uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <MessageSquareText size={15} />AI 写作反馈
                      </p>
                      <button onClick={() => setAiFeedback('')} className="text-emerald-500/60 hover:text-emerald-500 transition-colors">
                        <X size={18} />
                      </button>
                    </div>
                    <p className="text-sm text-emerald-900 dark:text-emerald-200 leading-relaxed whitespace-pre-line">{aiFeedback}</p>
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
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 bg-surface-container-high text-on-surface border border-outline/20 shadow-lg px-6 py-3 rounded-full font-label text-sm z-[100] animate-bounce">
          {toast}
        </div>
      )}

      {/* AI Settings Modal */}
      {showAiSettings && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => setShowAiSettings(false)}>
          <div className="bg-surface border border-outline-variant/20 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-2">
                <span className="material-symbols-outlined text-primary text-[26px]">smart_toy</span>
                <h2 className="font-headline text-xl font-bold text-on-surface">AI 设置</h2>
              </div>
              <button onClick={() => setShowAiSettings(false)} className="p-1 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-5">
              {/* Enable toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-label text-sm font-medium text-on-surface">启用 AI 功能</p>
                  <p className="text-xs text-on-surface-variant">开启后可使用 AI 生成灵感、续写等辅助功能</p>
                </div>
                <button
                  onClick={() => store.setAiEnabled(!store.aiEnabled)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${store.aiEnabled ? 'bg-primary' : 'bg-outline-variant/40'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${store.aiEnabled ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              {/* Preset */}
              <div>
                <label className="font-label text-xs font-medium text-on-surface-variant uppercase tracking-widest mb-2 block">快速选择</label>
                <div className="flex gap-2 flex-wrap">
                  {API_PRESETS.map(p => (
                    <button
                      key={p.label}
                      onClick={() => {
                        store.setAiConfig({ apiBase: p.base, model: p.models[0] });
                        setAiTestStatus('idle');
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-label border transition-colors ${
                        store.aiConfig.apiBase === p.base
                          ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                          : 'bg-surface-container border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* API Base */}
              <div>
                <label className="font-label text-xs font-medium text-on-surface-variant uppercase tracking-widest mb-2 block">API 地址</label>
                <input
                  type="url"
                  value={store.aiConfig.apiBase}
                  onChange={e => { store.setAiConfig({ apiBase: e.target.value }); setAiTestStatus('idle'); }}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-lg text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none transition-colors"
                />
              </div>

              {/* API Key */}
              <div>
                <label className="font-label text-xs font-medium text-on-surface-variant uppercase tracking-widest mb-2 block">API Key</label>
                <input
                  type="password"
                  value={store.aiConfig.apiKey}
                  onChange={e => { store.setAiConfig({ apiKey: e.target.value }); setAiTestStatus('idle'); }}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-lg text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none transition-colors"
                />
                <p className="text-[13px] text-on-surface-variant mt-1">密钥仅存储在浏览器本地，不会上传到任何服务器</p>
              </div>

              {/* Model */}
              <div>
                <label className="font-label text-xs font-medium text-on-surface-variant uppercase tracking-widest mb-2 block">模型</label>
                <div className="flex flex-col sm:flex-row gap-2 mb-2">
                  <input
                    type="text"
                    value={store.aiConfig.model}
                    onChange={e => { store.setAiConfig({ model: e.target.value }); setAiTestStatus('idle'); }}
                    placeholder="gemini-1.5-flash"
                    className="flex-1 px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-lg text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none transition-colors"
                  />
                  {store.aiConfig.apiKey && (
                    <button
                      onClick={async () => {
                        setAiModelsLoading(true);
                        setAiAvailModels([]);
                        try {
                          const base = store.aiConfig.apiBase.replace(/\/+$/, '');
                          const res = await fetch(`${base}/models`, {
                            headers: { Authorization: `Bearer ${store.aiConfig.apiKey}` },
                          });
                          const data = await res.json();
                          const ids: string[] = (data.data ?? data.models ?? []).map((m: Record<string,string>) => m.id ?? m.name?.replace('models/', '') ?? '').filter(Boolean);
                          setAiAvailModels(ids);
                        } catch { setAiAvailModels([]); }
                        finally { setAiModelsLoading(false); }
                      }}
                      disabled={aiModelsLoading}
                      title="获取该 Key 可用的模型列表"
                      className="px-3 py-2 border border-outline-variant/30 rounded-lg text-xs font-label text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {aiModelsLoading ? '获取中…' : '可用模型'}
                    </button>
                  )}
                </div>
                {aiAvailModels.length > 0 && (
                  <div className="max-h-32 overflow-y-auto flex flex-wrap gap-1 mb-1">
                    {aiAvailModels.map(m => (
                      <button
                        key={m}
                        onClick={() => { store.setAiConfig({ model: m }); setAiTestStatus('idle'); }}
                        className={`px-2 py-0.5 rounded text-[13px] font-label border transition-colors ${
                          store.aiConfig.model === m
                            ? 'bg-primary/10 border-primary/30 text-primary'
                            : 'border-outline-variant/20 text-on-surface-variant hover:bg-surface-container'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
                  {/* Quick model buttons for current preset */}
                  {aiAvailModels.length === 0 && (() => {
                    const preset = API_PRESETS.find(p => store.aiConfig.apiBase.includes(new URL(p.base).host));
                    if (!preset || preset.models.length <= 1) return null;
                    return (
                      <div className="flex gap-1 flex-wrap">
                        {preset.models.map(m => (
                          <button
                            key={m}
                            onClick={() => { store.setAiConfig({ model: m }); setAiTestStatus('idle'); }}
                            className={`px-2 py-1 rounded text-[13px] font-label border transition-colors ${
                              store.aiConfig.model === m
                                ? 'bg-primary/10 border-primary/30 text-primary'
                                : 'border-outline-variant/20 text-on-surface-variant hover:bg-surface-container'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
              </div>

              {/* Test connection */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={async () => {
                    setAiTestStatus('testing');
                    setAiTestError('');
                    const err = await testConnection(store.aiConfig);
                    if (err === null) {
                      setAiTestStatus('success');
                    } else {
                      setAiTestStatus('fail');
                      setAiTestError(err);
                    }
                  }}
                  disabled={aiTestStatus === 'testing'}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-label font-medium hover:bg-primary-dim transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">{aiTestStatus === 'testing' ? 'hourglass_top' : 'wifi_tethering'}</span>
                  <span>{aiTestStatus === 'testing' ? '测试中…' : '测试连接'}</span>
                </button>
                {aiTestStatus === 'success' && (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-sm font-label">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>连接成功
                  </span>
                )}
                {aiTestStatus === 'fail' && (
                  <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400 text-sm font-label">
                      <span className="material-symbols-outlined text-[18px]">error</span>连接失败
                    </span>
                    {aiTestError && (
                      <span className="text-[13px] text-red-500/80 dark:text-red-400/70 font-mono break-all max-w-xs">{aiTestError}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cloud Login Modal */}
      {showCloudLogin && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={() => setShowCloudLogin(false)}>
          <div className="bg-surface border border-outline-variant/20 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center space-x-2">
                <span className="material-symbols-outlined text-primary text-[26px]">cloud</span>
                <h2 className="font-headline text-xl font-bold text-on-surface">云端同步</h2>
              </div>
              <button onClick={() => setShowCloudLogin(false)} className="p-1 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {store.cloudUser ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-emerald-50/60 dark:bg-emerald-500/5 border border-emerald-200/40 dark:border-emerald-400/10 rounded-xl">
                  <span className="material-symbols-outlined text-emerald-500 text-[22px]">check_circle</span>
                  <div>
                    <p className="text-sm font-label font-medium text-on-surface">已登录</p>
                    <p className="text-xs text-on-surface-variant">{store.cloudUser.email}</p>
                  </div>
                </div>
                <button
                  onClick={async () => { await syncFromCloud(store.cloudUser!.id); showToast('✅ 同步完成'); }}
                  disabled={cloudSyncing}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary/10 text-primary border border-primary/20 rounded-xl text-sm font-label font-medium hover:bg-primary/15 transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[20px]">{cloudSyncing ? 'hourglass_top' : 'sync'}</span>
                  {cloudSyncing ? '同步中…' : '立即从云端同步'}
                </button>
                <button
                  onClick={async () => { await signOut(); showToast('已退出登录'); setShowCloudLogin(false); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-outline-variant/30 rounded-xl text-sm font-label text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">logout</span>退出登录
                </button>
              </div>
            ) : !SUPABASE_ENABLED ? (
              <div className="space-y-6 text-center">
                <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">cloud_off</span>
                <div>
                  <p className="font-label font-medium text-on-surface mb-1">云同步未启用</p>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    当前版本未配置 Supabase 凭据。<br />如需云同步功能，请联系开发者配置，<br />或在项目 <code className="bg-surface-container px-1 rounded text-xs">.env.local</code> 中填入凭据后重新构建。
                  </p>
                </div>
                <button
                  onClick={() => setShowCloudLogin(false)}
                  className="w-full py-2.5 border border-outline-variant/30 rounded-xl text-sm font-label text-on-surface-variant hover:bg-surface-container transition-colors"
                >关闭</button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 模式切换 */}
                <div className="flex rounded-xl overflow-hidden border border-outline-variant/30">
                  <button
                    onClick={() => { setCloudAuthMode('login'); setCloudAuthError(''); }}
                    className={`flex-1 py-2 text-sm font-label font-medium transition-colors ${cloudAuthMode === 'login' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
                  >登录</button>
                  <button
                    onClick={() => { setCloudAuthMode('register'); setCloudAuthError(''); }}
                    className={`flex-1 py-2 text-sm font-label font-medium transition-colors ${cloudAuthMode === 'register' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}
                  >注册账号</button>
                </div>

                {/* 注册说明 */}
                {cloudAuthMode === 'register' && (
                  <div className="flex gap-2.5 p-3 bg-primary/5 border border-primary/15 rounded-xl">
                    <span className="material-symbols-outlined text-primary text-[18px] mt-0.5 shrink-0">info</span>
                    <p className="text-xs text-on-surface-variant font-label leading-relaxed">
                      直接填写<strong className="text-on-surface">任意邮箱 + 自定义密码</strong>即可注册，无需邮箱验证。注册后即登录，文章数据加密存储于云端，跨设备同步。
                    </p>
                  </div>
                )}

                <input
                  type="email"
                  placeholder="邮箱地址"
                  value={cloudEmail}
                  onChange={e => setCloudEmail(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none transition-colors"
                />
                <input
                  type="password"
                  placeholder="密码（至少6位）"
                  value={cloudPassword}
                  onChange={e => setCloudPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCloudAuth()}
                  className="w-full px-3 py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none transition-colors"
                />
                {cloudAuthError && (
                  <p className="text-xs text-red-500 font-label">{cloudAuthError}</p>
                )}
                <button
                  onClick={handleCloudAuth}
                  disabled={cloudAuthLoading || !cloudEmail || !cloudPassword}
                  className="w-full py-2.5 bg-primary text-on-primary rounded-xl text-sm font-label font-medium hover:bg-primary-dim transition-colors disabled:opacity-50"
                >
                  {cloudAuthLoading ? '处理中…' : cloudAuthMode === 'login' ? '登录' : '注册并登录'}
                </button>

                {/* 底部提示 */}
                <div className="flex items-center justify-center gap-1.5 text-xs text-on-surface-variant font-label">
                  <span className="material-symbols-outlined text-[14px]">lock</span>
                  <span>数据仅你本人可见，任何人无法访问</span>
                </div>

                {cloudAuthMode === 'login' && (
                  <p className="text-xs text-on-surface-variant text-center font-label">
                    没有账号？点击上方<button className="text-primary underline-offset-2 hover:underline ml-0.5" onClick={() => { setCloudAuthMode('register'); setCloudAuthError(''); }}>注册账号</button>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
