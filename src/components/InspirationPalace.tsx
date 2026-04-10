import { useEffect, useState, useMemo } from 'react';
import { db } from '../db';
import { useStore } from '../store';
import { SCENE_PROMPTS } from '../data/scenes';
import { BUILTIN_CHALLENGES, pickRandomChallenge } from '../data/challenges';
import { BUILTIN_CHARACTER_PROMPTS, pickRandomCharacterPrompt } from '../data/characterPrompts';
import type { Draft, WordSet, WritingMode } from '../types';
import { WRITING_MODES } from '../types';
import { chatCompletion } from '../services/ai';
import { buildInspirationRemixPrompt } from '../services/prompts';
import { Dices, PencilLine, Mountain, MoonStar, CircleHelp, Users, LoaderCircle, Sparkles, Download, Pencil, RefreshCw, Search, SearchX, Trash2, X, Save, ArrowUpRight } from 'lucide-react';

interface PalaceItem {
    draft: Draft;
    wordSet?: WordSet;
}

function hasMeaningfulContent(content: string) {
    return content.replace(/[\s\u200B-\u200D\uFEFF]/g, '').length > 0;
}

/** 推断旧稿件（无 writingMode）的真实模式：有实际词条 → words，否则 → free */
function resolveMode(draft: Draft, wordSet?: WordSet): WritingMode {
    if (draft.writingMode) return draft.writingMode;
    return (wordSet && wordSet.words.length > 0) ? 'words' : 'free';
}

