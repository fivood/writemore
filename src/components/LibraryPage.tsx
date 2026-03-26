import { useState, useMemo, useRef } from 'react';
import { getAllWords, addUserWord, updateUserWord, deleteUserWord, toggleWordEnabled } from '../data/wordEngine';
import type { Word, Genre, WordCategory } from '../types';
import { WORD_CATEGORIES, CATEGORY_META } from '../types';

type ViewFilter = 'all' | 'builtin' | 'user';

const CATEGORY_OPTIONS: (WordCategory | 'all')[] = ['all', ...WORD_CATEGORIES];

const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  WORD_CATEGORIES.map(c => [c, CATEGORY_META[c]?.color ?? 'bg-stone-100 text-stone-600 border-stone-200'])
);
CATEGORY_COLORS['all'] = 'bg-stone-100 text-stone-600 border-stone-200';

interface EditingWord {
  id?: string;
  text: string;
  explanation: string;
  category: WordCategory;
  genres: Genre[];
}

// ── Import types ──
interface ParsedImportItem {
  text: string;
  explanation: string;
  category: string;        // raw string from file, may be a new category
}

type ImportItemStatus = 'new' | 'duplicate' | 'conflict';

interface ImportPreviewItem {
  parsed: ParsedImportItem;
  status: ImportItemStatus;
  existingWord?: Word;     // the matching existing word if duplicate/conflict
  selected: boolean;       // user can toggle
  resolvedCategory: string; // final category to use (may be overridden)
}

// ── MD parser ──
// Format: [分类]（词语）：（释义）  OR  [分类](词语):(释义)  OR  [分类] 词语：释义
// Also tolerates missing brackets on explanation and half/full-width punctuation
function parseMdImport(content: string): ParsedImportItem[] {
  const items: ParsedImportItem[] = [];
  const lines = content.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('//') || line.startsWith('---')) continue;

    // Try multiple patterns from most specific to most lenient

    // Pattern 1: [分类]（词语）：（释义）  (full-width parens & colon)
    // Pattern 2: [分类](词语):(释义)       (half-width)
    // Pattern 3: [分类]（词语）:（释义）    (mixed)
    const regexes = [
      /^\[([^\]]+)\][（(]([^）)]+)[）)][：:][（(]([^）)]*)[）)]$/,   // full brackets
      /^\[([^\]]+)\][（(]([^）)]+)[）)][：:](.*)$/,                  // bracket word, plain explanation
      /^\[([^\]]+)\]\s*([^\s：:]+)\s*[：:]\s*(.*)$/,                 // [分类] 词语：释义
    ];

    let matched = false;
    for (const re of regexes) {
      const m = line.match(re);
      if (m) {
        const genre = m[1].trim();
        const text = m[2].trim();
        const explanation = (m[3] || '').trim();
        if (text) {
          items.push({ text, explanation, category: genre });
          matched = true;
          break;
        }
      }
    }

    // Fallback: treat as plain word with no genre/explanation
    if (!matched && line.length > 0 && line.length <= 20 && !line.includes(' ')) {
      items.push({ text: line, explanation: '', category: '通用' });
    }
  }

  return items;
}

function parseJsonImport(content: string): ParsedImportItem[] {
  const data = JSON.parse(content);
  if (!Array.isArray(data)) throw new Error('Invalid JSON format');
  return data
    .filter((item: Record<string, unknown>) => item.text && typeof item.text === 'string')
    .map((item: Record<string, unknown>) => ({
      text: (item.text as string).trim(),
      explanation: ((item.explanation as string) || '').trim(),
      category: ((item.category as string) || (item.genre as string) || '意象').trim(),
    }));
}

