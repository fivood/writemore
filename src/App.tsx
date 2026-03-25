import { useEffect, useCallback, useState, useRef } from 'react';
import { useStore } from './store';
import { drawRandomWords, loadUserData, addUserWord, getAllWords, deleteUserWord } from './data/wordEngine';
import { db } from './db';
import type { Genre, Word, WordSet } from './types';
import { GENRE_COLORS, FICTION_GENRES } from './types';

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function App() {
  const store = useStore();
  const [toast, setToast] = useState('');
  const [showAddWord, setShowAddWord] = useState(false);
  const [favorites, setFavorites] = useState<WordSet[]>([]);
  const [history, setHistory] = useState<WordSet[]>([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryGenre, setLibraryGenre] = useState<Genre | ''>('');
  const [allWordsForLib, setAllWordsForLib] = useState<Word[]>([]);
  const resizeRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Init
  useEffect(() => {
    loadUserData();
    store.updateStreak();
    if (store.currentWords.length === 0) handleDraw();
    loadRecords();
  }, []);

  // Theme
  useEffect(() => {
    const t = store.theme === 'system' ? getSystemTheme() : store.theme;
    document.documentElement.setAttribute('data-theme', t);
  }, [store.theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', store.fontSize);
  }, [store.fontSize]);

  // Timer
  useEffect(() => {
    if (!store.timerActive) return;
    const id = setInterval(() => {
      const next = store.timerSeconds + 1;
      if (next >= store.timerDuration * 60) {
        store.setTimerActive(false);
        store.setTimerSeconds(0);
        showToast('⏰ 时间到！写得不错~');
      } else {
        store.setTimerSeconds(next);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [store.timerActive, store.timerSeconds, store.timerDuration]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inEditor = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable;

      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSaveDraft();
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        store.setFocusMode(!store.focusMode);
        return;
      }
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        setShowAddWord(true);
        return;
      }
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        store.setActiveTab('library');
        return;
      }
      if (e.key === 'Escape') {
        if (store.focusMode) { store.setFocusMode(false); return; }
        if (showAddWord) { setShowAddWord(false); return; }
      }
      if (inEditor) return;
      if (e.key === ' ') { e.preventDefault(); handleDraw(); }
      if (e.key === 's' || e.key === 'S') { e.preventDefault(); handleFavorite(); }
      if (e.key === 'Enter') { e.preventDefault(); editorRef.current?.focus(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [store.focusMode, showAddWord, store.currentWords, store.selectedGenres, store.wordCount, store.lockedIndices]);

  async function loadRecords() {
    const favs = await db.wordSets.where('isFavorite').equals(1).reverse().sortBy('createdAt');
    setFavorites(favs);
    const hist = await db.wordSets.reverse().sortBy('createdAt');
    setHistory(hist);
  }

  function handleDraw() {
    const locked = new Map<number, Word>();
    store.lockedIndices.forEach(i => {
      if (store.currentWords[i]) locked.set(i, store.currentWords[i]);
    });
    const words = drawRandomWords(store.wordCount, store.selectedGenres, locked);
    store.setCurrentWords(words);

    // Save to history
    const ws: WordSet = {
      id: `ws_${Date.now()}`,
      words,
      genre: store.selectedGenres.join(',') || '全部',
      createdAt: new Date(),
      isFavorite: false,
      hasWritten: false,
    };
    db.wordSets.add(ws).then(loadRecords);
    store.setCurrentWordSetId(ws.id);
    store.setEditorContent('');
  }

  async function handleFavorite() {
    if (!store.currentWordSetId) return;
    const ws = await db.wordSets.get(store.currentWordSetId);
    if (!ws) return;
    await db.wordSets.update(store.currentWordSetId, { isFavorite: ws.isFavorite ? 0 : 1 } as any);
    showToast(ws.isFavorite ? '已取消收藏' : '✨ 已收藏');
    loadRecords();
  }

  async function handleSaveDraft() {
    if (!store.currentWordSetId || !store.editorContent.trim()) return;
    const content = store.editorContent;
    const wordCount = content.replace(/\s/g, '').length;
    await db.drafts.put({
      id: `draft_${store.currentWordSetId}`,
      wordSetId: store.currentWordSetId,
      content,
      wordCount,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.wordSets.update(store.currentWordSetId, { hasWritten: true });
    showToast(`💾 已保存 (${wordCount}字)`);
    loadRecords();
  }

  // Auto-save
  useEffect(() => {
    if (!store.editorContent.trim()) return;
    const timer = setTimeout(handleSaveDraft, 30000);
    return () => clearTimeout(timer);
  }, [store.editorContent]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  // Resize handler
  const handleMouseDown = useCallback(() => {
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (e: MouseEvent) => {
      if (!isResizing.current || !resizeRef.current) return;
      const parent = resizeRef.current.parentElement!;
      const rect = parent.getBoundingClientRect();
      const ratio = Math.max(0.2, Math.min(0.7, (e.clientX - rect.left) / rect.width));
      store.setSplitRatio(ratio);
    };
    const onUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // Library words
  useEffect(() => {
    if (store.activeTab === 'library') {
      setAllWordsForLib(getAllWords());
    }
  }, [store.activeTab]);

  const filteredLibWords = allWordsForLib.filter(w => {
    if (libraryGenre && w.genre !== libraryGenre) return false;
    if (librarySearch && !w.text.includes(librarySearch) && !(w.explanation || '').includes(librarySearch)) return false;
    return true;
  });

  const wordCount = store.editorContent.replace(/\s/g, '').length;
  const timerPct = store.timerActive ? (store.timerSeconds / (store.timerDuration * 60)) * 100 : 0;
  const timerRemain = store.timerDuration * 60 - store.timerSeconds;
  const timerMin = Math.floor(timerRemain / 60);
  const timerSec = timerRemain % 60;

  const isFav = favorites.some(f => f.id === store.currentWordSetId);

  const tabs = [
    { id: 'inspire', label: '✦ 词条' },
    { id: 'library', label: '📚 词库' },
    { id: 'favorites', label: '⭐ 收藏' },
    { id: 'history', label: '📋 历史' },
  ];

  return (
    <div className={`app ${store.focusMode ? 'focus-mode' : ''}`}>
      {/* Top Bar */}
      <div className="topbar">
        <div className="topbar__logo">每日写作灵感</div>
        <div className="topbar__tabs">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`topbar__tab ${store.activeTab === t.id ? 'topbar__tab--active' : ''}`}
              onClick={() => store.setActiveTab(t.id)}
            >{t.label}</button>
          ))}
        </div>
        <div className="topbar__actions">
          <button className="topbar__btn" title="添加词条 (Ctrl+N)" onClick={() => setShowAddWord(true)}>＋</button>
          <button className="topbar__btn" title={store.theme === 'dark' ? '浅色模式' : store.theme === 'light' ? '深色模式' : '跟随系统'}
            onClick={() => store.setTheme(store.theme === 'light' ? 'dark' : store.theme === 'dark' ? 'system' : 'light')}>
            {store.theme === 'dark' ? '🌙' : store.theme === 'light' ? '☀️' : '🌗'}
          </button>
          <select
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: '12px', color: 'var(--text-secondary)' }}
            value={store.fontSize}
            onChange={e => store.setFontSize(e.target.value as any)}
          >
            <option value="small">小</option>
            <option value="medium">中</option>
            <option value="large">大</option>
          </select>
        </div>
      </div>

      <div className="main">
        {/* Sidebar */}
        <div className={`sidebar ${store.sidebarCollapsed ? 'sidebar--collapsed' : ''}`}>
          <div className="sidebar__section">
            <div className="sidebar__title">小说类型</div>
            <div className="sidebar__genre-list">
              {FICTION_GENRES.map(g => (
                <button
                  key={g}
                  className={`sidebar__genre ${store.selectedGenres.includes(g) ? 'sidebar__genre--active' : ''}`}
                  onClick={() => store.toggleGenre(g)}
                >
                  <span className="sidebar__genre-dot" style={{ background: GENRE_COLORS[g] }} />
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="sidebar__section">
            <div className="sidebar__title">词条数量</div>
            <div className="sidebar__wordcount">
              {([3, 4, 5] as const).map(n => (
                <button
                  key={n}
                  className={`sidebar__wordcount-btn ${store.wordCount === n ? 'sidebar__wordcount-btn--active' : ''}`}
                  onClick={() => store.setWordCount(n)}
                >{n}</button>
              ))}
            </div>
          </div>
          <div className="sidebar__section">
            <div className="sidebar__title">限时写作</div>
            <div className="sidebar__wordcount">
              {([10, 15, 20, 30] as const).map(n => (
                <button
                  key={n}
                  className={`sidebar__wordcount-btn ${store.timerDuration === n ? 'sidebar__wordcount-btn--active' : ''}`}
                  onClick={() => store.setTimerDuration(n)}
                >{n}分</button>
              ))}
            </div>
          </div>
          <div className="sidebar__section">
            <button className="btn btn--secondary" style={{ width: '100%' }}
              onClick={() => store.toggleSidebar()}>
              收起侧边栏
            </button>
          </div>
        </div>

        {/* Main content area */}
        {store.activeTab === 'inspire' ? (
          <div className="content">
            {/* Words Panel */}
            <div className="words-panel" style={{ width: `${store.splitRatio * 100}%` }}>
              <div className="words-panel__header">
                <div className="words-panel__title">灵感词条</div>
                <div className="words-panel__actions">
                  <button className="btn btn--sm btn--ghost" onClick={handleFavorite}>
                    {isFav ? '⭐' : '☆'} {isFav ? '已收藏' : '收藏'}
                  </button>
                  <button className="btn btn--sm btn--primary" onClick={handleDraw}>
                    🎲 抽取
                  </button>
                </div>
              </div>
              <div className="words-panel__cards">
                {store.currentWords.map((w, i) => (
                  <div key={`${w.id}_${i}`} className={`word-card ${store.lockedIndices.has(i) ? 'word-card--locked' : ''}`}>
                    <div className="word-card__header">
                      <span className="word-card__text">{w.text}</span>
                      <button
                        className={`word-card__lock ${store.lockedIndices.has(i) ? 'word-card__lock--active' : ''}`}
                        onClick={() => store.toggleLock(i)}
                        title={store.lockedIndices.has(i) ? '解锁' : '锁定'}
                      >
                        {store.lockedIndices.has(i) ? '🔒' : '🔓'}
                      </button>
                    </div>
                    <span className="word-card__genre" style={{ background: GENRE_COLORS[w.genre] }}>
                      {w.genre}
                    </span>
                    {w.explanation && (
                      <div className="word-card__explanation">💡 {w.explanation}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Resize Handle */}
            <div
              ref={resizeRef}
              className="resize-handle"
              onMouseDown={handleMouseDown}
            />

            {/* Editor Panel */}
            <div className="editor-panel">
              <div className="editor-panel__header">
                <div className="editor-panel__toolbar">
                  <button className="editor-panel__toolbar-btn" title="全屏专注 (Ctrl+Shift+F)"
                    onClick={() => store.setFocusMode(true)}>⛶</button>
                  <button
                    className={`editor-panel__toolbar-btn ${store.timerActive ? 'editor-panel__toolbar-btn--active' : ''}`}
                    onClick={() => { store.setTimerActive(!store.timerActive); if (store.timerActive) store.setTimerSeconds(0); }}
                    title="限时挑战"
                  >⏱</button>
                  <button className="editor-panel__toolbar-btn" onClick={handleSaveDraft} title="保存 (Ctrl+S)">💾</button>
                </div>
                <div className="editor-panel__stats">
                  <span>{wordCount} 字</span>
                  {store.timerActive && (
                    <span className="timer__text">{timerMin}:{timerSec.toString().padStart(2, '0')}</span>
                  )}
                </div>
              </div>
              {store.timerActive && (
                <div className="timer__bar" style={{ width: '100%', borderRadius: 0 }}>
                  <div className="timer__progress" style={{ width: `${timerPct}%` }} />
                </div>
              )}
              <textarea
                ref={editorRef}
                className="editor-panel__textarea"
                placeholder="在这里开始写作...&#10;让词条激发你的想象力，将它们编织成独一无二的故事。"
                value={store.editorContent}
                onChange={e => store.setEditorContent(e.target.value)}
              />
            </div>
          </div>
        ) : store.activeTab === 'library' ? (
          <div className="library">
            <div className="library__header">
              <div className="library__search">
                🔍
                <input placeholder="搜索词条..." value={librarySearch} onChange={e => setLibrarySearch(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select className="modal__select" style={{ width: 'auto' }} value={libraryGenre}
                  onChange={e => setLibraryGenre(e.target.value as any)}>
                  <option value="">全部类型</option>
                  {FICTION_GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                  <option value="通用">通用</option>
                </select>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{filteredLibWords.length} 条</span>
              </div>
            </div>
            <div className="library__list">
              {filteredLibWords.slice(0, 200).map(w => (
                <div key={w.id} className="library__word-row">
                  <span className="library__word-text" title={w.explanation}>{w.text}</span>
                  <span className="library__word-explanation">{w.explanation || ''}</span>
                  <span className="library__word-genre" style={{ background: GENRE_COLORS[w.genre] }}>{w.genre}</span>
                  {w.source === 'user' && (
                    <button className="btn btn--sm btn--ghost" style={{ color: 'var(--danger)' }}
                      onClick={() => { deleteUserWord(w.id); setAllWordsForLib(getAllWords()); }}>
                      删除
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : store.activeTab === 'favorites' ? (
          <div className="records" style={{ flex: 1, overflow: 'auto' }}>
            <div style={{ padding: '16px 0' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', marginBottom: 16 }}>⭐ 收藏的词条组合 ({favorites.length})</h3>
              {favorites.length === 0 && <div className="empty-state"><div className="empty-state__icon">⭐</div><p>还没有收藏哦</p><p>按 S 键快速收藏当前词条组合</p></div>}
              {favorites.map(ws => (
                <div key={ws.id} className="record-card">
                  <div className="record-card__words">
                    {ws.words.map((w, i) => <span key={i} className="record-card__word">{w.text}</span>)}
                  </div>
                  <div className="record-card__meta">
                    <span>📅 {new Date(ws.createdAt).toLocaleDateString()}</span>
                    <span>📂 {ws.genre || '全部'}</span>
                    <span>{ws.hasWritten ? '✅ 已写作' : '📝 未动笔'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="records" style={{ flex: 1, overflow: 'auto' }}>
            <div style={{ padding: '16px 0' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', marginBottom: 16 }}>📋 历史记录 ({history.length})</h3>
              {history.length === 0 && <div className="empty-state"><div className="empty-state__icon">📋</div><p>还没有记录</p></div>}
              {history.slice(0, 50).map(ws => (
                <div key={ws.id} className="record-card">
                  <div className="record-card__words">
                    {ws.words.map((w, i) => <span key={i} className="record-card__word">{w.text}</span>)}
                  </div>
                  <div className="record-card__meta">
                    <span>📅 {new Date(ws.createdAt).toLocaleDateString()}</span>
                    <span>📂 {ws.genre || '全部'}</span>
                    <span>{ws.hasWritten ? '✅ 已写作' : '📝 未动笔'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar toggle when collapsed */}
      {store.sidebarCollapsed && (
        <button
          style={{ position: 'fixed', left: 4, top: '50%', transform: 'translateY(-50%)', zIndex: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 4px', cursor: 'pointer' }}
          onClick={() => store.toggleSidebar()}
        >▶</button>
      )}

      {/* Status Bar */}
      <div className="statusbar">
        <div className="statusbar__item">
          <span>🔥</span>
          <span className="statusbar__streak">{store.streak} 天</span>
        </div>
        <div className="statusbar__divider" />
        <div className="statusbar__item">
          <span>✏️ 今日 {wordCount} 字</span>
        </div>
        {store.timerActive && (
          <>
            <div className="statusbar__divider" />
            <div className="statusbar__item timer">
              <span>⏱ {timerMin}:{timerSec.toString().padStart(2, '0')}</span>
              <div className="timer__bar">
                <div className="timer__progress" style={{ width: `${timerPct}%` }} />
              </div>
            </div>
          </>
        )}
        <div style={{ flex: 1 }} />
        <div className="statusbar__item" style={{ fontSize: 11 }}>
          Space 抽取 · S 收藏 · Enter 写作 · Ctrl+S 保存 · Ctrl+Shift+F 专注
        </div>
      </div>

      {/* Add Word Modal */}
      {showAddWord && <AddWordModal onClose={() => setShowAddWord(false)} onAdd={(w) => {
        addUserWord(w);
        showToast('✅ 词条已添加');
        setShowAddWord(false);
        if (store.activeTab === 'library') {
          setAllWordsForLib(getAllWords());
        }
      }} />}

      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function AddWordModal({ onClose, onAdd }: { onClose: () => void; onAdd: (w: { text: string; explanation?: string; genre: Genre }) => void }) {
  const [text, setText] = useState('');
  const [explanation, setExplanation] = useState('');
  const [genre, setGenre] = useState<Genre>('通用');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__title">添加自定义词条</div>
        <div className="modal__field">
          <label className="modal__label">词条文本 *</label>
          <input className="modal__input" value={text} onChange={e => setText(e.target.value)} placeholder="输入词条" maxLength={20} autoFocus />
        </div>
        <div className="modal__field">
          <label className="modal__label">释义（可选）</label>
          <textarea className="modal__textarea-field" value={explanation} onChange={e => setExplanation(e.target.value)} placeholder="输入释义或解释" />
        </div>
        <div className="modal__field">
          <label className="modal__label">归属类型</label>
          <select className="modal__select" value={genre} onChange={e => setGenre(e.target.value as Genre)}>
            {[...FICTION_GENRES, '通用' as Genre].map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="modal__actions">
          <button className="btn btn--secondary" onClick={onClose}>取消</button>
          <button className="btn btn--primary" disabled={!text.trim()} onClick={() => onAdd({ text: text.trim(), explanation: explanation.trim() || undefined, genre })}>
            添加
          </button>
        </div>
      </div>
    </div>
  );
}
