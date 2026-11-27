import {
    X, Sparkles, Star, RefreshCw, Dices, User, Mountain, CircleHelp,
    Lock, LockOpen, LoaderCircle, Plus, ArrowLeft, ChevronsLeft, Bot, MoonStar, PencilLine,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useStore } from '../store';
import { CHARACTER_LAYERS, pickGenre, pickScene } from '../inspire';
import type { PromptFavorite } from '../types';
import { backToHome, drawNewWords, pickNextChallenge, pickNextCharacterPrompt, toggleWordSetFavorite } from '../lib/session';
import { isPromptFavorited, togglePromptFavorite } from '../lib/drafts';
import { WORD_CARD_STYLE } from '../ui/meta';
import type { AiAssist } from './useAiAssist';
import ModeSidebar from './ModeSidebar';

function DeskDrawer({
    open,
    collapsed,
    onClose,
    onCollapseDesktop,
    libraryOpen,
    onToggleLibrary,
    children,
}: {
    open: boolean;
    collapsed: boolean;
    onClose: () => void;
    onCollapseDesktop: () => void;
    libraryOpen: boolean;
    onToggleLibrary: () => void;
    children: ReactNode;
}) {
    return (
        <>
            {open && (
                <div
                    className="md:hidden fixed inset-0 z-[55] bg-black/45 backdrop-blur-[2px] transition-opacity duration-300"
                    onClick={onClose}
                />
            )}
            <aside
                className={`${
                    open
                        ? 'fixed right-0 top-0 bottom-0 w-[88%] max-w-[340px] z-[60] translate-x-0 shadow-2xl'
                        : 'fixed right-0 top-0 bottom-0 w-[88%] max-w-[340px] z-[60] translate-x-full'
                } ${
                    collapsed
                        ? 'md:w-0 md:opacity-0 md:overflow-hidden md:border-r-0 md:p-0'
                        : 'md:relative md:translate-x-0 md:w-[320px] md:opacity-100 md:border-r md:border-outline-variant/55'
                } bg-surface-container-low/95 dark:bg-[#171513] transition-all duration-300 ease-in-out overflow-y-auto shrink-0 md:z-auto flex flex-col`}
            >
                <div className="p-5 pb-24 md:pb-8 flex-1 flex flex-col justify-between gap-6">
                    <div className="space-y-5">
                        <div className="flex items-center justify-between pb-3 border-b border-dashed border-outline-variant/60">
                            <button
                                onClick={backToHome}
                                className="inline-flex items-center gap-1.5 text-xs font-label text-on-surface-variant hover:text-primary transition-colors group cursor-pointer"
                            >
                                <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                                <span>返回首页</span>
                            </button>

                            <button
                                onClick={onCollapseDesktop}
                                title="收起侧栏"
                                className="hidden md:inline-flex items-center gap-1 text-xs font-label text-outline hover:text-on-surface transition-colors cursor-pointer"
                            >
                                <ChevronsLeft size={15} />
                                <span>收起</span>
                            </button>

                            <button
                                onClick={onClose}
                                className="md:hidden inline-flex items-center gap-1 text-xs font-label text-on-surface-variant hover:text-on-surface"
                            >
                                <X size={16} />
                                <span>收起</span>
                            </button>
                        </div>

                        {children}
                    </div>

                    <ModeSidebar libraryOpen={libraryOpen} onToggleLibrary={onToggleLibrary} />
                </div>
            </aside>
        </>
    );
}

function SaveToBank({ onSave }: { onSave: () => void }) {
    return (
        <button
            onClick={onSave}
            className="mt-3 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm border border-secondary/50 bg-secondary-container/50 text-secondary text-[13px] font-label hover:opacity-85 transition-opacity cursor-pointer"
        >
            <Plus size={12} />存进题库
        </button>
    );
}

function CandidateList<T extends { id: string; text: string }>({
    items,
    currentId,
    onPick,
}: {
    items: T[];
    currentId: string;
    onPick: (item: T) => void;
}) {
    if (items.length < 2) return null;
    return (
        <div className="space-y-1.5">
            <p className="font-label text-xs text-secondary flex items-center gap-1">
                <Sparkles size={12} />AI 候选题目（点选切换）
            </p>
            {items.map(item => (
                <button
                    key={item.id}
                    onClick={() => onPick(item)}
                    className={`w-full text-left px-3 py-2 rounded-sm border text-xs font-body leading-relaxed transition-colors cursor-pointer ${
                        item.id === currentId
                            ? 'bg-primary-container/55 border-primary/50 text-on-surface font-medium'
                            : 'bg-surface-container border-outline-variant/45 text-on-surface-variant hover:border-secondary/50'
                    }`}
                >
                    {item.text}
                </button>
            ))}
        </div>
    );
}

