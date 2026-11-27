import { useEffect, useState, useMemo } from 'react';
import {
  Calendar, History, LayoutGrid, Download, X, ListChecks, Search, Clock,
  ArrowUpDown, Trash2, BookOpen, SearchX, Check, Save, ArrowUpRight,
} from 'lucide-react';
import { db } from '../db';
import { useStore } from '../store';
import type { Draft, WordSet } from '../types';
import { isGhostDreamDraft } from '../lib/drafts';
import { dayKey, downloadText } from '../lib/util';

interface HistoryItem {
  draft: Draft;
  wordSet?: WordSet;
}

type SortMode = 'date' | 'words';
type ViewMode = 'grid' | 'calendar';

/** 近 6 个月松烟墨 × 朱砂色带打卡日历热力图 */
function CalendarHeatmap({ items }: { items: HistoryItem[] }) {
  const today = new Date();
  const totalWeeks = 26;
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (totalWeeks - 1) * 7 - startDate.getDay());

  const dayMap = useMemo(() => {
    const map = new Map<string, { count: number; totalWords: number }>();
    items.forEach(({ draft }) => {
      const key = dayKey(draft.updatedAt);
      const prev = map.get(key) || { count: 0, totalWords: 0 };
      map.set(key, { count: prev.count + 1, totalWords: prev.totalWords + draft.wordCount });
    });
    return map;
  }, [items]);

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
    if (count === 0) return 'bg-surface-container-high/80';
    if (count === 1) return 'bg-secondary/35';
    if (count <= 3) return 'bg-secondary/75';
    return 'bg-primary';
  };

  const monthLabels: { label: string; col: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, i) => {
    const m = week[0].getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ label: `${String(m + 1).padStart(2, '0')}月`, col: i });
      lastMonth = m;
    }
  });

  const dayLabels = ['', '一', '', '三', '', '五', ''];

  return (
    <div className="index-card paper-grain p-5 rounded-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-primary" />
          <span className="font-headline text-sm font-bold text-on-surface">写作日历</span>
          <span className="font-label text-xs text-outline ml-1">近半年</span>
        </div>
        <div className="flex items-center gap-1 font-label text-xs text-outline">
          <span className="mr-1">少</span>
          <div className="w-[11px] h-[11px] bg-surface-container-high/80" />
          <div className="w-[11px] h-[11px] bg-secondary/35" />
          <div className="w-[11px] h-[11px] bg-secondary/75" />
          <div className="w-[11px] h-[11px] bg-primary" />
          <span className="ml-1">多</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-1 min-w-max">
          <div className="flex ml-6 mb-0.5">
            {monthLabels.map((m, i) => (
              <span
                key={i}
                className="font-mono text-[10px] text-outline"
                style={{ marginLeft: m.col === 0 ? 0 : `${(m.col - (i > 0 ? monthLabels[i - 1].col : 0)) * 14 - 22}px` }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className="flex gap-[3px]">
            <div className="flex flex-col gap-[3px] mr-1">
              {dayLabels.map((label, i) => (
                <div key={i} className="w-4 h-[11px] flex items-center justify-end">
                  <span className="text-[10px] font-label text-outline">{label}</span>
                </div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((day, di) => {
                  const key = dayKey(day);
                  const todayKey = dayKey(today);
                  const data = dayMap.get(key);
                  const isFuture = day > today;
                  return (
                    <div
                      key={di}
                      className={`w-[11px] h-[11px] transition-colors ${
                        isFuture ? 'bg-transparent' : getIntensity(data?.count || 0)
                      } ${key === todayKey ? 'ring-1 ring-primary ring-offset-1 ring-offset-background' : ''}`}
                      title={isFuture ? '' : `${day.getMonth() + 1}月${day.getDate()}日${data ? ` · ${data.count}篇 · ${data.totalWords}字` : ' · 无记录'}`}
                    />
                  );
                })}
              </div>
            ))}
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
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewItem, setPreviewItem] = useState<HistoryItem | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewContent, setPreviewContent] = useState('');
  const [previewSaving, setPreviewSaving] = useState(false);
  const [previewSavedHint, setPreviewSavedHint] = useState(false);

  const hasPreviewChanges = !!previewItem && (
    previewTitle !== (previewItem.draft.title || '') ||
    previewContent !== (previewItem.draft.content || '')
  );

  useEffect(() => {
    void fetchHistory();
  }, []);

  async function fetchHistory() {
    try {
      const drafts = await db.drafts.orderBy('updatedAt').reverse().toArray();
      const items: HistoryItem[] = [];
      for (const draft of drafts) {
        if (isGhostDreamDraft(draft)) continue;
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

  const stats = useMemo(() => {
    const totalDrafts = history.length;
    const totalWords = history.reduce((sum, h) => sum + h.draft.wordCount, 0);
    const avgWords = totalDrafts > 0 ? Math.round(totalWords / totalDrafts) : 0;
    const days = new Set(history.map(h => dayKey(h.draft.updatedAt)));
    return { totalDrafts, totalWords, avgWords, writingDays: days.size };
  }, [history]);

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

  const loadDraftToEditor = (item: HistoryItem, overrideTitle?: string, overrideContent?: string) => {
    store.setEditorTitle(overrideTitle ?? item.draft.title);
    store.setEditorContent(overrideContent ?? item.draft.content);
    store.setCurrentDraftId(item.draft.id);
    store.setCurrentWordSetId(item.draft.wordSetId);
    if (item.wordSet) {
      store.setCurrentWords(item.wordSet.words);
    }
    store.setWritingMode(item.draft.writingMode || (item.wordSet?.words.length ? 'words' : 'free'));
    store.setActiveTab('inspire');
  };

  const handleOpenDraft = (item: HistoryItem) => {
    if (selectMode) return;
    setPreviewItem(item);
    setPreviewTitle(item.draft.title || '');
    setPreviewContent(item.draft.content || '');
  };

  async function handleSavePreview() {
    if (!previewItem || previewSaving) return;
    setPreviewSaving(true);
    try {
      const title = previewTitle.trim() || '未命名灵感';
      const content = previewContent;
      const updatedAt = new Date();
      const wordCount = content.replace(/\s+/g, '').length;

      await db.drafts.update(previewItem.draft.id, { title, content, wordCount, updatedAt });
      setHistory(prev => prev.map(it => it.draft.id === previewItem.draft.id
        ? { ...it, draft: { ...it.draft, title, content, wordCount, updatedAt } }
        : it));
      setPreviewItem(prev => prev ? { ...prev, draft: { ...prev.draft, title, content, wordCount, updatedAt } } : prev);
      setPreviewSavedHint(true);
      setTimeout(() => setPreviewSavedHint(false), 1500);
    } catch (e) {
      console.error('Failed to save preview draft', e);
    } finally {
      setPreviewSaving(false);
    }
  }

  function closePreview() {
    if (hasPreviewChanges && !confirm('当前有未保存修改，确定关闭吗？')) return;
    setPreviewItem(null);
  }

  useEffect(() => {
    if (!previewItem) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSavePreview();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closePreview();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewItem, previewTitle, previewContent, previewSaving]);

  const handleDelete = async (e: React.MouseEvent, draftId: string) => {
    e.stopPropagation();
    if (confirm('确定要彻底删除这篇草稿吗？此操作无法撤销。')) {
      await db.drafts.delete(draftId);
      setHistory(prev => prev.filter(h => h.draft.id !== draftId));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要彻底删除选中的 ${selectedIds.size} 篇草稿吗？此操作无法撤销。`)) return;
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
      downloadText(`${title}.md`, content);
    });
  };

  function handleExportAll() {
    if (history.length === 0) return;
    const lines: string[] = [`# WriteMore 写作历史导出`, `导出时间：${new Date().toLocaleString('zh-CN')}`, `共 ${history.length} 篇草稿 ｜ 累计 ${stats.totalWords.toLocaleString()} 字`, '', '---', ''];
    history.forEach((item, i) => {
      const title = item.draft.title || '未命名灵感';
      const date = new Date(item.draft.updatedAt).toLocaleString('zh-CN');
      const mode = item.draft.writingMode || 'words';
      const wordsLine = item.wordSet?.words.length
        ? `**灵感词条**：${item.wordSet.words.map(w => w.text).join(' · ')}\n\n`
        : '';
      lines.push(`## ${i + 1}. ${title}`);
      lines.push('');
      lines.push(`> 模式：${mode} ｜ 更新：${date} ｜ 字数：${item.draft.wordCount}`);
      lines.push('');
      if (wordsLine) lines.push(wordsLine);
      lines.push(item.draft.content || '（无内容）');
      lines.push('', '---', '');
    });
    downloadText(`writemore_history_${dayKey()}.md`, lines.join('\n'));
  }

  return (
    <main className="flex-1 relative overflow-y-auto p-4 md:p-8 lg:p-12">
      <div className="max-w-5xl mx-auto pb-20">
        {/* 报刊版头 */}
        <div className="broadsheet-masthead-rule py-4 mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="font-headline text-2xl md:text-3xl font-bold text-on-surface flex items-center gap-2.5">
              <History size={24} className="text-primary" />
              <span>写作历史</span>
            </h2>
          </div>

          {history.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-surface-container rounded-sm border border-outline-variant/60 overflow-hidden">
                <button
                  onClick={() => setViewMode('calendar')}
                  className={`px-2.5 py-1.5 transition-colors cursor-pointer flex items-center gap-1 text-xs font-label ${
                    viewMode === 'calendar' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                  title="展开台历热力图"
                >
                  <Calendar size={14} />
                  <span>台历</span>
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-2.5 py-1.5 transition-colors cursor-pointer flex items-center gap-1 text-xs font-label ${
                    viewMode === 'grid' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                  title="仅看卡片"
                >
                  <LayoutGrid size={14} />
                  <span>纯列表</span>
                </button>
              </div>

              <button
                onClick={handleExportAll}
                title="导出全部为 Markdown"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container border border-outline-variant/60 rounded-sm text-xs font-label text-on-surface-variant hover:border-secondary hover:text-on-surface transition-colors cursor-pointer"
              >
                <Download size={14} />
                <span className="hidden sm:inline">导出全集</span>
              </button>

              <button
                onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-label font-medium border transition-colors cursor-pointer ${
                  selectMode
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-surface-container text-on-surface-variant border-outline-variant/60 hover:border-secondary'
                }`}
              >
                {selectMode ? <X size={14} /> : <ListChecks size={14} />}
                <span>{selectMode ? '退出选择' : '批量管理'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Stats Strip */}
        {history.length > 0 && (
          <div className="broadsheet-frame grid grid-cols-2 sm:grid-cols-4 mb-6 bg-surface-container/60">
            {[
              { label: '累计手稿', value: stats.totalDrafts, unit: '篇' },
              { label: '累计字数', value: stats.totalWords.toLocaleString(), unit: '字' },
              { label: '篇均字数', value: stats.avgWords, unit: '字' },
              { label: '动笔天数', value: stats.writingDays, unit: '天' },
            ].map((stat, idx) => (
              <div key={stat.label} className={`px-4 py-3 ${idx < 3 ? 'border-b sm:border-b-0 sm:border-r border-on-surface/20' : ''}`}>
                <p className="font-label text-xs text-outline">{stat.label}</p>
                <p className="font-headline text-xl font-bold text-on-surface mt-1">
                  {stat.value} <span className="font-label text-xs font-normal text-outline">{stat.unit}</span>
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Calendar heatmap */}
        {viewMode === 'calendar' && history.length > 0 && (
          <CalendarHeatmap items={history} />
        )}

        {/* Search & Sort toolbar */}
        {history.length > 0 && (
          <div className="flex items-center gap-2.5 mb-6">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
              <input
                type="text"
                placeholder="检索历史手稿标题、内容或词条…"
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
                <span>最新</span>
              </button>
              <button
                onClick={() => setSortMode('words')}
                className={`px-3 py-2 text-xs font-label font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  sortMode === 'words' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <ArrowUpDown size={13} />
                <span>字数</span>
              </button>
            </div>
          </div>
        )}

        {/* Batch action bar */}
        {selectMode && selectedIds.size > 0 && (
          <div className="mb-5 px-4 py-2.5 bg-primary-container/35 border border-primary/40 rounded-sm flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs text-on-surface">
              SELECTED <strong className="text-primary">{selectedIds.size}</strong> MANUSCRIPTS
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBatchExport}
                className="flex items-center gap-1 px-3 py-1 bg-primary text-on-primary text-xs font-label font-medium rounded-sm hover:bg-primary-dim transition-colors cursor-pointer"
              >
                <Download size={13} />
                <span>批量导出 .md</span>
              </button>
              <button
                onClick={() => void handleBatchDelete()}
                className="flex items-center gap-1 px-3 py-1 bg-error text-on-error text-xs font-label font-medium rounded-sm hover:opacity-90 transition-opacity cursor-pointer"
              >
                <Trash2 size={13} />
                <span>批量删除</span>
              </button>
            </div>
          </div>
        )}

        {/* Main content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-7 h-7 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <p className="mt-4 text-on-surface-variant text-xs font-mono uppercase tracking-widest">LOADING…</p>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-24 index-card paper-grain rounded-sm border-dashed">
            <BookOpen size={38} className="text-outline mx-auto mb-4" />
            <p className="text-on-surface font-headline text-lg font-bold mb-1">编年历尚无记录</p>
            <p className="text-on-surface-variant font-body text-sm mt-2 max-w-sm mx-auto leading-relaxed">
              当你在打字机上敲下并保存第一篇手稿后，你的每日字迹便会在此生根。
            </p>
            <button
              className="mt-6 px-6 py-2.5 bg-primary text-on-primary hover:bg-primary-dim transition-colors rounded-sm font-label text-xs font-semibold uppercase tracking-wider cursor-pointer"
              onClick={() => store.setActiveTab('inspire')}
            >
              开始创作 →
            </button>
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16">
            <SearchX size={36} className="text-outline mx-auto mb-3" />
            <p className="text-on-surface-variant font-label text-sm">
              没有找到包含「<span className="font-medium text-primary">{searchQuery}</span>」的记录
            </p>
          </div>
        ) : (
          <div className="broadsheet-frame grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {displayed.map(item => {
              const selected = selectMode && selectedIds.has(item.draft.id);
              return (
                <div
                  key={item.draft.id}
                  onClick={() => selectMode ? toggleSelect(item.draft.id) : handleOpenDraft(item)}
                  className={`bg-surface-container/65 hover:bg-surface-container p-5 border-b border-r border-on-surface/20 cursor-pointer group relative flex flex-col transition-colors ${
                    selected ? 'palace-selected-frame z-10' : ''
                  }`}
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

                  {!selectMode && (
                    <button
                      onClick={e => void handleDelete(e, item.draft.id)}
                      className="absolute top-3.5 right-3.5 text-outline hover:text-error opacity-0 group-hover:opacity-100 transition-opacity p-1 cursor-pointer"
                      title="彻底删除草稿"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}

                  <div className={`font-label text-xs text-outline mb-3 flex items-center justify-between ${selectMode ? 'pl-6' : 'pr-7'}`}>
                    <span>{new Date(item.draft.updatedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="px-1.5 py-0.5 bg-surface-container-low rounded-none border border-outline-variant/50 text-on-surface-variant">
                      {item.draft.wordCount} 字
                    </span>
                  </div>

                  <h3 className="font-headline text-lg font-bold text-on-surface mb-2 group-hover:text-primary transition-colors truncate">
                    {item.draft.title || '未命名灵感'}
                  </h3>

                  <p className="font-body text-on-surface-variant text-sm line-clamp-3 mb-4 min-h-[54px] leading-relaxed flex-1">
                    {item.draft.content ? item.draft.content.replace(/[#*>_`[\]]/g, '').slice(0, 150) : '空白手稿…'}
                  </p>

                  {item.wordSet && item.wordSet.words.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-3 border-t border-dashed border-outline-variant/55">
                      {item.wordSet.words.map((w, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-surface-container-lowest text-on-surface-variant text-[11px] rounded-none border border-outline-variant/55 font-headline">
                          {w.text}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {previewItem && (
        <div className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={closePreview}>
          <div className="w-full max-w-4xl max-h-[90vh] manuscript-sheet paper-grain rounded-sm flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-3.5 border-b border-dashed border-outline-variant/65 bg-surface-container-low/50">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-widest text-outline">MANUSCRIPT ARCHIVE · 审阅与批改</p>
                <p className="font-mono text-xs text-on-surface-variant mt-0.5">{new Date(previewItem.draft.updatedAt).toLocaleString('zh-CN')}</p>
              </div>
              <button className="p-1.5 rounded-sm text-outline hover:text-on-surface hover:bg-surface-container cursor-pointer" onClick={closePreview}>
                <X size={18} />
              </button>
            </div>

            <div className="p-6 md:p-8 overflow-y-auto flex-1 space-y-4">
              <input
                value={previewTitle}
                onChange={e => setPreviewTitle(e.target.value)}
                placeholder="手稿标题"
                className="w-full bg-transparent border-none focus:ring-0 font-headline text-2xl md:text-3xl font-bold text-on-surface placeholder:text-outline/50 outline-none"
              />
              <textarea
                value={previewContent}
                onChange={e => setPreviewContent(e.target.value)}
                placeholder="正文内容…"
                className="w-full min-h-[48vh] bg-surface-container/60 border border-outline-variant/50 rounded-sm p-4 font-body text-base leading-[1.9] text-on-surface placeholder:text-outline focus:outline-none focus:border-primary/60"
              />
            </div>

            <div className="px-6 py-3.5 border-t border-dashed border-outline-variant/65 bg-surface-container-low/40 flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-xs text-on-surface-variant">
                CHARS: {previewContent.replace(/\s+/g, '').length}
                {previewSavedHint && <span className="ml-2 text-tertiary font-label font-semibold">· 已保存</span>}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void handleSavePreview()}
                  disabled={previewSaving || !hasPreviewChanges}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-sm bg-primary text-on-primary text-xs font-label font-medium hover:bg-primary-dim transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Save size={14} />
                  <span>{previewSaving ? '保存中…' : '保存修改'}</span>
                </button>
                <button
                  onClick={() => {
                    loadDraftToEditor(previewItem, previewTitle.trim() || '未命名灵感', previewContent);
                    setPreviewItem(null);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-sm border border-outline-variant/65 text-xs font-label text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
                >
                  <ArrowUpRight size={14} />
                  <span>铺入打字机继续写</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
