import {
    Sparkles, X, MoonStar, ArrowLeft, ChevronsRight, LoaderCircle,
    Save, Upload, PanelLeft, MessageSquareText, Maximize, Timer, Keyboard, Pilcrow,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { useStore } from '../store';
import { backToHome, drawNewWords, saveDraft } from '../lib/session';
import { countChars, downloadText, hasMeaningfulContent, todayLabel } from '../lib/util';
import { WRITING_MODES } from '../ui/meta';
import { useAiAssist } from './useAiAssist';
import PromptPanel from './PromptPanel';
import LibraryPage from './LibraryPage';
import { WritingMachineDock } from './TypewriterRig';

/** 写作界面：统一案头灵感夹 + 纯净文学棉纸手稿页 + 可折叠古董打字机联动底座 */
export default function WritingView() {
    const store = useStore();
    const ai = useAiAssist();
    const [libraryOpen, setLibraryOpen] = useState(false);
    const [mobilePanel, setMobilePanel] = useState(false);
    const [showToolbar, setShowToolbar] = useState(false);
    const showLibrary = store.writingMode === 'words' && libraryOpen;
    const lastSavedRef = useRef('');

    // Ctrl+S 保存；不在输入框里时，空格换一组词、回车聚焦编辑器
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                void saveDraft();
                return;
            }
            const target = e.target as HTMLElement;
            if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable) return;
            if (e.key === ' ' && useStore.getState().writingMode === 'words') {
                e.preventDefault();
                drawNewWords();
            }
            if (e.key === 'Enter' && target === document.body) {
                const textarea = document.querySelector<HTMLTextAreaElement>('.w-md-editor-text-input');
                if (textarea) { e.preventDefault(); textarea.focus(); }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // 自动保存：停笔 2.5 秒存一次；持续打字每 60 秒存一次
    useEffect(() => {
        const content = store.editorContent;
        if (!hasMeaningfulContent(content) || content === lastSavedRef.current) return;
        const timer = setTimeout(() => {
            void saveDraft();
            lastSavedRef.current = content;
        }, 2500);
        return () => clearTimeout(timer);
    }, [store.editorContent]);

    useEffect(() => {
        const interval = setInterval(() => {
            const content = useStore.getState().editorContent;
            if (hasMeaningfulContent(content) && content !== lastSavedRef.current) {
                void saveDraft();
                lastSavedRef.current = content;
            }
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    function exportMarkdown() {
        const title = store.editorTitle || '未命名灵感';
        downloadText(`${title}.md`, `# ${title}\n\n${store.editorContent}`);
    }

    const currentModeMeta = WRITING_MODES.find(m => m.mode === store.writingMode);
    const charCount = countChars(store.editorContent);
    const remainingSec = Math.max(0, store.timerDuration * 60 - store.timerSeconds);
    const timerLabel = `${String(Math.floor(remainingSec / 60)).padStart(2, '0')}:${String(remainingSec % 60).padStart(2, '0')}`;

    return (
        <>
            {store.sidebarCollapsed && !showLibrary && (
                <button
                    onClick={() => store.toggleSidebar()}
                    title="展开案头灵感栏"
                    className="hidden md:flex fixed left-0 top-1/2 -translate-y-1/2 z-40 items-center gap-1 py-2.5 px-1.5 bg-surface-container border border-l-0 border-outline-variant/70 rounded-r-sm shadow-sm text-outline hover:text-primary transition-colors cursor-pointer"
                >
                    <ChevronsRight size={16} />
                </button>
            )}

            <PromptPanel
                ai={ai}
                mobileOpen={mobilePanel}
                onClose={() => setMobilePanel(false)}
                libraryOpen={libraryOpen}
                onToggleLibrary={() => setLibraryOpen(v => !v)}
            />

            {showLibrary ? (
                <LibraryPage />
            ) : (
                <main className="flex-1 relative overflow-y-auto">
                    {/* 顶部限时写作进度细线 */}
                    {store.timerActive && (
                        <div className="sticky top-0 left-0 right-0 h-[3px] bg-surface-dim z-30">
                            <div
                                className="h-full bg-primary transition-all duration-1000 ease-linear"
                                style={{ width: `${(store.timerSeconds / (store.timerDuration * 60)) * 100}%` }}
                            />
                        </div>
                    )}

                    {/* 居中棉纸手稿画布 */}
                    <div
                        className={`max-w-3xl mx-auto pt-4 md:pt-8 px-3 sm:px-6 md:px-10 min-h-full flex flex-col transition-[padding] duration-300 ${
                            store.machineDockOpen ? 'pb-36 md:pb-[310px]' : 'pb-28 md:pb-20'
                        }`}
                    >
                        <article className="manuscript-sheet px-5 sm:px-8 md:px-12 pt-5 md:pt-7 pb-12 flex-1 flex flex-col relative">
                            {/* 报刊双横线稿纸栏头 */}
                            <div className="flex flex-wrap justify-between items-center gap-2 py-2.5 mb-6 broadsheet-masthead-rule">
                                <div className="flex items-center flex-wrap gap-2.5">
                                    <button
                                        onClick={backToHome}
                                        className="md:hidden inline-flex items-center text-on-surface-variant hover:text-primary transition-colors"
                                    >
                                        <ArrowLeft size={18} />
                                    </button>
                                    <span className="font-body text-xs text-outline">
                                        {todayLabel()}
                                    </span>
                                    {currentModeMeta && (
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-label font-medium border ${currentModeMeta.color}`}>
                                            <currentModeMeta.Icon size={12} />
                                            <span>{currentModeMeta.label}</span>
                                        </span>
                                    )}
                                    <span className="font-label text-xs text-outline">
                                        · {charCount} 字
                                    </span>
                                    {store.timerActive && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary text-on-primary font-mono text-xs font-bold">
                                            <Timer size={11} />
                                            <span>{timerLabel}</span>
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-1.5">
                                    {/* Mobile: 打开灵感便签抽屉 */}
                                    <button
                                        onClick={() => setMobilePanel(true)}
                                        className="md:hidden inline-flex items-center gap-1 px-2.5 py-1 bg-surface-container border border-outline-variant/60 text-on-surface-variant rounded-sm text-xs font-label cursor-pointer"
                                    >
                                        <PanelLeft size={14} />
                                        <span>案头签</span>
                                    </button>

                                    <button
                                        onClick={() => setShowToolbar(v => !v)}
                                        title={showToolbar ? '隐藏 Markdown 排版栏' : '展开 Markdown 排版栏'}
                                        className={`p-1.5 rounded-sm border transition-colors cursor-pointer ${
                                            showToolbar
                                                ? 'bg-surface-container-high border-secondary/50 text-on-surface'
                                                : 'border-transparent text-outline hover:text-on-surface hover:bg-surface-container'
                                        }`}
                                    >
                                        <Pilcrow size={15} />
                                    </button>

                                    <button
                                        onClick={() => void saveDraft()}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-container hover:bg-surface-container-high border border-outline-variant/65 text-on-surface rounded-sm transition-colors text-xs font-label font-medium cursor-pointer"
                                    >
                                        <Save size={14} className="text-primary" />
                                        <span className="hidden sm:inline">存入宫殿</span>
                                        <span className="sm:hidden">保存</span>
                                    </button>

                                    <button
                                        onClick={exportMarkdown}
                                        className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 bg-primary text-on-primary hover:bg-primary-dim rounded-sm transition-colors text-xs font-label font-medium cursor-pointer"
                                    >
                                        <Upload size={14} />
                                        <span>导出 .md</span>
                                    </button>
                                </div>
                            </div>

                            {/* 稿件标题 */}
                            <input
                                className="w-full bg-transparent border-none focus:ring-0 font-headline text-2xl md:text-3xl font-bold text-on-surface placeholder:text-outline/50 placeholder:italic outline-none mb-5 tracking-tight"
                                placeholder={
                                    store.writingMode === 'dream'
                                        ? '给这场梦拟个题目…'
                                        : store.writingMode === 'scene'
                                            ? '给这段场景描写拟个标题…'
                                            : store.writingMode === 'challenge'
                                                ? '就这道习作题拟个标题…'
                                                : store.writingMode === 'character'
                                                    ? '写下这个角色的名字或代号…'
                                                    : '给你的手稿起个名字…'
                                }
                                type="text"
                                value={store.editorTitle}
                                onChange={e => store.setEditorTitle(e.target.value)}
                            />

                            {/* 正文编辑区 */}
                            <div
                                className={`flex-1 w-full relative overflow-visible markdown-editor-container min-h-[360px] ${
                                    showToolbar ? 'md-toolbar-visible' : ''
                                }`}
                                data-color-mode={store.theme === 'dark' ? 'dark' : 'light'}
                            >
                                <MDEditor
                                    value={store.editorContent}
                                    onChange={val => store.setEditorContent(val || '')}
                                    preview="edit"
                                    height="100%"
                                    visibleDragbar={false}
                                    className="w-full h-full bg-transparent border-none shadow-none text-on-surface outline-none"
                                    textareaProps={{
                                        placeholder:
                                            store.writingMode === 'dream'
                                                ? '闭上眼回忆一下，你梦见了什么…'
                                                : store.writingMode === 'scene'
                                                    ? '仔细想象这个场景，写下你看见的光影、听见的声响、触碰到的温度…'
                                                    : store.writingMode === 'challenge'
                                                        ? '顺着题签的线索，敲下你的第一行字…'
                                                        : store.writingMode === 'character'
                                                            ? '围绕这个维度，写下关于人物的一个切面或瞬间…'
                                                            : '敲击键盘开始书写（支持 Markdown 语法，空格抽词，Ctrl+S 保存）…',
                                    }}
                                    style={{ backgroundColor: 'transparent', boxShadow: 'none' }}
                                />
                            </div>

                            {/* AI 写后反馈批注签 */}
                            {ai.feedback && (
                                <div className="mt-8 bg-surface-container border-l-2 border-tertiary border border-outline-variant/60 rounded-sm p-5">
                                    <div className="flex items-center justify-between mb-2.5">
                                        <p className="font-label text-xs text-tertiary font-bold flex items-center gap-1.5">
                                            <MessageSquareText size={14} />AI 写作反馈
                                        </p>
                                        <button
                                            onClick={ai.clearFeedback}
                                            className="text-outline hover:text-on-surface transition-colors cursor-pointer"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                    <p className="font-body text-sm text-on-surface leading-relaxed whitespace-pre-line">
                                        {ai.feedback}
                                    </p>
                                </div>
                            )}

                            {/* AI 解梦批注签 */}
                            {ai.dreamInterpret && (
                                <div className="mt-6 bg-surface-container border-l-2 border-secondary border border-outline-variant/60 rounded-sm p-5">
                                    <div className="flex items-center justify-between mb-2.5">
                                        <p className="font-label text-xs text-secondary font-bold flex items-center gap-1.5">
                                            <MoonStar size={14} />AI 解梦
                                        </p>
                                        <button
                                            onClick={ai.clearDreamInterpret}
                                            className="text-outline hover:text-on-surface transition-colors cursor-pointer"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                    <p className="font-body text-sm text-on-surface leading-relaxed whitespace-pre-line">
                                        {ai.dreamInterpret}
                                    </p>
                                </div>
                            )}
                        </article>
                    </div>

                    {/* 右侧竖向极简机械工具条 */}
                    <div className="fixed right-3 bottom-16 md:right-6 md:bottom-auto md:top-1/2 md:-translate-y-1/2 flex flex-row md:flex-col items-center gap-1.5 p-1.5 glass-panel bg-surface-container/90 border border-outline-variant/65 rounded-sm custom-shadow z-30">
                        <button
                            className={`w-9 h-9 rounded-sm flex items-center justify-center transition-colors cursor-pointer ${
                                store.timerActive
                                    ? 'bg-primary text-on-primary'
                                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-primary'
                            }`}
                            title="限时挑战开关"
                            onClick={() => {
                                const next = !store.timerActive;
                                store.setTimerActive(next);
                                if (!next) store.setTimerSeconds(0);
                            }}
                        >
                            <Timer size={17} />
                        </button>

                        <button
                            className="w-9 h-9 rounded-sm flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors cursor-pointer"
                            title="存入灵感宫殿 (Ctrl+S)"
                            onClick={() => void saveDraft()}
                        >
                            <Save size={17} />
                        </button>

                        {store.aiEnabled && store.editorContent.trim().length > 20 && (
                            <>
                                <div className="hidden md:block h-px w-5 bg-outline-variant/50 my-0.5" />
                                <button
                                    onClick={ai.continueWriting}
                                    disabled={ai.continueLoading}
                                    title="AI 顺势续写"
                                    className="w-9 h-9 rounded-sm flex items-center justify-center text-secondary hover:bg-secondary-container/60 transition-colors disabled:opacity-40 cursor-pointer"
                                >
                                    {ai.continueLoading ? <LoaderCircle size={17} className="animate-spin" /> : <Sparkles size={17} />}
                                </button>
                                <button
                                    onClick={ai.feedbackRun}
                                    disabled={ai.feedbackLoading}
                                    title="AI 审读批注"
                                    className="w-9 h-9 rounded-sm flex items-center justify-center text-tertiary hover:bg-tertiary-container/60 transition-colors disabled:opacity-40 cursor-pointer"
                                >
                                    {ai.feedbackLoading ? <LoaderCircle size={17} className="animate-spin" /> : <MessageSquareText size={17} />}
                                </button>
                                {store.writingMode === 'dream' && (
                                    <button
                                        onClick={ai.dreamInterpretRun}
                                        disabled={ai.dreamLoading}
                                        title="AI 梦境解析"
                                        className="w-9 h-9 rounded-sm flex items-center justify-center text-secondary hover:bg-secondary-container/60 transition-colors disabled:opacity-40 cursor-pointer"
                                    >
                                        {ai.dreamLoading ? <LoaderCircle size={17} className="animate-spin" /> : <MoonStar size={17} />}
                                    </button>
                                )}
                            </>
                        )}

                        <div className="hidden md:block h-px w-5 bg-outline-variant/50 my-0.5" />

                        <button
                            className={`hidden md:flex w-9 h-9 rounded-sm items-center justify-center transition-colors cursor-pointer ${
                                store.machineDockOpen
                                    ? 'text-secondary bg-secondary-container/50'
                                    : 'text-on-surface-variant hover:bg-surface-container-high'
                            }`}
                            title={store.machineDockOpen ? '收起打字机底座（纯稿纸模式）' : '展开打字机底座'}
                            onClick={() => store.setMachineDockOpen(!store.machineDockOpen)}
                        >
                            <Keyboard size={17} />
                        </button>

                        <button
                            className="w-9 h-9 rounded-sm flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors cursor-pointer"
                            title="全屏沉浸专注"
                            onClick={() => {
                                if (document.fullscreenElement) {
                                    void document.exitFullscreen();
                                } else {
                                    void document.documentElement.requestFullscreen();
                                }
                            }}
                        >
                            <Maximize size={17} />
                        </button>
                    </div>

                    {/* 桌面端底部可折叠黑漆黄铜打字机底座 */}
                    <WritingMachineDock
                        open={store.machineDockOpen}
                        sidebarCollapsed={store.sidebarCollapsed}
                        onToggle={store.setMachineDockOpen}
                    />
                </main>
            )}
        </>
    );
}
