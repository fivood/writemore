import { useEffect, useState, useMemo } from 'react';
import { db } from '../db';
import { useStore } from '../store';
import type { Draft, WordSet } from '../types';

interface HistoryItem {
  draft: Draft;
  wordSet?: WordSet;
}

type SortMode = 'date' | 'words';
type ViewMode = 'grid' | 'calendar';

// Build a calendar heatmap for the past ~6 months
function CalendarHeatmap({ items }: { items: HistoryItem[] }) {
  const today = new Date();
  const totalWeeks = 26; // ~6 months
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (totalWeeks * 7 - 1) - startDate.getDay());

  // Build day -> word count map
  const dayMap = useMemo(() => {
    const map = new Map<string, { count: number; totalWords: number }>();
    items.forEach(({ draft }) => {
      const key = new Date(draft.updatedAt).toISOString().slice(0, 10);
      const prev = map.get(key) || { count: 0, totalWords: 0 };
      map.set(key, { count: prev.count + 1, totalWords: prev.totalWords + draft.wordCount });
    });
    return map;
  }, [items]);

  // Generate weeks grid
  const weeks: Date[][] = [];
  const cursor = new Date(startDate);
  for (let w = 0; w < totalWeeks; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  const getIntensity = (count: number) => {
    if (count === 0) return 'bg-surface-container-high';
    if (count === 1) return 'bg-amber-200 dark:bg-primary/30';
    if (count <= 3) return 'bg-amber-400 dark:bg-primary/60';
    return 'bg-amber-600 dark:bg-primary';
  };

  const monthLabels: { label: string; col: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, i) => {
    const m = week[0].getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ label: `${m + 1}月`, col: i });
      lastMonth = m;
    }
  });

  const dayLabels = ['', '一', '', '三', '', '五', ''];

  return (
    <div className="bg-surface-container p-5 rounded-xl border border-outline-variant/15 mb-6">
      <div className="flex items-center space-x-2 mb-4">
        <span className="material-symbols-outlined text-[20px] text-primary">calendar_month</span>
        <span className="font-label text-sm font-semibold text-on-surface">写作日历</span>
        <span className="text-outline text-xs font-label ml-2">近 6 个月</span>
      </div>
      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-0.5 min-w-max">
          {/* Month labels */}
          <div className="flex ml-7 mb-1">
            {monthLabels.map((m, i) => (
              <span
                key={i}
                className="text-[12px] font-label text-outline absolute-ish"
                style={{ marginLeft: m.col === 0 ? 0 : `${(m.col - (i > 0 ? monthLabels[i - 1].col : 0)) * 13 - 13}px` }}
              >
                {m.label}
              </span>
            ))}
          </div>
          {/* Grid */}
          <div className="flex gap-0.5">
            {/* Day labels */}
            <div className="flex flex-col gap-0.5 mr-1">
              {dayLabels.map((label, i) => (
                <div key={i} className="w-5 h-[11px] flex items-center justify-end">
                  <span className="text-[14px] font-label text-on-surface-variant">{label}</span>
                </div>
              ))}
            </div>
            {/* Weeks */}
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {week.map((day, di) => {
                  const key = day.toISOString().slice(0, 10);
                  const todayKey = today.toISOString().slice(0, 10);
                  const data = dayMap.get(key);
                  const isFuture = day > today;
                  return (
                    <div
                      key={di}
                      className={`w-[11px] h-[11px] rounded-[2px] transition-colors ${
                        isFuture ? 'bg-transparent' : getIntensity(data?.count || 0)
                      } ${key === todayKey ? 'ring-1 ring-primary ring-offset-1' : ''}`}
                      title={isFuture ? '' : `${day.getMonth() + 1}月${day.getDate()}日${data ? ` · ${data.count}篇 · ${data.totalWords}字` : ' · 无记录'}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="flex items-center justify-end mt-2 space-x-1">
            <span className="text-[14px] font-label text-on-surface-variant mr-1">少</span>
            <div className="w-[11px] h-[11px] rounded-[2px] bg-surface-container-high" />
            <div className="w-[11px] h-[11px] rounded-[2px] bg-amber-200 dark:bg-primary/30" />
            <div className="w-[11px] h-[11px] rounded-[2px] bg-amber-400 dark:bg-primary/60" />
            <div className="w-[11px] h-[11px] rounded-[2px] bg-amber-600 dark:bg-primary" />
            <span className="text-[14px] font-label text-on-surface-variant ml-1">多</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const store = useStore();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    try {
      const drafts = await db.drafts.orderBy('updatedAt').reverse().toArray();
      const items: HistoryItem[] = [];
      for (const draft of drafts) {
        const wordSet = draft.wordSetId ? await db.wordSets.get(draft.wordSetId) : undefined;
        items.push({ draft, wordSet });
      }
      setHistory(items);
    } catch (e) {
      console.error('Failed to load history', e);
    } finally {
      setLoading(false);
    }
  }

  // Stats
  const stats = useMemo(() => {
    const totalDrafts = history.length;
    const totalWords = history.reduce((sum, h) => sum + h.draft.wordCount, 0);
    const avgWords = totalDrafts > 0 ? Math.round(totalWords / totalDrafts) : 0;
    // Unique writing days
    const days = new Set(history.map(h => new Date(h.draft.updatedAt).toISOString().slice(0, 10)));
    return { totalDrafts, totalWords, avgWords, writingDays: days.size };
  }, [history]);

  // Filtered & sorted
  const displayed = useMemo(() => {
    let result = history;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(h =>
        h.draft.title.toLowerCase().includes(q) ||
        h.draft.content.toLowerCase().includes(q) ||
        h.wordSet?.words.some(w => w.text.toLowerCase().includes(q))
      );
    }

    if (sortMode === 'words') {
      result = [...result].sort((a, b) => b.draft.wordCount - a.draft.wordCount);
    }

    return result;
  }, [history, searchQuery, sortMode]);

  const handleOpenDraft = (item: HistoryItem) => {
    if (selectMode) return;
    store.setEditorTitle(item.draft.title);
    store.setEditorContent(item.draft.content);
    store.setCurrentDraftId(item.draft.id);
    store.setCurrentWordSetId(item.draft.wordSetId);
    if (item.wordSet) {
      store.setCurrentWords(item.wordSet.words);
    }
    store.setActiveTab('inspire');
  };

  const handleDelete = async (e: React.MouseEvent, draftId: string) => {
    e.stopPropagation();
    if (confirm('确定要删除这篇草稿吗？此操作无法撤销。')) {
      await db.drafts.delete(draftId);
      setHistory(prev => prev.filter(h => h.draft.id !== draftId));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 篇草稿吗？此操作无法撤销。`)) return;
    for (const id of selectedIds) {
      await db.drafts.delete(id);
    }
    setHistory(prev => prev.filter(h => !selectedIds.has(h.draft.id)));
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  const handleBatchExport = () => {
    if (selectedIds.size === 0) return;
    const selected = history.filter(h => selectedIds.has(h.draft.id));
    selected.forEach(item => {
      const title = item.draft.title || '未命名灵感';
      const wordsLine = item.wordSet?.words.length
        ? `> 灵感词条：${item.wordSet.words.map(w => w.text).join(' · ')}\n\n`
        : '';
      const content = `# ${title}\n\n${wordsLine}${item.draft.content}`;
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.md`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <main className="flex-1 bg-surface relative overflow-y-auto p-8 md:p-12">
      <div className="max-w-5xl mx-auto pb-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-headline text-3xl font-black text-on-surface flex items-center space-x-3">
            <span className="material-symbols-outlined text-[34px] text-primary">history</span>
            <span>写作历史</span>
          </h2>
          <div className="flex items-center space-x-2">
            {history.length > 0 && (
              <>
                {/* View toggle */}
                <div className="flex bg-surface-container rounded-lg border border-outline-variant/30 overflow-hidden mr-2">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-primary text-white' : 'text-outline hover:bg-surface-container-high'}`}
                    title="卡片视图"
                  >
                    <span className="material-symbols-outlined text-[18px]">grid_view</span>
                  </button>
                  <button
                    onClick={() => setViewMode('calendar')}
                    className={`p-2 transition-colors ${viewMode === 'calendar' ? 'bg-primary text-white' : 'text-outline hover:bg-surface-container-high'}`}
                    title="日历视图"
                  >
                    <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                  </button>
                </div>
                <button
                  onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
                  className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-label font-medium transition-all ${selectMode ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
                >
                  <span className="material-symbols-outlined text-[18px]">{selectMode ? 'close' : 'checklist'}</span>
                  <span>{selectMode ? '退出选择' : '批量管理'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stats bar */}
        {history.length > 0 && (
          <div className="flex items-center flex-wrap gap-4 mb-6 p-4 bg-surface-container-low/60 rounded-xl border border-outline-variant/15">
            <div className="flex items-center space-x-2 text-sm font-label text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px] text-primary">description</span>
              <span className="font-bold text-on-surface">{stats.totalDrafts}</span>
              <span>篇草稿</span>
            </div>
            <div className="h-4 w-px bg-outline-variant/30" />
            <div className="flex items-center space-x-2 text-sm font-label text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px] text-amber-500">edit_note</span>
              <span className="font-bold text-on-surface">{stats.totalWords.toLocaleString()}</span>
              <span>总字数</span>
            </div>
            <div className="h-4 w-px bg-outline-variant/30" />
            <div className="flex items-center space-x-2 text-sm font-label text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px] text-green-500">avg_pace</span>
              <span className="font-bold text-on-surface">{stats.avgWords}</span>
              <span>字/篇</span>
            </div>
            <div className="h-4 w-px bg-outline-variant/30" />
            <div className="flex items-center space-x-2 text-sm font-label text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px] text-purple-500">event_available</span>
              <span className="font-bold text-on-surface">{stats.writingDays}</span>
              <span>个写作日</span>
            </div>
          </div>
        )}

        {/* Calendar heatmap */}
        {viewMode === 'calendar' && history.length > 0 && (
          <CalendarHeatmap items={history} />
        )}

        {/* Search & Sort toolbar */}
        {history.length > 0 && (
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
              <input
                type="text"
                placeholder="搜索标题、内容或词条..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container rounded-lg border border-outline-variant/30 text-sm font-label text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>
            <div className="flex bg-surface-container rounded-lg border border-outline-variant/30 overflow-hidden">
              <button
                onClick={() => setSortMode('date')}
                className={`px-3 py-2 text-[13px] font-label font-medium transition-colors flex items-center space-x-1 ${sortMode === 'date' ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
              >
                <span className="material-symbols-outlined text-[16px]">schedule</span>
                <span>最新</span>
              </button>
              <button
                onClick={() => setSortMode('words')}
                className={`px-3 py-2 text-[13px] font-label font-medium transition-colors flex items-center space-x-1 ${sortMode === 'words' ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
              >
                <span className="material-symbols-outlined text-[16px]">sort</span>
                <span>字数</span>
              </button>
            </div>
          </div>
        )}

        {/* Batch action bar */}
        {selectMode && selectedIds.size > 0 && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-primary/10 border border-amber-200 dark:border-primary/20 rounded-lg flex items-center justify-between">
            <span className="text-sm font-label text-amber-800 dark:text-primary">
              已选择 <span className="font-bold">{selectedIds.size}</span> 篇草稿
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleBatchExport}
                className="flex items-center space-x-1 px-4 py-1.5 bg-primary text-white text-xs font-label font-medium rounded-md hover:bg-primary-dim transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                <span>批量导出 .md</span>
              </button>
              <button
                onClick={handleBatchDelete}
                className="flex items-center space-x-1 px-4 py-1.5 bg-red-500 text-white text-xs font-label font-medium rounded-md hover:bg-red-600 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                <span>批量删除</span>
              </button>
            </div>
          </div>
        )}

        {/* Main content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            <p className="mt-4 text-on-surface-variant text-sm font-label">加载中...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-24 bg-surface-container-low/50 rounded-2xl border border-dashed border-outline-variant/30">
            <span className="material-symbols-outlined text-5xl text-outline mb-4">menu_book</span>
            <p className="text-on-surface-variant font-label text-lg mb-1">还没有写作记录</p>
            <p className="text-on-surface-variant text-sm mt-2 max-w-sm mx-auto leading-relaxed">
              去「✦ 词条」页面抽取灵感，写下你的第一个故事吧！
            </p>
            <button
              className="mt-8 px-8 py-3 bg-primary text-white hover:bg-[#7c442d] transition-colors rounded-lg font-label text-sm font-medium custom-shadow"
              onClick={() => store.setActiveTab('inspire')}
            >
              开始创作
            </button>
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-4xl text-outline mb-4">search_off</span>
            <p className="text-on-surface-variant font-label">
              没有找到包含「<span className="font-medium text-primary">{searchQuery}</span>」的记录
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {displayed.map((item) => (
              <div
                key={item.draft.id}
                onClick={() => selectMode ? toggleSelect(item.draft.id) : handleOpenDraft(item)}
                className={`bg-surface-container p-5 rounded-xl border hover:border-primary/30 cursor-pointer group transition-all duration-300 hover:-translate-y-0.5 relative flex flex-col ${
                  selectMode && selectedIds.has(item.draft.id) ? 'border-primary ring-2 ring-primary/20' : 'border-outline-variant/15'
                }`}
              >
                {/* Select checkbox */}
                {selectMode && (
                  <div className="absolute top-3 left-3 z-10">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      selectedIds.has(item.draft.id) ? 'bg-primary border-primary text-white' : 'border-outline bg-surface-container'
                    }`}>
                      {selectedIds.has(item.draft.id) && <span className="material-symbols-outlined text-[16px]">check</span>}
                    </div>
                  </div>
                )}

                {/* Delete button (non-select mode) */}
                {!selectMode && (
                  <button
                    onClick={(e) => handleDelete(e, item.draft.id)}
                    className="absolute top-3 right-3 text-outline hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    title="删除草稿"
                  >
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                  </button>
                )}

                {/* Meta */}
                <div className={`text-xs font-label text-outline mb-3 flex items-center justify-between ${selectMode ? 'pl-7' : 'pr-8'}`}>
                  <span>{new Date(item.draft.updatedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="text-[12px] tracking-wider uppercase bg-surface-container-high px-2 py-0.5 rounded text-on-surface-variant font-medium">
                    {item.draft.wordCount} 字
                  </span>
                </div>

                {/* Title */}
                <h3 className="font-headline text-lg font-bold text-on-surface mb-2 group-hover:text-primary transition-colors truncate">
                  {item.draft.title || '未命名灵感'}
                </h3>

                {/* Preview */}
                <p className="text-on-surface-variant text-sm line-clamp-3 mb-4 min-h-[54px] leading-relaxed flex-1">
                  {item.draft.content ? item.draft.content.replace(/[#*>_`\[\]]/g, '').slice(0, 150) : '没有任何内容...'}
                </p>

                {/* Word chips */}
                {item.wordSet && item.wordSet.words.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-3 border-t border-outline-variant/10">
                    {item.wordSet.words.map((w, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-surface-container-high text-on-surface-variant text-[12px] rounded border border-outline-variant/20 font-label font-medium flex items-center space-x-1">
                        <span className="material-symbols-outlined text-[12px] opacity-60">tag</span>
                        <span>{w.text}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
