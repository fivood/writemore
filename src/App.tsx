import { useEffect, useRef, useState } from 'react';
import { useStore } from './store';
import { drawRandomWords, loadUserData } from './data/wordEngine';
import { saveDraftToDb, toggleFavoriteWordSet } from './data/draftEngine';
import type { Genre, Word } from './types';
import MDEditor from '@uiw/react-md-editor';
import HistoryPage from './components/HistoryPage';
import FavoritesPage from './components/FavoritesPage';
import LibraryPage from './components/LibraryPage';

export default function App() {
  const store = useStore();
  const [toast, setToast] = useState('');
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Init
  useEffect(() => {
    loadUserData();
    store.updateStreak();
    if (store.currentWords.length === 0) handleDraw();
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
      if (e.key === ' ') { e.preventDefault(); handleDraw(); }
      if (e.key === 'Enter') { e.preventDefault(); editorRef.current?.focus(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [store.currentWords, store.selectedGenres, store.wordCount, store.lockedIndices, store.editorContent, store.editorTitle]);

  async function handleDraw() {
    // Auto-save existing work if any
    if (store.editorContent.trim() || store.editorTitle.trim()) {
      await handleSave();
    }
    
    // Clear the current editor for fresh ideas
    store.setEditorTitle('');
    store.setEditorContent('');
    store.setCurrentWordSetId(null);
    store.setCurrentDraftId(null);
    store.setIsCurrentWordSetFavorite(false);

    const locked = new Map<number, Word>();
    store.lockedIndices.forEach(i => {
      if (store.currentWords[i]) locked.set(i, store.currentWords[i]);
    });
    const words = drawRandomWords(store.wordCount, store.selectedGenres, locked);
    store.setCurrentWords(words);
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
        store.currentDraftId
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

  return (
    <div className="bg-surface text-on-surface font-body selection:bg-primary-container selection:text-on-primary-container min-h-screen">
      {/* TopNavBar */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-panel bg-[#fbf9f5]/70 flex justify-between items-center px-8 py-4 max-w-full">
        <div className="text-xl font-bold text-[#8a5038] italic font-headline">每日写作灵感</div>
        <nav className="flex space-x-8 items-center font-headline text-base tracking-tight">
          <button className={`transition-all duration-300 ease-in-out ${store.activeTab === 'inspire' ? 'text-[#8a5038] border-b-2 border-[#8a5038] pb-1' : 'text-stone-500 hover:text-[#8a5038]'}`} onClick={() => store.setActiveTab('inspire')}>✦ 词条</button>
          <button className={`transition-all duration-300 ease-in-out ${store.activeTab === 'library' ? 'text-[#8a5038] border-b-2 border-[#8a5038] pb-1' : 'text-stone-500 hover:text-[#8a5038]'}`} onClick={() => store.setActiveTab('library')}>📚 词库</button>
          <button className={`transition-all duration-300 ease-in-out ${store.activeTab === 'favorites' ? 'text-[#8a5038] border-b-2 border-[#8a5038] pb-1' : 'text-stone-500 hover:text-[#8a5038]'}`} onClick={() => store.setActiveTab('favorites')}>⭐ 收藏</button>
          <button className={`transition-all duration-300 ease-in-out ${store.activeTab === 'history' ? 'text-[#8a5038] border-b-2 border-[#8a5038] pb-1' : 'text-stone-500 hover:text-[#8a5038]'}`} onClick={() => store.setActiveTab('history')}>📋 历史</button>
        </nav>
        <div className="flex items-center space-x-4">
        </div>
      </header>

      <div className="flex h-screen pt-[72px] pb-[45px]">
        {/* SideNavBar */}
        <aside className={`transition-all duration-300 ${store.sidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-64 glass-panel bg-[#f5f4ef]/70 flex flex-col p-6 border-r border-[#b2b2ad]/15 shrink-0'}`}>
          <div className="mb-6">
            <h2 className="font-headline text-lg font-semibold text-stone-800">灵感分类</h2>
            <p className="text-[10px] font-label uppercase tracking-widest text-stone-500 mt-1">选择你需要的灵感类型</p>
          </div>
          <nav className="space-y-1 flex-1 overflow-y-auto pr-2">
            {[
              { id: '科幻', icon: 'rocket_launch', color: 'bg-blue-300', en: 'Sci-fi' },
              { id: '悬疑', icon: 'search', color: 'bg-purple-300', en: 'Mystery' },
              { id: '奇幻', icon: 'auto_stories', color: 'bg-green-300', en: 'Fantasy' },
              { id: '言情', icon: 'favorite', color: 'bg-red-300', en: 'Romance' },
              { id: '历史', icon: 'history_edu', color: 'bg-amber-300', en: 'Historical' },
              { id: '武侠', icon: 'swords', color: 'bg-orange-300', en: 'Wuxia' },
              { id: '都市', icon: 'location_city', color: 'bg-teal-300', en: 'Urban' },
              { id: '恐怖', icon: 'sentiment_very_dissatisfied', color: 'bg-rose-300', en: 'Horror' },
            ].map(g => (
              <button key={g.id} 
                onClick={() => store.toggleGenre(g.id as Genre)}
                className={`w-full flex items-center space-x-3 px-3 py-2 transition-transform duration-200 ${store.selectedGenres.includes(g.id as Genre) ? 'bg-[#ffffff] text-[#8a5038] rounded-lg shadow-sm active:scale-95 active:opacity-90' : 'text-stone-600 hover:bg-stone-200/50 hover:translate-x-1'}`}>
                <span className={`w-2 h-2 rounded-full ${g.color}`}></span>
                <span className="material-symbols-outlined text-sm">{g.icon || 'category'}</span>
                <span className="font-label text-xs uppercase tracking-widest flex-1 text-left">{g.id}</span>
              </button>
            ))}

            {/* Word Count Selector */}
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

            {/* Timed Writing Selector */}
            <div className="pt-4 pb-4">
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
          </nav>
          <div className="pt-4 space-y-3">
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

        {/* Main Content Area */}
        {store.activeTab === 'inspire' ? (
          <>
            {/* Inspiration Panel */}
            <section className="w-80 bg-surface-container-low p-8 flex flex-col space-y-6 overflow-y-auto shrink-0 border-r border-outline-variant/10">
              <div className="mb-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-label text-[10px] uppercase tracking-[0.2em] text-outline">每日灵感</span>
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
              <div className="space-y-4">
                {store.currentWords.map((w, i) => (
                  <div key={`${w.id}_${i}`} className="bg-[#fcfaf7] p-6 custom-shadow rounded-lg border border-stone-100 relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <span className="px-2 py-0.5 bg-amber-100 text-stone-800 text-[10px] font-bold font-label rounded tracking-wider ring-1 ring-amber-200/50 uppercase">
                        {w.genre}
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

            {/* Main Editor */}
            <main className="flex-1 bg-surface relative overflow-y-auto">
              {store.timerActive && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-surface-dim">
                  <div className="h-full bg-primary transition-all duration-1000 ease-linear" style={{ width: `${(store.timerSeconds / (store.timerDuration * 60)) * 100}%` }}></div>
                </div>
              )}
              
              <div className="max-w-3xl mx-auto pt-24 pb-32 px-12 min-h-full flex flex-col">
                <div className="mb-12">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-outline text-xs font-label">{dateStr}</div>
                    <div className="flex space-x-2">
                      <button onClick={handleSave} className="flex items-center space-x-1 px-3 py-1.5 bg-stone-100 text-[#8a5038] hover:bg-stone-200 rounded-md transition-colors text-xs font-label font-medium">
                        <span className="material-symbols-outlined text-[16px]">save</span>
                        <span>存入历史</span>
                      </button>
                      <button onClick={handleExport} className="flex items-center space-x-1 px-3 py-1.5 bg-[#8a5038] text-white hover:bg-[#7c442d] rounded-md transition-colors text-xs font-label font-medium shadow-sm">
                        <span className="material-symbols-outlined text-[16px]">download</span>
                        <span>导出 .md</span>
                      </button>
                    </div>
                  </div>
                  <input 
                    className="w-full bg-transparent border-none focus:ring-0 font-headline text-4xl font-black text-on-surface placeholder:text-surface-dim outline-none mb-6" 
                    placeholder="给你的灵感起个名字..." 
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
                      placeholder: "在这里开始你的故事（支持 Markdown 格式）..."
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
                <button className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-white hover:text-primary transition-all" title="保存草稿 (Ctrl+S)" onClick={handleSave}>
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
          </>
        ) : store.activeTab === 'history' ? (
          <HistoryPage />
        ) : store.activeTab === 'favorites' ? (
          <FavoritesPage />
        ) : (
          <LibraryPage />
        )}
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
