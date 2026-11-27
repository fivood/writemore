import { useEffect, useState, useMemo } from 'react';
import { db } from '../db';
import { useStore } from '../store';
import { SCENE_PROMPTS, BUILTIN_CHALLENGES, BUILTIN_CHARACTER_PROMPTS, pickChallenge, pickCharacterPrompt, buildInspirationRemixPrompt } from '../inspire';
import type { Draft, WordSet, WritingMode } from '../types';
import { WRITING_MODES } from '../ui/meta';
import { findScene, isGhostDreamDraft } from '../lib/drafts';
import { dayKey, downloadText } from '../lib/util';
import { chatCompletion } from '../services/ai';
import {
    Dices, PencilLine, Mountain, MoonStar, CircleHelp, Users,
    LoaderCircle, Sparkles, Download, Pencil, RefreshCw, Search, SearchX,
    Trash2, X, Save, ArrowUpRight, CheckSquare, Square, ListChecks, Merge, ArrowUp, ArrowDown, Landmark,
} from 'lucide-react';

interface PalaceItem {
    draft: Draft;
    wordSet?: WordSet;
}

function resolveMode(draft: Draft, wordSet?: WordSet): WritingMode {
    if (draft.writingMode) return draft.writingMode;
    return (wordSet && wordSet.words.length > 0) ? 'words' : 'free';
}

const MODE_STYLE: Record<WritingMode, {
    Icon: React.ComponentType<{ size?: number; className?: string }>;
    badge: string;
    cardTone: string;
    leftAccent: string;
}> = {
    words:     { Icon: Dices,      badge: 'bg-[#f4ead7] dark:bg-[#33291c] border-[#d6c09e] dark:border-[#4d3e2a] text-[#785834] dark:text-[#d9ba91]', cardTone: 'washi-words',     leftAccent: 'border-l-[#a68358] dark:border-l-[#c7a682]' },
    free:      { Icon: PencilLine, badge: 'bg-[#e6ecdf] dark:bg-[#232c1e] border-[#c5d1b8] dark:border-[#374530] text-[#4c5e3f] dark:text-[#abc09c]', cardTone: 'washi-free',      leftAccent: 'border-l-[#7c8f6c] dark:border-l-[#96a68a]' },
    scene:     { Icon: Mountain,   badge: 'bg-[#e3ebe5] dark:bg-[#202b25] border-[#c1d1c6] dark:border-[#33443b] text-[#445c4e] dark:text-[#9eb8a9]', cardTone: 'washi-scene',     leftAccent: 'border-l-[#6e8778] dark:border-l-[#8aa696]' },
    dream:     { Icon: MoonStar,   badge: 'bg-[#eee7e2] dark:bg-[#2e2623] border-[#d1c3ba] dark:border-[#473b36] text-[#69554b] dark:text-[#c7b2a7]', cardTone: 'washi-dream',     leftAccent: 'border-l-[#948077] dark:border-l-[#b5a096]' },
    challenge: { Icon: CircleHelp, badge: 'bg-[#f3e5d7] dark:bg-[#34261a] border-[#d9bfa6] dark:border-[#4f3927] text-[#7d5636] dark:text-[#d9b08c]', cardTone: 'washi-challenge', leftAccent: 'border-l-[#a87d59] dark:border-l-[#cca17c]' },
    character: { Icon: Users,      badge: 'bg-[#f2e6da] dark:bg-[#33261c] border-[#d8c1ac] dark:border-[#4d392a] text-[#7a573b] dark:text-[#d6b294]', cardTone: 'washi-character', leftAccent: 'border-l-[#9e795b] dark:border-l-[#c49e7e]' },
};

