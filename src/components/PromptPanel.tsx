import { X, Sparkles, Star, RefreshCw, Dices, User, Mountain, CircleHelp, Lock, LockOpen, LoaderCircle } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from '../store';
import { CHARACTER_LAYERS, pickGenre } from '../inspire';
import type { PromptFavorite } from '../types';
import { drawNewWords, pickNextChallenge, pickNextCharacterPrompt, toggleWordSetFavorite } from '../lib/session';
import { isPromptFavorited, togglePromptFavorite } from '../lib/drafts';
import { CHARACTER_LAYER_STYLE, GENRE_STYLE, WORD_CARD_STYLE } from '../ui/meta';
import type { AiAssist } from './useAiAssist';

/** 桌面端是编辑器左边一栏；手机上点「灵感」从右侧滑出，带遮罩 */
function Panel({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
    return (
        <>
            {open && (
                <div
                    className="md:hidden fixed inset-0 z-[55] bg-black/40 backdrop-blur-sm transition-opacity duration-300"
                    onClick={onClose}
                />
            )}
            <section className={`${open
                ? 'fixed right-0 top-0 bottom-0 w-[85%] max-w-[360px] z-[60] bg-surface-container-low shadow-2xl translate-x-0'
                : 'fixed right-0 top-0 bottom-0 w-[85%] max-w-[360px] z-[60] translate-x-full md:translate-x-0'
            } transition-transform duration-300 ease-in-out overflow-y-auto pt-4 px-4 pb-20 md:relative md:block md:w-80 md:bg-surface-container-low md:overflow-y-auto md:shrink-0 md:border-r md:border-outline-variant/10 md:z-auto`}>
                <div className="p-5 md:p-8 flex flex-col space-y-6">
                    <button onClick={onClose} className="md:hidden mb-2 flex items-center gap-1 text-sm text-on-surface-variant"><X size={18} />收起</button>
                    {children}
                </div>
            </section>
        </>
    );
}

type FavoriteEntry = Omit<PromptFavorite, 'id' | 'createdAt'>;

/** 当前题目有没有收藏 + 切换收藏 */
function usePromptFavorite(entry: FavoriteEntry | null, label: string) {
    const showToast = useStore(s => s.showToast);
    const [fav, setFav] = useState({ id: '', on: false });
    const id = entry?.itemId ?? '';
    const module = entry?.module;
    useEffect(() => {
        if (!id || !module) return;
        let cancelled = false;
        isPromptFavorited(module, id)
            .then(on => { if (!cancelled) setFav({ id, on }); })
            .catch(() => { if (!cancelled) setFav({ id, on: false }); });
        return () => { cancelled = true; };
    }, [module, id]);
    async function toggle() {
        if (!entry) return;
        try {
            const on = await togglePromptFavorite(entry);
            setFav({ id: entry.itemId, on });
            showToast(on ? `⭐ 已收藏${label}` : '取消收藏');
        } catch (e) {
            console.error('Failed to toggle prompt favorite', e);
        }
    }
    return { on: fav.id === id && fav.on, toggle };
}

/** 写作页的提示卡：词卡 / 场景 / 挑战题 / 角色题 */
export default function PromptPanel({ ai, mobileOpen, onClose }: { ai: AiAssist; mobileOpen: boolean; onClose: () => void }) {
    const store = useStore();
    const scene = store.currentScene;
    const challenge = store.currentChallenge;
    const character = store.currentCharacterPrompt;
    const characterLayer = character && CHARACTER_LAYERS.find(l => l.id === character.layer);
    const sceneFav = usePromptFavorite(scene && {
        module: 'scene', itemId: scene.id, title: scene.title, description: scene.description, tags: scene.tags, isAi: scene.id.startsWith('ai_'),
    }, '场景题目');
    const challengeFav = usePromptFavorite(challenge && {
        module: 'challenge', itemId: challenge.id, title: challenge.text, isAi: challenge.id.startsWith('ai_'),
    }, '挑战题目');
    const characterFav = usePromptFavorite(character && {
        module: 'character', itemId: character.id, title: character.text,
        description: characterLayer ? `维度：${characterLayer.name}` : undefined, isAi: character.id.startsWith('ai_'),
    }, '人物题目');

    return (
        <>
            {store.writingMode === 'words' && (
                <Panel open={mobileOpen} onClose={onClose}>
                        <div className="mb-2">
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-label text-[12px] uppercase tracking-[0.2em] text-outline">词汇灵感</span>
                                <div className="flex space-x-1">
                                    <button onClick={toggleWordSetFavorite} className="p-1 hover:bg-surface-container rounded group transition-all" title="收藏">
                                        <Star size={20} className={`transition-colors ${store.isCurrentWordSetFavorite ? 'text-amber-500 fill-current' : 'text-outline group-hover:text-amber-500 dark:group-hover:text-[#ffb148]'}`} />
                                    </button>
                                    <button className="p-1 hover:bg-surface-container rounded group transition-all" title="换一组 (Space)" onClick={drawNewWords}>
                                        <Dices size={20} className="text-outline group-hover:text-primary transition-colors" />
                                    </button>
                                </div>
                            </div>
                            <h3 className="font-headline text-2xl text-on-surface">写作灵感</h3>
                        </div>

                        {store.currentWords.length > 0 && (
                            <div className={`flex items-center space-x-2 px-4 py-3 rounded-lg border ${store.drawnGenre ? (GENRE_STYLE[store.drawnGenre]?.bg ?? 'bg-stone-100 border-stone-200') : 'bg-surface-container-high border-outline-variant/30'}`}>
                                {(() => {
                                    const GenreIcon = (store.drawnGenre && GENRE_STYLE[store.drawnGenre]?.Icon) || Sparkles;
                                    return <GenreIcon size={20} />;
                                })()}
                                <div className="flex-1">
                                    <p className="text-[12px] font-label uppercase tracking-widest text-on-surface-variant">写作风格</p>
                                    <p className="font-headline font-bold text-base leading-tight">{store.drawnGenre || '不限风格'}</p>
                                </div>
                                <button onClick={() => store.setDrawnGenre(pickGenre())} className="p-1 rounded hover:bg-surface-container transition-colors" title="换一个风格">
                                    <RefreshCw size={18} className="text-outline" />
                                </button>
                                <button onClick={() => store.setDrawnGenre(null)} className="p-1 rounded hover:bg-surface-container transition-colors" title="清除风格约束">
                                    <X size={18} className="text-outline" />
                                </button>
                            </div>
                        )}

                        {/* AI 写作引导 */}
                        {store.aiEnabled && store.currentWords.length > 0 && (
                            <div className="bg-amber-50/60 dark:bg-amber-500/5 border border-amber-200/40 dark:border-amber-400/10 rounded-lg p-3">
                                {ai.wordHint ? (
                                    <div>
                                        <p className="text-[12px] font-label uppercase tracking-widest text-amber-600 dark:text-amber-500 mb-1.5 flex items-center gap-1">
                                            <Sparkles size={14} />AI 灵感引导
                                        </p>
                                        <p className="text-sm text-amber-900 dark:text-amber-600 leading-relaxed">{ai.wordHint}</p>
                                    </div>
                                ) : (
                                    <button
                                        onClick={ai.wordHintRun}
                                        disabled={ai.wordHintLoading}
                                        className="w-full flex items-center justify-center gap-1.5 py-1 text-xs font-label text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 transition-colors disabled:opacity-50"
                                    >
                                        {ai.wordHintLoading ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                        <span>{ai.wordHintLoading ? 'AI 思考中…' : 'AI 帮我找灵感'}</span>
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="space-y-4">
                            {store.currentWords.map((w, i) => {
                                const cat = w.category || w.genres?.[0] || '意象';
                                const catStyle = WORD_CARD_STYLE[cat] ?? WORD_CARD_STYLE['意象'];
                                const flipping = store.wordsFlipping && !store.lockedIndices.has(i);
                                return (
                                    <div key={`${w.id}_${i}`} className="card-perspective">
                                        <div className={`${catStyle.glow} bg-surface-container p-6 rounded-lg border border-outline-variant/10 custom-shadow dark:shadow-none relative overflow-hidden group transition-all hover:bg-surface-container-high ${flipping ? 'card-flipping' : ''}`}>
                                            <div className="flex justify-between items-start mb-4 relative z-10">
                                                <span className={`px-2 py-1 text-[12px] font-bold font-label rounded-lg tracking-wider uppercase ${catStyle.badge}`}>
                                                    {w.category || w.genres?.[0] || '意象'}
                                                </span>
                                                <button onClick={() => store.toggleLock(i)} className={`text-sm transition-colors ${store.lockedIndices.has(i) ? 'text-primary' : 'text-stone-300 dark:text-outline hover:text-stone-500 dark:hover:text-on-surface-variant'}`}>
                                                    {store.lockedIndices.has(i) ? <Lock size={16} /> : <LockOpen size={16} />}
                                                </button>
                                            </div>
                                            <h4 className="font-headline text-2xl font-bold mb-3 text-stone-900 dark:text-on-surface leading-tight relative z-10">{w.text}</h4>
                                            {w.explanation && (
                                                <p className="text-sm text-stone-700 dark:text-on-surface-variant leading-relaxed relative z-10">{w.explanation}</p>
                                            )}
                                            <div className="absolute inset-0 opacity-[0.03] dark:opacity-0 pointer-events-none paper-texture"></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Panel>
            )}

            {/* Scene Prompt Panel */}
            {store.writingMode === 'scene' && store.currentScene && (
                <Panel open={mobileOpen} onClose={onClose}>
                        <div className="mb-2">
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-label text-[12px] uppercase tracking-[0.2em] text-outline">场景描写</span>
                            </div>
                            <h3 className="font-headline text-2xl text-on-surface">描写挑战</h3>
                        </div>

                        <div className="bg-surface-container p-6 rounded-lg border border-outline-variant/10 relative overflow-hidden transition-all hover:bg-surface-container-high">
                            <Mountain size={34} className="text-blue-400 dark:text-[#69a8f6] mb-4 block" />
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <h4 className="font-headline text-xl font-bold text-stone-900 dark:text-on-surface">{store.currentScene.title}</h4>
                                <button onClick={sceneFav.toggle} className="p-1 hover:bg-surface-container rounded group transition-all" title={sceneFav.on ? '取消收藏' : '收藏题目'}>
                                    <Star size={20} className={`transition-colors ${sceneFav.on ? 'text-amber-500 fill-current' : 'text-outline group-hover:text-amber-500 dark:group-hover:text-[#ffb148]'}`} />
                                </button>
                            </div>
                            <p className="text-sm text-stone-700 dark:text-on-surface-variant leading-relaxed mb-4">{store.currentScene.description}</p>
                            <div className="flex flex-wrap gap-1.5">
                                {store.currentScene.tags.map(tag => (
                                    <span key={tag} className="px-2.5 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-700 text-[12px] font-label rounded-full border border-blue-200/50 dark:border-blue-400/20">{tag}</span>
                                ))}
                            </div>
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none paper-texture"></div>
                        </div>

                    </Panel>
            )}

            {/* Challenge Panel */}
            {store.writingMode === 'challenge' && store.currentChallenge && (
                <Panel open={mobileOpen} onClose={onClose}>
                        <div className="mb-2">
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-label text-[12px] uppercase tracking-[0.2em] text-outline">写作挑战</span>
                                <button className="p-1 hover:bg-surface-container rounded group transition-all" title="换一题" onClick={() => pickNextChallenge(store.currentChallenge?.id)}>
                                    <RefreshCw size={20} className="text-outline group-hover:text-primary transition-colors" />
                                </button>
                            </div>
                            <h3 className="font-headline text-2xl text-on-surface">习作题目</h3>
                        </div>

                        <div className="bg-surface-container p-6 rounded-lg border border-outline-variant/10 relative overflow-hidden transition-all hover:bg-surface-container-high">
                            <CircleHelp size={34} className="text-rose-400 dark:text-rose-300 mb-4 block" />
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-base text-stone-800 dark:text-on-surface leading-relaxed font-medium">{store.currentChallenge.text}</p>
                                <button onClick={challengeFav.toggle} className="p-1 hover:bg-surface-container rounded group transition-all" title={challengeFav.on ? '取消收藏' : '收藏题目'}>
                                    <Star size={20} className={`transition-colors ${challengeFav.on ? 'text-amber-500 fill-current' : 'text-outline group-hover:text-amber-500 dark:group-hover:text-[#ffb148]'}`} />
                                </button>
                            </div>
                            {store.currentChallenge.id.startsWith('ai_') && (
                                <span className="mt-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100/80 dark:bg-rose-500/10 border border-rose-200/50 dark:border-rose-400/20 text-[12px] font-label text-rose-600 dark:text-rose-400">
                                    <Sparkles size={13} />AI 出题
                                </span>
                            )}
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none paper-texture"></div>
                        </div>

                        {/* AI 出题 */}
                        {store.aiEnabled && (
                            <button
                                onClick={ai.challengeGenerate}
                                disabled={ai.challengeLoading}
                                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50/60 dark:bg-rose-500/5 border border-rose-200/40 dark:border-rose-400/10 rounded-lg text-xs font-label text-rose-700 dark:text-rose-400 hover:bg-rose-100/60 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                            >
                                {ai.challengeLoading ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                <span>{ai.challengeLoading ? '出题中…' : 'AI 出一道题'}</span>
                            </button>
                        )}
                    </Panel>
            )}

            {/* Character Prompt Panel */}
            {store.writingMode === 'character' && store.currentCharacterPrompt && (() => {
                const layer = CHARACTER_LAYERS.find(l => l.id === store.currentCharacterPrompt!.layer);
                return (
                    <Panel open={mobileOpen} onClose={onClose}>
                            <div className="mb-2">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-label text-[12px] uppercase tracking-[0.2em] text-outline">角色描写</span>
                                    <button className="p-1 hover:bg-surface-container rounded group transition-all" title="换一题" onClick={() => pickNextCharacterPrompt(store.currentCharacterPrompt?.id)}>
                                        <RefreshCw size={20} className="text-outline group-hover:text-primary transition-colors" />
                                    </button>
                                </div>
                                <h3 className="font-headline text-2xl text-on-surface">角色练习</h3>
                            </div>

                            {layer && (
                                <div className={`flex items-start space-x-2 px-3 py-2 rounded-lg border text-xs font-label ${CHARACTER_LAYER_STYLE[layer.id].color}`}>
                                    {(() => {
                                        const LayerIcon = CHARACTER_LAYER_STYLE[layer.id].Icon;
                                        return <LayerIcon size={16} className="shrink-0 mt-0.5" />;
                                    })()}
                                    <div className="flex flex-col min-w-0">
                                        <span className="font-medium">{layer.name}</span>
                                        <span className="opacity-70 leading-relaxed mt-0.5">{layer.description}</span>
                                    </div>
                                </div>
                            )}

                            <div className="bg-surface-container p-6 rounded-lg border border-outline-variant/10 relative overflow-hidden transition-all hover:bg-surface-container-high">
                                <User size={30} className="text-fuchsia-400 dark:text-fuchsia-300 mb-4 block" />
                                <div className="flex items-start justify-between gap-3">
                                    <p className="text-base text-stone-800 dark:text-on-surface leading-relaxed font-medium">{store.currentCharacterPrompt.text}</p>
                                    <button onClick={characterFav.toggle} className="p-1 hover:bg-surface-container rounded group transition-all" title={characterFav.on ? '取消收藏' : '收藏题目'}>
                                        <Star size={20} className={`transition-colors ${characterFav.on ? 'text-amber-500 fill-current' : 'text-outline group-hover:text-amber-500 dark:group-hover:text-[#ffb148]'}`} />
                                    </button>
                                </div>
                                <div className="absolute inset-0 opacity-[0.03] pointer-events-none paper-texture"></div>
                            </div>

                            {/* AI 角色深挖 */}
                            {store.aiEnabled && (
                                <div className="space-y-2">
                                    <button
                                        onClick={ai.characterDeep}
                                        disabled={ai.characterLoading}
                                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-fuchsia-50/60 dark:bg-fuchsia-500/5 border border-fuchsia-200/40 dark:border-fuchsia-400/10 rounded-lg text-xs font-label text-fuchsia-700 dark:text-fuchsia-400 hover:bg-fuchsia-100/60 dark:hover:bg-fuchsia-500/10 transition-colors disabled:opacity-50"
                                    >
                                        {ai.characterLoading ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                        <span>{ai.characterLoading ? '思考中…' : 'AI 深挖角色'}</span>
                                    </button>
                                    <button
                                        onClick={ai.characterGenerate}
                                        disabled={ai.characterGenLoading}
                                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-fuchsia-50/60 dark:bg-fuchsia-500/5 border border-fuchsia-200/40 dark:border-fuchsia-400/10 rounded-lg text-xs font-label text-fuchsia-700 dark:text-fuchsia-400 hover:bg-fuchsia-100/60 dark:hover:bg-fuchsia-500/10 transition-colors disabled:opacity-50"
                                    >
                                        {ai.characterGenLoading ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                        <span>{ai.characterGenLoading ? '出题中…' : 'AI 出一道角色题'}</span>
                                    </button>
                                    {ai.characterExtra && (
                                        <div className="bg-fuchsia-50/60 dark:bg-fuchsia-500/5 border border-fuchsia-200/40 dark:border-fuchsia-400/10 rounded-lg p-3">
                                            <p className="text-[12px] font-label uppercase tracking-widest text-fuchsia-600 dark:text-fuchsia-600 mb-1.5 flex items-center gap-1">
                                                <Sparkles size={14} />AI 追问
                                            </p>
                                            <p className="text-sm text-fuchsia-900 dark:text-fuchsia-700 leading-relaxed">{ai.characterExtra}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </Panel>
                );
            })()}
        </>
    );
}
