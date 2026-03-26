import { useEffect, useRef, useState } from 'react';
import { useStore } from './store';
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

export default function App() {
  const store = useStore();
  const [toast, setToast] = useState('');
  const [wordsSubView, setWordsSubView] = useState<'write' | 'library'>('write');
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Init
  useEffect(() => {
    loadUserData();
    store.updateStreak();
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
    if (store.editorContent.trim() || store.editorTitle.trim()) {
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
    if (store.editorContent.trim() || store.editorTitle.trim()) {
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
    if (!store.editorContent.trim() && !store.editorTitle.trim()) return;
    
    try {
      const { wordSetId, draftId } = await saveDraftToDb(
        store.editorTitle || '未命名灵感',
        store.editorContent,
        store.currentWords,
        store.currentWordSetId,
        store.currentDraftId,
        store.drawnGenre,
        store.writingMode,
        store.currentScene?.id,
        store.currentChallenge?.id,
        store.currentCharacterPrompt?.id,
      );
      store.setCurrentWordSetId(wordSetId);
      store.setCurrentDraftId(draftId);
      showToast(`💾 已保存 (${store.editorContent.replace(/\s/g, '').length}字)`);
    } catch (e) {
      console.error('Failed to save draft', e);
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

  const wordCount = store.editorContent.replace(/\s/g, '').length;
  
  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日 · 星期${['日', '一', '二', '三', '四', '五', '六'][today.getDay()]}`;

  const genreStyleMap: Record<string, { bg: string; icon: string }> = {
    '科幻': { bg: 'bg-blue-50 border-blue-200 text-blue-800',   icon: 'rocket_launch' },
    '悬疑': { bg: 'bg-purple-50 border-purple-200 text-purple-800', icon: 'search' },
    '奇幻': { bg: 'bg-green-50 border-green-200 text-green-800', icon: 'auto_stories' },
    '言情': { bg: 'bg-red-50 border-red-200 text-red-800',       icon: 'favorite' },
    '武侠': { bg: 'bg-orange-50 border-orange-200 text-orange-800', icon: 'swords' },
    '都市': { bg: 'bg-teal-50 border-teal-200 text-teal-800',   icon: 'location_city' },
    '历史': { bg: 'bg-amber-50 border-amber-200 text-amber-800', icon: 'history_edu' },
    '恐怖': { bg: 'bg-rose-50 border-rose-200 text-rose-800',   icon: 'sentiment_very_dissatisfied' },
  };

  const isWriting = store.writingMode !== null && store.activeTab === 'inspire';

  return (
    <div className="bg-surface text-on-surface font-body selection:bg-primary-container selection:text-on-primary-container min-h-screen">
      {/* TopNavBar */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-panel bg-[#fbf9f5]/70 flex justify-between items-center px-8 py-4 max-w-full">
        <div className="text-xl font-bold text-[#8a5038] italic font-headline">每日写作灵感</div>
        <nav className="flex space-x-8 items-center font-headline text-base tracking-tight">
          <button className={`transition-all duration-300 ease-in-out ${store.activeTab === 'inspire' ? 'text-[#8a5038] border-b-2 border-[#8a5038] pb-1' : 'text-stone-500 hover:text-[#8a5038]'}`} onClick={() => store.setActiveTab('inspire')}>✦ 灵感</button>
          <button className={`transition-all duration-300 ease-in-out ${store.activeTab === 'palace' ? 'text-[#8a5038] border-b-2 border-[#8a5038] pb-1' : 'text-stone-500 hover:text-[#8a5038]'}`} onClick={() => store.setActiveTab('palace')}>🏛 灵感宫殿</button>
          <button className={`transition-all duration-300 ease-in-out ${store.activeTab === 'favorites' ? 'text-[#8a5038] border-b-2 border-[#8a5038] pb-1' : 'text-stone-500 hover:text-[#8a5038]'}`} onClick={() => store.setActiveTab('favorites')}>⭐ 收藏</button>
          <button className={`transition-all duration-300 ease-in-out ${store.activeTab === 'history' ? 'text-[#8a5038] border-b-2 border-[#8a5038] pb-1' : 'text-stone-500 hover:text-[#8a5038]'}`} onClick={() => store.setActiveTab('history')}>📋 历史</button>
        </nav>
        <div className="flex items-center space-x-4"></div>
      </header>

      <div className="flex h-screen pt-[72px] pb-[45px]">

        {/* ━━━ Mode Selection Screen ━━━ */}
        {store.activeTab === 'inspire' && !isWriting && (
          <main className="flex-1 bg-surface relative overflow-y-auto">
            <div className="max-w-4xl mx-auto pt-20 pb-32 px-8">
              <div className="text-center mb-16">
                <p className="text-outline text-sm font-label mb-3">{dateStr}</p>
                <h1 className="font-headline text-4xl font-black text-on-surface mb-3">今天想写什么？</h1>
                <p className="text-stone-500 font-headline text-lg">选择一种灵感方式，开始今天的写作</p>
              </div>

              <div className="grid grid-cols-2 gap-6 max-w-3xl mx-auto">
                {WRITING_MODES.map(m => (
                  <button
                    key={m.mode}
                    onClick={() => selectMode(m.mode)}
                    className={`group relative p-8 rounded-2xl border-2 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] ${m.color}`}
                  >
                    <span className="material-symbols-outlined text-[40px] mb-4 block opacity-80 group-hover:opacity-100 transition-opacity">{m.icon}</span>
                    <h3 className="font-headline text-xl font-bold mb-2">{m.label}</h3>
                    <p className="text-sm opacity-75 leading-relaxed">{m.desc}</p>
                    <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-60 transition-opacity">
                      <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-center mt-16 space-x-6 text-sm font-label text-stone-400">
                <div className="flex items-center space-x-2">
                  <span className="material-symbols-outlined text-primary text-base" style={{fontVariationSettings: "'FILL' 1"}}>local_fire_department</span>
                  <span className="text-primary font-medium">连续打卡 {store.streak} 天</span>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* ━━━ Writing Interface ━━━ */}
        {store.activeTab === 'inspire' && isWriting && (
          <>
            {/* Sidebar */}
            <aside className={`transition-all duration-300 ${store.sidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-64 glass-panel bg-[#f5f4ef]/70 flex flex-col p-6 border-r border-[#b2b2ad]/15 shrink-0'}`}>
              <button onClick={handleBackToModeSelect} className="flex items-center space-x-2 text-stone-500 hover:text-primary transition-colors mb-6 group">
                <span className="material-symbols-outlined text-sm group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
                <span className="font-label text-xs">返回选择</span>
              </button>

              {/* Words mode sidebar */}
              {store.writingMode === 'words' && (
                <>
                  <div className="mb-6">
                    <h2 className="font-headline text-lg font-semibold text-stone-800">词汇分类</h2>
                    <p className="text-[10px] font-label uppercase tracking-widest text-stone-500 mt-1">筛选词条类型</p>
                  </div>
                  <nav className="space-y-1 flex-1 overflow-y-auto pr-2">
                    {WORD_CATEGORIES.map(cat => {
                      const meta = CATEGORY_META[cat];
                      const active = store.selectedCategories.includes(cat);
                      return (
                        <button key={cat}
                          onClick={() => store.toggleCategory(cat)}
                          className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 ${active ? 'bg-white text-[#8a5038] shadow-sm active:scale-95' : 'text-stone-600 hover:bg-stone-200/50 hover:translate-x-1'}`}>
                          <span className="text-base leading-none">{meta?.icon ?? '◆'}</span>
                          <span className="font-label text-xs uppercase tracking-widest flex-1 text-left">{cat}</span>
                          {active && <span className="w-1.5 h-1.5 rounded-full bg-[#8a5038]"></span>}
                        </button>
                      );
                    })}
                    <div className="pt-6 pb-2">
                      <h3 className="font-headline text-[13px] font-semibold text-stone-700 mb-3">词条数量</h3>
                      <div className="flex space-x-2">
                        {[3, 4, 5].map(n => (
                          <button key={n} onClick={() => store.setWordCount(n as any)}
                            className={`flex-1 py-1.5 rounded text-xs font-label transition-colors ${store.wordCount === n ? 'bg-primary text-white' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'}`}>
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
                            ? 'bg-amber-100 text-amber-800 font-medium'
                            : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50 hover:text-amber-700'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">menu_book</span>
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
                    <h2 className="font-headline text-lg font-semibold text-stone-800">场景描写</h2>
                    <p className="text-[10px] font-label uppercase tracking-widest text-stone-500 mt-1">用文字描绘画面</p>
                  </div>
                  <div className="flex-1 flex flex-col">
                    {store.currentScene && (
                      <div className="bg-blue-50/80 border border-blue-200/60 rounded-xl p-4 mb-4">
                        <p className="text-[10px] font-label uppercase tracking-widest text-blue-500 mb-2">当前场景</p>
                        <h4 className="font-headline text-base font-bold text-blue-900 mb-2">{store.currentScene.title}</h4>
                        <p className="text-sm text-blue-800/80 leading-relaxed">{store.currentScene.description}</p>
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {store.currentScene.tags.map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-label rounded-full">{tag}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <button onClick={() => store.setCurrentScene(pickRandomScene(store.currentScene?.id))} className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm font-label text-stone-600 hover:text-primary hover:border-primary/30 transition-all">
                      <span className="material-symbols-outlined text-[16px]">refresh</span>
                      <span>换一个场景</span>
                    </button>
                  </div>
                </>
              )}

              {/* Dream mode sidebar */}
              {store.writingMode === 'dream' && (
                <>
                  <div className="mb-6">
                    <h2 className="font-headline text-lg font-semibold text-stone-800">梦境记录</h2>
                    <p className="text-[10px] font-label uppercase tracking-widest text-stone-500 mt-1">记录你的梦</p>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="bg-violet-50/80 border border-violet-200/60 rounded-xl p-4">
                      <p className="font-headline text-sm font-medium text-violet-900 mb-2">💡 写作小贴士</p>
                      <ul className="text-xs text-violet-800/70 space-y-1.5 leading-relaxed">
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
                    <h2 className="font-headline text-lg font-semibold text-stone-800">自由发挥</h2>
                    <p className="text-[10px] font-label uppercase tracking-widest text-stone-500 mt-1">想到什么写什么</p>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="bg-emerald-50/80 border border-emerald-200/60 rounded-xl p-4">
                      <p className="font-headline text-sm font-medium text-emerald-900 mb-2">✍ 自由模式</p>
                      <p className="text-xs text-emerald-800/70 leading-relaxed">没有提示、没有限制。把脑子里的想法直接倾倒到纸上。想写什么就写什么。</p>
                    </div>
                  </div>
                </>
              )}
              {/* Challenge mode sidebar */}
              {store.writingMode === 'challenge' && (
                <>
                  <div className="mb-6">
                    <h2 className="font-headline text-lg font-semibold text-stone-800">写作挑战</h2>
                    <p className="text-[10px] font-label uppercase tracking-widest text-stone-500 mt-1">你问我不一定答</p>
                  </div>
                  <div className="flex-1 flex flex-col space-y-4">
                    <div className="bg-rose-50/80 border border-rose-200/60 rounded-xl p-4">
                      <p className="font-headline text-sm font-medium text-rose-900 mb-2">💭 练习提示</p>
                      <ul className="text-xs text-rose-800/70 space-y-1.5 leading-relaxed">
                        <li>• 不必写出「标准答案」</li>
                        <li>• 尽可能尝试多种表达方式</li>
                        <li>• 允许自己「错」和「奇思怲想」</li>
                        <li>• 换一题继续就好</li>
                      </ul>
                    </div>
                    <label className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm font-label text-stone-600 hover:text-rose-600 hover:border-rose-300 transition-all cursor-pointer">
                      <span className="material-symbols-outlined text-[16px]">上传_file</span>
                      <span>导入提珰 (.md)</span>
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
                    <div className="bg-stone-50 border border-stone-100 rounded-lg px-3 py-2.5 text-[10px] font-label text-stone-400 leading-relaxed">
                      <p className="text-stone-500 font-medium mb-1">文件格式示例</p>
                      <p className="text-[9px] text-stone-400 mb-1.5">每行一条提示，空行忽略，支持 - / * / • 开头</p>
                      <pre className="font-mono text-[9px] text-stone-500 whitespace-pre-wrap leading-relaxed">{`- 只用动作展示愤怒，不提情绪\n用感官细节描写一场分离\n• 在对话中藏一个人说谎的信号`}</pre>
                    </div>
                  </div>
                </>
              )}

              {/* Character mode sidebar */}
              {store.writingMode === 'character' && (
                <>
                  <div className="mb-5">
                    <h2 className="font-headline text-lg font-semibold text-stone-800">人物描写</h2>
                    <p className="text-[10px] font-label uppercase tracking-widest text-stone-500 mt-1">六个维度深挖角色</p>
                  </div>
                  <div className="flex-1 flex flex-col space-y-2 overflow-y-auto">
                    {/* Layer filter */}
                    <p className="text-[10px] font-label text-stone-400 uppercase tracking-widest mb-1">切换维度</p>
                    <button
                      onClick={() => { store.setSelectedCharacterLayer(null); pickAndSetCharacterPrompt(store.currentCharacterPrompt?.id); }}
                      className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left text-xs font-label transition-all ${
                        store.selectedCharacterLayer === null
                          ? 'bg-fuchsia-100 text-fuchsia-800 font-medium'
                          : 'text-stone-600 hover:bg-stone-100'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">shuffle</span>
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
                            ? `${layer.color} font-medium`
                            : 'text-stone-600 hover:bg-stone-100'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">{layer.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div>{layer.name}</div>
                        </div>
                      </button>
                    ))}

                    <div className="pt-3 space-y-2">
                      <label className="flex items-center justify-center space-x-2 px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-label text-stone-600 hover:text-fuchsia-600 hover:border-fuchsia-300 transition-all cursor-pointer">
                        <span className="material-symbols-outlined text-[14px]">upload_file</span>
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
                      <div className="bg-stone-50 border border-stone-100 rounded-lg px-3 py-2.5 text-[10px] font-label text-stone-400 leading-relaxed">
                        <p className="text-stone-500 font-medium mb-1">文件格式示例</p>
                        <p className="text-[9px] text-stone-400 mb-1.5">每行一条提示，将归入当前选中维度</p>
                        <pre className="font-mono text-[9px] text-stone-500 whitespace-pre-wrap leading-relaxed">{`- 他最害怕失去什么？\n她能原谅什么，不能原谅什么？\n• 他的沉默意味着什么`}</pre>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {/* Timer (all modes) */}
              <div className="pt-4 pb-2 border-t border-stone-200/50 mt-auto">
                <h3 className="font-headline text-[13px] font-semibold text-stone-700 mb-3">限时写作</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[10, 15, 20, 30].map(n => (
                    <button key={n} onClick={() => store.setTimerDuration(n as any)}
                      className={`py-1.5 rounded text-[10px] font-label transition-colors ${store.timerDuration === n ? 'bg-primary text-white' : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-50'}`}>
                      {n}分
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <button onClick={() => store.toggleSidebar()} className="w-full py-2 flex items-center justify-center space-x-2 text-stone-400 hover:text-stone-600 transition-colors text-xs font-label border border-transparent hover:border-stone-200 rounded">
                  <span className="material-symbols-outlined text-sm">keyboard_double_arrow_left</span>
                  <span>收起侧边栏</span>
                </button>
              </div>
            </aside>

            {store.sidebarCollapsed && (
              <button className="fixed left-0 top-1/2 -translate-y-1/2 z-40 p-2 bg-white/80 border border-[#b2b2ad]/15 rounded-r-md shadow-sm opacity-50 hover:opacity-100 transition-all text-stone-400 hover:text-[#8a5038]" onClick={() => store.toggleSidebar()}>
                <span className="material-symbols-outlined">keyboard_double_arrow_right</span>
              </button>
            )}

            {/* Word Inspiration Panel */}
            {store.writingMode === 'words' && wordsSubView !== 'library' && (
              <section className="w-80 bg-surface-container-low p-8 flex flex-col space-y-6 overflow-y-auto shrink-0 border-r border-outline-variant/10">
                <div className="mb-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-label text-[10px] uppercase tracking-[0.2em] text-outline">词汇灵感</span>
                    <div className="flex space-x-1">
                      <button onClick={handleToggleFavorite} className="p-1 hover:bg-stone-200/50 rounded group transition-all" title="收藏">
                        <span className={`material-symbols-outlined text-[18px] transition-colors ${store.isCurrentWordSetFavorite ? 'text-amber-500' : 'text-stone-400 group-hover:text-amber-500'}`} style={store.isCurrentWordSetFavorite ? { fontVariationSettings: "'FILL' 1" } : {}}>star</span>
                      </button>
                      <button className="p-1 hover:bg-stone-200/50 rounded group transition-all" title="抽取 (Space)" onClick={handleDraw}>
                        <span className="material-symbols-outlined text-[18px] text-stone-400 group-hover:text-primary transition-colors">casino</span>
                      </button>
                    </div>
                  </div>
                  <h3 className="font-headline text-2xl text-on-surface">写作灵感</h3>
                </div>

                {store.drawnGenre && (
                  <div className={`flex items-center space-x-2 px-4 py-3 rounded-xl border ${genreStyleMap[store.drawnGenre]?.bg ?? 'bg-stone-100 border-stone-200'}`}>
                    <span className="material-symbols-outlined text-[18px]">{genreStyleMap[store.drawnGenre]?.icon ?? 'edit'}</span>
                    <div className="flex-1">
                      <p className="text-[10px] font-label uppercase tracking-widest text-stone-500">写作风格</p>
                      <p className="font-headline font-bold text-base leading-tight">{store.drawnGenre}</p>
                    </div>
                    <button onClick={() => store.setDrawnGenre(pickRandomGenre(store.selectedGenres))} className="p-1 rounded hover:bg-black/5 transition-colors" title="换一个风格">
                      <span className="material-symbols-outlined text-[16px] text-stone-400">refresh</span>
                    </button>
                  </div>
                )}

                <div className="space-y-4">
                  {store.currentWords.map((w, i) => (
                    <div key={`${w.id}_${i}`} className="bg-[#fcfaf7] p-6 custom-shadow rounded-lg border border-stone-100 relative overflow-hidden group">
                      <div className="flex justify-between items-start mb-4 relative z-10">
                        <span className="px-2 py-0.5 bg-amber-100 text-stone-800 text-[10px] font-bold font-label rounded tracking-wider ring-1 ring-amber-200/50 uppercase">
                          {w.category || w.genres?.[0] || '意象'}
                        </span>
                        <button onClick={() => store.toggleLock(i)} className={`material-symbols-outlined text-sm transition-colors ${store.lockedIndices.has(i) ? 'text-primary' : 'text-stone-300 hover:text-stone-500'}`}>
                          {store.lockedIndices.has(i) ? 'lock' : 'lock_open'}
                        </button>
                      </div>
                      <h4 className="font-headline text-xl font-bold mb-3 text-stone-900 leading-tight relative z-10">{w.text}</h4>
                      {w.explanation && (
                        <p className="text-sm text-stone-800 leading-relaxed font-medium relative z-10">{w.explanation}</p>
                      )}
                      <div className="absolute inset-0 opacity-[0.03] pointer-events-none paper-texture"></div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Scene Prompt Panel */}
            {store.writingMode === 'scene' && store.currentScene && (
              <section className="w-80 bg-surface-container-low p-8 flex flex-col space-y-6 overflow-y-auto shrink-0 border-r border-outline-variant/10">
                <div className="mb-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-label text-[10px] uppercase tracking-[0.2em] text-outline">场景描写</span>
                    <button className="p-1 hover:bg-stone-200/50 rounded group transition-all" title="换一个场景" onClick={() => store.setCurrentScene(pickRandomScene(store.currentScene?.id))}>
                      <span className="material-symbols-outlined text-[18px] text-stone-400 group-hover:text-primary transition-colors">refresh</span>
                    </button>
                  </div>
                  <h3 className="font-headline text-2xl text-on-surface">描写挑战</h3>
                </div>

                <div className="bg-[#fcfaf7] p-6 custom-shadow rounded-lg border border-stone-100 relative overflow-hidden">
                  <span className="material-symbols-outlined text-[32px] text-blue-400 mb-4 block">landscape</span>
                  <h4 className="font-headline text-xl font-bold mb-3 text-stone-900">{store.currentScene.title}</h4>
                  <p className="text-sm text-stone-700 leading-relaxed mb-4">{store.currentScene.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {store.currentScene.tags.map(tag => (
                      <span key={tag} className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-label rounded-full border border-blue-200/50">{tag}</span>
                    ))}
                  </div>
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none paper-texture"></div>
                </div>
              </section>
            )}

            {/* Challenge Panel */}
            {store.writingMode === 'challenge' && store.currentChallenge && (
              <section className="w-80 bg-surface-container-low p-8 flex flex-col space-y-6 overflow-y-auto shrink-0 border-r border-outline-variant/10">
                <div className="mb-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-label text-[10px] uppercase tracking-[0.2em] text-outline">写作挑战</span>
                    <button className="p-1 hover:bg-stone-200/50 rounded group transition-all" title="换一题" onClick={() => pickAndSetChallenge(store.currentChallenge?.id)}>
                      <span className="material-symbols-outlined text-[18px] text-stone-400 group-hover:text-primary transition-colors">refresh</span>
                    </button>
                  </div>
                  <h3 className="font-headline text-2xl text-on-surface">习作题目</h3>
                </div>

                <div className="bg-[#fcfaf7] p-6 custom-shadow rounded-lg border border-stone-100 relative overflow-hidden flex-1">
                  <span className="material-symbols-outlined text-[32px] text-rose-400 mb-4 block">quiz</span>
                  <p className="text-base text-stone-800 leading-relaxed font-medium">{store.currentChallenge.text}</p>
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none paper-texture"></div>
                </div>
              </section>
            )}

            {/* Character Prompt Panel */}
            {store.writingMode === 'character' && store.currentCharacterPrompt && (() => {
              const layer = CHARACTER_LAYERS.find(l => l.id === store.currentCharacterPrompt!.layer);
              return (
                <section className="w-80 bg-surface-container-low p-8 flex flex-col space-y-6 overflow-y-auto shrink-0 border-r border-outline-variant/10">
                  <div className="mb-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-label text-[10px] uppercase tracking-[0.2em] text-outline">人物描写</span>
                      <button className="p-1 hover:bg-stone-200/50 rounded group transition-all" title="换一题" onClick={() => pickAndSetCharacterPrompt(store.currentCharacterPrompt?.id)}>
                        <span className="material-symbols-outlined text-[18px] text-stone-400 group-hover:text-primary transition-colors">refresh</span>
                      </button>
                    </div>
                    <h3 className="font-headline text-2xl text-on-surface">角色练习</h3>
                  </div>

                  {layer && (
                    <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg border text-xs font-label ${layer.color}`}>
                      <span className="material-symbols-outlined text-[14px]">{layer.icon}</span>
                      <span className="font-medium">{layer.name}</span>
                      <span className="opacity-60 flex-1 truncate">{layer.description}</span>
                    </div>
                  )}

                  <div className="bg-[#fcfaf7] p-6 custom-shadow rounded-lg border border-stone-100 relative overflow-hidden flex-1">
                    <span className="material-symbols-outlined text-[28px] text-fuchsia-400 mb-4 block">person_search</span>
                    <p className="text-base text-stone-800 leading-relaxed font-medium">{store.currentCharacterPrompt.text}</p>
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none paper-texture"></div>
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
              
              <div className="max-w-3xl mx-auto pt-24 pb-32 px-12 min-h-full flex flex-col">
                <div className="mb-12">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center space-x-3">
                      <div className="text-outline text-xs font-label">{dateStr}</div>
                      {store.writingMode && (
                        <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-label font-medium border ${WRITING_MODES.find(m => m.mode === store.writingMode)?.color || ''}`}>
                          <span className="material-symbols-outlined text-[12px]">{WRITING_MODES.find(m => m.mode === store.writingMode)?.icon}</span>
                          <span>{WRITING_MODES.find(m => m.mode === store.writingMode)?.label}</span>
                        </span>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <button onClick={handleSave} className="flex items-center space-x-1 px-3 py-1.5 bg-stone-100 text-[#8a5038] hover:bg-stone-200 rounded-md transition-colors text-xs font-label font-medium">
                        <span className="material-symbols-outlined text-[16px]">save</span>
                        <span>存入灵感宫殿</span>
                      </button>
                      <button onClick={handleExport} className="flex items-center space-x-1 px-3 py-1.5 bg-[#8a5038] text-white hover:bg-[#7c442d] rounded-md transition-colors text-xs font-label font-medium shadow-sm">
                        <span className="material-symbols-outlined text-[16px]">download</span>
                        <span>导出 .md</span>
                      </button>
                    </div>
                  </div>
                  <input 
                    className="w-full bg-transparent border-none focus:ring-0 font-headline text-4xl font-black text-on-surface placeholder:text-surface-dim outline-none mb-6" 
                    placeholder={store.writingMode === 'dream' ? '给你的梦起个名字...' : store.writingMode === 'scene' ? '给这段描写起个标题...' : store.writingMode === 'challenge' ? '就这题写点什么...' : store.writingMode === 'character' ? '这个角色叫什么名字...' : '给你的灵感起个名字...'}
                    type="text" 
                    value={store.editorTitle}
                    onChange={(e) => store.setEditorTitle(e.target.value)}
                  />
                </div>
                
                <div className="flex-1 w-full relative -mx-4 overflow-visible markdown-editor-container">
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
              </div>
              
              {/* Zen Toolbar */}
              <div className="fixed right-12 top-1/2 -translate-y-1/2 flex flex-col space-y-4 p-2 glass-panel bg-surface-container-low/80 rounded-full custom-shadow">
                <button className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-white hover:text-primary transition-all" title="限时挑战" onClick={() => { store.setTimerActive(!store.timerActive); if (store.timerActive) store.setTimerSeconds(0); }}>
                  <span className={`material-symbols-outlined ${store.timerActive ? 'text-primary' : ''}`}>timelapse</span>
                </button>
                <button className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-white hover:text-primary transition-all" title="保存 (Ctrl+S)" onClick={handleSave}>
                  <span className="material-symbols-outlined">save</span>
                </button>
                <div className="h-px w-6 bg-outline-variant/20 mx-auto"></div>
                <button className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-white hover:text-primary transition-all" title="全屏专注" onClick={() => {
                  if (document.fullscreenElement) { document.exitFullscreen(); } else { document.documentElement.requestFullscreen(); }
                }}>
                  <span className="material-symbols-outlined">fullscreen</span>
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

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-[#fbf9f5] flex justify-between items-center px-10 py-2 w-full border-t border-[#b2b2ad]/10 h-[45px]">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <span className="material-symbols-outlined text-primary text-sm" style={{fontVariationSettings: "'FILL' 1"}}>local_fire_department</span>
            <span className="font-label text-[11px] font-medium text-[#8a5038]">连续打卡: {store.streak} 天</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="material-symbols-outlined text-stone-400 text-sm">edit_note</span>
            <span className="font-label text-[11px] font-medium text-stone-500">今日字数: {wordCount}</span>
          </div>
        </div>
        <div className="flex items-center space-x-6 text-[11px] font-label font-medium text-stone-400">
          <span className="text-stone-500">© 每日写作灵感小组</span>
        </div>
      </footer>
      
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 bg-surface-container-high text-on-surface border border-outline/20 shadow-lg px-6 py-3 rounded-full font-label text-sm z-[100] animate-bounce">
          {toast}
        </div>
      )}
    </div>
  );
}
