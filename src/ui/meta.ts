// 界面用的图标和配色表（灵感模块只管数据，样式都在这里）
import {
  Sparkles, Package, Zap, Layers, Eye, Brain, User, Map as MapIcon, ScrollText, Tag, BookOpen, Pencil,
  Rocket, Search, BookText, Heart, Sword, Building2, Ghost,
  Dices, PencilLine, Mountain, MoonStar, CircleHelp, Users, Mic, Accessibility, History,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CharacterLayerId } from '../inspire';
import type { WritingMode } from '../types';

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  '意象': Sparkles,
  '实物': Package,
  '动作': Zap,
  '状态': Layers,
  '感官': Eye,
  '抽象': Brain,
  '人物': User,
  '地名': MapIcon,
  '典故': ScrollText,
};

/** 自建分类能选的图标 */
export const CUSTOM_ICON_POOL: Record<string, LucideIcon> = {
  tag: Tag,
  sparkles: Sparkles,
  package: Package,
  zap: Zap,
  layers: Layers,
  eye: Eye,
  brain: Brain,
  user: User,
  map: MapIcon,
  scroll: ScrollText,
  book: BookOpen,
  pencil: Pencil,
};

/** customIconKeys：自建分类名 → 图标键 */
export function categoryIcon(category: string, customIconKeys: Record<string, string> = {}): LucideIcon {
  return CATEGORY_ICONS[category] ?? CUSTOM_ICON_POOL[customIconKeys[category]] ?? Tag;
}

/** 词库页的分类标签 */
export const CATEGORY_COLORS: Record<string, string> = {
  '意象': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  '实物': 'bg-amber-100 text-amber-700 border-amber-200',
  '动作': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  '状态': 'bg-pink-100 text-pink-700 border-pink-200',
  '感官': 'bg-cyan-100 text-cyan-700 border-cyan-200',
  '抽象': 'bg-violet-100 text-violet-700 border-violet-200',
  '人物': 'bg-orange-100 text-orange-700 border-orange-200',
  '地名': 'bg-teal-100 text-teal-700 border-teal-200',
  '典故': 'bg-stone-100 text-stone-700 border-stone-200',
  'all': 'bg-stone-100 text-stone-600 border-stone-200',
};

/** 写作页词卡：分类角标和光晕 */
export const WORD_CARD_STYLE: Record<string, { badge: string; glow: string }> = {
  '意象': { badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300', glow: 'word-glow-indigo' },
  '实物': { badge: 'bg-amber-100  text-amber-700', glow: 'word-glow-amber' },
  '动作': { badge: 'bg-emerald-100 text-emerald-700', glow: 'word-glow-emerald' },
  '状态': { badge: 'bg-pink-100   text-pink-700   dark:bg-pink-400/15   dark:text-pink-300', glow: 'word-glow-pink' },
  '感官': { badge: 'bg-cyan-100   text-cyan-700   dark:bg-cyan-400/15   dark:text-cyan-300', glow: 'word-glow-cyan' },
  '抽象': { badge: 'bg-violet-100 text-violet-700', glow: 'word-glow-violet' },
  '人物': { badge: 'bg-orange-100 text-orange-700', glow: 'word-glow-orange' },
  '地名': { badge: 'bg-teal-100   text-teal-700', glow: 'word-glow-teal' },
  '典故': { badge: 'bg-stone-100  text-stone-600  dark:bg-surface-variant dark:text-on-surface-variant', glow: 'word-glow-stone' },
};

export const GENRE_STYLE: Record<string, { bg: string; Icon: LucideIcon }> = {
  '科幻': { bg: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-500/10 dark:border-blue-400/15 dark:text-blue-300', Icon: Rocket },
  '悬疑': { bg: 'bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-500/10 dark:border-purple-400/15 dark:text-purple-300', Icon: Search },
  '奇幻': { bg: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-500/10 dark:border-green-400/15 dark:text-green-300', Icon: BookText },
  '言情': { bg: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-500/10 dark:border-red-400/15 dark:text-red-300', Icon: Heart },
  '武侠': { bg: 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-500/10 dark:border-orange-400/15 dark:text-orange-300', Icon: Sword },
  '都市': { bg: 'bg-teal-50 border-teal-200 text-teal-800 dark:bg-teal-500/10 dark:border-teal-400/15 dark:text-teal-300', Icon: Building2 },
  '历史': { bg: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-400/15 dark:text-amber-300', Icon: ScrollText },
  '恐怖': { bg: 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-500/10 dark:border-rose-400/15 dark:text-rose-300', Icon: Ghost },
};

export const WRITING_MODES: { mode: WritingMode; label: string; color: string; Icon: LucideIcon }[] = [
  { mode: 'words',     label: '词汇灵感', Icon: Dices,      color: 'bg-amber-50   dark:bg-amber-500/10  border-amber-200   dark:border-amber-400/20  text-amber-800   dark:text-amber-300'   },
  { mode: 'free',      label: '自由发挥', Icon: PencilLine, color: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-400/20 text-emerald-800 dark:text-emerald-300' },
  { mode: 'scene',     label: '场景描写', Icon: Mountain,   color: 'bg-blue-50    dark:bg-blue-500/10    border-blue-200    dark:border-blue-400/20    text-blue-800    dark:text-blue-300'    },
  { mode: 'dream',     label: '梦境记录', Icon: MoonStar,   color: 'bg-violet-50  dark:bg-violet-500/10  border-violet-200  dark:border-violet-400/20  text-violet-800  dark:text-violet-300'  },
  { mode: 'challenge', label: '写作挑战', Icon: CircleHelp, color: 'bg-rose-50    dark:bg-rose-500/10    border-rose-200    dark:border-rose-400/20    text-rose-800    dark:text-rose-300'    },
  { mode: 'character', label: '角色描写', Icon: User,       color: 'bg-fuchsia-50 dark:bg-fuchsia-500/10 border-fuchsia-200 dark:border-fuchsia-400/20 text-fuchsia-800 dark:text-fuchsia-300' },
];

export const CHARACTER_LAYER_STYLE: Record<CharacterLayerId, { color: string; Icon: LucideIcon }> = {
  inner:        { Icon: Brain,         color: 'bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-500/12 dark:border-purple-400/30 dark:text-purple-500' },
  relationship: { Icon: Users,         color: 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-500/12 dark:border-rose-400/30 dark:text-rose-500' },
  voice:        { Icon: Mic,           color: 'bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-500/12 dark:border-sky-400/30 dark:text-sky-500' },
  body:         { Icon: Accessibility, color: 'bg-teal-50 border-teal-200 text-teal-800 dark:bg-teal-500/12 dark:border-teal-400/30 dark:text-teal-500' },
  history:      { Icon: History,       color: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-500/12 dark:border-amber-400/30 dark:text-amber-500' },
  edge:         { Icon: Eye,           color: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-500/12 dark:border-emerald-400/30 dark:text-emerald-500' },
};
