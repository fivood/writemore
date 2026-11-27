import { Sparkles, X, MoonStar, ArrowLeft, ChevronsRight, LoaderCircle, Save, Upload, PanelLeft, MessageSquareText, Maximize, Timer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import MDEditor from '@uiw/react-md-editor';
import { useStore } from '../store';
import { backToHome, drawNewWords, saveDraft } from '../lib/session';
import { downloadText, hasMeaningfulContent, todayLabel } from '../lib/util';
import { WRITING_MODES } from '../ui/meta';
import { useAiAssist } from './useAiAssist';
import ModeSidebar from './ModeSidebar';
import PromptPanel from './PromptPanel';
import LibraryPage from './LibraryPage';

/** 写作界面：左侧栏 + 提示卡 + 编辑器（词汇模式下可以换成词库管理） */
export default function WritingView() {
    const store = useStore();
    const ai = useAiAssist();
    const [libraryOpen, setLibraryOpen] = useState(false);
    const [mobilePanel, setMobilePanel] = useState(false);
    const showLibrary = store.writingMode === 'words' && libraryOpen;
    const lastSavedRef = useRef('');

    // Ctrl+S 保存；不在输入框里时，空格换一组词、回车进编辑器
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 's') {
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

    // 自动保存：停笔 2.5 秒存一次；一直在写的话每 60 秒也存一次
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

    return (
        <>
            <ModeSidebar ai={ai} libraryOpen={libraryOpen} onToggleLibrary={() => setLibraryOpen(v => !v)} />

            {store.sidebarCollapsed && (
                <button className="fixed left-0 top-1/2 -translate-y-1/2 z-40 p-2 bg-surface/80 dark:bg-surface-container/80 border border-outline-variant/15 rounded-r-md shadow-sm opacity-50 hover:opacity-100 transition-all text-on-surface-variant hover:text-primary" onClick={() => store.toggleSidebar()}>
                    <ChevronsRight size={20} />
                </button>
            )}

            {!showLibrary && <PromptPanel ai={ai} mobileOpen={mobilePanel} onClose={() => setMobilePanel(false)} />}

            {showLibrary ? <LibraryPage /> : (
            <main className="flex-1 bg-surface relative overflow-y-auto">
                {store.timerActive && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-surface-dim">
                        <div className="h-full bg-primary transition-all duration-1000 ease-linear" style={{ width: `${(store.timerSeconds / (store.timerDuration * 60)) * 100}%` }}></div>
                    </div>
                )}

                <div className="max-w-3xl mx-auto pt-8 md:pt-24 pb-32 px-4 md:px-12 min-h-full flex flex-col">
                    <div className="mb-6 md:mb-12">
                        <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                            <div className="flex items-center space-x-3">
                                <button onClick={backToHome} className="md:hidden flex items-center text-on-surface-variant hover:text-primary transition-colors">
                                    <ArrowLeft size={20} />
                                </button>
                                <div className="text-outline text-xs font-label">{todayLabel()}</div>
                                {store.writingMode && (
                                    <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[12px] font-label font-medium border ${WRITING_MODES.find(m => m.mode === store.writingMode)?.color || ''}`}>
                                        {(() => {
                                            const mode = store.writingMode!;
                                            const ModeIcon = WRITING_MODES.find(m => m.mode === mode)?.Icon || Sparkles;
                                            return <ModeIcon size={14} />;
                                        })()}
                                        <span>{WRITING_MODES.find(m => m.mode === store.writingMode)?.label}</span>
                                    </span>
                                )}
                            </div>
                            <div className="flex space-x-2">
                                {/* Mobile: show prompt panel toggle */}
                                {store.writingMode !== 'free' && (
                                    <button onClick={() => setMobilePanel(true)} className="md:hidden flex items-center space-x-1 px-3 py-1.5 bg-surface-container text-on-surface-variant rounded-md text-xs font-label font-medium">
                                        <PanelLeft size={18} />
                                        <span>灵感</span>
                                    </button>
                                )}
                                <button onClick={saveDraft} className="flex items-center space-x-1 px-3 py-1.5 bg-surface-container dark:bg-surface-container-high text-primary hover:bg-surface-container-high dark:hover:bg-surface-container-highest rounded-md transition-colors text-xs font-label font-medium">
                                    <Save size={18} />
                                    <span className="hidden sm:inline">存入灵感宫殿</span>
                                    <span className="sm:hidden">保存</span>
                                </button>
                                <button onClick={exportMarkdown} className="hidden sm:flex items-center space-x-1 px-3 py-1.5 bg-primary text-on-primary hover:bg-primary-dim rounded-md transition-colors text-xs font-label font-medium shadow-sm">
                                    <Upload size={18} />
                                    <span>导出 .md</span>
                                </button>
                            </div>
                        </div>
                        <input
                            className="w-full bg-transparent border-none focus:ring-0 font-headline text-2xl md:text-4xl font-black text-on-surface placeholder:text-surface-dim outline-none mb-4 md:mb-6"
                            placeholder={store.writingMode === 'dream' ? '给你的梦起个名字...' : store.writingMode === 'scene' ? '给这段描写起个标题...' : store.writingMode === 'challenge' ? '就这题写点什么...' : store.writingMode === 'character' ? '这个角色叫什么名字...' : '给你的灵感起个名字...'}
                            type="text"
                            value={store.editorTitle}
                            onChange={(e) => store.setEditorTitle(e.target.value)}
                        />
                    </div>

                    <div
                        className="flex-1 w-full relative -mx-4 overflow-visible markdown-editor-container"
                        data-color-mode={store.theme === 'dark' ? 'dark' : 'light'}
                    >
                        <MDEditor
                            value={store.editorContent}
                            onChange={(val) => store.setEditorContent(val || '')}
                            preview="edit"
                            height="100%"
                            visibleDragbar={false}
                            className="w-full h-full bg-transparent font-headline text-xl leading-loose border-none shadow-none text-on-surface outline-none"
                            textareaProps={{
                                placeholder: store.writingMode === 'dream'
                                    ? "闭上眼回忆一下，你梦见了什么..."
                                    : store.writingMode === 'scene'
                                        ? "仔细想象这个场景，描写你看到的、听到的、感受到的..."
                                        : store.writingMode === 'challenge'
                                            ? "看看题目，写下你的想法" : store.writingMode === 'character'
                                                ? "就这个提示，写下关于这个角色的一个片段…" : "在这里开始你的故事（支持 Markdown 格式）..."
                            }}
                            style={{ backgroundColor: 'transparent', boxShadow: 'none' }}
                        />
                    </div>

                    {/* AI 写后反馈面板 */}
                    {ai.feedback && (
                        <div className="mt-6 bg-emerald-50/70 dark:bg-emerald-500/5 border border-emerald-200/40 dark:border-emerald-400/10 rounded-lg p-5">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-[12px] font-label uppercase tracking-widest text-emerald-600 dark:text-emerald-600 flex items-center gap-1">
                                    <MessageSquareText size={15} />AI 写作反馈
                                </p>
                                <button onClick={ai.clearFeedback} className="text-emerald-500/60 hover:text-emerald-500 transition-colors">
                                    <X size={18} />
                                </button>
                            </div>
                            <p className="text-sm text-emerald-900 dark:text-emerald-700 leading-relaxed whitespace-pre-line">{ai.feedback}</p>
                        </div>
                    )}

                    {/* AI 解梦面板 */}
                    {ai.dreamInterpret && (
                        <div className="mt-6 bg-violet-50/70 dark:bg-violet-500/5 border border-violet-200/40 dark:border-violet-400/10 rounded-lg p-5">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-[12px] font-label uppercase tracking-widest text-violet-600 dark:text-violet-600 flex items-center gap-1">
                                    <MoonStar size={15} />AI 解梦
                                </p>
                                <button onClick={ai.clearDreamInterpret} className="text-violet-500/60 hover:text-violet-500 transition-colors">
                                    <X size={18} />
                                </button>
                            </div>
                            <p className="text-sm text-violet-900 dark:text-violet-700 leading-relaxed whitespace-pre-line">{ai.dreamInterpret}</p>
                        </div>
                    )}
                </div>

                {/* Zen Toolbar */}
                <div className="fixed right-3 bottom-16 md:right-12 md:bottom-auto md:top-1/2 md:-translate-y-1/2 flex flex-row md:flex-col space-x-2 md:space-x-0 md:space-y-4 p-2 glass-panel bg-surface-container-low/80 rounded-full custom-shadow z-30">
                    <button className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-primary transition-all" title="限时挑战" onClick={() => { store.setTimerActive(!store.timerActive); if (store.timerActive) store.setTimerSeconds(0); }}>
                        <Timer size={20} className={store.timerActive ? 'text-primary' : ''} />
                    </button>
                    <button className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-primary transition-all" title="保存 (Ctrl+S)" onClick={saveDraft}>
                        <Save size={20} />
                    </button>
                    {store.aiEnabled && store.editorContent.trim().length > 20 && (
                        <>
                            <button
                                onClick={ai.continueWriting}
                                disabled={ai.continueLoading}
                                title="AI 续写"
                                className="w-10 h-10 rounded-full flex items-center justify-center text-violet-500 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all disabled:opacity-40"
                            >
                                {ai.continueLoading ? <LoaderCircle size={22} className="animate-spin" /> : <Sparkles size={22} />}
                            </button>
                            <button
                                onClick={ai.feedbackRun}
                                disabled={ai.feedbackLoading}
                                title="AI 写后反馈"
                                className="w-10 h-10 rounded-full flex items-center justify-center text-emerald-500 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all disabled:opacity-40"
                            >
                                {ai.feedbackLoading ? <LoaderCircle size={22} className="animate-spin" /> : <MessageSquareText size={22} />}
                            </button>
                            {store.writingMode === 'dream' && (
                                <button
                                    onClick={ai.dreamInterpretRun}
                                    disabled={ai.dreamLoading}
                                    title="AI 解梦"
                                    className="w-10 h-10 rounded-full flex items-center justify-center text-violet-500 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all disabled:opacity-40"
                                >
                                    {ai.dreamLoading ? <LoaderCircle size={22} className="animate-spin" /> : <MoonStar size={22} />}
                                </button>
                            )}
                        </>
                    )}
                    <div className="h-px w-6 bg-outline-variant/20 mx-auto"></div>
                    <button className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-primary transition-all" title="全屏专注" onClick={() => {
                        if (document.fullscreenElement) { document.exitFullscreen(); } else { document.documentElement.requestFullscreen(); }
                    }}>
                        <Maximize size={20} />
                    </button>
                </div>
            </main>
            )}
        </>
    );
}
