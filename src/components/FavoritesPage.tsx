import { useEffect, useState, useMemo, type ComponentType, type MouseEvent } from 'react';
import { Star, X, ListChecks, Library, Search, Clock, LayoutGrid, Sparkles, SearchX, Check, Pencil, Mountain, CircleHelp, User } from 'lucide-react';
import { db } from '../db';
import { useStore } from '../store';
import type { PromptFavorite, WordSet } from '../types';
import { toggleFavoriteWordSet } from '../data/draftEngine';

type SortMode = 'date' | 'module';

export default function FavoritesPage() {
  const store = useStore();
  const [favorites, setFavorites] = useState<WordSet[]>([]);
  const [promptFavorites, setPromptFavorites] = useState<PromptFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const moduleMeta: Record<PromptFavorite['module'] | 'words', { label: string; color: string; Icon: ComponentType<{ size?: number; className?: string }> }> = {
    words: { label: '词汇灵感', color: 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-400/20', Icon: Sparkles },
    scene: { label: '场景描写', color: 'bg-blue-50 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-400/20', Icon: Mountain },
    challenge: { label: '写作挑战', color: 'bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-400/20', Icon: CircleHelp },
    character: { label: '角色描写', color: 'bg-fuchsia-50 dark:bg-fuchsia-500/10 text-fuchsia-800 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-400/20', Icon: User },
  };

  useEffect(() => {
    fetchFavorites();
  }, []);

  async function fetchFavorites() {
    try {
      const favs = await db.wordSets.filter(ws => ws.isFavorite).reverse().toArray();
      const promptFavs = await db.promptFavorites.reverse().toArray();
      setFavorites(favs);
      setPromptFavorites(promptFavs);
    } catch (e) {
      console.error('Failed to load favorites', e);
    } finally {
      setLoading(false);
    }
  }

  // Filtered & sorted results (word sets)
  const displayedWordSets = useMemo(() => {
    let result = favorites;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(ws =>
        ws.words.some(w => w.text.toLowerCase().includes(q)) ||
        ws.genre.toLowerCase().includes(q) ||
        moduleMeta.words.label.includes(searchQuery.trim())
      );
    }

    if (sortMode === 'module') {
      result = [...result].sort((a, b) => a.genre.localeCompare(b.genre, 'zh'));
    }

    return result;
  }, [favorites, searchQuery, sortMode]);

  // Filtered & sorted results (prompt favorites)
  const displayedPromptFavorites = useMemo(() => {
    let result = promptFavorites;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(item =>
        item.title.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        (item.tags || []).some(tag => tag.toLowerCase().includes(q)) ||
        moduleMeta[item.module].label.toLowerCase().includes(q)
      );
    }

    if (sortMode === 'module') {
      const order: Record<PromptFavorite['module'], number> = { scene: 0, challenge: 1, character: 2 };
      result = [...result].sort((a, b) => order[a.module] - order[b.module]);
    }

    return result;
  }, [promptFavorites, searchQuery, sortMode]);

  const totalDisplayed = displayedWordSets.length + displayedPromptFavorites.length;

  // Genre stats
  const genreStats = useMemo(() => {
    const map = new Map<string, number>();
    favorites.forEach(ws => {
      map.set(ws.genre, (map.get(ws.genre) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [favorites]);

  const totalFavorites = favorites.length + promptFavorites.length;

  const handleUsePrompt = (ws: WordSet) => {
    if (store.editorContent.trim() || store.editorTitle.trim()) {
      if (!confirm('使用这组灵感前，当前编辑器内容（如果未手动保存）将被清空，是否继续？')) {
        return;
      }
    }
    store.setEditorTitle('');
    store.setEditorContent('');
    store.setCurrentDraftId(null);
    store.setCurrentWordSetId(ws.id);
    store.setCurrentWords(ws.words);
    store.setIsCurrentWordSetFavorite(true);
    store.setActiveTab('inspire');
  };

  const handleUnfavorite = async (e: MouseEvent, ws: WordSet) => {
    e.stopPropagation();
    await toggleFavoriteWordSet(ws.words, ws.id, true);
    setFavorites(prev => prev.filter(item => item.id !== ws.id));
    if (store.currentWordSetId === ws.id) {
      store.setIsCurrentWordSetFavorite(false);
    }
  };

  const handleUnfavoritePrompt = async (id: string) => {
    await db.promptFavorites.delete(id);
    setPromptFavorites(prev => prev.filter(item => item.id !== id));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBatchUnfavorite = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要取消收藏选中的 ${selectedIds.size} 组灵感吗？`)) return;

    for (const id of selectedIds) {
      const ws = favorites.find(f => f.id === id);
      if (ws) {
        await toggleFavoriteWordSet(ws.words, ws.id, true);
        if (store.currentWordSetId === ws.id) {
          store.setIsCurrentWordSetFavorite(false);
        }
      }
    }
    setFavorites(prev => prev.filter(f => !selectedIds.has(f.id)));
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  return (
    <main className="flex-1 bg-surface relative overflow-y-auto p-4 md:p-8 lg:p-12">
      <div className="max-w-5xl mx-auto pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <h2 className="font-headline text-2xl md:text-3xl font-black text-on-surface flex items-center space-x-3">
            {totalFavorites > 0 && <Star size={34} className="text-amber-500" fill="currentColor" />}
            <span>收藏夹</span>
          </h2>
          {favorites.length > 0 && (
            <button
              onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-label font-medium transition-all ${selectMode ? 'bg-amber-500 text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              {selectMode ? <X size={18} /> : <ListChecks size={18} />}
              <span>{selectMode ? '退出选择' : '批量管理'}</span>
            </button>
          )}
        </div>

        {/* Stats bar */}
        {totalFavorites > 0 && (
          <div className="flex items-center flex-wrap gap-3 mb-6 p-4 bg-surface-container-low/60 rounded-xl border border-outline-variant/15">
            <div className="flex items-center space-x-2 text-sm font-label text-on-surface-variant">
              <Library size={20} className="text-amber-500" />
              <span className="font-bold text-on-surface">{totalFavorites}</span>
              <span>项收藏</span>
            </div>
            <div className="h-4 w-px bg-outline-variant/30" />
            <div className="text-sm font-label text-on-surface-variant">
              词汇灵感 <span className="font-bold text-on-surface">{favorites.length}</span> 组 · 题目收藏 <span className="font-bold text-on-surface">{promptFavorites.length}</span> 条
            </div>
            {favorites.length > 0 && <div className="h-4 w-px bg-outline-variant/30" />}
            <div className="flex flex-wrap gap-1.5">
              {genreStats.map(([genre, count]) => (
                <span key={genre} className="px-2 py-0.5 bg-amber-50 dark:bg-primary/10 text-amber-800 dark:text-primary text-[12px] font-label font-semibold rounded border border-amber-100 dark:border-primary/20 tracking-wide">
                  {genre} ×{count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Search & Sort toolbar */}
        {totalFavorites > 0 && (
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1">
              <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
              <input
                type="text"
                placeholder="搜索词条、题目或模块..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container rounded-lg border border-outline-variant/30 text-sm font-label text-on-surface placeholder:text-outline focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant">
                  <X size={18} />
                </button>
              )}
            </div>
            <div className="flex bg-surface-container rounded-lg border border-outline-variant/30 overflow-hidden">
              <button
                onClick={() => setSortMode('date')}
                className={`px-3 py-2 text-[13px] font-label font-medium transition-colors flex items-center space-x-1 ${sortMode === 'date' ? 'bg-amber-500 text-white' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
              >
                <Clock size={16} />
                <span>按时间</span>
              </button>
              <button
                onClick={() => setSortMode('module')}
                className={`px-3 py-2 text-[13px] font-label font-medium transition-colors flex items-center space-x-1 ${sortMode === 'module' ? 'bg-amber-500 text-white' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
              >
                <LayoutGrid size={16} />
                <span>按模块</span>
              </button>
            </div>
          </div>
        )}

        {/* Batch action bar */}
        {selectMode && selectedIds.size > 0 && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-primary/10 border border-amber-200 dark:border-primary/20 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 animate-[fadeIn_0.2s_ease-out]">
            <span className="text-sm font-label text-amber-800 dark:text-primary">
              已选择 <span className="font-bold">{selectedIds.size}</span> 项
            </span>
            <button
              onClick={handleBatchUnfavorite}
              className="flex items-center space-x-1 px-4 py-1.5 bg-red-500 text-white text-xs font-label font-medium rounded-md hover:bg-red-600 transition-colors"
            >
              <Star size={16} />
              <span>批量取消收藏</span>
            </button>
          </div>
        )}

        {/* Main content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-8 h-8 rounded-full border-4 border-amber-500/30 border-t-amber-500 animate-spin" />
            <p className="mt-4 text-on-surface-variant text-sm font-label">加载中...</p>
          </div>
        ) : totalFavorites === 0 ? (
          <div className="text-center py-24 bg-surface-container-low/50 rounded-2xl border border-dashed border-outline-variant/30">
            <Sparkles size={48} className="text-outline mb-4" />
            <p className="text-on-surface-variant font-label text-lg mb-1">空空如也</p>
            <p className="text-on-surface-variant text-sm mt-2 max-w-sm mx-auto leading-relaxed">
              在场景描写、写作挑战、角色描写或词汇灵感页面看到喜欢的题目时，点击 <span className="inline-block text-amber-500 align-text-bottom"><Star size={18} fill="currentColor" /></span> 收藏吧！
            </p>
            <button
              className="mt-8 px-8 py-3 bg-amber-500 text-white hover:bg-amber-600 transition-colors rounded-lg font-label text-sm font-medium custom-shadow"
              onClick={() => store.setActiveTab('inspire')}
            >
              去寻找灵感
            </button>
          </div>
        ) : totalDisplayed === 0 ? (
          <div className="text-center py-16">
            <SearchX size={40} className="text-outline mb-4" />
            <p className="text-on-surface-variant font-label">
              没有找到包含「<span className="font-medium text-amber-600">{searchQuery}</span>」的收藏
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {displayedPromptFavorites.length > 0 && (
              <section>
                <h3 className="font-headline text-xl font-bold text-on-surface mb-4">题目收藏</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {displayedPromptFavorites.map((item) => {
                    const meta = moduleMeta[item.module];
                    const ModuleIcon = meta.Icon;
                    return (
                      <div key={item.id} className="bg-surface-container p-5 rounded-xl border border-outline-variant/15 hover:border-amber-500/30 transition-all duration-300 hover:-translate-y-0.5 flex flex-col relative">
                        <div className="text-xs font-label text-outline mb-3 flex items-center justify-between">
                          <span>{new Date(item.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' })}</span>
                          <button onClick={() => handleUnfavoritePrompt(item.id)} className="text-amber-500 hover:text-outline transition-colors" title="取消收藏">
                            <Star size={20} fill="currentColor" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-label font-medium border ${meta.color}`}>
                            <ModuleIcon size={13} />{meta.label}
                          </span>
                          {item.isAi && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-label font-medium border bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-400/20 text-rose-700 dark:text-rose-300">
                              <Sparkles size={13} />AI
                            </span>
                          )}
                        </div>

                        <p className="text-base text-on-surface leading-relaxed font-medium">{item.title}</p>
                        {item.description && <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">{item.description}</p>}
                        {item.tags && item.tags.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {item.tags.map(tag => (
                              <span key={tag} className="px-2 py-0.5 rounded-full text-[12px] font-label bg-surface-container-high text-on-surface-variant border border-outline-variant/20">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {displayedWordSets.length > 0 && (
              <section>
                <h3 className="font-headline text-xl font-bold text-on-surface mb-4">词汇灵感收藏</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {displayedWordSets.map((ws) => (
                    <div
                      key={ws.id}
                      className={`bg-surface-container p-5 rounded-xl border hover:border-amber-500/30 group transition-all duration-300 hover:-translate-y-0.5 flex flex-col relative ${
                        selectMode && selectedIds.has(ws.id) ? 'border-amber-500 dark:border-primary ring-2 ring-amber-200 dark:ring-primary/20' : 'border-outline-variant/15'
                      }`}
                      onClick={() => selectMode && toggleSelect(ws.id)}
                    >
                      {selectMode && (
                        <div className="absolute top-3 left-3 z-10">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            selectedIds.has(ws.id) ? 'bg-amber-500 border-amber-500 text-white' : 'border-outline bg-surface-container'
                          }`}>
                            {selectedIds.has(ws.id) && <Check size={16} />}
                          </div>
                        </div>
                      )}

                      <div className={`text-xs font-label text-outline mb-3 flex items-center justify-between ${selectMode ? 'pl-7' : ''}`}>
                        <span>{new Date(ws.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' })}</span>
                        <div className="flex items-center space-x-2">
                          <span className="bg-amber-50 dark:bg-primary/10 text-amber-700 dark:text-primary font-bold px-2 py-0.5 rounded tracking-widest text-[12px] uppercase border border-amber-100 dark:border-primary/20">
                            {ws.genre}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-label font-medium border bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-400/20 text-amber-800 dark:text-amber-300">
                            <Sparkles size={13} />词汇灵感
                          </span>
                          {!selectMode && (
                            <button
                              onClick={(e) => handleUnfavorite(e, ws)}
                              className="text-amber-500 hover:text-outline transition-colors"
                              title="取消收藏"
                            >
                              <Star size={20} fill="currentColor" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex-1">
                        <div className="flex flex-wrap gap-2 mb-4">
                          {ws.words.length > 0 ? ws.words.map((w, idx) => (
                            <span
                              key={idx}
                              className="px-3 py-1.5 bg-surface-container-high text-on-surface font-headline font-bold text-sm rounded-md border border-outline-variant/20 shadow-sm cursor-default"
                              title={w.explanation || undefined}
                            >
                              {w.text}
                              {w.explanation && <span className="ml-1 text-outline text-[12px]">释</span>}
                            </span>
                          )) : (
                            <span className="text-on-surface-variant italic text-sm">空的词组</span>
                          )}
                        </div>
                      </div>

                      {!selectMode && (
                        <button
                          onClick={() => handleUsePrompt(ws)}
                          className="w-full mt-3 py-2 border border-amber-500/20 dark:border-primary/20 text-amber-700 dark:text-primary font-label text-xs font-semibold rounded-md hover:bg-amber-50 dark:hover:bg-primary/10 transition-colors flex items-center justify-center space-x-1"
                        >
                          <Pencil size={16} />
                          <span>使用此灵感创作</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
