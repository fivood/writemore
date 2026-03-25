import { useEffect, useState } from 'react';
import { db } from '../db';
import { useStore } from '../store';
import type { WordSet } from '../types';
import { toggleFavoriteWordSet } from '../data/draftEngine';

export default function FavoritesPage() {
  const store = useStore();
  const [favorites, setFavorites] = useState<WordSet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFavorites();
  }, []);

  async function fetchFavorites() {
    try {
      const favs = await db.wordSets.filter(ws => ws.isFavorite).reverse().toArray();
      setFavorites(favs);
    } catch (e) {
      console.error('Failed to load favorites', e);
    } finally {
      setLoading(false);
    }
  }

  const handleUsePrompt = (ws: WordSet) => {
    if (store.editorContent.trim() || store.editorTitle.trim()) {
      if (!confirm('使用这组灵感前，当前编辑器内容（如果未手动保存）将被清空，是否继续？')) {
        return;
      }
    }
    
    // Clear and setup for writing with this prompt
    store.setEditorTitle('');
    store.setEditorContent('');
    store.setCurrentDraftId(null);
    store.setCurrentWordSetId(ws.id);
    store.setCurrentWords(ws.words);
    store.setIsCurrentWordSetFavorite(true);
    store.setActiveTab('inspire');
  };

  const handleUnfavorite = async (e: React.MouseEvent, ws: WordSet) => {
    e.stopPropagation();
    await toggleFavoriteWordSet(ws.words, ws.id, true);
    setFavorites(prev => prev.filter(item => item.id !== ws.id));
    
    // Sycn state if we are currently looking at this wordset
    if (store.currentWordSetId === ws.id) {
      store.setIsCurrentWordSetFavorite(false);
    }
  };

  return (
    <main className="flex-1 bg-surface relative overflow-y-auto p-12">
      <div className="max-w-4xl mx-auto pb-20">
        <h2 className="font-headline text-3xl font-black mb-8 text-on-surface flex items-center space-x-3">
          <span className="material-symbols-outlined text-[32px] text-amber-500" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
          <span>收藏夹</span>
        </h2>
        
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-4 border-amber-500/30 border-t-amber-500 animate-spin"></div>
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-20 bg-surface-container-low/50 rounded-2xl border border-dashed border-outline-variant/30">
            <span className="material-symbols-outlined text-4xl text-stone-300 mb-4">stars</span>
            <p className="text-stone-500 font-label">你还没有收藏过任何灵感词组组合。</p>
            <p className="text-stone-400 text-sm mt-2">在「词条」页面看到喜欢的组合时，点击小星星收藏吧！</p>
            <button className="mt-6 px-6 py-2.5 bg-amber-500 text-white hover:bg-amber-600 transition-colors rounded-lg font-label text-sm font-medium custom-shadow" onClick={() => store.setActiveTab('inspire')}>去寻找灵感</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {favorites.map((ws) => (
              <div 
                key={ws.id} 
                className="bg-white p-6 rounded-xl border border-stone-100/80 hover:border-amber-500/30 custom-shadow group transition-all duration-300 flex flex-col relative"
              >
                <div className="text-xs font-label text-outline mb-4 flex items-center justify-between">
                  <span>{new Date(ws.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' })}</span>
                  <div className="flex items-center space-x-2">
                    <span className="bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded tracking-widest text-[10px] uppercase border border-amber-100">
                      {ws.genre}
                    </span>
                    <button 
                      onClick={(e) => handleUnfavorite(e, ws)}
                      className="text-amber-500 hover:text-stone-400 transition-colors"
                      title="取消收藏"
                    >
                      <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    </button>
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {ws.words.length > 0 ? ws.words.map((w, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-surface-container-low text-on-surface font-headline font-bold text-sm rounded-md border border-stone-200/60 shadow-sm">
                        {w.text}
                      </span>
                    )) : (
                      <span className="text-stone-400 italic text-sm">空的词组组合</span>
                    )}
                  </div>
                </div>
                
                <button 
                  onClick={() => handleUsePrompt(ws)}
                  className="w-full mt-4 py-2 border border-amber-500/20 text-amber-700 font-label text-xs font-semibold rounded-md hover:bg-amber-50 transition-colors flex items-center justify-center space-x-1"
                >
                  <span className="material-symbols-outlined text-[14px]">edit</span>
                  <span>使用此灵感创作</span>
                </button>
                
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
