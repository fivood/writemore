export interface WritingChallenge {
  id: string;
  text: string;
  source: 'builtin' | 'user';
}

export const BUILTIN_CHALLENGES: WritingChallenge[] = [
  // 展示不叙述
  { id: 'wc001', text: '用"展示"而不是"叙述"的方法重写句子：她的头发一团乱。', source: 'builtin' },
  { id: 'wc002', text: '用"展示"而不是"叙述"的方法重写句子：我讨厌玫瑰的味道。', source: 'builtin' },
  { id: 'wc003', text: '用"展示"而不是"叙述"的方法重写句子：他等不及再见她一面。', source: 'builtin' },
  { id: 'wc004', text: '用"展示"而不是"叙述"的方法重写句子：学龄儿童休息时间结束后仍不能离开操场。', source: 'builtin' },
  { id: 'wc005', text: '用"展示"而不是"叙述"的方法重写句子：你总是改变主意。', source: 'builtin' },
  { id: 'wc006', text: '用"展示"而不是"叙述"的方法重写句子：月亮圆了。', source: 'builtin' },
  { id: 'wc007', text: '用"展示"而不是"叙述"的方法重写句子：我不会放弃的。', source: 'builtin' },
  // 陈词滥调改造
  { id: 'wc008', text: '用新鲜的、原创性的语言改造这句陈词滥调：他的裤子上有蚂蚁。', source: 'builtin' },
  { id: 'wc009', text: '用新鲜的、原创性的语言改造这句陈词滥调：我就像一条离开了水的鱼。', source: 'builtin' },
  { id: 'wc010', text: '用新鲜的、原创性的语言改造这句陈词滥调：沐浴后，她觉得自己像雏菊一样清爽。', source: 'builtin' },
  { id: 'wc011', text: '用新鲜的、原创性的语言改造这句陈词滥调：那不过是沧海一粟。', source: 'builtin' },
  { id: 'wc012', text: '用新鲜的、原创性的语言改造这句陈词滥调：这是切片面包以后最好的东西。', source: 'builtin' },
  { id: 'wc013', text: '用新鲜的、原创性的语言改造这句陈词滥调：在苦痛的眼中，你就是一场筵席。', source: 'builtin' },
  { id: 'wc014', text: '用新鲜的、原创性的语言改造这句陈词滥调：那男孩像野草一样生长。', source: 'builtin' },
  { id: 'wc015', text: '用新鲜的、原创性的语言改造这句陈词滥调：她曾祖母跟那句山丘一样老。', source: 'builtin' },
  { id: 'wc016', text: '用新鲜的、原创性的语言改造这句陈词滥调：不要贪心不足蛇吞象。', source: 'builtin' },
  { id: 'wc017', text: '用新鲜的、原创性的语言改造这句陈词滥调：我像树叶一样颤抖。', source: 'builtin' },
  { id: 'wc018', text: '用新鲜的、原创性的语言改造这句陈词滥调：经过第二次短暂的停留后，他继续在薄冰上走着。', source: 'builtin' },
  { id: 'wc019', text: '用新鲜的、原创性的语言改造这句陈词滥调：她的胸平得跟飞机场一样。', source: 'builtin' },
  { id: 'wc020', text: '用新鲜的、原创性的语言改造这句陈词滥调：千方百计，不遗余力。', source: 'builtin' },
];

export function pickRandomChallenge(
  excludeId?: string,
  extra: WritingChallenge[] = [],
): WritingChallenge | null {
  const pool = [...BUILTIN_CHALLENGES, ...extra].filter(c => c.id !== excludeId);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