const MODE_STYLE: Record<WritingMode, {
    Icon: React.ComponentType<{ size?: number; className?: string }>;
    bg: string; border: string; text: string;
    // 卡片样式增强
    cardFrom: string; leftAccent: string; hoverBorder: string; chipBg: string;
}> = {
    words:     { Icon: Dices,      bg: 'bg-amber-50   dark:bg-amber-500/10',   border: 'border-amber-200   dark:border-amber-400/20',   text: 'text-amber-800   dark:text-amber-300',   cardFrom: 'from-amber-50/50   dark:from-amber-500/8',   leftAccent: 'border-l-amber-400   dark:border-l-amber-400/60',   hoverBorder: 'hover:border-amber-300/60   dark:hover:border-amber-400/35',   chipBg: 'bg-amber-50   dark:bg-amber-500/15 text-amber-700   dark:text-amber-300 border-amber-200/60   dark:border-amber-400/20'   },
    free:      { Icon: PencilLine, bg: 'bg-emerald-50  dark:bg-emerald-500/10', border: 'border-emerald-200  dark:border-emerald-400/20', text: 'text-emerald-800  dark:text-emerald-300', cardFrom: 'from-emerald-50/50 dark:from-emerald-500/8', leftAccent: 'border-l-emerald-400 dark:border-l-emerald-400/60', hoverBorder: 'hover:border-emerald-300/60 dark:hover:border-emerald-400/35', chipBg: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-400/20' },
    scene:     { Icon: Mountain,   bg: 'bg-blue-50     dark:bg-blue-500/10',    border: 'border-blue-200     dark:border-blue-400/20',    text: 'text-blue-800     dark:text-blue-300',    cardFrom: 'from-blue-50/50     dark:from-blue-500/8',   leftAccent: 'border-l-blue-400     dark:border-l-blue-400/60',   hoverBorder: 'hover:border-blue-300/60     dark:hover:border-blue-400/35',   chipBg: 'bg-blue-50     dark:bg-blue-500/15 text-blue-700     dark:text-blue-300 border-blue-200/60     dark:border-blue-400/20'     },
    dream:     { Icon: MoonStar,   bg: 'bg-violet-50   dark:bg-violet-500/10',  border: 'border-violet-200   dark:border-violet-400/20',  text: 'text-violet-800   dark:text-violet-300',  cardFrom: 'from-violet-50/50   dark:from-violet-500/8', leftAccent: 'border-l-violet-500   dark:border-l-violet-400/60', hoverBorder: 'hover:border-violet-300/60   dark:hover:border-violet-400/35', chipBg: 'bg-violet-50   dark:bg-violet-500/15 text-violet-700   dark:text-violet-300 border-violet-200/60   dark:border-violet-400/20'   },
    challenge: { Icon: CircleHelp, bg: 'bg-rose-50     dark:bg-rose-500/10',    border: 'border-rose-200     dark:border-rose-400/20',    text: 'text-rose-800     dark:text-rose-300',    cardFrom: 'from-rose-50/50     dark:from-rose-500/8',   leftAccent: 'border-l-rose-400     dark:border-l-rose-400/60',   hoverBorder: 'hover:border-rose-300/60     dark:hover:border-rose-400/35',   chipBg: 'bg-rose-50     dark:bg-rose-500/15 text-rose-700     dark:text-rose-300 border-rose-200/60     dark:border-rose-400/20'     },
    character: { Icon: Users,      bg: 'bg-fuchsia-50  dark:bg-fuchsia-500/10', border: 'border-fuchsia-200  dark:border-fuchsia-400/20', text: 'text-fuchsia-800  dark:text-fuchsia-300', cardFrom: 'from-fuchsia-50/50 dark:from-fuchsia-500/8', leftAccent: 'border-l-fuchsia-400 dark:border-l-fuchsia-400/60', hoverBorder: 'hover:border-fuchsia-300/60 dark:hover:border-fuchsia-400/35', chipBg: 'bg-fuchsia-50 dark:bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-200/60 dark:border-fuchsia-400/20' },
};

export default function InspirationPalace() {
    const store = useStore();
    const [items, setItems] = useState<PalaceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterMode, setFilterMode] = useState<WritingMode | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [aiRemixResult, setAiRemixResult] = useState('');
    const [aiRemixLoading, setAiRemixLoading] = useState(false);
    const [previewItem, setPreviewItem] = useState<PalaceItem | null>(null);
    const [previewTitle, setPreviewTitle] = useState('');
    const [previewContent, setPreviewContent] = useState('');
    const [previewSaving, setPreviewSaving] = useState(false);
    const [previewSavedHint, setPreviewSavedHint] = useState(false);
    // 无多选
    const hasPreviewChanges = !!previewItem && (
        previewTitle !== (previewItem.draft.title || '') ||
        previewContent !== (previewItem.draft.content || '')
    );

    useEffect(() => { fetchItems(); }, []);

    async function fetchItems() {
        try {
            const drafts = await db.drafts.orderBy('updatedAt').reverse().toArray();
            const result: PalaceItem[] = [];
            const toMigrate: { id: string; mode: WritingMode }[] = [];
            for (const draft of drafts) {
                if (draft.deletedFromPalace) continue;
                const wordSet = draft.wordSetId ? await db.wordSets.get(draft.wordSetId) : undefined;
                // 旧稿件没有 writingMode，根据关联词条推断真实模式并写回 DB
                if (!draft.writingMode) {
                    const inferred = resolveMode(draft, wordSet);
                    draft.writingMode = inferred;
                    toMigrate.push({ id: draft.id, mode: inferred });
                }
                // dream 空稿过滤（需在推断之后）
                if (draft.writingMode === 'dream' && !hasMeaningfulContent(draft.content) && (draft.wordCount ?? 0) === 0) continue;
                result.push({ draft, wordSet });
            }
            setItems(result);
            // 一次性静默写回，修复历史数据
            if (toMigrate.length > 0) {
                Promise.all(toMigrate.map(({ id, mode }) =>
                    db.drafts.update(id, { writingMode: mode })
                )).catch(console.error);
            }
        } catch (e) {
            console.error('Failed to load palace items', e);
        } finally {
            setLoading(false);
        }
    }

    const displayed = useMemo(() => {
        let result = items;
        if (filterMode !== 'all') {
            result = result.filter(it => resolveMode(it.draft, it.wordSet) === filterMode);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            result = result.filter(it =>
                it.draft.title.toLowerCase().includes(q) ||
                it.draft.content.toLowerCase().includes(q)
            );
        }
        return result;
    }, [items, filterMode, searchQuery]);

    const stats = useMemo(() => {
        const total = items.length;
        const totalWords = items.reduce((s, it) => s + it.draft.wordCount, 0);
        const byMode: Record<string, number> = {};
        items.forEach(it => {
            const m = resolveMode(it.draft, it.wordSet);
            byMode[m] = (byMode[m] || 0) + 1;
        });
        return { total, totalWords, byMode };
    }, [items]);

    const loadDraftToEditor = (item: PalaceItem, overrideTitle?: string, overrideContent?: string) => {
        store.setEditorTitle(overrideTitle ?? item.draft.title);
        store.setEditorContent(overrideContent ?? item.draft.content);
        store.setCurrentDraftId(item.draft.id);
        store.setCurrentWordSetId(item.draft.wordSetId);
        if (item.wordSet) store.setCurrentWords(item.wordSet.words);
        const mode = resolveMode(item.draft, item.wordSet);
        store.setWritingMode(mode);
        if (mode === 'scene' && item.draft.sceneId) {
            const scene = SCENE_PROMPTS.find(s => s.id === item.draft.sceneId);
            if (scene) store.setCurrentScene(scene);
        }
        if (mode === 'challenge') {
            const cid = item.draft.challengeId;
            if (cid) {
                const builtin = BUILTIN_CHALLENGES.find(c => c.id === cid);
                if (builtin) {
                    store.setCurrentChallenge(builtin);
                } else {
                    db.challenges.get(cid).then(c => {
                        if (c) store.setCurrentChallenge(c);
                        else store.setCurrentChallenge(pickRandomChallenge());
                    });
                }
            } else {
                store.setCurrentChallenge(pickRandomChallenge());
            }
        }
        if (mode === 'character') {
            const cid = item.draft.characterPromptId;
            if (cid) {
                const builtin = BUILTIN_CHARACTER_PROMPTS.find(c => c.id === cid);
                if (builtin) {
                    store.setCurrentCharacterPrompt(builtin);
                } else {
                    db.characterPrompts.get(cid).then(c => {
                        if (c) store.setCurrentCharacterPrompt(c);
                        else store.setCurrentCharacterPrompt(pickRandomCharacterPrompt());
                    });
                }
            } else {
                store.setCurrentCharacterPrompt(pickRandomCharacterPrompt());
            }
        }
        store.setActiveTab('inspire');
    };

    const handleOpen = (item: PalaceItem) => {
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

            await db.drafts.update(previewItem.draft.id, {
                title,
                content,
                wordCount,
                updatedAt,
            });

            setItems(prev => prev.map(it => it.draft.id === previewItem.draft.id
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

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('确定要删除这条灵感记录吗？')) {
            await db.drafts.update(id, { deletedFromPalace: true });
            setItems(prev => prev.filter(it => it.draft.id !== id));
            // 如果删除的正是当前编辑器里打开的稿件，解除关联，下次保存时会创建新条目
            if (store.currentDraftId === id) {
                store.setCurrentDraftId(null);
                store.setCurrentWordSetId(null);
            }
        }
    };

    const getModeLabel = (mode?: WritingMode) => {
        const m = mode || 'words';
        return WRITING_MODES.find(wm => wm.mode === m);
    };

    const getSceneTitle = (sceneId?: string) => {
        if (!sceneId) return null;
        return SCENE_PROMPTS.find(s => s.id === sceneId)?.title;
    };

    async function handleAiRemix() {
        // 只用当前分类下的卡片
        const remixSource = filterMode === 'all' ? items : items.filter(it => resolveMode(it.draft, it.wordSet) === filterMode);
        if (!store.aiEnabled || remixSource.length < 2) return;
        setAiRemixLoading(true);
        setAiRemixResult('');
        try {
            const shuffled = [...remixSource].sort(() => Math.random() - 0.5);
            const picked = shuffled.slice(0, Math.min(5, shuffled.length)).map(it => it.draft);
            const msgs = buildInspirationRemixPrompt(picked);
            const result = await chatCompletion(store.aiConfig, msgs, { maxTokens: 300 });
            setAiRemixResult(result);
        } catch {
            setAiRemixResult('AI 生成失败，请检查 AI 设置');
        } finally {
            setAiRemixLoading(false);
        }
    }

    function handleStartFromRemix() {
        store.setWritingMode('free');
        store.setEditorTitle('');
        store.setEditorContent('');
        store.setCurrentDraftId(null);
        store.setCurrentWordSetId(null);
        store.setActiveTab('inspire');
    }

    function handleExportAll() {
        if (items.length === 0) return;
        const lines: string[] = [`# WriteMore 灵感宫殿导出`, `导出时间：${new Date().toLocaleString('zh-CN')}`, `共 ${items.length} 条灵感`, '', '---', ''];
        items.forEach((item, i) => {
            const title = item.draft.title || '未命名灵感';
            const date = new Date(item.draft.updatedAt).toLocaleString('zh-CN');
            const mode = item.draft.writingMode || 'words';  // already resolved in fetchItems
            const wordsLine = item.wordSet?.words.length
                ? `**灵感词条**：${item.wordSet.words.map(w => w.text).join(' · ')}\n\n`
                : '';
            lines.push(`## ${i + 1}. ${title}`);
            lines.push(``);
            lines.push(`> 模式：${mode}　｜　更新：${date}　｜　字数：${item.draft.wordCount}`);
            lines.push(``);
            if (wordsLine) lines.push(wordsLine);
            lines.push(item.draft.content || '（无内容）');
            lines.push('', '---', '');
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `writemore_palace_${new Date().toISOString().slice(0, 10)}.md`;
        a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <main className="flex-1 bg-surface relative overflow-y-auto p-4 md:p-8 lg:p-12">
            <div className="max-w-6xl mx-auto pb-20">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                    <div>
                        <h2 className="font-headline text-2xl md:text-3xl font-black text-on-surface flex items-center space-x-3">
                            <span className="text-[34px]">🏛</span>
                            <span>灵感宫殿</span>
                        </h2>
                        <p className="text-on-surface-variant font-label text-sm mt-1">所有写作灵感汇聚于此</p>
                    </div>
                    {items.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 text-sm font-label text-on-surface-variant">
                            <span><strong className="text-on-surface">{stats.total}</strong> 条灵感</span>
                            <span className="text-outline-variant hidden sm:inline">|</span>
                            <span><strong className="text-on-surface">{stats.totalWords.toLocaleString()}</strong> 字</span>
                            {store.aiEnabled && items.length >= 2 && (
                                <button
                                    onClick={handleAiRemix}
                                    disabled={aiRemixLoading}
                                    className="ml-2 flex items-center gap-1.5 px-3 py-1.5 bg-violet-50/60 dark:bg-violet-100/60 border border-violet-400/40 dark:border-violet-400/10 rounded-lg text-xs font-label text-violet-700 dark:text-violet-800 hover:bg-violet-100/60 dark:hover:bg-violet-500/10 transition-colors disabled:opacity-50"
                                >
                                    {aiRemixLoading ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                    <span>{aiRemixLoading ? '生成中…' : 'AI 再创作'}</span>
                                </button>
                            )}
                            <button
                                onClick={handleExportAll}
                                title="导出全部为 Markdown"
                                className="ml-2 flex items-center gap-1.5 px-3 py-1.5 bg-surface-container border border-outline-variant/30 rounded-lg text-xs font-label text-on-surface-variant hover:bg-surface-container-high transition-colors"
                            >
                                <Download size={16} />
                                <span>导出全部</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* AI Remix Result */}
                {aiRemixResult && (
                    <div className="mb-6 bg-violet-50/60 dark:bg-violet-200/20 border border-violet-200/40 dark:border-violet-400/10 rounded-xl p-4">
                        <p className="text-[12px] font-label uppercase tracking-widest text-violet-600 dark:text-violet-600 mb-2 flex items-center gap-1">
                            <Sparkles size={14} />AI 灵感再创作
                        </p>
                        <p className="text-sm text-violet-900 dark:text-violet-700/70 leading-relaxed mb-3">{aiRemixResult}</p>
                        <div className="flex gap-2">
                            <button
                                onClick={handleStartFromRemix}
                                className="flex items-center gap-1 px-3 py-1.5 bg-violet-400 text-white rounded-lg text-xs font-label hover:bg-violet-600 transition-colors"
                            >
                                <Pencil size={16} />
                                <span>以此开始写作</span>
                            </button>
                            <button
                                onClick={handleAiRemix}
                                disabled={aiRemixLoading}
                                className="flex items-center gap-1 px-3 py-1.5 border border-violet-300 dark:border-violet-700/20 rounded-lg text-xs font-label text-violet-700 dark:text-violet-600 hover:bg-violet-100/20 dark:hover:bg-violet-300/10 transition-colors disabled:opacity-50"
                            >
                                <RefreshCw size={16} />
                                <span>再来一个</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Filter tabs */}
                {items.length > 0 && (
                    <div className="flex items-center gap-2 mb-6 flex-wrap">
                        <button
                            onClick={() => setFilterMode('all')}
                            className={`px-4 py-2 rounded-full text-xs font-label font-medium transition-all ${filterMode === 'all'
                                    ? 'bg-surface-container-high border border-outline-variant/30 text-on-surface'
                                    : 'bg-surface-container text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-high'
                                }`}
                        >
                            全部 <span className="ml-1 opacity-60">{stats.total}</span>
                        </button>
                        {WRITING_MODES.map(m => {
                            const count = stats.byMode[m.mode] || 0;
                            if (count === 0) return null;
                            const style = MODE_STYLE[m.mode];
                            return (
                                <button
                                    key={m.mode}
                                    onClick={() => setFilterMode(m.mode)}
                                    className={`px-4 py-2 rounded-full text-xs font-label font-medium transition-all flex items-center space-x-1.5 ${filterMode === m.mode
                                            ? `${style.bg} ${style.text} ${style.border} border`
                                            : 'bg-surface-container text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-high'
                                        }`}
                                >
                                    <style.Icon size={16} />
                                    <span>{m.label}</span>
                                    <span className="opacity-60">{count}</span>
                                </button>
                            );
                        })}

                        {/* Search */}
                        <div className="relative ml-auto">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
                            <input
                                type="text"
                                placeholder="搜索灵感..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-surface-container rounded-full border border-outline-variant/30 text-xs font-label text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all w-48"
                            />
                        </div>
                    </div>
                )}

                {/* Content */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24">
                        <div className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                        <p className="mt-4 text-on-surface-variant text-sm font-label">加载中...</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-24 bg-surface-container-low/50 rounded-2xl border border-dashed border-outline-variant/30">
                        <span className="text-5xl mb-4 block">🏛</span>
                        <p className="text-on-surface-variant font-label text-lg mb-1">灵感宫殿还是空的</p>
                        <p className="text-on-surface-variant text-sm mt-2 max-w-sm mx-auto leading-relaxed">
                            选择一种灵感模式，写下你的第一条灵感吧！
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
                        <SearchX size={40} className="text-outline mb-4" />
                        <p className="text-on-surface-variant font-label">没有找到匹配的灵感记录</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {displayed.map(item => {
                            const mode = resolveMode(item.draft, item.wordSet);
                            const mLabel = getModeLabel(mode);
                            const mStyle = MODE_STYLE[mode];
                            const sceneTitle = getSceneTitle(item.draft.sceneId);
                            return (
                                <div
                                    key={item.draft.id}
                                    onClick={() => handleOpen(item)}
                                    className={`bg-gradient-to-br ${mStyle.cardFrom} to-surface-container overflow-hidden p-5 rounded-xl border border-outline-variant/20 border-l-4 ${mStyle.leftAccent} ${mStyle.hoverBorder} cursor-pointer group transition-all duration-200 hover:-translate-y-1 hover:shadow-lg relative flex flex-col`}
                                >
                                    {/* 水印图标 — 极低透明度装饰 */}
                                    <div className="absolute -bottom-1 -right-1 opacity-[0.05] group-hover:opacity-[0.09] transition-opacity duration-300 pointer-events-none select-none" aria-hidden="true">
                                        <mStyle.Icon size={76} />
                                    </div>

                                    {/* Delete */}
                                    <button
                                        onClick={e => handleDelete(e, item.draft.id)}
                                        className="absolute top-3 right-3 text-outline hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 z-10"
                                        title="删除"
                                    >
                                        <Trash2 size={20} />
                                    </button>

                                    {/* Mode badge + date */}
                                    <div className="relative flex items-center justify-between mb-3 pr-8">
                                        <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[12px] font-label font-medium border ${mStyle.bg} ${mStyle.border} ${mStyle.text}`}>
                                            <mStyle.Icon size={14} />
                                            <span>{mLabel?.label}</span>
                                        </span>
                                        <span className="text-xs font-label text-outline">
                                            {new Date(item.draft.updatedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    {/* Title */}
                                    <h3 className="relative font-headline text-lg font-bold text-on-surface mb-2 group-hover:text-primary transition-colors truncate">
                                        {item.draft.title || '未命名灵感'}
                                    </h3>

                                    {/* Scene subtitle */}
                                    {sceneTitle && (
                                        <p className="relative text-xs text-blue-500 font-label mb-2 flex items-center space-x-1">
                                            <Mountain size={14} />
                                            <span>{sceneTitle}</span>
                                        </p>
                                    )}

                                    {/* Preview */}
                                    <p className="relative text-on-surface-variant text-sm line-clamp-3 mb-4 min-h-[54px] leading-relaxed flex-1">
                                        {item.draft.content ? item.draft.content.replace(/[#*>_`\[\]]/g, '').slice(0, 150) : '没有任何内容...'}
                                    </p>

                                    {/* Bottom: word count + word chips */}
                                    <div className="relative flex items-center justify-between pt-3 border-t border-outline-variant/10">
                                        <span className="text-[12px] tracking-wider uppercase bg-surface-container-high px-2 py-0.5 rounded text-on-surface-variant font-label font-medium">
                                            {item.draft.wordCount} 字
                                        </span>
                                        {item.wordSet && item.wordSet.words.length > 0 && (
                                            <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                                                {item.wordSet.words.slice(0, 4).map((w, idx) => (
                                                    <span key={idx} className={`px-1.5 py-0.5 text-[12px] rounded border font-label ${mStyle.chipBg}`}>
                                                        {w.text}
                                                    </span>
                                                ))}
                                                {item.wordSet.words.length > 4 && (
                                                    <span className="text-[12px] text-outline font-label">+{item.wordSet.words.length - 4}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {previewItem && (
                <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={closePreview}>
                    <div className="w-full max-w-4xl max-h-[90vh] bg-surface border border-outline-variant/20 rounded-2xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/15 bg-surface-container-low/60">
                            <div className="min-w-0">
                                <p className="text-[12px] font-label uppercase tracking-widest text-outline">全文查看与编辑</p>
                                <p className="text-xs font-label text-on-surface-variant mt-1">{new Date(previewItem.draft.updatedAt).toLocaleString('zh-CN')}</p>
                            </div>
                            <button className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container" onClick={closePreview}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-5 md:p-6 overflow-y-auto flex-1 space-y-4">
                            <input
                                value={previewTitle}
                                onChange={e => setPreviewTitle(e.target.value)}
                                placeholder="标题"
                                className="w-full bg-transparent border-none focus:ring-0 font-headline text-2xl md:text-3xl font-black text-on-surface placeholder:text-surface-dim outline-none"
                            />
                            <textarea
                                value={previewContent}
                                onChange={e => setPreviewContent(e.target.value)}
                                placeholder="正文内容..."
                                className="w-full min-h-[48vh] bg-surface-container-low/40 border border-outline-variant/20 rounded-xl p-4 text-sm md:text-base leading-relaxed text-on-surface placeholder:text-outline focus:outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                            />
                        </div>

                        <div className="px-5 py-4 border-t border-outline-variant/15 bg-surface-container-low/40 flex flex-wrap items-center justify-between gap-3">
                            <span className="text-xs font-label text-on-surface-variant">
                                字数：{previewContent.replace(/\s+/g, '').length}
                                {previewSavedHint && <span className="ml-2 text-emerald-600 dark:text-emerald-400">已保存</span>}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleSavePreview}
                                    disabled={previewSaving || !hasPreviewChanges}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-label font-medium hover:bg-primary-dim transition-colors disabled:opacity-50"
                                >
                                    <Save size={16} />
                                    <span>{previewSaving ? '保存中…' : '保存'}</span>
                                </button>
                                <button
                                    onClick={() => {
                                        loadDraftToEditor(previewItem, previewTitle.trim() || '未命名灵感', previewContent);
                                        setPreviewItem(null);
                                    }}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-outline-variant/30 text-xs font-label text-on-surface-variant hover:bg-surface-container transition-colors"
                                >
                                    <ArrowUpRight size={16} />
                                    <span>在编辑器中继续</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
