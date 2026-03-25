import { useEffect, useState } from 'react';
import { db } from '../db';
import { useStore } from '../store';
import type { Draft, WordSet } from '../types';

interface HistoryItem {
  draft: Draft;
  wordSet?: WordSet;
}

export default function HistoryPage() {
  const store = useStore();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const drafts = await db.drafts.reverse().sortBy('updatedAt');
        const items: HistoryItem[] = [];
        
        for (const draft of drafts) {
          const wordSet = await db.wordSets.get(draft.wordSetId);
          items.push({ draft, wordSet });
        }
        
        setHistory(items);
      } catch (e) {
        console.error('Failed to load history', e);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  const handleOpenDraft = (item: HistoryItem) => {
    store.setEditorTitle(item.draft.title);
    store.setEditorContent(item.draft.content);
    store.setCurrentDraftId(item.draft.id);
    store.setCurrentWordSetId(item.draft.wordSetId);
    if (item.wordSet) {
      store.setCurrentWords(item.wordSet.words);
    }
    store.setActiveTab('inspire');
  };

  const handleDelete = async (e: React.MouseEvent, draftId: string) => {
    e.stopPropagation();
    if (confirm('确定要删除这篇灵感草稿吗？此操作无法撤销。')) {
      await db.drafts.delete(draftId);
      setHistory(prev => prev.filter(h => h.draft.id !== draftId));
    }
  };

  return (
    <main className="flex-1 bg-surface relative overflow-y-auto p-12">
      <div className="max-w-4xl mx-auto pb-20">
        <h2 className="font-headline text-3xl font-black mb-8 text-on-surface flex items-center space-x-3">
          <span className="material-symbols-outlined text-[32px] text-primary">history</span>
          <span>写作历史</span>
        </h2>
        
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-20 bg-surface-container-low/50 rounded-2xl border border-dashed border-outline-variant/30">
            <span className="material-symbols-outlined text-4xl text-stone-300 mb-4">menu_book</span>
            <p className="text-stone-500 font-label">你还没有保存过任何草稿。</p>
            <p className="text-stone-400 text-sm mt-2">去「词条」页面抽取灵感，写下你的第一个故事吧！</p>
            <button className="mt-6 px-6 py-2.5 bg-primary text-white hover:bg-[#7c442d] transition-colors rounded-lg font-label text-sm font-medium custom-shadow" onClick={() => store.setActiveTab('inspire')}>开始创作</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {history.map((item) => (
              <div 
                key={item.draft.id} 
                onClick={() => handleOpenDraft(item)}
                className="bg-white p-6 rounded-xl border border-stone-100 hover:border-primary/30 custom-shadow cursor-pointer group transition-all duration-300 hover:-translate-y-1 relative"
              >
                <button 
                  onClick={(e) => handleDelete(e, item.draft.id)}
                  className="absolute top-4 right-4 text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  title="删除草稿"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
                
                <div className="text-xs font-label text-outline mb-3 flex items-center justify-between pr-8">
                  <span>{new Date(item.draft.updatedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="text-[10px] tracking-wider uppercase bg-surface-container px-2 py-0.5 rounded text-stone-500">
                    {item.draft.wordCount} 字
                  </span>
                </div>
                
                <h3 className="font-headline text-xl font-bold text-on-surface mb-3 group-hover:text-primary transition-colors flex-1 w-11/12 truncate">
                  {item.draft.title || '未命名灵感'}
                </h3>
                
                <p className="text-stone-500 text-sm line-clamp-3 mb-6 min-h-[60px]">
                  {item.draft.content ? item.draft.content.replace(/[#*>_]/g, '') : '没有任何内容...'}
                </p>
                
                {item.wordSet && item.wordSet.words.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-4 border-t border-stone-50">
                    {item.wordSet.words.map((w, idx) => (
                      <span key={idx} className="px-2 py-1 bg-[#f5f4ef] text-stone-600 text-[10px] rounded border border-stone-200/50 font-label font-medium flex items-center space-x-1">
                        <span className="material-symbols-outlined text-[12px] opacity-70">tag</span>
                        <span>{w.text}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
