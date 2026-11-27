import { Sparkles, Dices, MoonStar, User, PencilLine, Mountain, CircleHelp, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useStore } from '../store';
import { openDailyBox, startDailyBox, startMode } from '../lib/session';
import { dayKey, todayLabel } from '../lib/util';

/** 首页：今日盲盒 + 选今天写什么 */
export default function HomeModes() {
    const store = useStore();
    const [isOpeningBox, setIsOpeningBox] = useState(false);

    function handleOpenDailyBox() {
        if (isOpeningBox) return;
        setIsOpeningBox(true);
        setTimeout(() => {
            openDailyBox();
            setIsOpeningBox(false);
        }, 1200);
    }

    return (
        <main className="flex-1 bg-background relative overflow-y-auto">
            <div className="max-w-5xl mx-auto pt-8 md:pt-16 pb-32 px-4 md:px-8">
                {/* Hero */}
                <div className="mb-8 md:mb-12">
                    <p className="text-outline text-xs font-label uppercase tracking-[0.2em] mb-3">{todayLabel()}</p>
                    <h1 className="font-headline italic text-3xl md:text-5xl lg:text-6xl text-on-surface mb-3 tracking-tight leading-none">今天想写什么？</h1>
                    <p className="text-on-surface-variant font-label text-sm max-w-md leading-relaxed">当然，什么都不写也没问题。一切在我。</p>
                </div>

                {/* Bento Grid */}
                <div className="grid grid-cols-2 md:grid-cols-12 gap-3 md:gap-4 auto-rows-[140px] md:auto-rows-[180px]">

                    {/* 🎁 今日灵感盲盒 — fullwidth (12 cols, 1 row) */}
                    {(() => {
                                                const box = store.dailyBoxOpenedDate === dayKey() ? store.dailyBoxData : null;
                        return (
                            <div className="col-span-2 md:col-span-12 row-span-1 bento-ring-wrapper">
                                <div className="w-full h-full glass-panel bg-gradient-to-r from-violet-500/5 to-fuchsia-500/5 dark:from-violet-500/10 dark:to-fuchsia-500/10 rounded-2xl border border-outline-variant/15 p-5 md:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 overflow-hidden relative z-[1]">
                                    {/* background decorations */}
                                    <div className="absolute right-12 -top-12 w-48 h-48 bg-violet-400/5 blur-[60px] rounded-full pointer-events-none"></div>
                                    <div className="absolute left-1/3 -bottom-12 w-48 h-48 bg-fuchsia-400/5 blur-[60px] rounded-full pointer-events-none"></div>

                                    {!box ? (
                                        // 未开启状态
                                        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-between">
                                            <div className="flex items-center gap-3.5 text-center sm:text-left flex-col sm:flex-row">
                                                <span className={`p-3 rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 shrink-0 ${isOpeningBox ? 'animate-jiggle' : 'hover:animate-jiggle'}`}>
                                                    <Sparkles size={36} className={isOpeningBox ? 'animate-jiggle' : ''} />
                                                </span>
                                                <div>
                                                    <h2 className="font-headline text-lg font-bold text-on-surface flex items-center gap-1.5 justify-center sm:justify-start">
                                                        今日限定灵感盲盒 🌰
                                                    </h2>
                                                    <p className="text-on-surface-variant text-xs mt-1">AI 与算法联袂特调，每日专供一次限定盲盒，开启你的今日奇思妙想</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={handleOpenDailyBox}
                                                disabled={isOpeningBox}
                                                className="px-5 py-2.5 bg-primary text-on-primary rounded-xl font-label text-xs font-bold shadow-md hover:bg-primary-dim transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                                            >
                                                {isOpeningBox ? (
                                                    <>
                                                        <LoaderCircle size={16} className="animate-spin" />
                                                        <span>正在拆开盲盒…</span>
                                                    </>
                                                ) : (
                                                    <span>拆开今日盲盒</span>
                                                )}
                                            </button>
                                        </div>
                                    ) : (
                                        // 已开启状态
                                        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-between">
                                            <div className="flex-1 w-full text-center sm:text-left">
                                                <div className="flex items-center gap-2 mb-2 justify-center sm:justify-start">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-label tracking-widest uppercase bg-violet-500/15 text-violet-700 dark:text-[#a78bfa] border border-violet-400/20">
                                                        今日限定
                                                    </span>
                                                    <span className="text-xs text-on-surface-variant font-label">
                                                        {box.promptType === 'scene' ? '🏞️ 场景任务' : '⚔️ 挑战任务'}
                                                    </span>
                                                </div>
                                                {/* 3个词条展示 */}
                                                <div className="flex flex-wrap gap-1.5 mb-2.5 justify-center sm:justify-start">
                                                    {box.words.map(w => (
                                                        <span key={w.id} className="px-2.5 py-1 bg-surface-container border border-outline-variant/20 rounded-lg text-xs text-on-surface font-label font-medium">
                                                            {w.text}
                                                        </span>
                                                    ))}
                                                </div>
                                                <p className="text-on-surface-variant text-xs line-clamp-1">
                                                    任务：{box.promptType === 'scene' ? box.promptData.description : box.promptData.text}
                                                </p>
                                            </div>
                                            <button 
                                                onClick={startDailyBox}
                                                className="px-5 py-2.5 bg-violet-500 text-white rounded-xl font-label text-xs font-bold shadow-md hover:bg-violet-600 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                                            >
                                                <span>以此开启写作 →</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* 词汇灵感 — large (8 cols, 2 rows) */}
                    <div className="col-span-2 md:col-span-8 row-span-2 bento-ring-wrapper">
                    <button onClick={() => startMode('words')}
                        className="w-full h-full glass-panel bg-surface-container dark:bg-surface-container rounded-2xl border border-outline-variant/10 p-5 md:p-8 flex flex-col justify-between group bento-glow-amber transition-all duration-500 overflow-hidden relative z-[1] text-left active:scale-[0.99]"
                    >
                        <div className="absolute -right-16 -top-16 w-56 h-56 bg-amber-400/5 dark:bg-[#ffb148]/5 blur-[80px] rounded-full group-hover:bg-amber-400/10 dark:group-hover:bg-[#ffb148]/10 transition-colors pointer-events-none"></div>
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <span className="p-3 rounded-lg bg-amber-500/10 text-amber-600 dark:text-[#ffb148]">
                                    <Dices size={30} />
                                </span>
                                <h2 className="font-headline text-lg md:text-2xl text-on-surface">词汇灵感</h2>
                            </div>
                            <p className="text-orange-700 text-sm leading-relaxed max-w-sm">让我悦耳之声你华丽英勇的冲淡。</p>
                            <p className="text-on-surface-variant text-sm leading-relaxed max-w-sm">这句话是什么意思？什么意思都没有！那它的意义何在？它解开了束缚着我的语法规则。</p>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="font-label text-[11px] md:text-[12px] uppercase tracking-widest text-on-surface-variant hidden md:inline">含词库管理 · Space 键抽取</span>
                            <span className="px-3 md:px-5 py-1.5 md:py-2 bg-amber-500/15 text-amber-700 dark:text-[#ffb148] rounded-full font-label text-xs font-bold border border-amber-400/20 group-hover:bg-amber-500/25 transition-all">开始写作 →</span>
                        </div>
                    </button>
                    </div>

                    {/* 梦境记录 — small (4 cols, 1 row) */}
                    <div className="col-span-1 md:col-span-4 row-span-1 bento-ring-wrapper">
                    <button onClick={() => startMode('dream')}
                        className="w-full h-full glass-panel bg-surface-container dark:bg-surface-container rounded-2xl border border-outline-variant/10 p-4 md:p-6 flex flex-col justify-between group bento-glow-violet transition-all duration-500 overflow-hidden relative z-[1] text-left active:scale-[0.99]"
                    >
                        <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-violet-400/5 dark:bg-[#ba9eff]/5 blur-[60px] rounded-full group-hover:bg-violet-400/10 dark:group-hover:bg-[#ba9eff]/10 transition-colors pointer-events-none"></div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="p-2 rounded-lg bg-violet-500/10 text-violet-600 dark:text-[#ba9eff]">
                                <MoonStar size={22} />
                            </span>
                            <h2 className="font-headline text-lg text-on-surface">梦境记录</h2>
                        </div>
                        <p className="text-on-surface-variant text-xs leading-relaxed">我有过一个梦。一个出生的梦。一个死亡的梦。一个鸟巢。</p>
                    </button>
                    </div>

                    {/* 角色描写 — small (4 cols, 1 row) */}
                    <div className="col-span-1 md:col-span-4 row-span-1 bento-ring-wrapper">
                    <button onClick={() => startMode('character')}
                        className="w-full h-full glass-panel bg-surface-container dark:bg-surface-container rounded-2xl border border-outline-variant/10 p-4 md:p-6 flex flex-col justify-between group bento-glow-fuchsia transition-all duration-500 overflow-hidden relative z-[1] text-left active:scale-[0.99]"
                    >
                        <div className="absolute -left-8 -top-8 w-36 h-36 bg-fuchsia-400/5 dark:bg-fuchsia-300/5 blur-[60px] rounded-full group-hover:bg-fuchsia-400/10 transition-colors pointer-events-none"></div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="p-2 rounded-lg bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300">
                                <User size={22} />
                            </span>
                            <h2 className="font-headline text-lg text-on-surface">角色描写</h2>
                        </div>
                        <p className="text-on-surface-variant text-xs leading-relaxed">“到底什么是‘真相’？”有一天，兔子这样问道。</p>
                    </button>
                    </div>

                    {/* 自由发挥 — medium (5 cols, 1 row) */}
                    <div className="col-span-1 md:col-span-5 row-span-1 bento-ring-wrapper">
                    <button onClick={() => startMode('free')}
                        className="w-full h-full glass-panel bg-surface-container dark:bg-surface-container rounded-2xl border border-outline-variant/10 p-4 md:p-6 flex flex-col justify-between group bento-glow-green transition-all duration-500 overflow-hidden relative z-[1] text-left active:scale-[0.99]"
                    >
                        <div className="absolute -left-12 -bottom-12 w-48 h-48 bg-emerald-400/5 dark:bg-[#69f6b8]/5 blur-[80px] rounded-full group-hover:bg-emerald-400/10 dark:group-hover:bg-[#69f6b8]/10 transition-colors pointer-events-none"></div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-[#69f6b8]">
                                <PencilLine size={22} />
                            </span>
                            <h2 className="font-headline text-lg text-on-surface">自由发挥</h2>
                        </div>
                        <p className="text-on-surface-variant text-xs leading-relaxed">潦草、不假思索、一往无前、冲动而且诚实。我想不出来任何东西去写。</p>
                    </button>
                    </div>

                    {/* 场景描写 — medium (4 cols, 1 row) */}
                    <div className="col-span-1 md:col-span-4 row-span-1 bento-ring-wrapper">
                    <button onClick={() => startMode('scene')}
                        className="w-full h-full glass-panel bg-surface-container dark:bg-surface-container rounded-2xl border border-outline-variant/10 p-4 md:p-6 flex flex-col justify-between group bento-glow-blue transition-all duration-500 overflow-hidden relative z-[1] text-left active:scale-[0.99]"
                    >
                        <div className="absolute right-0 top-0 w-full h-full pointer-events-none opacity-20 group-hover:opacity-30 transition-opacity">
                            <div className="w-full h-full bg-gradient-to-br from-blue-400/20 to-transparent rounded-2xl"></div>
                        </div>
                        <div className="flex items-center gap-2 mb-2 relative">
                            <span className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-300">
                                <Mountain size={22} />
                            </span>
                            <h2 className="font-headline text-lg text-on-surface">场景描写</h2>
                        </div>
                        <p className="text-on-surface-variant text-xs leading-relaxed relative">空气里有静止的灰尘、疯狂的灰尘和正要爆发的灰尘。</p>
                    </button>
                    </div>

                    {/* 写作挑战 — medium (3 cols, 1 row) */}
                    <div className="col-span-2 md:col-span-3 row-span-1 bento-ring-wrapper">
                    <button onClick={() => startMode('challenge')}
                        className="w-full h-full glass-panel bg-surface-container dark:bg-surface-container rounded-2xl border border-outline-variant/10 p-4 md:p-6 flex flex-col justify-between group bento-glow-rose transition-all duration-500 overflow-hidden relative z-[1] text-left active:scale-[0.99]"
                    >
                        <div className="absolute -right-8 -top-8 w-36 h-36 bg-rose-400/5 dark:bg-rose-300/5 blur-[60px] rounded-full group-hover:bg-rose-400/10 transition-colors pointer-events-none"></div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-300">
                                <CircleHelp size={22} />
                            </span>
                            <h2 className="font-headline text-lg text-on-surface">写作挑战</h2>
                        </div>
                        <p className="text-on-surface-variant text-xs leading-relaxed">为什么那个人行道上的男人推着一个空的婴儿车？</p>
                    </button>
                    </div>

                </div>

            </div>
        </main>
    );
}
