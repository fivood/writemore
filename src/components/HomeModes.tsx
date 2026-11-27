import { useState } from 'react';
import { useStore } from '../store';
import { openDailyBox, startDailyBox, startMode } from '../lib/session';
import { dayKey, todayLabel } from '../lib/util';
import { publicAsset } from '../lib/assets';
import { playCardShuffle, unlockTypewriterAudio } from '../lib/soundEngine';
import { DailyDispatchMachine, VintageKeycap } from './TypewriterRig';

/**
 * 版面极简木刻插图：通过放大裁切掉多余白边，配合正片叠底与旧报纸底色无缝融合
 */
function EditorialPlate({
    name,
    boxClass,
    variant,
    zoomClass = 'scale-125',
}: {
    name: string;
    boxClass: string;
    variant: 'lexicon' | 'freehand' | 'scene' | 'character' | 'challenge';
    zoomClass?: string;
}) {
    const [failed, setFailed] = useState(false);

    return (
        <div className={`relative overflow-hidden select-none ${boxClass}`}>
            {!failed ? (
                <img
                    src={`${publicAsset(`editorial/${name}.png`)}?v=4`}
                    alt=""
                    draggable={false}
                    onError={() => setFailed(true)}
                    className={`w-full h-full object-contain ${zoomClass} brightness-[1.03] contrast-[1.04] mix-blend-multiply dark:mix-blend-screen dark:invert dark:opacity-80 transition-transform duration-500`}
                />
            ) : (
                <svg viewBox="0 0 240 160" className="w-full h-full text-on-surface" preserveAspectRatio="xMidYMid slice">
                    {variant === 'lexicon' && (
                        <g stroke="currentColor" strokeOpacity="0.45" fill="none" strokeWidth="1.2">
                            <circle cx="72" cy="80" r="40" />
                            <rect x="116" y="42" width="76" height="76" />
                            <line x1="24" y1="126" x2="216" y2="34" />
                        </g>
                    )}
                    {variant === 'freehand' && (
                        <g stroke="currentColor" strokeOpacity="0.45" fill="none" strokeWidth="1.4">
                            <path d="M20 110 Q80 35 140 85 T220 50" />
                            <circle cx="170" cy="52" r="20" />
                        </g>
                    )}
                    {variant === 'scene' && (
                        <g stroke="currentColor" strokeOpacity="0.45" fill="none" strokeWidth="1.4">
                            <path d="M70 130 L70 68 A45 45 0 0 1 160 68 L160 130 Z" />
                            <line x1="30" y1="130" x2="210" y2="130" />
                        </g>
                    )}
                    {variant === 'character' && (
                        <g stroke="currentColor" strokeOpacity="0.45" fill="none" strokeWidth="1.4">
                            <circle cx="105" cy="76" r="34" />
                            <circle cx="135" cy="76" r="34" />
                        </g>
                    )}
                    {variant === 'challenge' && (
                        <g stroke="currentColor" strokeOpacity="0.45" fill="none" strokeWidth="1.4">
                            <circle cx="120" cy="64" r="18" />
                            <path d="M111 80 L102 124 L138 124 L129 80 Z" />
                        </g>
                    )}
                </svg>
            )}
        </div>
    );
}

/** 菱形装饰细分隔线 */
function DiamondDivider() {
    return (
        <div className="flex items-center gap-2 my-2.5">
            <div className="flex-1 h-px bg-on-surface/22" />
            <span className="w-1.5 h-1.5 rotate-45 bg-on-surface/35 inline-block" />
            <div className="flex-1 h-px bg-on-surface/22" />
        </div>
    );
}

/**
 * 首页：复古单色报刊海报版式
 * - 顶部：双横线刊期条 + 居中大报头标题 + 第二道双横线（去掉两侧小字说明）
 * - 主体：左 8 栏（打字机盲盒 + 左下折角窄栏 + 中间头条主文尾花） + 右 4 栏（八角切角框左图右文三栏）
 */