export default function InspirationPalace() {
    const store = useStore();
    const [items, setItems] = useState<PalaceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterMode, setFilterMode] = useState<WritingMode | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [aiRemixResult, setAiRemixResult] = useState('');
    const [aiRemixLoading, setAiRemixLoading] = useState(false);
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [previewItem, setPreviewItem] = useState<PalaceItem | null>(null);
    const [previewTitle, setPreviewTitle] = useState('');
    const [previewContent, setPreviewContent] = useState('');
    const [previewSaving, setPreviewSaving] = useState(false);
    const [previewSavedHint, setPreviewSavedHint] = useState(false);
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [mergeTitle, setMergeTitle] = useState('');
    const [mergeItems, setMergeItems] = useState<PalaceItem[]>([]);

    const hasPreviewChanges = !!previewItem && (
        previewTitle !== (previewItem.draft.title || '') ||
        previewContent !== (previewItem.draft.content || '')
    );

    useEffect(() => { void fetchItems(); }, []);

    async function fetchItems() {
        try {
            const drafts = await db.drafts.orderBy('updatedAt').reverse().toArray();
            const result: PalaceItem[] = [];
            for (const draft of drafts) {
                if (draft.deletedFromPalace) continue;
                const wordSet = draft.wordSetId ? await db.wordSets.get(draft.wordSetId) : undefined;
                const mode = draft.writingMode || resolveMode(draft, wordSet);
                if (isGhostDreamDraft({ ...draft, writingMode: mode })) continue;
                result.push({ draft, wordSet });
            }
            setItems(result);
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
        if (mode === 'scene') {
            store.setCurrentScene(null);
            if (item.draft.sceneId) void findScene(item.draft.sceneId).then(store.setCurrentScene);
        }
        if (mode === 'challenge') {
            const cid = item.draft.challengeId;
            if (cid) {
                const builtin = BUILTIN_CHALLENGES.find(c => c.id === cid);
                if (builtin) {
                    store.setCurrentChallenge(builtin);
                } else {
                    store.setCurrentChallenge(null);
                    void db.challenges.get(cid).then(c => { if (c) store.setCurrentChallenge(c); });
                }
            } else {
                store.setCurrentChallenge(pickChallenge());
            }
        }
        if (mode === 'character') {
            const cid = item.draft.characterPromptId;
            if (cid) {
                const builtin = BUILTIN_CHARACTER_PROMPTS.find(c => c.id === cid);
                if (builtin) {
                    store.setCurrentCharacterPrompt(builtin);
                } else {
                    store.setCurrentCharacterPrompt(null);
                    void db.characterPrompts.get(cid).then(c => { if (c) store.setCurrentCharacterPrompt(c); });
                }
            } else {
                store.setCurrentCharacterPrompt(pickCharacterPrompt());
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

    const handleOpenMerge = () => {
        const selected = items.filter(it => selectedIds.has(it.draft.id));
        if (selected.length < 2) return;
        setMergeItems(selected);
        const todayStr = new Date().toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }).replace('/', '-');
        setMergeTitle(`合并手稿 ${todayStr}`);
        setShowMergeModal(true);
    };

    const moveItem = (index: number, direction: 'up' | 'down') => {
        const nextIndex = direction === 'up' ? index - 1 : index + 1;
        if (nextIndex < 0 || nextIndex >= mergeItems.length) return;
        const newItems = [...mergeItems];
        const temp = newItems[index];
        newItems[index] = newItems[nextIndex];
        newItems[nextIndex] = temp;
        setMergeItems(newItems);
    };

    const mergedPreview = useMemo(() => {
        return mergeItems.map((it, idx) => {
            const title = it.draft.title || `未命名灵感 ${idx + 1}`;
            const content = it.draft.content || '';
            return `## ${title}\n\n${content}`;
        }).join('\n\n---\n\n');
    }, [mergeItems]);

    async function handleConfirmMerge() {
        if (mergeItems.length < 2) return;
        const title = mergeTitle.trim() || '未命名合并手稿';
        const content = mergedPreview;
        const wordCount = content.replace(/\s+/g, '').length;
        const now = new Date();
        const draftId = `draft_${Date.now()}`;
        const wordSetId = `ws_empty_${Date.now()}`;

        try {
            const wordSet: WordSet = {
                id: wordSetId,
                words: [],
                genre: '通用',
                createdAt: now,
                isFavorite: false,
                hasWritten: true,
            };
            await db.wordSets.put(wordSet);

            const newDraft: Draft = {
                id: draftId,
                wordSetId,
                title,
                content,
                wordCount,
                createdAt: now,
                updatedAt: now,
                writingMode: 'free',
                deletedFromPalace: false,
            };
            await db.drafts.put(newDraft);
            await fetchItems();

            setSelectMode(false);
            setSelectedIds(new Set());
            setShowMergeModal(false);

            loadDraftToEditor({ draft: newDraft, wordSet });
        } catch (e) {
            console.error('Failed to merge drafts', e);
            alert('合并草稿失败，请重试');
        }
    }

    async function handleAiRemix() {
        if (!store.aiEnabled) return;
        let source: PalaceItem[];
        if (selectMode && selectedIds.size > 0) {
            source = items.filter(it => selectedIds.has(it.draft.id));
        } else {
            source = filterMode === 'all' ? items : items.filter(it => resolveMode(it.draft, it.wordSet) === filterMode);
        }
        if (source.length < 2) return;
        setAiRemixLoading(true);
        setAiRemixResult('');
        try {
            const shuffled = [...source].sort(() => Math.random() - 0.5);
            const picked = shuffled.slice(0, Math.min(5, shuffled.length)).map(it => it.draft);
            const msgs = buildInspirationRemixPrompt(picked);
            const result = await chatCompletion(store.aiConfig, msgs);
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
            const mode = item.draft.writingMode || 'words';
            const wordsLine = item.wordSet?.words.length
                ? `**灵感词条**：${item.wordSet.words.map(w => w.text).join(' · ')}\n\n`
                : '';
            lines.push(`## ${i + 1}. ${title}`);
            lines.push('');
            lines.push(`> 模式：${mode} | 更新：${date} | 字数：${item.draft.wordCount}`);
            lines.push('');
            if (wordsLine) lines.push(wordsLine);
            lines.push(item.draft.content || '（无内容）');
            lines.push('', '---', '');
        });
        downloadText(`writemore_palace_${dayKey()}.md`, lines.join('\n'));
    }

    return (
        <main className="flex-1 relative overflow-y-auto p-4 md:p-8 lg:p-12">
            <div className="max-w-6xl mx-auto pb-24">
                {/* 报刊版头 */}
                <div className="broadsheet-masthead-rule py-4 mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                    <div>
                        <h2 className="font-headline text-2xl md:text-3xl font-bold text-on-surface flex items-center gap-2.5">
                            <Landmark size={24} className="text-primary" />
                            <span>灵感宫殿</span>
                        </h2>
                        <p className="text-on-surface-variant font-body text-sm mt-1">
                            所有写作草稿与灵感片段汇聚于此。
                        </p>
                    </div>

                    {items.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 text-xs font-label text-on-surface-variant">
                            <span>共 <strong className="text-on-surface">{stats.total}</strong> 篇</span>
                            <span className="text-outline-variant">|</span>
                            <span><strong className="text-on-surface">{stats.totalWords.toLocaleString()}</strong> 字</span>
                            {store.aiEnabled && items.length >= 2 && (
                                <button
                                    onClick={handleAiRemix}
                                    disabled={aiRemixLoading}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container border border-secondary/55 rounded-sm font-label text-xs text-secondary hover:bg-secondary-container/40 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {aiRemixLoading ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                    <span>{aiRemixLoading ? '生成中…' : 'AI 灵感重组'}</span>
                                </button>
                            )}
                            <button
                                onClick={handleExportAll}
                                title="导出全部为 Markdown"
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container border border-outline-variant/65 rounded-sm font-label text-xs text-on-surface-variant hover:border-secondary hover:text-on-surface transition-colors cursor-pointer"
                            >
                                <Download size={14} />
                                <span>导出全集</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* AI Remix Result */}
                {aiRemixResult && (
                    <div className="mb-6 index-card paper-grain border-l-2 border-l-secondary rounded-sm p-5">
                        <p className="font-mono text-[13px] uppercase tracking-widest text-secondary mb-2 flex items-center gap-1.5">
                            <Sparkles size={13} />AI REMIX PROPOSAL · 灵感重组方案
                        </p>
                        <p className="font-body text-sm text-on-surface leading-relaxed mb-4 whitespace-pre-line">{aiRemixResult}</p>
                        <div className="flex gap-2">
                            <button
                                onClick={handleStartFromRemix}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-on-primary rounded-sm text-xs font-label font-medium hover:bg-primary-dim transition-colors cursor-pointer"
                            >
                                <Pencil size={13} />
                                <span>以此开始写作</span>
                            </button>
                            <button
                                onClick={handleAiRemix}
                                disabled={aiRemixLoading}
                                className="flex items-center gap-1.5 px-3.5 py-1.5 border border-outline-variant/65 rounded-sm text-xs font-label text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-50 cursor-pointer"
                            >
                                <RefreshCw size={13} />
                                <span>换一个构想</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Filter tabs & Search */}
                {items.length > 0 && (
                    <div className="flex items-center gap-2 mb-6 flex-wrap">
                        <button
                            onClick={() => setFilterMode('all')}
                            className={`px-3 py-1.5 rounded-sm text-xs font-label font-medium border transition-colors cursor-pointer ${
                                filterMode === 'all'
                                    ? 'bg-primary text-on-primary border-primary'
                                    : 'bg-surface-container text-on-surface-variant border-outline-variant/55 hover:border-secondary'
                            }`}
                        >
                            全部 <span className="ml-1 font-mono text-[13px] opacity-80">{stats.total}</span>
                        </button>

                        {WRITING_MODES.map(m => {
                            const count = stats.byMode[m.mode] || 0;
                            if (count === 0) return null;
                            const style = MODE_STYLE[m.mode];
                            const active = filterMode === m.mode;
                            return (
                                <button
                                    key={m.mode}
                                    onClick={() => setFilterMode(m.mode)}
                                    className={`px-3 py-1.5 rounded-sm text-xs font-label font-medium border transition-colors flex items-center gap-1.5 cursor-pointer ${
                                        active
                                            ? `${style.badge} font-semibold`
                                            : 'bg-surface-container text-on-surface-variant border-outline-variant/55 hover:border-secondary'
                                    }`}
                                >
                                    <style.Icon size={13} />
                                    <span>{m.label}</span>
                                    <span className="font-mono text-[13px] opacity-70">{count}</span>
                                </button>
                            );
                        })}

                        <div className="ml-auto flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                            {items.length >= 2 && (
                                <button
                                    onClick={() => {
                                        setSelectMode(v => !v);
                                        setSelectedIds(new Set());
                                        setAiRemixResult('');
                                    }}
                                    title={selectMode ? '退出装订多选' : '勾选多张手稿进行合并装订或 AI 重组'}
                                    className={`px-3 py-1.5 rounded-sm border transition-colors text-xs font-label flex items-center gap-1.5 cursor-pointer ${
                                        selectMode
                                            ? 'bg-primary text-on-primary border-primary font-medium'
                                            : 'bg-surface-container border-outline-variant/60 text-on-surface-variant hover:border-secondary'
                                    }`}
                                >
                                    <ListChecks size={14} />
                                    <span>{selectMode ? '退出装订' : '多选装订'}</span>
                                </button>
                            )}
                            <div className="relative flex-1 sm:flex-initial">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="检索手稿标题或正文…"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full sm:w-52 pl-8 pr-3 py-1.5 bg-surface-container rounded-sm border border-outline-variant/60 text-xs font-label text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Content */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24">
                        <div className="w-7 h-7 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                        <p className="mt-4 text-on-surface-variant text-xs font-mono uppercase tracking-widest">LOADING ARCHIVE…</p>
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-24 index-card paper-grain rounded-sm border-dashed">
                        <Landmark size={38} className="text-outline mx-auto mb-4" />
                        <p className="text-on-surface font-headline text-lg font-bold mb-1">档案柜尚无手稿</p>
                        <p className="text-on-surface-variant font-body text-sm mt-1 max-w-sm mx-auto leading-relaxed">
                            挑选一张灵感索引卡，敲下你的第一段文字吧。
                        </p>
                        <button
                            className="mt-6 px-6 py-2.5 bg-primary text-on-primary hover:bg-primary-dim transition-colors rounded-sm font-label text-xs font-semibold uppercase tracking-wider cursor-pointer"
                            onClick={() => store.setActiveTab('inspire')}
                        >
                            前往灵感案头 →
                        </button>
                    </div>
                ) : displayed.length === 0 ? (
                    <div className="text-center py-16">
                        <SearchX size={36} className="text-outline mx-auto mb-3" />
                        <p className="text-on-surface-variant font-label text-sm">没有找到匹配的手稿记录</p>
                    </div>
                ) : (
                    <div className="broadsheet-frame grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                        {displayed.map(item => {
                            const mode = resolveMode(item.draft, item.wordSet);
                            const mLabel = getModeLabel(mode);
                            const mStyle = MODE_STYLE[mode];
                            const sceneTitle = getSceneTitle(item.draft.sceneId);
                            const isSelected = selectedIds.has(item.draft.id);
                            return (
                                <div
                                    key={item.draft.id}
                                    onClick={() => {
                                        if (selectMode) {
                                            setSelectedIds(prev => {
                                                const next = new Set(prev);
                                                if (next.has(item.draft.id)) next.delete(item.draft.id);
                                                else next.add(item.draft.id);
                                                return next;
                                            });
                                        } else {
                                            handleOpen(item);
                                        }
                                    }}
                                    className={`${mStyle.cardTone} p-5 border-b border-r border-on-surface/20 cursor-pointer group relative flex flex-col h-full transition-colors ${
                                        isSelected ? 'palace-selected-frame z-10' : ''
                                    }`}
                                >
                                    {/* 选择模式印记 */}
                                    {selectMode && (
                                        <div className={`absolute top-3.5 right-3.5 flex items-center gap-1 font-mono text-[12px] ${
                                            isSelected ? 'text-primary font-bold' : 'text-outline'
                                        }`}>
                                            {isSelected ? <CheckSquare size={17} /> : <Square size={17} />}
                                        </div>
                                    )}

                                    {/* 删除按钮 */}
                                    {!selectMode && (
                                        <button
                                            onClick={e => void handleDelete(e, item.draft.id)}
                                            className="absolute top-3.5 right-3.5 text-outline hover:text-error opacity-0 group-hover:opacity-100 transition-opacity p-1 z-10 cursor-pointer"
                                            title="移除手稿"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}

                                    {/* Mode stamp + date */}
                                    <div className="flex items-center justify-between mb-3 pr-7">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[13px] font-label font-medium border ${mStyle.badge}`}>
                                            <mStyle.Icon size={12} />
                                            <span>{mLabel?.label}</span>
                                        </span>
                                        <span className="font-mono text-[13px] text-outline">
                                            {new Date(item.draft.updatedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>

                                    {/* Title */}
                                    <h3 className="font-headline text-lg font-bold text-on-surface mb-2 group-hover:text-primary transition-colors truncate">
                                        {item.draft.title || '未命名灵感'}
                                    </h3>

                                    {sceneTitle && (
                                        <p className="text-xs text-secondary font-label mb-2 flex items-center gap-1">
                                            <Mountain size={12} />
                                            <span>{sceneTitle}</span>
                                        </p>
                                    )}

                                    {/* Preview */}
                                    <p className="font-body text-on-surface-variant text-sm line-clamp-3 mb-4 min-h-[54px] leading-relaxed flex-1">
                                        {item.draft.content ? item.draft.content.replace(/[#*>_`[\]]/g, '').slice(0, 150) : '空白手稿…'}
                                    </p>

                                    {/* Bottom perforated ledger */}
                                    <div className="flex items-center justify-between pt-3 border-t border-dashed border-outline-variant/55">
                                        <span className="font-label text-xs text-outline">
                                            {item.draft.wordCount} 字
                                        </span>
                                        {item.wordSet && item.wordSet.words.length > 0 && (
                                            <div className="flex flex-wrap gap-1 justify-end max-w-[65%]">
                                                {item.wordSet.words.slice(0, 4).map((w, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="px-1.5 py-0.5 text-[13px] border border-on-surface/20 bg-surface-container-lowest text-on-surface-variant font-headline"
                                                    >
                                                        {w.text}
                                                    </span>
                                                ))}
                                                {item.wordSet.words.length > 4 && (
                                                    <span className="font-mono text-[13px] text-outline">+{item.wordSet.words.length - 4}</span>
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

            {/* 底部浮动多选装订台 */}
            {selectMode && (
                <div className="fixed bottom-16 md:bottom-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 bg-surface-container border border-outline-variant/80 rounded-sm shadow-2xl text-xs font-label">
                    <span className="font-mono text-on-surface-variant whitespace-nowrap">
                        SELECTED <strong className="text-primary">{selectedIds.size}</strong>
                    </span>
                    <div className="w-px h-4 bg-outline-variant/50" />
                    <button
                        onClick={() => setSelectedIds(new Set(displayed.map(it => it.draft.id)))}
                        className="text-on-surface-variant hover:text-on-surface transition-colors whitespace-nowrap cursor-pointer"
                    >
                        全选当前
                    </button>
                    <button
                        onClick={() => setSelectedIds(new Set())}
                        disabled={selectedIds.size === 0}
                        className="text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-30 whitespace-nowrap cursor-pointer"
                    >
                        清空
                    </button>
                    <div className="w-px h-4 bg-outline-variant/50" />
                    <button
                        onClick={handleOpenMerge}
                        disabled={selectedIds.size < 2}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary rounded-sm hover:bg-primary-dim transition-colors disabled:opacity-40 whitespace-nowrap font-medium cursor-pointer"
                    >
                        <Merge size={14} />
                        <span>装订合成 ({selectedIds.size})</span>
                    </button>
                    {store.aiEnabled && (
                        <button
                            onClick={handleAiRemix}
                            disabled={selectedIds.size < 2 || aiRemixLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-on-secondary rounded-sm hover:bg-secondary-dim transition-colors disabled:opacity-40 whitespace-nowrap font-medium cursor-pointer"
                        >
                            {aiRemixLoading ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            <span>{aiRemixLoading ? '生成中…' : `AI 重组 (${selectedIds.size})`}</span>
                        </button>
                    )}
                    <button
                        onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
                        className="p-1 rounded-sm text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
                        title="退出选择"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* 全文查看与编辑弹窗 */}
            {previewItem && (
                <div className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={closePreview}>
                    <div className="w-full max-w-4xl max-h-[90vh] manuscript-sheet paper-grain rounded-sm flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-3.5 border-b border-dashed border-outline-variant/65 bg-surface-container-low/50">
                            <div className="min-w-0">
                                <p className="font-mono text-[12px] uppercase tracking-widest text-outline">MANUSCRIPT FOLIO · 手稿审阅与批改</p>
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
                                placeholder="手稿正文…"
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

            {/* 多选装订合成台弹窗 */}
            {showMergeModal && (
                <div className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-4" onClick={() => setShowMergeModal(false)}>
                    <div className="w-full max-w-5xl max-h-[90vh] manuscript-sheet paper-grain rounded-sm flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-dashed border-outline-variant/65 bg-surface-container-low/50">
                            <div className="min-w-0">
                                <p className="font-mono text-[12px] uppercase tracking-widest text-outline">BINDERY · 手稿装订台</p>
                                <h3 className="font-headline text-lg font-bold text-on-surface mt-0.5">
                                    多片段装订合成器
                                </h3>
                            </div>
                            <button
                                className="p-1.5 rounded-sm text-outline hover:text-on-surface hover:bg-surface-container cursor-pointer"
                                onClick={() => setShowMergeModal(false)}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-y-auto">
                            <div className="lg:col-span-5 flex flex-col h-full min-h-[280px]">
                                <h4 className="font-mono text-[13px] font-bold uppercase tracking-widest text-outline mb-3">
                                    SEQUENCE · 装订顺序 ({mergeItems.length})
                                </h4>
                                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                                    {mergeItems.map((item, idx) => {
                                        const mode = resolveMode(item.draft, item.wordSet);
                                        const mStyle = MODE_STYLE[mode];
                                        return (
                                            <div
                                                key={item.draft.id}
                                                className={`flex items-center gap-3 p-3 bg-surface-container border border-outline-variant/55 rounded-sm ${mStyle.leftAccent} border-l-[3px]`}
                                            >
                                                <div className="shrink-0 w-6 h-6 rounded-sm bg-surface-container-high flex items-center justify-center font-mono text-xs font-bold text-on-surface">
                                                    {String(idx + 1).padStart(2, '0')}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-headline text-sm font-bold text-on-surface truncate">
                                                        {item.draft.title || '未命名灵感'}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5 font-mono text-[13px] text-outline">
                                                        <span>{item.draft.wordCount} CHARS</span>
                                                        <span>·</span>
                                                        <span>{new Date(item.draft.updatedAt).toLocaleDateString('zh-CN')}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-1 shrink-0">
                                                    <button
                                                        onClick={() => moveItem(idx, 'up')}
                                                        disabled={idx === 0}
                                                        className="p-1 rounded-sm bg-surface-container-lowest border border-outline-variant/50 hover:border-secondary text-on-surface-variant disabled:opacity-30 cursor-pointer"
                                                        title="上移"
                                                    >
                                                        <ArrowUp size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => moveItem(idx, 'down')}
                                                        disabled={idx === mergeItems.length - 1}
                                                        className="p-1 rounded-sm bg-surface-container-lowest border border-outline-variant/50 hover:border-secondary text-on-surface-variant disabled:opacity-30 cursor-pointer"
                                                        title="下移"
                                                    >
                                                        <ArrowDown size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="lg:col-span-7 flex flex-col h-full min-h-[360px]">
                                <h4 className="font-mono text-[13px] font-bold uppercase tracking-widest text-outline mb-3">
                                    MANUSCRIPT PREVIEW · 合成长文预览
                                </h4>
                                <div className="mb-4">
                                    <label className="block text-xs font-label text-on-surface-variant mb-1.5">
                                        新装订手稿标题
                                    </label>
                                    <input
                                        type="text"
                                        value={mergeTitle}
                                        onChange={e => setMergeTitle(e.target.value)}
                                        placeholder="输入合成后的新标题"
                                        className="w-full px-3 py-2 bg-surface-container rounded-sm border border-outline-variant/60 text-sm font-headline font-bold text-on-surface focus:outline-none focus:border-primary transition-colors"
                                    />
                                </div>

                                <div className="flex-1 flex flex-col min-h-0 bg-surface-container/60 border border-outline-variant/55 rounded-sm p-4">
                                    <div className="flex items-center justify-between pb-2 border-b border-dashed border-outline-variant/50 font-mono text-[13px] text-outline mb-3">
                                        <span>MARKDOWN OUTPUT</span>
                                        <span>{mergedPreview.replace(/\s+/g, '').length} CHARS</span>
                                    </div>
                                    <textarea
                                        readOnly
                                        value={mergedPreview}
                                        className="flex-1 w-full bg-transparent border-none focus:ring-0 text-sm leading-relaxed text-on-surface font-body resize-none focus:outline-none overflow-y-auto"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t border-dashed border-outline-variant/65 bg-surface-container-low/40 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setShowMergeModal(false)}
                                className="px-4 py-2 rounded-sm border border-outline-variant/65 text-xs font-label text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
                            >
                                取消
                            </button>
                            <button
                                onClick={() => void handleConfirmMerge()}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-sm bg-primary text-on-primary text-xs font-label font-medium hover:bg-primary-dim transition-colors cursor-pointer"
                            >
                                <Merge size={14} />
                                <span>确认装订并铺入打字机</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
