import { Sparkles, BookOpen, Bot, RefreshCw, ArrowLeft, Download, Shuffle, ChevronsLeft, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { db } from '../db';
import { WORD_CATEGORIES, CHARACTER_LAYERS, pickScene } from '../inspire';
import { backToHome, pickNextChallenge, pickNextCharacterPrompt } from '../lib/session';
import { loadCustomCategories, onCustomCategoriesChange } from '../lib/customCategories';
import { categoryIcon, CHARACTER_LAYER_STYLE } from '../ui/meta';
import type { AiAssist } from './useAiAssist';

/** 导入的提示文件：每行一条，空行忽略，去掉开头的 ● • - * */
function parseImportLines(text: string) {
    return text.split('\n').map(l => l.trim()).filter(l => l.length > 0).map(l => l.replace(/^[\u25cf\u2022\-*]\s*/, ''));
}

function useCustomIconKeys() {
    const read = () => Object.fromEntries(loadCustomCategories().map(c => [c.name, c.iconKey]));
    const [keys, setKeys] = useState(read);
    useEffect(() => onCustomCategoriesChange(() => setKeys(read())), []);
    return keys;
}

/** 写作页左侧栏：各模式的筛选和操作 + 限时写作 */
export default function ModeSidebar({ ai, libraryOpen, onToggleLibrary }: { ai: AiAssist; libraryOpen: boolean; onToggleLibrary: () => void }) {
    const store = useStore();
    const customIconKeys = useCustomIconKeys();
    return (
        <aside className={`transition-all duration-300 hidden md:flex ${store.sidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-64 glass-panel bg-surface-container-low/40 flex-col p-6 border-r border-outline-variant/10 shrink-0'}`}>
            <button onClick={backToHome} className="flex items-center space-x-2 text-on-surface-variant hover:text-primary transition-colors mb-6 group">
                <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                <span className="font-label text-xs">返回选择</span>
            </button>

            {/* Words mode sidebar */}
            {store.writingMode === 'words' && (
                <>
                    <div className="mb-6">
                        <h2 className="font-headline text-lg font-semibold text-on-surface">词汇分类</h2>
                        <p className="text-[12px] font-label uppercase tracking-widest text-on-surface-variant mt-1">筛选词条类型</p>
                    </div>
                    <nav className="space-y-1 flex-1 overflow-y-auto pr-2">
                        {WORD_CATEGORIES.map(cat => {
                            const active = store.selectedCategories.includes(cat);
                            return (
                                <button key={cat}
                                    onClick={() => store.toggleCategory(cat)}
                                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 ${active ? 'bg-surface-container-high text-primary shadow-sm dark:shadow-[0_0_15px_rgba(186,158,255,0.12)] active:scale-95' : 'text-on-surface-variant hover:bg-surface-container dark:hover:bg-white/5 hover:translate-x-1'}`}>
                                    {(() => { const CatIcon = categoryIcon(cat, customIconKeys); return <CatIcon size={20} />; })()}
                                    <span className="font-label text-xs uppercase tracking-widest flex-1 text-left">{cat}</span>
                                    {active && <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>}
                                </button>
                            );
                        })}
                        <div className="pt-6 pb-2">
                            <h3 className="font-headline text-[15px] font-semibold text-on-surface mb-3">词条数量</h3>
                            <div className="flex space-x-2">
                                {([3, 4, 5] as const).map(n => (
                                    <button key={n} onClick={() => store.setWordCount(n)}
                                        className={`flex-1 py-1.5 rounded text-xs font-label transition-colors ${store.wordCount === n ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-highest'}`}>
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="pt-4">
                            <button
                                onClick={onToggleLibrary}
                                className={`w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg text-xs font-label transition-all ${libraryOpen
                                        ? 'bg-amber-100 text-amber-800 font-medium dark:bg-amber-500/15 dark:text-[#ffb148]'
                                        : 'bg-surface-container-high text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-highest hover:text-[#ffb148]'
                                    }`}
                            >
                                <BookOpen size={16} />
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
                        <h2 className="font-headline text-lg font-semibold text-on-surface">场景描写</h2>
                        <p className="text-[12px] font-label uppercase tracking-widest text-on-surface-variant mt-1">用文字描绘画面</p>
                    </div>
                    <div className="flex-1 flex flex-col space-y-3">
                        <button onClick={() => { store.setCurrentScene(pickScene({ exclude: store.currentScene?.id })); }} className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-surface-container-high border border-outline-variant/30 rounded-lg text-sm font-label text-on-surface-variant hover:text-primary hover:border-primary/30 transition-all">
                            <RefreshCw size={18} />
                            <span>换一个场景</span>
                        </button>

                        {store.aiEnabled && (
                            <>
                                <button
                                    onClick={ai.sceneDeepDive}
                                    disabled={ai.sceneLoading || !store.currentScene}
                                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50/60 dark:bg-blue-500/5 border border-blue-200/40 dark:border-blue-400/10 rounded-lg text-xs font-label text-blue-700 dark:text-blue-400 hover:bg-blue-100/60 dark:hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                                >
                                    {ai.sceneLoading ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                    <span>{ai.sceneLoading ? '生成中…' : 'AI 补充感官细节'}</span>
                                </button>
                                <button
                                    onClick={ai.sceneGenerate}
                                    disabled={ai.sceneLoading}
                                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50/60 dark:bg-blue-500/5 border border-blue-200/40 dark:border-blue-400/10 rounded-lg text-xs font-label text-blue-700 dark:text-blue-400 hover:bg-blue-100/60 dark:hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                                >
                                    <Bot size={16} />
                                    <span>AI 生成新场景</span>
                                </button>
                                {ai.sceneExtra && (
                                    <div className="bg-blue-50/60 dark:bg-blue-500/5 border border-blue-200/40 dark:border-blue-400/10 rounded-lg p-3">
                                        <p className="text-[12px] font-label uppercase tracking-widest text-blue-600 dark:text-blue-600 mb-1.5 flex items-center gap-1">
                                            <Sparkles size={14} />感官引导
                                        </p>
                                        <p className="text-sm text-blue-900 dark:text-blue-700 leading-relaxed whitespace-pre-line">{ai.sceneExtra}</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </>
            )}

            {/* Dream mode sidebar */}
            {store.writingMode === 'dream' && (
                <>
                    <div className="mb-6">
                        <h2 className="font-headline text-lg font-semibold text-on-surface">梦境记录</h2>
                        <p className="text-[12px] font-label uppercase tracking-widest text-on-surface-variant mt-1">记录你的梦</p>
                    </div>
                    <div className="flex-1 space-y-4">
                        <div className="bg-stone-50/80 dark:bg-stone-500/10 border border-violet-200/60 dark:border-violet-400/15 rounded-lg p-4">
                            <p className="font-headline text-sm font-medium text-violet-600 dark:text-violet-500 mb-2">让梦指引你</p>
                            <ul className="text-xs text-violet-600/70 dark:text-violet-600/80 space-y-1.5 leading-relaxed">
                            <li>梦能够到达我们的理性到达不了的地方。</li>
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
                        <h2 className="font-headline text-lg font-semibold text-on-surface">自由发挥</h2>
                        <p className="text-[12px] font-label uppercase tracking-widest text-on-surface-variant mt-1">想到什么写什么</p>
                    </div>
                    <div className="flex-1 space-y-4">
                        <div className="bg-emerald-50/80 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-400/15 rounded-lg p-4">
                            <p className="font-headline text-sm font-medium text-emerald-900 dark:text-emerald-600 mb-2">✍ 自由模式</p>
                            <p className="text-xs text-emerald-800/70 dark:text-emerald-600/70 leading-relaxed">没有提示、没有限制。把脑子里的想法直接咀尾到纸上。想写什么就写什么。</p>
                        </div>
                    </div>
                </>
            )}
            {/* Challenge mode sidebar */}
            {store.writingMode === 'challenge' && (
                <>
                    <div className="mb-6">
                        <h2 className="font-headline text-lg font-semibold text-on-surface">写作挑战</h2>
                        <p className="text-[12px] font-label uppercase tracking-widest text-on-surface-variant mt-1">你问我不一定答</p>
                    </div>
                    <div className="flex-1 flex flex-col space-y-4">
                        <div className="bg-rose-50/80 dark:bg-rose-500/10 border border-rose-200/60 dark:border-rose-400/15 rounded-lg p-4">
                            <p className="font-headline text-sm font-medium text-rose-900 dark:text-rose-500 mb-2">💭 练习提示</p>
                            <ul className="text-xs text-rose-800/70 dark:text-rose-600/70 space-y-1.5 leading-relaxed">
                                <li>• 不必写出「标准答案」</li>
                                <li>• 尽可能尝试多种表达方式</li>
                                <li>• 允许自己「错」和「奇思妙想」</li>
                                <li>• 换一题继续就好</li>
                            </ul>
                        </div>
                        <label className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-surface-container-high border border-outline-variant/30 rounded-lg text-xs font-label text-on-surface-variant hover:text-error hover:border-error/30 transition-all cursor-pointer">
                            <Download size={18} />
                            <span>导入提示 (.md)</span>
                            <input type="file" accept=".md,.txt" className="hidden" onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const lines = parseImportLines(await file.text());
                                if (lines.length === 0) return;
                                const newChallenges = lines.map((t, i) => ({
                                    id: `user_${Date.now()}_${i}`,
                                    text: t,
                                    source: 'user' as const,
                                }));
                                await db.challenges.bulkPut(newChallenges);
                                pickNextChallenge(store.currentChallenge?.id);
                                e.target.value = '';
                            }} />
                        </label>
                        <div className="bg-surface-container-low dark:bg-surface-container-high border border-outline-variant/15 rounded-lg px-3 py-2.5 text-[12px] font-label text-on-surface-variant leading-relaxed">
                            <p className="text-on-surface-variant font-medium mb-1">文件格式示例</p>
                            <p className="text-[14px] text-outline mb-1.5">每行一条提示，空行忽略，支持 - / * / • 开头</p>
                            <pre className="font-mono text-[14px] text-on-surface-variant whitespace-pre-wrap leading-relaxed">{`- 只用动作展示愤怒，不提情绪\n用感官细节描写一场分离\n• 在对话中藏一个人说谎的信号`}</pre>
                        </div>
                    </div>
                </>
            )}

            {/* Character mode sidebar */}
            {store.writingMode === 'character' && (
                <>
                    <div className="mb-5">
                        <h2 className="font-headline text-lg font-semibold text-on-surface">角色描写</h2>
                        <p className="text-[12px] font-label uppercase tracking-widest text-on-surface-variant mt-1">六个维度深挖角色</p>
                    </div>
                    <div className="flex-1 flex flex-col space-y-2 overflow-y-auto">
                        {/* Layer filter */}
                        <p className="text-[12px] font-label text-on-surface-variant uppercase tracking-widest mb-1">切换维度</p>
                        <button
                            onClick={() => { store.setSelectedCharacterLayer(null); pickNextCharacterPrompt(store.currentCharacterPrompt?.id, null); }}
                            className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left text-xs font-label transition-all ${store.selectedCharacterLayer === null
                                    ? 'bg-stone-100 text-fuchsia-800 font-medium dark:bg-[rgb(136_41_211/40%)] dark:text-[#c7b8ed]'
                                    : 'text-on-surface-variant hover:bg-surface-container dark:hover:bg-white/5'
                                }`}
                        >
                            <Shuffle size={16} />
                            <span>全部维度</span>
                        </button>
                        {CHARACTER_LAYERS.map(layer => (
                            <button
                                key={layer.id}
                                onClick={() => {
                                    store.setSelectedCharacterLayer(layer.id);
                                    pickNextCharacterPrompt(store.currentCharacterPrompt?.id, layer.id);
                                }}
                                className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-left text-xs font-label transition-all ${store.selectedCharacterLayer === layer.id
                                        ? `${CHARACTER_LAYER_STYLE[layer.id].color} font-medium`
                                        : 'text-on-surface-variant hover:bg-surface-container dark:hover:bg-white/5'
                                    }`}
                            >
                                {(() => {
                                    const LayerIcon = CHARACTER_LAYER_STYLE[layer.id].Icon;
                                    return <LayerIcon size={16} />;
                                })()}
                                <div className="flex-1 min-w-0">
                                    <div>{layer.name}</div>
                                </div>
                            </button>
                        ))}

                        <div className="pt-3 space-y-2">
                            <label className="flex items-center justify-center space-x-2 px-3 py-2 bg-surface-container-high border border-outline-variant/30 rounded-lg text-xs font-label text-on-surface-variant hover:text-fuchsia-300 hover:border-fuchsia-400/30 transition-all cursor-pointer">
                                <Download size={16} />
                                <span>导入提示 (.md)</span>
                                <input type="file" accept=".md,.txt" className="hidden" onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const lines = parseImportLines(await file.text());
                                    if (lines.length === 0) return;
                                    const layer = store.selectedCharacterLayer || 'inner';
                                    const newPrompts = lines.map((t, i) => ({
                                        id: `char_user_${Date.now()}_${i}`,
                                        text: t,
                                        layer,
                                        source: 'user' as const,
                                    }));
                                    await db.characterPrompts.bulkPut(newPrompts);
                                    pickNextCharacterPrompt(store.currentCharacterPrompt?.id);
                                    e.target.value = '';
                                }} />
                            </label>
                            <div className="bg-surface-container-low dark:bg-surface-container-high border border-outline-variant/15 rounded-lg px-3 py-2.5 text-[12px] font-label text-on-surface-variant leading-relaxed">
                                <p className="text-on-surface-variant font-medium mb-1">文件格式示例</p>
                                <p className="text-[14px] text-outline mb-1.5">每行一条提示，将归入当前选中维度</p>
                                <pre className="font-mono text-[14px] text-on-surface-variant whitespace-pre-wrap leading-relaxed">{`- 他最害怕失去什么？\n她能原谅什么，不能原谅什么？\n• 他的沉默意味着什么`}</pre>
                            </div>
                        </div>
                    </div>
                </>
            )}
            {/* Timer (all modes) */}
            <div className="pt-4 pb-2 border-t border-outline-variant/15 mt-auto">
                <h3 className="font-headline text-[15px] font-semibold text-on-surface mb-3">限时写作</h3>
                <div className="grid grid-cols-2 gap-2">
                    {([10, 15, 20, 30] as const).map(n => (
                        <button key={n} onClick={() => store.setTimerDuration(n)}
                            className={`py-1.5 rounded text-[12px] font-label transition-colors ${store.timerDuration === n ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-highest'}`}>
                            {n}分
                        </button>
                    ))}
                </div>
            </div>

            <div className="pt-4">
                <button onClick={() => store.toggleSidebar()} className="w-full py-2 flex items-center justify-center space-x-2 text-on-surface-variant hover:text-on-surface transition-colors text-xs font-label border border-transparent hover:border-outline-variant/30 rounded">
                    <ChevronsLeft size={16} />
                    <span>收起侧边栏</span>
                </button>
            </div>
        </aside>
    );
}
