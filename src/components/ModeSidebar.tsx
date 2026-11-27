import { BookOpen, Download, Shuffle, SlidersHorizontal, ChevronDown, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { db } from '../db';
import { WORD_CATEGORIES, CHARACTER_LAYERS, parsePromptLines } from '../inspire';
import { pickNextChallenge, pickNextCharacterPrompt } from '../lib/session';
import { loadCustomCategories, onCustomCategoriesChange } from '../lib/customCategories';
import { categoryIcon } from '../ui/meta';

function useCustomIconKeys() {
    const read = () => Object.fromEntries(loadCustomCategories().map(c => [c.name, c.iconKey]));
    const [keys, setKeys] = useState(read);
    useEffect(() => onCustomCategoriesChange(() => setKeys(read())), []);
    return keys;
}

export default function ModeSidebar({
    libraryOpen,
    onToggleLibrary,
}: {
    libraryOpen: boolean;
    onToggleLibrary: () => void;
}) {
    const store = useStore();
    const customIconKeys = useCustomIconKeys();
    const [filtersExpanded, setFiltersExpanded] = useState(false);
    const [importExpanded, setImportExpanded] = useState(false);

    return (
        <div className="space-y-4">
            {/* 词汇模式：可折叠词类筛选 + 词条数量 + 词库管理 */}
            {store.writingMode === 'words' && (
                <div className="border border-outline-variant/60 rounded-sm bg-surface-container/70 overflow-hidden">
                    <div className="px-3 py-2 flex items-center justify-between gap-2">
                        <button
                            onClick={() => setFiltersExpanded(v => !v)}
                            className="flex items-center gap-1.5 text-xs font-label font-medium text-on-surface hover:text-primary transition-colors cursor-pointer min-w-0"
                        >
                            <SlidersHorizontal size={13} className="text-secondary shrink-0" />
                            <span className="whitespace-nowrap">抽词设置</span>
                            <span className="text-[11px] text-outline whitespace-nowrap">
                                ({store.selectedCategories.length === 0 ? '全部' : `${store.selectedCategories.length}类`}·{store.wordCount}词)
                            </span>
                            <ChevronDown size={13} className={`text-outline shrink-0 transition-transform ${filtersExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        <button
                            onClick={onToggleLibrary}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-sm font-label text-[11px] font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                libraryOpen
                                    ? 'bg-primary text-on-primary border-primary'
                                    : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/60 hover:border-secondary hover:text-on-surface'
                            }`}
                        >
                            <BookOpen size={12} />
                            <span>{libraryOpen ? '返回写作' : '词库管理'}</span>
                        </button>
                    </div>

                    {filtersExpanded && (
                        <div className="px-3 pb-3 pt-2 border-t border-dashed border-outline-variant/55 space-y-3">
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="font-label text-xs text-outline">词条分类</span>
                                    {store.selectedCategories.length > 0 && (
                                        <button
                                            onClick={() => store.setSelectedCategories([])}
                                            className="font-label text-[11px] text-primary hover:underline cursor-pointer"
                                        >
                                            重置
                                        </button>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {WORD_CATEGORIES.map(cat => {
                                        const active = store.selectedCategories.includes(cat);
                                        const CatIcon = categoryIcon(cat, customIconKeys);
                                        return (
                                            <button
                                                key={cat}
                                                onClick={() => store.toggleCategory(cat)}
                                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-label border transition-colors cursor-pointer ${
                                                    active
                                                        ? 'bg-primary text-on-primary border-primary font-medium'
                                                        : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/55 hover:border-secondary'
                                                }`}
                                            >
                                                <CatIcon size={12} />
                                                <span>{cat}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                                <span className="font-label text-xs text-outline">抽取张数</span>
                                <div className="flex gap-1.5">
                                    {([3, 4, 5] as const).map(n => (
                                        <button
                                            key={n}
                                            onClick={() => store.setWordCount(n)}
                                            className={`w-8 py-1 rounded-sm font-label text-xs border transition-colors cursor-pointer ${
                                                store.wordCount === n
                                                    ? 'bg-primary text-on-primary border-primary font-bold'
                                                    : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/55 hover:border-secondary'
                                            }`}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 角色模式：6 个维度快速切换 */}
            {store.writingMode === 'character' && (
                <div className="border border-outline-variant/60 rounded-sm bg-surface-container/70 p-3">
                    <p className="font-label text-xs text-outline mb-2">人物维度</p>
                    <div className="flex flex-wrap gap-1.5">
                        <button
                            onClick={() => {
                                store.setSelectedCharacterLayer(null);
                                void pickNextCharacterPrompt(store.currentCharacterPrompt?.id, null);
                            }}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-label border transition-colors cursor-pointer ${
                                store.selectedCharacterLayer === null
                                    ? 'bg-primary text-on-primary border-primary font-medium'
                                    : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/55 hover:border-secondary'
                            }`}
                        >
                            <Shuffle size={11} />
                            <span>全部</span>
                        </button>
                        {CHARACTER_LAYERS.map(layer => {
                            const active = store.selectedCharacterLayer === layer.id;
                            return (
                                <button
                                    key={layer.id}
                                    onClick={() => {
                                        store.setSelectedCharacterLayer(layer.id);
                                        void pickNextCharacterPrompt(store.currentCharacterPrompt?.id, layer.id);
                                    }}
                                    className={`px-2 py-1 rounded-sm text-xs font-label border transition-colors cursor-pointer ${
                                        active
                                            ? 'bg-primary text-on-primary border-primary font-medium'
                                            : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/55 hover:border-secondary'
                                    }`}
                                >
                                    {layer.name}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 挑战 / 角色模式：自定义题库导入折叠条 */}
            {(store.writingMode === 'challenge' || store.writingMode === 'character') && (
                <div className="border border-dashed border-outline-variant/60 rounded-sm px-3 py-2 bg-surface-container/40">
                    <div className="flex items-center justify-between gap-2">
                        <label className="inline-flex items-center gap-1.5 text-xs font-label text-on-surface-variant hover:text-primary transition-colors cursor-pointer">
                            <Download size={13} />
                            <span>导入提示 (.md / .txt)</span>
                            <input
                                type="file"
                                accept=".md,.txt"
                                className="hidden"
                                onChange={async e => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const lines = parsePromptLines(await file.text());
                                    if (lines.length === 0) return;
                                    if (store.writingMode === 'challenge') {
                                        await db.challenges.bulkPut(
                                            lines.map((t, i) => ({
                                                id: `user_${Date.now()}_${i}`,
                                                text: t,
                                                source: 'user' as const,
                                            }))
                                        );
                                        void pickNextChallenge(store.currentChallenge?.id);
                                    } else {
                                        const layer = store.selectedCharacterLayer || 'inner';
                                        await db.characterPrompts.bulkPut(
                                            lines.map((t, i) => ({
                                                id: `char_user_${Date.now()}_${i}`,
                                                text: t,
                                                layer,
                                                source: 'user' as const,
                                            }))
                                        );
                                        void pickNextCharacterPrompt(store.currentCharacterPrompt?.id);
                                    }
                                    store.showToast(`📥 已导入 ${lines.length} 条提示`);
                                    e.target.value = '';
                                }}
                            />
                        </label>
                        <button
                            onClick={() => setImportExpanded(v => !v)}
                            className="font-label text-[11px] text-outline hover:text-on-surface cursor-pointer"
                        >
                            {importExpanded ? '收起' : '说明'}
                        </button>
                    </div>
                    {importExpanded && (
                        <p className="mt-2 pt-2 border-t border-dashed border-outline-variant/45 font-body text-xs text-outline leading-relaxed">
                            每行一条提示，空行忽略，支持 - / * / • 开头。
                        </p>
                    )}
                </div>
            )}

            {/* 全模式通用：限时写作 */}
            <div className="pt-3 border-t border-dashed border-outline-variant/60">
                <div className="flex items-center justify-between mb-2">
                    <span className="font-label text-xs text-outline flex items-center gap-1">
                        <Timer size={12} className={store.timerActive ? 'text-primary' : 'text-secondary'} />
                        <span>限时写作</span>
                    </span>
                    <button
                        onClick={() => {
                            const next = !store.timerActive;
                            store.setTimerActive(next);
                            if (!next) store.setTimerSeconds(0);
                        }}
                        className={`font-label text-[11px] px-2 py-0.5 rounded-sm border transition-colors cursor-pointer ${
                            store.timerActive
                                ? 'bg-primary text-on-primary border-primary'
                                : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/60 hover:border-primary/50'
                        }`}
                    >
                        {store.timerActive ? '停止' : '开始'}
                    </button>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                    {([10, 15, 20, 30] as const).map(n => (
                        <button
                            key={n}
                            onClick={() => store.setTimerDuration(n)}
                            className={`py-1 rounded-sm font-label text-xs border transition-colors cursor-pointer ${
                                store.timerDuration === n
                                    ? 'bg-secondary-container text-on-secondary-container border-secondary/60 font-bold'
                                    : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/50 hover:border-secondary/40'
                            }`}
                        >
                            {n}分
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
