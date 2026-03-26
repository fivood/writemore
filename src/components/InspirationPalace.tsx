import { useEffect, useState, useMemo } from 'react';
import { db } from '../db';
import { useStore } from '../store';
import { SCENE_PROMPTS } from '../data/scenes';
import { BUILTIN_CHALLENGES, pickRandomChallenge } from '../data/challenges';
import { BUILTIN_CHARACTER_PROMPTS, pickRandomCharacterPrompt } from '../data/characterPrompts';
import type { Draft, WordSet, WritingMode } from '../types';
import { WRITING_MODES } from '../types';

interface PalaceItem {
  draft: Draft;
  wordSet?: WordSet;
}

const MODE_STYLE: Record<WritingMode, { icon: string; bg: string; border: string; text: string }> = {
  words:     { icon: 'casino',       bg: 'bg-amber-50  dark:bg-primary/10',   border: 'border-amber-200  dark:border-primary/20',   text: 'text-amber-700  dark:text-primary'   },
  free:      { icon: 'edit_note',    bg: 'bg-emerald-50 dark:bg-secondary/10', border: 'border-emerald-200 dark:border-secondary/20', text: 'text-emerald-700 dark:text-secondary' },
  scene:     { icon: 'landscape',    bg: 'bg-blue-50   dark:bg-blue-900/20',  border: 'border-blue-200   dark:border-blue-400/20',  text: 'text-blue-700   dark:text-blue-300'  },
  dream:     { icon: 'nights_stay',  bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-200 dark:border-violet-400/20', text: 'text-violet-700 dark:text-violet-300' },
  challenge: { icon: 'quiz',         bg: 'bg-rose-50   dark:bg-rose-900/20',  border: 'border-rose-200   dark:border-rose-400/20',  text: 'text-rose-700   dark:text-rose-300'  },
  character: { icon: 'person_search', bg: 'bg-fuchsia-50 dark:bg-fuchsia-900/20', border: 'border-fuchsia-200 dark:border-fuchsia-400/20', text: 'text-fuchsia-700 dark:text-fuchsia-300' },
};

export default function InspirationPalace() {
  const store = useStore();
  const [items, setItems] = useState<PalaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<WritingMode | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { fetchItems(); }, []);

  async function fetchItems() {
    try {
      const drafts = await db.drafts.reverse().sortBy('updatedAt');
      const result: PalaceItem[] = [];
      for (const draft of drafts) {
        if (draft.deletedFromPalace) continue;
        const wordSet = draft.wordSetId ? await db.wordSets.get(draft.wordSetId) : undefined;
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
      result = result.filter(it => (it.draft.writingMode || 'words') === filterMode);
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
      const m = it.draft.writingMode || 'words';
      byMode[m] = (byMode[m] || 0) + 1;
    });
    return { total, totalWords, byMode };
  }, [items]);

  const handleOpen = (item: PalaceItem) => {
    store.setEditorTitle(item.draft.title);
    store.setEditorContent(item.draft.content);
    store.setCurrentDraftId(item.draft.id);
    store.setCurrentWordSetId(item.draft.wordSetId);
    if (item.wordSet) store.setCurrentWords(item.wordSet.words);
    const mode = item.draft.writingMode || 'words';
    store.setWritingMode(mode);
    if (mode === 'scene' && item.draft.sceneId) {
      const scene = SCENE_PROMPTS.find(s => s.id === item.draft.sceneId);
      if (scene) store.setCurrentScene(scene);
    }
    if (mode === 'challenge') {
      const cid = item.draft.challengeId;
      if (cid) {
        const builtin = BUILTIN_CHALLENGES.find(c => c.id === cid);
        if (builtin) {
          store.setCurrentChallenge(builtin);
        } else {
          db.challenges.get(cid).then(c => {
            if (c) store.setCurrentChallenge(c);
            else store.setCurrentChallenge(pickRandomChallenge());
          });
        }
      } else {
        store.setCurrentChallenge(pickRandomChallenge());
      }
    }
    if (mode === 'character') {
      const cid = item.draft.characterPromptId;
      if (cid) {
        const builtin = BUILTIN_CHARACTER_PROMPTS.find(c => c.id === cid);
        if (builtin) {
          store.setCurrentCharacterPrompt(builtin);
        } else {
          db.characterPrompts.get(cid).then(c => {
            if (c) store.setCurrentCharacterPrompt(c);
            else store.setCurrentCharacterPrompt(pickRandomCharacterPrompt());
          });
        }
      } else {
        store.setCurrentCharacterPrompt(pickRandomCharacterPrompt());
      }
    }
    store.setActiveTab('inspire');
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确定要删除这条灵感记录吗？')) {
      await db.drafts.update(id, { deletedFromPalace: true });
      setItems(prev => prev.filter(it => it.draft.id !== id));
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

  return (
    <main className="flex-1 bg-surface relative overflow-y-auto p-8 md:p-12">
      <div className="max-w-6xl mx-auto pb-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-headline text-3xl font-black text-on-surface flex items-center space-x-3">
              <span className="text-[32px]">🏛</span>
              <span>灵感宫殿</span>
            </h2>
            <p className="text-on-surface-variant font-label text-sm mt-1">所有写作灵感汇聚于此</p>
          </div>
          {items.length > 0 && (
            <div className="flex items-center space-x-4 text-sm font-label text-on-surface-variant">
              <span><strong className="text-on-surface">{stats.total}</strong> 条灵感</span>
              <span className="text-outline-variant">|</span>
              <span><strong className="text-on-surface">{stats.totalWords.toLocaleString()}</strong> 字</span>
            </div>
          )}
        </div>

        {/* Filter tabs */}
        {items.length > 0 && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-4 py-2 rounded-full text-xs font-label font-medium transition-all ${
                filterMode === 'all'
                  ? 'bg-surface-container-high text-on-surface'
                  : 'bg-surface-container text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-high'
              }`}
            >
              全部 <span className="ml-1 opacity-60">{stats.total}</span>
            </button>
            {WRITING_MODES.map(m => {
              const count = stats.byMode[m.mode] || 0;
              if (count === 0) return null;
              const style = MODE_STYLE[m.mode];
              return (
                <button
                  key={m.mode}
                  onClick={() => setFilterMode(m.mode)}
                  className={`px-4 py-2 rounded-full text-xs font-label font-medium transition-all flex items-center space-x-1.5 ${
                    filterMode === m.mode
                      ? `${style.bg} ${style.text} ${style.border} border`
                      : 'bg-surface-container text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container-high'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">{m.icon}</span>
                  <span>{m.label}</span>
                  <span className="opacity-60">{count}</span>
                </button>
              );
            })}

            {/* Search */}
            <div className="relative ml-auto">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[16px]">search</span>
              <input
                type="text"
                placeholder="搜索灵感..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-surface-container rounded-full border border-outline-variant/30 text-xs font-label text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all w-48"
              />
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            <p className="mt-4 text-on-surface-variant text-sm font-label">加载中...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-24 bg-surface-container-low/50 rounded-2xl border border-dashed border-outline-variant/30">
            <span className="text-5xl mb-4 block">🏛</span>
            <p className="text-on-surface-variant font-label text-lg mb-1">灵感宫殿还是空的</p>
            <p className="text-on-surface-variant text-sm mt-2 max-w-sm mx-auto leading-relaxed">
              选择一种灵感模式，写下你的第一条灵感吧！
            </p>
            <button
              className="mt-8 px-8 py-3 bg-primary text-white hover:bg-[#7c442d] transition-colors rounded-lg font-label text-sm font-medium custom-shadow"
              onClick={() => store.setActiveTab('inspire')}
            >
              开始创作
            </button>
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-4xl text-outline mb-4">search_off</span>
            <p className="text-on-surface-variant font-label">没有找到匹配的灵感记录</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {displayed.map(item => {
              const mode = item.draft.writingMode || 'words';
              const mLabel = getModeLabel(mode);
              const mStyle = MODE_STYLE[mode];
              const sceneTitle = getSceneTitle(item.draft.sceneId);

              return (
                <div
                  key={item.draft.id}
                  onClick={() => handleOpen(item)}
                  className={`bg-surface-container p-5 rounded-xl border border-outline-variant/15 hover:border-primary/30 cursor-pointer group transition-all duration-300 hover:-translate-y-0.5 relative flex flex-col`}
                >
                  {/* Delete */}
                  <button
                    onClick={e => handleDelete(e, item.draft.id)}
                    className="absolute top-3 right-3 text-outline hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    title="删除"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>

                  {/* Mode badge + date */}
                  <div className="flex items-center justify-between mb-3 pr-8">
                    <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-label font-medium border ${mStyle.bg} ${mStyle.border} ${mStyle.text}`}>
                      <span className="material-symbols-outlined text-[12px]">{mStyle.icon}</span>
                      <span>{mLabel?.label}</span>
                    </span>
                    <span className="text-xs font-label text-outline">
                      {new Date(item.draft.updatedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-headline text-lg font-bold text-on-surface mb-2 group-hover:text-primary transition-colors truncate">
                    {item.draft.title || '未命名灵感'}
                  </h3>

                  {/* Scene subtitle */}
                  {sceneTitle && (
                    <p className="text-xs text-blue-500 font-label mb-2 flex items-center space-x-1">
                      <span className="material-symbols-outlined text-[12px]">landscape</span>
                      <span>{sceneTitle}</span>
                    </p>
                  )}

                  {/* Preview */}
                  <p className="text-on-surface-variant text-sm line-clamp-3 mb-4 min-h-[54px] leading-relaxed flex-1">
                    {item.draft.content ? item.draft.content.replace(/[#*>_`\[\]]/g, '').slice(0, 150) : '没有任何内容...'}
                  </p>

                  {/* Bottom: word count + word chips */}
                  <div className="flex items-center justify-between pt-3 border-t border-outline-variant/10">
                    <span className="text-[10px] tracking-wider uppercase bg-surface-container-high px-2 py-0.5 rounded text-on-surface-variant font-label font-medium">
                      {item.draft.wordCount} 字
                    </span>
                    {item.wordSet && item.wordSet.words.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                        {item.wordSet.words.slice(0, 4).map((w, idx) => (
                          <span key={idx} className="px-1.5 py-0.5 bg-surface-container-high text-on-surface-variant text-[12px] rounded border border-outline-variant/20 font-label">
                            {w.text}
                          </span>
                        ))}
                        {item.wordSet.words.length > 4 && (
                          <span className="text-[12px] text-outline font-label">+{item.wordSet.words.length - 4}</span>
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
    </main>
  );
}
