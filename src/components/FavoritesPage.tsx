import { useEffect, useState, useMemo, type ComponentType, type MouseEvent } from 'react';
import { Star, X, ListChecks, Search, Clock, LayoutGrid, Sparkles, SearchX, Check, Pencil, Mountain, CircleHelp, User } from 'lucide-react';
import { db } from '../db';
import { useStore } from '../store';
import type { PromptFavorite, WordSet } from '../types';
import { toggleFavoriteWordSet } from '../lib/drafts';
import { startMode } from '../lib/session';

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
    words:     { label: '词汇灵感', color: 'bg-[#f4ead7] dark:bg-[#33291c] border-[#d6c09e] dark:border-[#4d3e2a] text-[#785834] dark:text-[#d9ba91]', Icon: Sparkles },
    scene:     { label: '场景描写', color: 'bg-[#e3ebe5] dark:bg-[#202b25] border-[#c1d1c6] dark:border-[#33443b] text-[#445c4e] dark:text-[#9eb8a9]', Icon: Mountain },
    challenge: { label: '写作挑战', color: 'bg-[#f3e5d7] dark:bg-[#34261a] border-[#d9bfa6] dark:border-[#4f3927] text-[#7d5636] dark:text-[#d9b08c]', Icon: CircleHelp },
    character: { label: '角色描写', color: 'bg-[#f2e6da] dark:bg-[#33261c] border-[#d8c1ac] dark:border-[#4d392a] text-[#7a573b] dark:text-[#d6b294]', Icon: User },
  };

  useEffect(() => {
    void fetchFavorites();
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

  const genreStats = useMemo(() => {
    const map = new Map<string, number>();
    favorites.forEach(ws => {
      map.set(ws.genre, (map.get(ws.genre) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [favorites]);

  const totalFavorites = favorites.length + promptFavorites.length;

  const handleUsePrompt = (ws: WordSet) => {
    startMode('words');
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
      if (next.has(id)) next.delete(id); else next.add(id);
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
    <main className="flex-1 relative overflow-y-auto p-4 md:p-8 lg:p-12">
      <div className="max-w-5xl mx-auto pb-20">
        {/* 报刊版头 */}
        <div className="broadsheet-masthead-rule py-4 mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="font-headline text-2xl md:text-3xl font-bold text-on-surface flex items-center gap-2.5">
              <Star size={24} className="text-secondary" fill={totalFavorites > 0 ? 'currentColor' : 'none'} />
              <span>收藏夹</span>
            </h2>
          </div>
          {favorites.length > 0 && (
            <button
              onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm text-xs font-label font-medium border transition-colors cursor-pointer ${
                selectMode
                  ? 'bg-primary text-on-primary border-primary'
                  : 'bg-surface-container text-on-surface-variant border-outline-variant/60 hover:border-secondary'
              }`}
            >
              {selectMode ? <X size={15} /> : <ListChecks size={15} />}
              <span>{selectMode ? '退出管理' : '批量管理'}</span>
            </button>
          )}
        </div>

        {/* Stats bar */}
        {totalFavorites > 0 && (
          <div className="flex items-center flex-wrap gap-3 mb-6 px-4 py-3 bg-surface-container border border-outline-variant/55 rounded-sm">
            <div className="font-label text-xs text-on-surface-variant">
              共 <strong className="text-on-surface">{totalFavorites}</strong> 项收藏
            </div>
            <div className="h-3.5 w-px bg-outline-variant/50" />
            <div className="text-xs font-label text-on-surface-variant">
              词汇灵感 <strong className="text-on-surface">{favorites.length}</strong> 组 · 题目 <strong className="text-on-surface">{promptFavorites.length}</strong> 条
            </div>
            {genreStats.length > 0 && <div className="h-3.5 w-px bg-outline-variant/50" />}
            <div className="flex flex-wrap gap-1.5">
              {genreStats.map(([genre, count]) => (
                <span key={genre} className="px-2 py-0.5 bg-surface-container-low text-on-surface-variant font-mono text-[13px] rounded-none border border-outline-variant/50">
                  {genre} ×{count}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Search & Sort toolbar */}
        {totalFavorites > 0 && (
          <div className="flex items-center gap-2.5 mb-6">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
              <input
                type="text"
                placeholder="检索收藏的词条、题目或模块…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-surface-container rounded-sm border border-outline-variant/60 text-xs font-label text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface">
                  <X size={15} />
                </button>
              )}
            </div>
            <div className="flex bg-surface-container rounded-sm border border-outline-variant/60 overflow-hidden">
              <button
                onClick={() => setSortMode('date')}
                className={`px-3 py-2 text-xs font-label font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  sortMode === 'date' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <Clock size={13} />
                <span>按时间</span>
              </button>
              <button
                onClick={() => setSortMode('module')}
                className={`px-3 py-2 text-xs font-label font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  sortMode === 'module' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <LayoutGrid size={13} />
                <span>按模块</span>
              </button>
            </div>
          </div>
        )}

        {/* Batch action bar */}
        {selectMode && selectedIds.size > 0 && (
          <div className="mb-5 px-4 py-2.5 bg-primary-container/35 border border-primary/40 rounded-sm flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-on-surface">
              SELECTED <strong className="text-primary">{selectedIds.size}</strong>
            </span>
            <button
              onClick={() => void handleBatchUnfavorite()}
              className="flex items-center gap-1 px-3 py-1 bg-error text-on-error text-xs font-label font-medium rounded-sm hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Star size={13} />
              <span>批量取消收藏</span>
            </button>
          </div>
        )}

        {/* Main content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-7 h-7 rounded-full border-2 border-secondary/30 border-t-secondary animate-spin" />
            <p className="mt-4 text-on-surface-variant text-xs font-mono uppercase tracking-widest">LOADING…</p>
          </div>
        ) : totalFavorites === 0 ? (
          <div className="text-center py-24 index-card paper-grain rounded-sm border-dashed">
            <Star size={38} className="text-outline mx-auto mb-4" />
            <p className="text-on-surface font-headline text-lg font-bold mb-1">剪报簿尚无藏品</p>
            <p className="text-on-surface-variant font-body text-sm mt-2 max-w-sm mx-auto leading-relaxed">
              在抽取词签、场景或习作题时，点击右上角星标即可将心仪的题目夹入此册。
            </p>
            <button
              className="mt-6 px-6 py-2.5 bg-primary text-on-primary hover:bg-primary-dim transition-colors rounded-sm font-label text-xs font-semibold uppercase tracking-wider cursor-pointer"
              onClick={() => store.setActiveTab('inspire')}
            >
              去抽取灵感 →
            </button>
          </div>
        ) : totalDisplayed === 0 ? (
          <div className="text-center py-16">
            <SearchX size={36} className="text-outline mx-auto mb-3" />
            <p className="text-on-surface-variant font-label text-sm">
              没有找到包含「<span className="font-medium text-primary">{searchQuery}</span>」的收藏
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {displayedPromptFavorites.length > 0 && (
              <section>
                <h3 className="font-headline text-lg font-bold text-on-surface mb-3">
                  题目收藏 ({displayedPromptFavorites.length})
                </h3>
                <div className="broadsheet-frame grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                  {displayedPromptFavorites.map(item => {
                    const meta = moduleMeta[item.module];
                    const ModuleIcon = meta.Icon;
                    return (
                      <div key={item.id} className="bg-surface-container/70 hover:bg-surface-container p-5 border-b border-r border-on-surface/20 flex flex-col relative transition-colors">
                        <div className="font-mono text-[13px] text-outline mb-3 flex items-center justify-between">
                          <span>{new Date(item.createdAt).toLocaleDateString('zh-CN')}</span>
                          <button onClick={() => void handleUnfavoritePrompt(item.id)} className="text-secondary hover:text-outline transition-colors cursor-pointer" title="取消收藏">
                            <Star size={17} fill="currentColor" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-none text-[13px] font-label font-medium border ${meta.color}`}>
                            <ModuleIcon size={12} />{meta.label}
                          </span>
                          {item.isAi && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-none font-mono text-[12px] border bg-primary/10 border-primary/35 text-primary">
                              <Sparkles size={11} />AI
                            </span>
                          )}
                        </div>

                        <p className="font-headline text-base text-on-surface leading-relaxed font-bold">{item.title}</p>
                        {item.description && <p className="mt-2 font-body text-xs text-on-surface-variant leading-relaxed">{item.description}</p>}
                        {item.tags && item.tags.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-dashed border-outline-variant/50 flex flex-wrap gap-1.5">
                            {item.tags.map(tag => (
                              <span key={tag} className="px-2 py-0.5 rounded-none font-mono text-[12px] bg-surface-container-low text-on-surface-variant border border-outline-variant/50">
                                #{tag}
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
                <h3 className="font-headline text-lg font-bold text-on-surface mb-3">
                  词汇灵感收藏 ({displayedWordSets.length})
                </h3>
                <div className="broadsheet-frame grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                  {displayedWordSets.map(ws => {
                    const selected = selectMode && selectedIds.has(ws.id);
                    return (
                      <div
                        key={ws.id}
                        className={`washi-words p-5 border-b border-r border-on-surface/20 group flex flex-col relative transition-colors ${
                          selected ? 'palace-selected-frame z-10' : ''
                        } ${selectMode ? 'cursor-pointer' : ''}`}
                        onClick={() => selectMode && toggleSelect(ws.id)}
                      >
                        {selectMode && (
                          <div className="absolute top-3.5 left-3.5 z-10">
                            <div className={`w-4 h-4 rounded-none border flex items-center justify-center transition-all ${
                              selected ? 'bg-primary border-primary text-on-primary' : 'border-outline bg-surface-container-lowest'
                            }`}>
                              {selected && <Check size={12} />}
                            </div>
                          </div>
                        )}

                        <div className={`font-mono text-[13px] text-outline mb-3.5 flex items-center justify-between ${selectMode ? 'pl-6' : ''}`}>
                          <span>{new Date(ws.createdAt).toLocaleDateString('zh-CN')}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="bg-surface-container-low text-on-surface-variant px-2 py-0.5 rounded-none text-[12px] border border-outline-variant/55">
                              {ws.genre}
                            </span>
                            {!selectMode && (
                              <button
                                onClick={e => void handleUnfavorite(e, ws)}
                                className="text-secondary hover:text-outline transition-colors cursor-pointer"
                                title="取消收藏"
                              >
                                <Star size={17} fill="currentColor" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex-1">
                          <div className="flex flex-wrap gap-2 mb-4">
                            {ws.words.length > 0 ? ws.words.map((w, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 bg-surface-container-lowest text-on-surface font-headline font-bold text-sm rounded-none border border-outline-variant/65 cursor-default"
                                title={w.explanation || undefined}
                              >
                                {w.text}
                                {w.explanation && <span className="ml-1 font-mono text-outline text-[12px]">*</span>}
                              </span>
                            )) : (
                              <span className="text-on-surface-variant italic text-xs">空的词组</span>
                            )}
                          </div>
                        </div>

                        {!selectMode && (
                          <button
                            onClick={() => handleUsePrompt(ws)}
                            className="w-full mt-2 pt-2.5 border-t border-dashed border-outline-variant/60 text-primary hover:text-primary-dim font-label text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Pencil size={13} />
                            <span>铺入打字机开始创作 →</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
