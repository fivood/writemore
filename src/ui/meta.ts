// 界面用的图标和配色表（温润橡果浅褐 × 草木茶染邻近色系）
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

export function categoryIcon(category: string, customIconKeys: Record<string, string> = {}): LucideIcon {
  return CATEGORY_ICONS[category] ?? CUSTOM_ICON_POOL[customIconKeys[category]] ?? Tag;
}

/** 词库页与词卡分类标签（邻近草木茶染色阶） */
export const CATEGORY_COLORS: Record<string, string> = {
  '意象': 'bg-[#f3e9d8] text-[#785937] border-[#dcc8ab] dark:bg-[#33291d] dark:text-[#d6b892] dark:border-[#4d3e2b]',
  '实物': 'bg-[#efe5d2] text-[#735833] border-[#d8c6a5] dark:bg-[#32291b] dark:text-[#d4bb90] dark:border-[#4c3f29]',
  '动作': 'bg-[#e5ecdf] text-[#4a5e40] border-[#c6d4bc] dark:bg-[#232c1f] dark:text-[#a8be9b] dark:border-[#364530]',
  '状态': 'bg-[#ede6e1] text-[#69564c] border-[#d4c7be] dark:bg-[#2e2623] dark:text-[#c4b0a5] dark:border-[#473b36]',
  '感官': 'bg-[#e3ebe6] text-[#455c50] border-[#c3d3c9] dark:bg-[#202b25] dark:text-[#9eb8aa] dark:border-[#33443b]',
  '抽象': 'bg-[#ece5da] text-[#63533f] border-[#d4c7b4] dark:bg-[#2d271f] dark:text-[#c7b7a1] dark:border-[#473e32]',
  '人物': 'bg-[#f2e6da] text-[#7a563b] border-[#dbc5b0] dark:bg-[#33261c] dark:text-[#d6b194] dark:border-[#4d392b]',
  '地名': 'bg-[#e6ece0] text-[#4e5e42] border-[#c8d4be] dark:bg-[#242c1f] dark:text-[#abc09d] dark:border-[#384531]',
  '典故': 'bg-[#eae4da] text-[#5c5346] border-[#cfc6b6] dark:bg-[#2b2721] dark:text-[#bdb3a4] dark:border-[#423d34]',
  'all':  'bg-surface-container-high text-on-surface-variant border-outline-variant/50',
};

export const WORD_CARD_STYLE: Record<string, { badge: string; glow: string }> = {
  '意象': { badge: CATEGORY_COLORS['意象'], glow: '' },
  '实物': { badge: CATEGORY_COLORS['实物'], glow: '' },
  '动作': { badge: CATEGORY_COLORS['动作'], glow: '' },
  '状态': { badge: CATEGORY_COLORS['状态'], glow: '' },
  '感官': { badge: CATEGORY_COLORS['感官'], glow: '' },
  '抽象': { badge: CATEGORY_COLORS['抽象'], glow: '' },
  '人物': { badge: CATEGORY_COLORS['人物'], glow: '' },
  '地名': { badge: CATEGORY_COLORS['地名'], glow: '' },
  '典故': { badge: CATEGORY_COLORS['典故'], glow: '' },
};

const ARCHIVAL_STAMP = 'bg-surface-container-high/80 border-outline-variant/60 text-on-surface';

export const GENRE_STYLE: Record<string, { bg: string; Icon: LucideIcon }> = {
  '科幻': { bg: ARCHIVAL_STAMP, Icon: Rocket },
  '悬疑': { bg: ARCHIVAL_STAMP, Icon: Search },
  '奇幻': { bg: ARCHIVAL_STAMP, Icon: BookText },
  '言情': { bg: ARCHIVAL_STAMP, Icon: Heart },
  '武侠': { bg: ARCHIVAL_STAMP, Icon: Sword },
  '都市': { bg: ARCHIVAL_STAMP, Icon: Building2 },
  '恐怖': { bg: ARCHIVAL_STAMP, Icon: Ghost },
  '历史': { bg: ARCHIVAL_STAMP, Icon: ScrollText },
};

export const WRITING_MODES: { mode: WritingMode; code: string; label: string; color: string; Icon: LucideIcon }[] = [
  { mode: 'words',     code: '01', label: '词汇灵感', Icon: Dices,      color: 'bg-[#f4ead7] dark:bg-[#33291c] border-[#d6c09e] dark:border-[#4d3e2a] text-[#785834] dark:text-[#d9ba91]' },
  { mode: 'dream',     code: '02', label: '梦境记录', Icon: MoonStar,   color: 'bg-[#eee7e2] dark:bg-[#2e2623] border-[#d1c3ba] dark:border-[#473b36] text-[#69554b] dark:text-[#c7b2a7]' },
  { mode: 'character', code: '03', label: '角色描写', Icon: User,       color: 'bg-[#f2e6da] dark:bg-[#33261c] border-[#d8c1ac] dark:border-[#4d392a] text-[#7a573b] dark:text-[#d6b294]' },
  { mode: 'free',      code: '04', label: '自由发挥', Icon: PencilLine, color: 'bg-[#e6ecdf] dark:bg-[#232c1e] border-[#c5d1b8] dark:border-[#374530] text-[#4c5e3f] dark:text-[#abc09c]' },
  { mode: 'scene',     code: '05', label: '场景描写', Icon: Mountain,   color: 'bg-[#e3ebe5] dark:bg-[#202b25] border-[#c1d1c6] dark:border-[#33443b] text-[#445c4e] dark:text-[#9eb8a9]' },
  { mode: 'challenge', code: '06', label: '写作挑战', Icon: CircleHelp, color: 'bg-[#f3e5d7] dark:bg-[#34261a] border-[#d9bfa6] dark:border-[#4f3927] text-[#7d5636] dark:text-[#d9b08c]' },
];

export const CHARACTER_LAYER_STYLE: Record<CharacterLayerId, { color: string; Icon: LucideIcon }> = {
  inner:        { Icon: Brain,         color: 'bg-surface-container-high border-secondary/40 text-on-surface' },
  relationship: { Icon: Users,         color: 'bg-surface-container-high border-primary/40 text-on-surface' },
  voice:        { Icon: Mic,           color: 'bg-surface-container-high border-tertiary/40 text-on-surface' },
  body:         { Icon: Accessibility, color: 'bg-surface-container-high border-secondary/40 text-on-surface' },
  history:      { Icon: History,       color: 'bg-surface-container-high border-primary/40 text-on-surface' },
  edge:         { Icon: Eye,           color: 'bg-surface-container-high border-tertiary/40 text-on-surface' },
};