// ── Import Preview Modal ──
function ImportPreviewModal({
  items,
  onConfirm,
  onClose,
}: {
  items: ImportPreviewItem[];
  onConfirm: (items: ImportPreviewItem[]) => void;
  onClose: () => void;
}) {
  const [previewItems, setPreviewItems] = useState(items);
  const KNOWN_CATEGORIES = new Set(WORD_CATEGORIES);

  const newWords = previewItems.filter(i => i.status === 'new');
  const duplicates = previewItems.filter(i => i.status === 'duplicate');
  const conflicts = previewItems.filter(i => i.status === 'conflict');
  const unknownCategories = [...new Set(previewItems.map(i => i.resolvedCategory).filter(c => !KNOWN_CATEGORIES.has(c)))];
  const selectedCount = previewItems.filter(i => i.selected).length;

  const toggleItem = (idx: number) => {
    setPreviewItems(prev => prev.map((item, i) => i === idx ? { ...item, selected: !item.selected } : item));
  };

  const toggleAll = (selected: boolean) => {
    setPreviewItems(prev => prev.map(item => ({ ...item, selected })));
  };

  const toggleByStatus = (status: ImportItemStatus, selected: boolean) => {
    setPreviewItems(prev => prev.map(item => item.status === status ? { ...item, selected } : item));
  };

  const updateCategory = (idx: number, category: string) => {
    setPreviewItems(prev => prev.map((item, i) => i === idx ? { ...item, resolvedCategory: category } : item));
  };

  const statusIcon = (s: ImportItemStatus) => {
    switch (s) {
      case 'new': return <span className="material-symbols-outlined text-[14px] text-green-500">add_circle</span>;
      case 'duplicate': return <span className="material-symbols-outlined text-[14px] text-amber-500">content_copy</span>;
      case 'conflict': return <span className="material-symbols-outlined text-[14px] text-red-500">warning</span>;
    }
  };

  const statusLabel = (s: ImportItemStatus) => {
    switch (s) {
      case 'new': return '新词条';
      case 'duplicate': return '重复';
      case 'conflict': return '分类不同';
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface-container rounded-2xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 pb-4 border-b border-outline-variant/15">
          <h3 className="font-headline text-xl font-bold text-on-surface flex items-center space-x-2 mb-4">
            <span className="material-symbols-outlined text-primary text-[24px]">file_download</span>
            <span>导入预览</span>
          </h3>

          {/* Summary pills */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => toggleByStatus('new', true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-label font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">add_circle</span>
              <span>新词条: {newWords.length}</span>
            </button>
            {duplicates.length > 0 && (
              <button
                onClick={() => toggleByStatus('duplicate', false)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-label font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">content_copy</span>
                <span>重复: {duplicates.length}</span>
              </button>
            )}
            {conflicts.length > 0 && (
              <button
                onClick={() => toggleByStatus('conflict', true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-label font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">warning</span>
                <span>分类冲突: {conflicts.length}</span>
              </button>
            )}
            {unknownCategories.length > 0 && (
              <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-label font-medium bg-purple-50 text-purple-700 border border-purple-200">
                <span className="material-symbols-outlined text-[14px]">new_label</span>
                <span>新分类: {unknownCategories.join('、')}</span>
              </div>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Select all / none */}
          <div className="flex items-center justify-between mb-3 px-2">
            <span className="text-xs font-label text-on-surface-variant">
              已选中 <span className="font-bold text-on-surface">{selectedCount}</span> / {previewItems.length}
            </span>
            <div className="flex space-x-2">
              <button onClick={() => toggleAll(true)} className="text-xs font-label text-primary hover:underline">全选</button>
              <button onClick={() => toggleAll(false)} className="text-xs font-label text-on-surface-variant hover:underline">全不选</button>
            </div>
          </div>

          <div className="space-y-1.5">
            {previewItems.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all ${
                  item.selected ? 'bg-surface-container-high border-outline-variant/30' : 'bg-surface-container/50 border-transparent opacity-50'
                }`}
              >
                {/* Checkbox */}
                <button onClick={() => toggleItem(idx)} className="shrink-0">
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                    item.selected ? 'bg-primary border-primary text-white' : 'border-outline bg-surface-container'
                  }`}>
                    {item.selected && <span className="material-symbols-outlined text-[12px]">check</span>}
                  </div>
                </button>

                {/* Status */}
                <div className="shrink-0 w-16 flex items-center space-x-1">
                  {statusIcon(item.status)}
                  <span className={`text-[10px] font-label font-medium ${
                    item.status === 'new' ? 'text-green-600' : item.status === 'duplicate' ? 'text-amber-600' : 'text-red-600'
                  }`}>{statusLabel(item.status)}</span>
                </div>

                {/* Category tag */}
                <span className={`shrink-0 px-1.5 py-0.5 text-[12px] font-label font-bold rounded border tracking-wider ${
                  CATEGORY_COLORS[item.resolvedCategory] || 'bg-purple-100 text-purple-700 border-purple-200'
                }`}>
                  <span className="material-symbols-outlined text-[12px] leading-none align-middle mr-0.5">{CATEGORY_META[item.resolvedCategory]?.icon ?? 'label'}</span>{item.resolvedCategory}
                </span>

                {/* Word text */}
                <span className="font-headline text-sm font-bold text-on-surface truncate min-w-0">{item.parsed.text}</span>

                {/* Explanation */}
                {item.parsed.explanation && (
                  <span className="text-[11px] text-stone-400 dark:text-on-surface-variant truncate min-w-0 flex-1">{item.parsed.explanation}</span>
                )}

                {/* Conflict info */}
                {item.status === 'conflict' && item.existingWord && (
                  <div className="shrink-0 flex items-center space-x-1">
                    <span className="text-[10px] text-stone-400 font-label">现有:</span>
                    <span className={`px-1.5 py-0.5 text-[12px] font-label font-bold rounded border tracking-wider ${CATEGORY_COLORS[item.existingWord.category] || 'bg-stone-100 text-stone-600 border-stone-200'}`}>{item.existingWord.category}</span>
                    <span className="text-[10px] text-stone-400 font-label">→</span>
                    {/* Let user pick which category to use */}
                    <select
                      value={item.resolvedCategory}
                      onChange={(e) => updateCategory(idx, e.target.value)}
                      className="text-[10px] font-label border border-stone-200 dark:border-outline-variant/30 rounded px-1 py-0.5 bg-white dark:bg-surface-container-high text-on-surface focus:outline-none"
                      onClick={e => e.stopPropagation()}
                    >
                      <option value={item.parsed.category}>{item.parsed.category} (导入)</option>
                      <option value={item.existingWord.category}>{item.existingWord.category} (保留)</option>
                    </select>
                  </div>
                )}

                {item.status === 'duplicate' && (
                  <span className="text-[10px] text-on-surface-variant font-label shrink-0 italic">已存在 · 同分类</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-outline-variant/15 flex items-center justify-between">
          <p className="text-xs font-label text-stone-400 dark:text-on-surface-variant">
            {unknownCategories.length > 0 && (
              <span className="text-purple-600">
                <span className="material-symbols-outlined text-[12px] align-middle">info</span>
                {' '}新分类「{unknownCategories.join('、')}」将被自动创建
              </span>
            )}
          </p>
          <div className="flex space-x-3">
            <button onClick={onClose} className="px-5 py-2 rounded-lg text-sm font-label text-on-surface-variant hover:bg-surface-container-high transition-colors">
              取消
            </button>
            <button
              onClick={() => onConfirm(previewItems.filter(i => i.selected))}
              disabled={selectedCount === 0}
              className="px-5 py-2 rounded-lg text-sm font-label font-medium bg-primary text-white hover:bg-primary-dim disabled:opacity-40 transition-colors flex items-center space-x-1"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>导入选中的 {selectedCount} 条</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ──
export default function LibraryPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<WordCategory | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<ViewFilter>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EditingWord | null>(null);
  const [page, setPage] = useState(0);
  const [importPreview, setImportPreview] = useState<ImportPreviewItem[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const PAGE_SIZE = 60;

  const allWords = useMemo(() => getAllWords(), [refreshKey]);

  // Stats
  const stats = useMemo(() => {
    const total = allWords.length;
    const builtin = allWords.filter(w => w.source === 'builtin').length;
    const user = allWords.filter(w => w.source === 'user').length;
    const disabled = allWords.filter(w => !w.enabled).length;
    const categoryCounts = new Map<string, number>();
    allWords.forEach(w => categoryCounts.set(w.category, (categoryCounts.get(w.category) || 0) + 1));
    return { total, builtin, user, disabled, categoryCounts };
  }, [allWords]);

  // Filtered words
  const filtered = useMemo(() => {
    let result = allWords;

    if (categoryFilter !== 'all') {
      result = result.filter(w => w.category === categoryFilter);
    }
    if (sourceFilter === 'builtin') result = result.filter(w => w.source === 'builtin');
    if (sourceFilter === 'user') result = result.filter(w => w.source === 'user');

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(w =>
        w.text.toLowerCase().includes(q) ||
        (w.explanation && w.explanation.toLowerCase().includes(q))
      );
    }

    return result;
  }, [allWords, categoryFilter, sourceFilter, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const refresh = () => { setRefreshKey(k => k + 1); };

  // Add / Edit word
  const openAddModal = () => {
    setEditing({ text: '', explanation: '', category: '意象', genres: ['通用'] });
    setShowModal(true);
  };

  const openEditModal = (w: Word) => {
    setEditing({ id: w.id, text: w.text, explanation: w.explanation || '', category: w.category || '意象', genres: w.genres || ['通用'] });
    setShowModal(true);
  };

  const handleSaveWord = () => {
    if (!editing || !editing.text.trim()) return;
    if (editing.id) {
      updateUserWord(editing.id, { text: editing.text.trim(), explanation: editing.explanation.trim() || undefined, category: editing.category });
    } else {
      addUserWord({ text: editing.text.trim(), explanation: editing.explanation.trim() || undefined, category: editing.category, genres: editing.genres });
    }
    setShowModal(false);
    setEditing(null);
    refresh();
  };

  const handleDeleteWord = (w: Word) => {
    if (confirm(`确定要删除词条「${w.text}」吗？`)) {
      deleteUserWord(w.id);
      refresh();
    }
  };

  const handleToggleEnabled = (w: Word) => {
    toggleWordEnabled(w.id);
    refresh();
  };

  // ── Import ──
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        let parsed: ParsedImportItem[];

        if (file.name.endsWith('.json')) {
          parsed = parseJsonImport(content);
        } else {
          // .md or .txt — use MD parser
          parsed = parseMdImport(content);
        }

        if (parsed.length === 0) {
          alert('未能从文件中解析出任何词条。\n\n支持的格式：\n[分类]（词语）：（释义）\n[分类](词语):(释义)\n[分类] 词语：释义\n\n每行一条。');
          return;
        }

        // Build existing word index for duplicate detection
        const existingByText = new Map<string, Word>();
        allWords.forEach(w => {
          existingByText.set(w.text.toLowerCase(), w);
        });

        // Classify each parsed item
        const preview: ImportPreviewItem[] = parsed.map(p => {
          const existing = existingByText.get(p.text.toLowerCase());
          let status: ImportItemStatus;

          if (!existing) {
            status = 'new';
          } else if (existing.category !== p.category) {
            status = 'conflict';
          } else {
            status = 'duplicate';
          }

          return {
            parsed: p,
            status,
            existingWord: existing,
            selected: status === 'new' || status === 'conflict', // default: select new & conflicts, not pure duplicates
            resolvedCategory: p.category,
          };
        });

        setImportPreview(preview);
      } catch {
        alert('导入失败：文件格式不正确。\n\n支持 .md 和 .json 格式。');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = (selected: ImportPreviewItem[]) => {
    let imported = 0;
    for (const item of selected) {
      if (item.status === 'conflict' && item.existingWord) {
        // Update category of the existing word if user chose the imported category
        if (item.resolvedCategory !== item.existingWord.category) {
          if (item.existingWord.source === 'user') {
            updateUserWord(item.existingWord.id, { category: item.resolvedCategory as WordCategory });
          } else {
            addUserWord({
              text: item.parsed.text,
              explanation: item.parsed.explanation || item.existingWord.explanation || undefined,
              category: item.resolvedCategory as WordCategory,
              genres: item.existingWord.genres || ['通用'],
            });
          }
          imported++;
        }
      } else if (item.status === 'new') {
        addUserWord({
          text: item.parsed.text,
          explanation: item.parsed.explanation || undefined,
          category: item.resolvedCategory as WordCategory,
          genres: ['通用'],
        });
        imported++;
      } else if (item.status === 'duplicate' && item.selected) {
        addUserWord({
          text: item.parsed.text,
          explanation: item.parsed.explanation || undefined,
          category: item.resolvedCategory as WordCategory,
          genres: ['通用'],
        });
        imported++;
      }
    }
    setImportPreview(null);
    refresh();
    // toast-like feedback would be nice, but alert works for now
    if (imported > 0) {
      alert(`成功导入 ${imported} 个词条！`);
    }
  };

  // ── Export ──
  const handleExport = () => {
    const userWords = allWords.filter(w => w.source === 'user');
    if (userWords.length === 0) { alert('没有自定义词条可导出'); return; }
    const data = JSON.stringify(userWords, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `writemore_custom_words_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMd = () => {
    const userWords = allWords.filter(w => w.source === 'user');
    if (userWords.length === 0) { alert('没有自定义词条可导出'); return; }
    const lines = userWords.map(w =>
      `[${w.category}]（${w.text}）${w.explanation ? `：（${w.explanation}）` : ''}`
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `writemore_custom_words_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="flex-1 bg-surface relative overflow-y-auto p-8 md:p-12">
      <div className="max-w-6xl mx-auto pb-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-headline text-3xl font-black text-on-surface flex items-center space-x-3">
            <span className="material-symbols-outlined text-[32px] text-primary">auto_stories</span>
            <span>词库管理</span>
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-label font-medium bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>导入</span>
            </button>
            <input ref={fileInputRef} type="file" accept=".json,.md,.txt" className="hidden" onChange={handleImport} />
            {/* Export dropdown */}
            <div className="relative group">
              <button
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-label font-medium bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">upload</span>
                <span>导出</span>
                <span className="material-symbols-outlined text-[12px] ml-0.5">expand_more</span>
              </button>
              <div className="absolute right-0 top-full mt-1 bg-surface-container-high rounded-lg border border-outline-variant/30 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 w-40">
                <button
                  onClick={handleExport}
                  className="w-full text-left px-4 py-2.5 text-xs font-label text-on-surface-variant hover:bg-surface-container-highest rounded-t-lg flex items-center space-x-2 transition-colors"
                >
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">JSON</span>
                  <span>导出为 .json</span>
                </button>
                <button
                  onClick={handleExportMd}
                  className="w-full text-left px-4 py-2.5 text-xs font-label text-on-surface-variant hover:bg-surface-container-highest rounded-b-lg flex items-center space-x-2 border-t border-outline-variant/15 transition-colors"
                >
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">MD</span>
                  <span>导出为 .md</span>
                </button>
              </div>
            </div>
            <button
              onClick={openAddModal}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-label font-medium bg-primary text-white hover:bg-primary-dim transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>添加词条</span>
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center flex-wrap gap-3 mb-6 p-4 bg-surface-container-low/60 rounded-xl border border-outline-variant/15">
          <button
            onClick={() => setSourceFilter('all')}
            className={`flex items-center space-x-2 text-sm font-label px-3 py-1 rounded-md transition-colors ${sourceFilter === 'all' ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-high/50'}`}
          >
            <span className="material-symbols-outlined text-[18px] text-primary">dictionary</span>
            <span className="font-bold">{stats.total}</span>
            <span>总计</span>
          </button>
          <div className="h-4 w-px bg-outline-variant/30" />
          <button
            onClick={() => setSourceFilter('builtin')}
            className={`flex items-center space-x-2 text-sm font-label px-3 py-1 rounded-md transition-colors ${sourceFilter === 'builtin' ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-high/50'}`}
          >
            <span className="material-symbols-outlined text-[18px] text-amber-500">inventory_2</span>
            <span className="font-bold">{stats.builtin}</span>
            <span>内置</span>
          </button>
          <div className="h-4 w-px bg-outline-variant/30" />
          <button
            onClick={() => setSourceFilter('user')}
            className={`flex items-center space-x-2 text-sm font-label px-3 py-1 rounded-md transition-colors ${sourceFilter === 'user' ? 'bg-surface-container-high text-on-surface' : 'text-on-surface-variant hover:bg-surface-container-high/50'}`}
          >
            <span className="material-symbols-outlined text-[18px] text-green-500">person</span>
            <span className="font-bold">{stats.user}</span>
            <span>自定义</span>
          </button>
          {stats.disabled > 0 && (
            <>
              <div className="h-4 w-px bg-outline-variant/30" />
              <div className="flex items-center space-x-2 text-sm font-label text-stone-400 dark:text-on-surface-variant">
                <span className="material-symbols-outlined text-[18px]">visibility_off</span>
                <span className="font-bold">{stats.disabled}</span>
                <span>已禁用</span>
              </div>
            </>
          )}
        </div>

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-2 mb-5">
          {CATEGORY_OPTIONS.map(c => {
            const meta = c !== 'all' ? CATEGORY_META[c] : null;
            return (
              <button
                key={c}
                onClick={() => { setCategoryFilter(c); setPage(0); }}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-label font-medium border transition-all ${
                  categoryFilter === c
                    ? 'bg-primary text-white border-primary'
                    : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:border-outline-variant'
                }`}
              >
                {meta && <span className="material-symbols-outlined text-[14px] leading-none">{meta.icon}</span>}
                <span>{c === 'all' ? '全部类型' : c}</span>
                {c !== 'all' && (
                  <span className="opacity-70">({stats.categoryCounts.get(c) || 0})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search bar */}
        <div className="relative mb-6">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-outline text-[18px]">search</span>
          <input
            type="text"
            placeholder="搜索词条或释义..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
            className="w-full pl-10 pr-4 py-2.5 bg-surface-container rounded-lg border border-outline-variant/30 text-sm font-label text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>

        {/* Result count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-label text-on-surface-variant">
            共 <span className="font-bold text-on-surface">{filtered.length}</span> 个词条
            {searchQuery && <span> · 搜索「<span className="text-primary">{searchQuery}</span>」</span>}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1 rounded hover:bg-surface-container-high disabled:opacity-30 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>
              <span className="text-xs font-label text-on-surface-variant">{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1 rounded hover:bg-surface-container-high disabled:opacity-30 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>
          )}
        </div>

        {/* Word grid */}
        {paginated.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-4xl text-stone-200 dark:text-outline mb-4">search_off</span>
            <p className="text-stone-500 dark:text-on-surface-variant font-label">没有找到匹配的词条</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {paginated.map(w => (
              <div
                key={w.id}
                className={`group relative bg-surface-container p-3 rounded-lg border transition-all hover:-translate-y-0.5 hover:bg-surface-container-high ${
                  w.enabled === false ? 'opacity-40 border-outline-variant/20' : 'border-outline-variant/15'
                }`}
              >
                {/* Top-right actions (hover) */}
                <div className="absolute top-1.5 right-1.5 flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleToggleEnabled(w)}
                    className="p-0.5 rounded hover:bg-surface-container-high text-outline hover:text-on-surface-variant transition-colors"
                    title={w.enabled !== false ? '禁用' : '启用'}
                  >
                    <span className="material-symbols-outlined text-[14px]">{w.enabled !== false ? 'visibility' : 'visibility_off'}</span>
                  </button>
                  {w.source === 'user' && (
                    <>
                      <button
                        onClick={() => openEditModal(w)}
                        className="p-0.5 rounded hover:bg-surface-container-high text-outline hover:text-primary transition-colors"
                        title="编辑"
                      >
                        <span className="material-symbols-outlined text-[14px]">edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteWord(w)}
                        className="p-0.5 rounded hover:bg-surface-container-high text-outline hover:text-red-500 transition-colors"
                        title="删除"
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                      </button>
                    </>
                  )}
                </div>

                {/* Category badge */}
                <span className={`inline-block px-1.5 py-0.5 text-[12px] font-label font-bold rounded border tracking-wider mb-2 ${CATEGORY_COLORS[w.category] || CATEGORY_COLORS['意象'] || 'bg-stone-100 text-stone-600 border-stone-200'}`}>
                  <span className="material-symbols-outlined text-[12px] leading-none align-middle mr-0.5">{CATEGORY_META[w.category]?.icon ?? 'label'}</span>{w.category}
                </span>

                {/* Word text */}
                <h4 className="font-headline text-base font-bold text-on-surface leading-tight mb-1">{w.text}</h4>

                {/* Explanation */}
                {w.explanation && (
                  <p className="text-[11px] text-on-surface-variant leading-relaxed line-clamp-2">{w.explanation}</p>
                )}

                {/* Source badge */}
                {w.source === 'user' && (
                  <div className="mt-2">
                    <span className="text-[8px] font-label font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100 uppercase tracking-wider">自定义</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Bottom pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center mt-8 space-x-2">
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-md text-xs font-label border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30 transition-colors"
            >
              首页
            </button>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-md text-xs font-label border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30 transition-colors"
            >
              上一页
            </button>
            <span className="px-4 py-1.5 text-xs font-label text-on-surface font-medium">{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-md text-xs font-label border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30 transition-colors"
            >
              下一页
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-md text-xs font-label border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high disabled:opacity-30 transition-colors"
            >
              末页
            </button>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && editing && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-surface-container rounded-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="font-headline text-xl font-bold text-on-surface mb-6 flex items-center space-x-2">
              <span className="material-symbols-outlined text-primary text-[24px]">{editing.id ? 'edit' : 'add_circle'}</span>
              <span>{editing.id ? '编辑词条' : '添加词条'}</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-label font-medium text-on-surface-variant mb-1.5 block">词条文本 *</label>
                <input
                  type="text"
                  value={editing.text}
                  onChange={e => setEditing({ ...editing, text: e.target.value })}
                  placeholder="输入词条..."
                  className="w-full px-4 py-2.5 bg-surface-container-low rounded-lg border border-outline-variant/30 text-sm font-headline text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-label font-medium text-on-surface-variant mb-1.5 block">释义（可选）</label>
                <textarea
                  value={editing.explanation}
                  onChange={e => setEditing({ ...editing, explanation: e.target.value })}
                  placeholder="输入释义或解释..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-surface-container-low rounded-lg border border-outline-variant/30 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-label font-medium text-on-surface-variant mb-1.5 block">词条分类</label>
                <div className="flex flex-wrap gap-2">
                  {WORD_CATEGORIES.map(c => (
                    <button
                      key={c}
                      onClick={() => setEditing({ ...editing!, category: c })}
                      className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-label font-medium border transition-all ${
                        editing.category === c
                          ? 'bg-primary text-white border-primary'
                          : 'bg-surface-container-high text-on-surface-variant border-outline-variant/30 hover:border-outline-variant'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px] leading-none">{CATEGORY_META[c]?.icon}</span>
                      <span>{c}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-8">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2 rounded-lg text-sm font-label text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveWord}
                disabled={!editing.text.trim()}
                className="px-5 py-2 rounded-lg text-sm font-label font-medium bg-primary text-white hover:bg-primary-dim disabled:opacity-40 transition-colors"
              >
                {editing.id ? '保存修改' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Preview Modal */}
      {importPreview && (
        <ImportPreviewModal
          items={importPreview}
          onConfirm={handleConfirmImport}
          onClose={() => setImportPreview(null)}
        />
      )}
    </main>
  );
}