export default function HomeModes() {
    const store = useStore();
    const [isOpeningBox, setIsOpeningBox] = useState(false);

    const box = store.dailyBoxOpenedDate === dayKey() ? store.dailyBoxData : null;

    function handleOpenDailyBox() {
        if (isOpeningBox) return;
        setIsOpeningBox(true);
        void unlockTypewriterAudio();
        playCardShuffle();
        setTimeout(() => {
            openDailyBox();
            setIsOpeningBox(false);
        }, 800);
    }

    return (
        <main className="flex-1 relative overflow-y-auto">
            <div className="max-w-5xl mx-auto pt-5 md:pt-7 pb-24 px-4 md:px-8">

                {/* ── 1. 顶部刊期条 + 第一道双平行墨线 ── */}
                <div className="flex items-center justify-end text-xs font-body text-on-surface-variant pb-1.5">
                    <span>{todayLabel()}</span>
                </div>
                <div className="poster-double-rule mb-5" />

                {/* ── 2. 简洁居中报头（无两侧装饰小字） ── */}
                <header className="text-center py-1.5 mb-5">
                    <h1 className="font-headline font-bold text-3xl sm:text-4xl md:text-[48px] text-on-surface tracking-tight leading-none">
                        What to write today?
                    </h1>
                    <p className="font-body text-on-surface-variant text-xs sm:text-sm mt-2.5 tracking-wide">
                        当然，什么都不写也没问题。一切在我。
                    </p>
                </header>

                <div className="poster-double-rule mb-6" />

                {/* ── 3. 海报主体非对称拼版：左 8 栏 + 右 4 栏八角切角通高栏 ── */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">

                    {/* ════ 左侧主版区 (8 cols) ════ */}
                    <div className="md:col-span-8 flex flex-col gap-5">

                        {/* 左上通栏：复古打字机与今日盲盒 */}
                        <DailyDispatchMachine
                            box={box}
                            isOpening={isOpeningBox}
                            onOpen={handleOpenDailyBox}
                            onStart={startDailyBox}
                        />

                        {/* 左下分栏：左侧折角框 (5/12) + 中间主文专栏 (7/12) */}
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 flex-1">

                            {/* 左下折角窄栏（轻边框 + 右下折角）：自由发挥 + 梦境记录 */}
                            <div className="sm:col-span-5 relative border border-on-surface/22 bg-surface-bright flex flex-col">
                                {/* 顶部折纸鸟插图（放大裁去多余留白，紧凑醒目） */}
                                <div className="px-3 pt-3">
                                    <EditorialPlate
                                        name="freehand-plate"
                                        boxClass="w-full h-24 sm:h-28"
                                        variant="freehand"
                                        zoomClass="scale-[1.75]"
                                    />
                                </div>

                                <div className="px-4 pb-5 pt-1 flex-1 flex flex-col justify-around divide-y divide-dashed divide-on-surface/25">
                                    {/* 自由发挥 */}
                                    <button
                                        onClick={() => startMode('free')}
                                        className="w-full py-3.5 text-center group cursor-pointer"
                                    >
                                        <h3 className="font-headline font-bold text-lg text-on-surface group-hover:text-primary transition-colors inline-block border-b border-on-surface/30 pb-0.5 mb-2">
                                            自由发挥
                                        </h3>
                                        <p className="font-body text-xs text-on-surface-variant leading-relaxed">
                                            潦草、不假思索、一往无前、冲动而且诚实。我想不出来任何东西去写。
                                        </p>
                                    </button>

                                    {/* 梦境记录 */}
                                    <button
                                        onClick={() => startMode('dream')}
                                        className="w-full py-3.5 text-center group cursor-pointer"
                                    >
                                        <h3 className="font-headline font-bold text-lg text-on-surface group-hover:text-primary transition-colors inline-block border-b border-on-surface/30 pb-0.5 mb-2">
                                            梦境记录
                                        </h3>
                                        <p className="font-body text-xs text-on-surface-variant leading-relaxed">
                                            “我有过一个梦。一个出生的梦。一个死亡的梦。一个鸟巢。”
                                        </p>
                                    </button>
                                </div>

                                {/* 右下角折页三角 */}
                                <div
                                    className="absolute -bottom-[1px] -right-[1px] w-5 h-5 pointer-events-none"
                                    style={{
                                        background: 'linear-gradient(135deg, var(--color-primary) 50%, var(--color-background) 50%)',
                                    }}
                                />
                            </div>

                            {/* 中间头条主栏：词汇灵感 */}
                            <button
                                onClick={() => startMode('words')}
                                className="sm:col-span-7 flex flex-col justify-between text-left group cursor-pointer"
                            >
                                <div>
                                    <div className="flex items-center justify-between gap-2 pb-2">
                                        <h2 className="font-headline font-bold text-2xl md:text-[30px] text-on-surface group-hover:text-primary transition-colors">
                                            词汇灵感
                                        </h2>
                                        <span className="px-2.5 py-1 bg-primary text-on-primary font-label text-xs group-hover:bg-primary-dim transition-colors">
                                            开始写作 →
                                        </span>
                                    </div>
                                    <div className="poster-double-rule mb-4" />

                                    <p className="font-body text-base text-on-surface font-semibold leading-relaxed mb-2">
                                        “让我悦耳之声你华丽英勇的冲淡。”
                                    </p>
                                    <p className="font-body text-sm text-on-surface-variant leading-relaxed mb-4">
                                        这句话是什么意思？什么意思都没有！那它的意义何在？它解开了束缚着我的语法规则。从九大分类词库中随机抽取词条，锁定喜欢的字词自由发想。
                                    </p>

                                    <div className="flex items-center gap-2 pb-3 border-b border-dashed border-on-surface/25">
                                        <div className="flex items-center -space-x-1">
                                            <VintageKeycap keyName="s" className="w-5 h-5" />
                                            <VintageKeycap keyName="p" className="w-5 h-5" />
                                            <VintageKeycap keyName="a" className="w-5 h-5" />
                                            <VintageKeycap keyName="c" className="w-5 h-5" />
                                            <VintageKeycap keyName="e" className="w-5 h-5" />
                                        </div>
                                        <span className="font-label text-xs text-on-surface-variant">
                                            空格键抽词 · 含自定义词库管理
                                        </span>
                                    </div>
                                </div>

                                {/* 底部尾花插图（横向放大铺展，饱满不浪费空间） */}
                                <div className="mt-3">
                                    <EditorialPlate
                                        name="lexicon-plate"
                                        boxClass="w-full h-36 sm:h-40"
                                        variant="lexicon"
                                        zoomClass="scale-[1.7] group-hover:scale-[1.76]"
                                    />
                                </div>
                            </button>

                        </div>
                    </div>

                    {/* ════ 右侧八角切角通高专栏 (4 cols，左图右文并列排布，空间零浪费) ════ */}
                    <div className="md:col-span-4 relative border border-on-surface/22 bg-surface-bright px-4 py-5 flex flex-col justify-between">
                        {/* 四个 45° 斜切角细线 */}
                        <svg className="absolute -top-[1px] -left-[1px] w-3.5 h-3.5 text-on-surface pointer-events-none" viewBox="0 0 14 14">
                            <polygon points="0,0 14,0 0,14" fill="var(--color-background)" />
                            <line x1="14" y1="0" x2="0" y2="14" stroke="currentColor" strokeOpacity="0.24" strokeWidth="1.1" />
                        </svg>
                        <svg className="absolute -top-[1px] -right-[1px] w-3.5 h-3.5 text-on-surface pointer-events-none" viewBox="0 0 14 14">
                            <polygon points="0,0 14,0 14,14" fill="var(--color-background)" />
                            <line x1="0" y1="0" x2="14" y2="14" stroke="currentColor" strokeOpacity="0.24" strokeWidth="1.1" />
                        </svg>
                        <svg className="absolute -bottom-[1px] -left-[1px] w-3.5 h-3.5 text-on-surface pointer-events-none" viewBox="0 0 14 14">
                            <polygon points="0,0 14,14 0,14" fill="var(--color-background)" />
                            <line x1="0" y1="0" x2="14" y2="14" stroke="currentColor" strokeOpacity="0.24" strokeWidth="1.1" />
                        </svg>
                        <svg className="absolute -bottom-[1px] -right-[1px] w-3.5 h-3.5 text-on-surface pointer-events-none" viewBox="0 0 14 14">
                            <polygon points="14,0 14,14 0,14" fill="var(--color-background)" />
                            <line x1="14" y1="0" x2="0" y2="14" stroke="currentColor" strokeOpacity="0.24" strokeWidth="1.1" />
                        </svg>

                        {/* 栏头 */}
                        <div className="text-center mb-1">
                            <DiamondDivider />
                            <h2 className="font-headline font-bold text-xl tracking-wider text-on-surface">
                                命题练习
                            </h2>
                            <p className="font-body text-xs text-on-surface-variant mt-0.5">
                                观察 · 人物 · 破题
                            </p>
                            <DiamondDivider />
                        </div>

                        {/* 三个左图右文并列模块（紧凑饱满，图文各得其所） */}
                        <div className="flex-1 flex flex-col justify-around divide-y divide-dashed divide-on-surface/22">
                            {/* 1. 场景描写 */}
                            <button
                                onClick={() => startMode('scene')}
                                className="w-full py-4 flex items-center gap-3.5 text-left group cursor-pointer"
                            >
                                <EditorialPlate
                                    name="scene-plate"
                                    boxClass="w-20 h-20 shrink-0"
                                    variant="scene"
                                    zoomClass="scale-[2.25] group-hover:scale-[2.35]"
                                />
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-headline font-bold text-base text-on-surface group-hover:text-primary transition-colors">
                                        场景描写
                                    </h3>
                                    <p className="font-body text-xs text-on-surface-variant mt-1 leading-relaxed">
                                        空气里有静止的灰尘、疯狂的灰尘和正要爆发的灰尘。
                                    </p>
                                </div>
                            </button>

                            {/* 2. 角色描写 */}
                            <button
                                onClick={() => startMode('character')}
                                className="w-full py-4 flex items-center gap-3.5 text-left group cursor-pointer"
                            >
                                <EditorialPlate
                                    name="character-plate"
                                    boxClass="w-20 h-20 shrink-0"
                                    variant="character"
                                    zoomClass="scale-[1.45] group-hover:scale-[1.52]"
                                />
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-headline font-bold text-base text-on-surface group-hover:text-primary transition-colors">
                                        角色描写
                                    </h3>
                                    <p className="font-body text-xs text-on-surface-variant mt-1 leading-relaxed">
                                        “到底什么是‘真相’？”有一天，兔子这样问道。
                                    </p>
                                </div>
                            </button>

                            {/* 3. 写作挑战 */}
                            <button
                                onClick={() => startMode('challenge')}
                                className="w-full py-4 flex items-center gap-3.5 text-left group cursor-pointer"
                            >
                                <EditorialPlate
                                    name="challenge-plate"
                                    boxClass="w-20 h-20 shrink-0"
                                    variant="challenge"
                                    zoomClass="scale-[2.35] group-hover:scale-[2.45]"
                                />
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-headline font-bold text-base text-on-surface group-hover:text-primary transition-colors">
                                        写作挑战
                                    </h3>
                                    <p className="font-body text-xs text-on-surface-variant mt-1 leading-relaxed">
                                        为什么那个人行道上的男人推着一个空的婴儿车？
                                    </p>
                                </div>
                            </button>
                        </div>
                    </div>

                </div>

            </div>
        </main>
    );
}