type FavoriteEntry = Omit<PromptFavorite, 'id' | 'createdAt'>;

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

function BonusDispatchWords() {
    const words = useStore(s => s.currentWords);
    if (words.length === 0) return null;
    return (
        <div className="p-3 rounded-sm bg-surface-container border border-dashed border-secondary/55">
            <p className="font-label text-xs text-secondary mb-2">今日盲盒词条</p>
            <div className="flex flex-wrap gap-1.5">
                {words.map(w => (
                    <span
                        key={w.id}
                        title={w.explanation || undefined}
                        className="px-2.5 py-0.5 bg-surface-container-lowest border border-outline-variant/60 rounded-none text-sm font-headline font-bold text-on-surface"
                    >
                        {w.text}
                    </span>
                ))}
            </div>
        </div>
    );
}

export default function PromptPanel({
    ai,
    mobileOpen,
    onClose,
    libraryOpen,
    onToggleLibrary,
}: {
    ai: AiAssist;
    mobileOpen: boolean;
    onClose: () => void;
    libraryOpen: boolean;
    onToggleLibrary: () => void;
}) {
    const store = useStore();
    const scene = store.currentScene;
    const challenge = store.currentChallenge;
    const character = store.currentCharacterPrompt;
    const characterLayer = character && CHARACTER_LAYERS.find(l => l.id === character.layer);

    const sceneFav = usePromptFavorite(
        scene && {
            module: 'scene',
            itemId: scene.id,
            title: scene.title,
            description: scene.description,
            tags: scene.tags,
            isAi: scene.id.startsWith('ai_'),
        },
        '场景题目'
    );
    const challengeFav = usePromptFavorite(
        challenge && {
            module: 'challenge',
            itemId: challenge.id,
            title: challenge.text,
            isAi: challenge.id.startsWith('ai_'),
        },
        '挑战题目'
    );
    const characterFav = usePromptFavorite(
        character && {
            module: 'character',
            itemId: character.id,
            title: character.text,
            description: characterLayer ? `维度：${characterLayer.name}` : undefined,
            isAi: character.id.startsWith('ai_'),
        },
        '人物题目'
    );

    return (
        <DeskDrawer
            open={mobileOpen}
            collapsed={store.sidebarCollapsed}
            onClose={onClose}
            onCollapseDesktop={store.toggleSidebar}
            libraryOpen={libraryOpen}
            onToggleLibrary={onToggleLibrary}
        >
            {/* ── 词汇灵感 ── */}
            {store.writingMode === 'words' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-headline font-bold text-xl text-on-surface">词汇灵感</h3>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={toggleWordSetFavorite}
                                className="p-1.5 rounded-sm border border-transparent hover:border-outline-variant/60 hover:bg-surface-container transition-all cursor-pointer"
                                title="收藏这组词条"
                            >
                                <Star
                                    size={17}
                                    className={store.isCurrentWordSetFavorite ? 'text-secondary fill-current' : 'text-outline hover:text-secondary'}
                                />
                            </button>
                            <button
                                onClick={drawNewWords}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm bg-primary text-on-primary hover:bg-primary-dim font-label text-xs transition-colors cursor-pointer"
                                title="换一组 (空格)"
                            >
                                <Dices size={14} />
                                <span>换一组</span>
                            </button>
                        </div>
                    </div>

                    {/* 写作风格 */}
                    {store.currentWords.length > 0 && (
                        <div className="flex items-center justify-between px-3 py-2 rounded-sm bg-surface-container border border-outline-variant/60">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="font-label text-xs text-outline">风格</span>
                                <span className="font-headline font-bold text-sm text-on-surface truncate">
                                    {store.drawnGenre || '不限风格'}
                                </span>
                            </div>
                            <div className="flex items-center gap-0.5">
                                <button
                                    onClick={() => store.setDrawnGenre(pickGenre())}
                                    className="p-1 rounded-sm hover:bg-surface-container-high text-outline hover:text-on-surface transition-colors cursor-pointer"
                                    title="随机切换风格"
                                >
                                    <RefreshCw size={14} />
                                </button>
                                {store.drawnGenre && (
                                    <button
                                        onClick={() => store.setDrawnGenre(null)}
                                        className="p-1 rounded-sm hover:bg-surface-container-high text-outline hover:text-on-surface transition-colors cursor-pointer"
                                        title="清除风格约束"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* AI 写作引导 */}
                    {store.aiEnabled && store.currentWords.length > 0 && (
                        <div className="bg-surface-container border border-secondary/45 rounded-sm p-3">
                            {ai.wordHint ? (
                                <div>
                                    <p className="font-label text-xs text-secondary mb-1.5 flex items-center gap-1">
                                        <Sparkles size={12} />AI 灵感点拨
                                    </p>
                                    <p className="text-xs font-body text-on-surface leading-relaxed">{ai.wordHint}</p>
                                </div>
                            ) : (
                                <button
                                    onClick={ai.wordHintRun}
                                    disabled={ai.wordHintLoading}
                                    className="w-full flex items-center justify-center gap-1.5 py-0.5 text-xs font-label text-secondary hover:text-primary transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {ai.wordHintLoading ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                    <span>{ai.wordHintLoading ? 'AI 构思中…' : 'AI 帮我找切入点'}</span>
                                </button>
                            )}
                        </div>
                    )}

                    {/* 词卡列表 */}
                    <div className="space-y-3">
                        {store.currentWords.map((w, i) => {
                            const cat = w.category || w.genres?.[0] || '意象';
                            const catStyle = WORD_CARD_STYLE[cat] ?? WORD_CARD_STYLE['意象'];
                            const locked = store.lockedIndices.has(i);
                            const flipping = store.wordsFlipping && !locked;
                            return (
                                <div key={`${w.id}_${i}`} className="card-perspective">
                                    <div
                                        className={`index-card paper-grain rounded-sm p-4 relative overflow-hidden ${
                                            locked ? 'border-primary/65 bg-primary-container/20' : ''
                                        } ${flipping ? 'card-flipping' : ''}`}
                                    >
                                        <div className="flex justify-between items-center mb-2">
                                            <span className={`px-1.5 py-0.5 text-[13px] font-label border ${catStyle.badge}`}>
                                                {cat}
                                            </span>
                                            <button
                                                onClick={() => store.toggleLock(i)}
                                                title={locked ? '已锁定（点击解锁）' : '锁定此词（换词时保留）'}
                                                className={`p-1 transition-colors cursor-pointer ${
                                                    locked
                                                        ? 'text-primary'
                                                        : 'text-outline hover:text-on-surface'
                                                }`}
                                            >
                                                {locked ? <Lock size={14} /> : <LockOpen size={14} />}
                                            </button>
                                        </div>

                                        <h4 className="font-headline text-xl font-bold text-on-surface leading-snug">
                                            {w.text}
                                        </h4>
                                        {w.explanation && (
                                            <p className="mt-1.5 pt-1.5 border-t border-dashed border-outline-variant/45 text-xs font-body text-on-surface-variant leading-relaxed">
                                                {w.explanation}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── 场景描写 ── */}
            {store.writingMode === 'scene' && store.currentScene && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-headline font-bold text-xl text-on-surface">场景描写</h3>
                        <button
                            onClick={() => store.setCurrentScene(pickScene({ exclude: store.currentScene?.id }))}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm bg-surface-container border border-outline-variant/65 hover:border-primary text-xs font-label text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                        >
                            <RefreshCw size={13} />
                            <span>换一个</span>
                        </button>
                    </div>

                    <BonusDispatchWords />

                    <div className="index-card paper-grain rounded-sm p-5 relative">
                        <div className="flex items-start justify-between gap-3 mb-2.5">
                            <div className="flex items-center gap-2">
                                <Mountain size={18} className="text-tertiary shrink-0" />
                                <h4 className="font-headline text-lg font-bold text-on-surface">
                                    {store.currentScene.title}
                                </h4>
                            </div>
                            <button
                                onClick={sceneFav.toggle}
                                className="p-1 rounded-sm hover:bg-surface-container-high transition-colors cursor-pointer"
                                title={sceneFav.on ? '取消收藏' : '收藏题目'}
                            >
                                <Star size={17} className={sceneFav.on ? 'text-secondary fill-current' : 'text-outline hover:text-secondary'} />
                            </button>
                        </div>

                        <p className="font-body text-sm text-on-surface-variant leading-relaxed mb-4">
                            {store.currentScene.description}
                        </p>

                        <div className="flex flex-wrap gap-1.5 pt-3 border-t border-dashed border-outline-variant/50">
                            {store.currentScene.tags.map(tag => (
                                <span
                                    key={tag}
                                    className="px-2 py-0.5 bg-surface-container-low text-on-surface-variant font-label text-[13px] rounded-none border border-outline-variant/50"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>

                    {store.aiEnabled && (
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={ai.sceneDeepDive}
                                    disabled={ai.sceneLoading}
                                    className="flex items-center justify-center gap-1 px-2.5 py-2 bg-surface-container border border-outline-variant/65 rounded-sm text-xs font-label text-on-surface-variant hover:border-secondary hover:text-on-surface transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {ai.sceneLoading ? <LoaderCircle size={13} className="animate-spin" /> : <Sparkles size={13} className="text-secondary" />}
                                    <span>感官细节</span>
                                </button>
                                <button
                                    onClick={ai.sceneGenerate}
                                    disabled={ai.sceneLoading}
                                    className="flex items-center justify-center gap-1 px-2.5 py-2 bg-surface-container border border-outline-variant/65 rounded-sm text-xs font-label text-on-surface-variant hover:border-secondary hover:text-on-surface transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    <Bot size={13} className="text-secondary" />
                                    <span>AI 新场景</span>
                                </button>
                            </div>
                            {ai.sceneExtra && (
                                <div className="bg-surface-container border border-secondary/45 rounded-sm p-3.5">
                                    <p className="font-label text-xs text-secondary mb-1.5 flex items-center gap-1">
                                        <Sparkles size={12} />感官引导
                                    </p>
                                    <p className="text-xs font-body text-on-surface leading-relaxed whitespace-pre-line">{ai.sceneExtra}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── 写作挑战 ── */}
            {store.writingMode === 'challenge' && store.currentChallenge && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-headline font-bold text-xl text-on-surface">写作挑战</h3>
                        <button
                            onClick={() => void pickNextChallenge(store.currentChallenge?.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm bg-surface-container border border-outline-variant/65 hover:border-primary text-xs font-label text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                        >
                            <RefreshCw size={13} />
                            <span>换一题</span>
                        </button>
                    </div>

                    <BonusDispatchWords />

                    <div className="index-card paper-grain rounded-sm p-5 relative">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                                <CircleHelp size={18} className="text-primary shrink-0 mt-1" />
                                <p className="font-body text-sm md:text-base text-on-surface leading-relaxed">
                                    {store.currentChallenge.text}
                                </p>
                            </div>
                            <button
                                onClick={challengeFav.toggle}
                                className="p-1 rounded-sm hover:bg-surface-container-high transition-colors shrink-0 cursor-pointer"
                                title={challengeFav.on ? '取消收藏' : '收藏题目'}
                            >
                                <Star size={17} className={challengeFav.on ? 'text-secondary fill-current' : 'text-outline hover:text-secondary'} />
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {store.currentChallenge.id.startsWith('ai_') && (
                                <span className="mt-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-none bg-primary/10 border border-primary/35 font-label text-[13px] text-primary">
                                    <Sparkles size={11} />AI 出题
                                </span>
                            )}
                            {ai.unsaved(store.currentChallenge.id) && (
                                <SaveToBank onSave={() => ai.saveToBank(store.currentChallenge!)} />
                            )}
                        </div>
                    </div>

                    {store.aiEnabled && (
                        <button
                            onClick={ai.challengeGenerate}
                            disabled={ai.challengeLoading}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-surface-container border border-outline-variant/65 rounded-sm text-xs font-label text-on-surface-variant hover:border-secondary hover:text-on-surface transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            {ai.challengeLoading ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} className="text-secondary" />}
                            <span>{ai.challengeLoading ? '出题中…' : 'AI 出一道题'}</span>
                        </button>
                    )}

                    <CandidateList items={ai.challengeCandidates} currentId={store.currentChallenge.id} onPick={store.setCurrentChallenge} />
                </div>
            )}

            {/* ── 角色描写 ── */}
            {store.writingMode === 'character' && store.currentCharacterPrompt && (() => {
                const layer = CHARACTER_LAYERS.find(l => l.id === store.currentCharacterPrompt!.layer);
                return (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-headline font-bold text-xl text-on-surface">角色描写</h3>
                            <button
                                onClick={() => void pickNextCharacterPrompt(store.currentCharacterPrompt?.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm bg-surface-container border border-outline-variant/65 hover:border-primary text-xs font-label text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                            >
                                <RefreshCw size={13} />
                                <span>换一题</span>
                            </button>
                        </div>

                        {layer && (
                            <div className="px-3 py-2 rounded-sm bg-surface-container border-l-2 border-secondary border border-outline-variant/55 text-xs">
                                <span className="font-label text-secondary font-bold">{layer.name}</span>
                                <p className="font-body text-on-surface-variant mt-0.5 leading-relaxed">{layer.description}</p>
                            </div>
                        )}

                        <div className="index-card paper-grain rounded-sm p-5 relative">
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2.5">
                                    <User size={18} className="text-secondary shrink-0 mt-1" />
                                    <p className="font-body text-sm md:text-base text-on-surface leading-relaxed">
                                        {store.currentCharacterPrompt.text}
                                    </p>
                                </div>
                                <button
                                    onClick={characterFav.toggle}
                                    className="p-1 rounded-sm hover:bg-surface-container-high transition-colors shrink-0 cursor-pointer"
                                    title={characterFav.on ? '取消收藏' : '收藏题目'}
                                >
                                    <Star size={17} className={characterFav.on ? 'text-secondary fill-current' : 'text-outline hover:text-secondary'} />
                                </button>
                            </div>
                            {ai.unsaved(store.currentCharacterPrompt.id) && (
                                <SaveToBank onSave={() => ai.saveToBank(store.currentCharacterPrompt!)} />
                            )}
                        </div>

                        {store.aiEnabled && (
                            <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={ai.characterDeep}
                                        disabled={ai.characterLoading}
                                        className="flex items-center justify-center gap-1 px-2.5 py-2 bg-surface-container border border-outline-variant/65 rounded-sm text-xs font-label text-on-surface-variant hover:border-secondary hover:text-on-surface transition-colors disabled:opacity-50 cursor-pointer"
                                    >
                                        {ai.characterLoading ? <LoaderCircle size={13} className="animate-spin" /> : <Sparkles size={13} className="text-secondary" />}
                                        <span>AI 深挖角色</span>
                                    </button>
                                    <button
                                        onClick={ai.characterGenerate}
                                        disabled={ai.characterGenLoading}
                                        className="flex items-center justify-center gap-1 px-2.5 py-2 bg-surface-container border border-outline-variant/65 rounded-sm text-xs font-label text-on-surface-variant hover:border-secondary hover:text-on-surface transition-colors disabled:opacity-50 cursor-pointer"
                                    >
                                        {ai.characterGenLoading ? <LoaderCircle size={13} className="animate-spin" /> : <Bot size={13} className="text-secondary" />}
                                        <span>AI 出题</span>
                                    </button>
                                </div>
                                {ai.characterExtra && (
                                    <div className="bg-surface-container border border-secondary/45 rounded-sm p-3.5">
                                        <p className="font-label text-xs text-secondary mb-1.5 flex items-center gap-1">
                                            <Sparkles size={12} />AI 追问
                                        </p>
                                        <p className="text-xs font-body text-on-surface leading-relaxed">{ai.characterExtra}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        <CandidateList items={ai.characterCandidates} currentId={store.currentCharacterPrompt.id} onPick={store.setCurrentCharacterPrompt} />
                    </div>
                );
            })()}

            {/* ── 梦境记录 ── */}
            {store.writingMode === 'dream' && (
                <div className="space-y-4">
                    <h3 className="font-headline font-bold text-xl text-on-surface">梦境记录</h3>
                    <div className="index-card paper-grain rounded-sm p-5 space-y-3">
                        <div className="flex items-center gap-2 text-secondary">
                            <MoonStar size={18} />
                            <span className="font-headline font-bold text-sm text-on-surface">让梦指引你</span>
                        </div>
                        <p className="font-body text-xs text-on-surface-variant leading-relaxed border-l-2 border-secondary/50 pl-3">
                            “梦能够到达我们的理性到达不了的地方。”
                        </p>
                        <ul className="font-body text-xs text-on-surface-variant space-y-1.5 pt-2 border-t border-dashed border-outline-variant/50 leading-relaxed">
                            <li>· 先捕捉醒来时残留的第一帧画面</li>
                            <li>· 记录梦里的光线、气味、温度与声响</li>
                            <li>· 不必修补断裂的逻辑，忠于荒诞感</li>
                        </ul>
                    </div>
                </div>
            )}

            {/* ── 自由发挥 ── */}
            {store.writingMode === 'free' && (
                <div className="space-y-4">
                    <h3 className="font-headline font-bold text-xl text-on-surface">自由发挥</h3>
                    <div className="index-card paper-grain rounded-sm p-5 space-y-2.5">
                        <div className="flex items-center gap-2 text-tertiary">
                            <PencilLine size={18} />
                            <span className="font-headline font-bold text-sm text-on-surface">无拘束书写</span>
                        </div>
                        <p className="font-body text-xs text-on-surface-variant leading-relaxed">
                            没有题目、没有限制。点击右上角「收起」即可隐藏侧栏，专心码字。
                        </p>
                    </div>
                </div>
            )}
        </DeskDrawer>
    );
}
