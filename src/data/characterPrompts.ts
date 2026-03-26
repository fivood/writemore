export type CharacterLayerId = 'inner' | 'relationship' | 'voice' | 'body' | 'history' | 'edge';

export interface CharacterLayer {
  id: CharacterLayerId;
  name: string;
  icon: string;
  description: string;
  color: string;
}

export interface CharacterPrompt {
  id: string;
  text: string;
  layer: CharacterLayerId;
  source: 'builtin' | 'user';
}

export const CHARACTER_LAYERS: CharacterLayer[] = [
  { id: 'inner',        name: '内心层',   icon: 'psychiatry',          description: '挖掘角色内部的矛盾与信仰',   color: 'bg-purple-50 border-purple-200 text-purple-800'   },
  { id: 'relationship', name: '关系层',   icon: 'group',               description: '两人之间的权力、距离与裂痕',  color: 'bg-rose-50 border-rose-200 text-rose-800'         },
  { id: 'voice',        name: '声音层',   icon: 'record_voice_over',   description: '说什么、不说什么、沉默的形状', color: 'bg-sky-50 border-sky-200 text-sky-800'            },
  { id: 'body',         name: '身体层',   icon: 'self_improvement',    description: '身体是最诚实的叙述者',        color: 'bg-teal-50 border-teal-200 text-teal-800'         },
  { id: 'history',      name: '历史层',   icon: 'history',             description: '过去如何以细节的形式住在当下', color: 'bg-amber-50 border-amber-200 text-amber-800'      },
  { id: 'edge',         name: '边缘视角', icon: 'visibility',          description: '从旁观者的眼睛看见主角',      color: 'bg-emerald-50 border-emerald-200 text-emerald-800'},
];

export const BUILTIN_CHARACTER_PROMPTS: CharacterPrompt[] = [
  // ── 内心层 ──────────────────────────────────────────────
  { id: 'cp001', layer: 'inner', source: 'builtin', text: '他/她有一套关于世界的理论，支撑他/她走到今天。写那套理论第一次出现裂缝的时刻。' },
  { id: 'cp002', layer: 'inner', source: 'builtin', text: '写他/她最深的恐惧——用他/她每天做的一个小习惯来侧写，不要直接命名那个恐惧。' },
  { id: 'cp003', layer: 'inner', source: 'builtin', text: '他/她有一件事从来不允许自己希望。写他/她某次差点希望了，然后把那个念头掐死的过程。' },
  { id: 'cp004', layer: 'inner', source: 'builtin', text: '他/她相信一件别人都觉得是幻觉的事。写他/她如何在生活细节里悄悄保护这个信念。' },
  { id: 'cp005', layer: 'inner', source: 'builtin', text: '写他/她曾经失去过的某种确信。他/她现在的哪个行为其实还在试图找回它？' },
  { id: 'cp006', layer: 'inner', source: 'builtin', text: '他/她有一个秘密的评判标准，一直在用它衡量所有遇到的人。写他/她用这把尺子量到自己的那一刻。' },
  { id: 'cp007', layer: 'inner', source: 'builtin', text: '他/她有两个版本的自己在内部争论。写一次争论——不要告诉读者谁赢了。' },
  { id: 'cp008', layer: 'inner', source: 'builtin', text: '写他/她最接近快乐的一次，以及他/她如何把那个快乐变成了一个问题。' },
  { id: 'cp009', layer: 'inner', source: 'builtin', text: '他/她知道自己在做一件会让他/她后悔的事，但还是做了。写他/她做决定的那一刻——不是后悔，是决定。' },
  { id: 'cp010', layer: 'inner', source: 'builtin', text: '写他/她对"足够好了"的界定。什么时候开始学会停止要求更多的？那是妥协，还是别的什么？' },
  { id: 'cp011', layer: 'inner', source: 'builtin', text: '他/她人生中有一个问题，从没有人给过他/她答案，但也从没停止想这个问题。写他/她某次重新遇见这个问题的时刻。' },

  // ── 关系层 ──────────────────────────────────────────────
  { id: 'cp012', layer: 'relationship', source: 'builtin', text: '双方有一个从来不说出口的规则，都在遵守，都不承认它存在。写这个规则如何在一次对话里悄悄运作。' },
  { id: 'cp013', layer: 'relationship', source: 'builtin', text: '写一个人如何在另一个人不注意的时候照顾对方——用他/她永远不会承认是"照顾"的方式。' },
  { id: 'cp014', layer: 'relationship', source: 'builtin', text: '两人曾经非常亲近。写现在他/她们如何在同一个房间里假装那段时间不存在。' },
  { id: 'cp015', layer: 'relationship', source: 'builtin', text: '其中一个人比另一个人更清楚这段关系会去哪里。写那个知道的人如何选择继续走。' },
  { id: 'cp016', layer: 'relationship', source: 'builtin', text: '写双方第一次意识到彼此在用不同的语言说同一件事，以及那一刻谁先沉默了。' },
  { id: 'cp017', layer: 'relationship', source: 'builtin', text: '两个人之间有一个话题，谁先提起谁就输了。写一次两人都感觉到那个话题在房间里，却都没有打开它。' },
  { id: 'cp018', layer: 'relationship', source: 'builtin', text: '写他/她替某人做了一个那人从未要求过的决定，以及他/她何时意识到这个决定其实是为了自己。' },
  { id: 'cp019', layer: 'relationship', source: 'builtin', text: '两人之间有一句话说了之后就不可挽回了。写说出那句话之前的最后一刻犹豫。' },
  { id: 'cp020', layer: 'relationship', source: 'builtin', text: '他/她对某个人的方式里有一种东西他/她从来没能原谅自己。写那个东西，不要命名它。' },
  { id: 'cp021', layer: 'relationship', source: 'builtin', text: '写这两个人如何在争吵里各自说的是不同的事，而他/她们都不知道另一个人听到的是什么。' },

  // ── 声音层 ──────────────────────────────────────────────
  { id: 'cp022', layer: 'voice', source: 'builtin', text: '写他/她在说谎时的语言习惯。句子在撒谎时会变短，还是会变长，还是会突然变得很精确？' },
  { id: 'cp023', layer: 'voice', source: 'builtin', text: '他/她有一句话说了很多次，但每次说的时候意思都不一样。写其中三次，让读者感受到差距。' },
  { id: 'cp024', layer: 'voice', source: 'builtin', text: '他/她在沉默时通常在做什么？那个动作替他/她说了什么。' },
  { id: 'cp025', layer: 'voice', source: 'builtin', text: '他/她从不说"对不起"。写他/她用来代替道歉的那些动作或话，以及接受方是否总能看懂。' },
  { id: 'cp026', layer: 'voice', source: 'builtin', text: '他/她在哪些人面前声音会变——变低、变快、变得更正式或更散漫？写一次声音的变化被另一个人察觉的时刻。' },
  { id: 'cp027', layer: 'voice', source: 'builtin', text: '写他/她说话时有哪些词语是绝不用的，那些词被他/她用什么代替了，为什么。' },
  { id: 'cp028', layer: 'voice', source: 'builtin', text: '他/她有一种笑，不是快乐的那种。写那种笑，以及它会在什么情况下出现。' },
  { id: 'cp029', layer: 'voice', source: 'builtin', text: '写他/她唯一一次说出了心里真正想说的话——以及说出来之后发生了什么。' },
  { id: 'cp030', layer: 'voice', source: 'builtin', text: '他/她有一个口头禅，是从某个人那里学来的。写他/她第一次听到这句话，以及第一次意识到自己也开始说了。' },

  // ── 身体层 ──────────────────────────────────────────────
  { id: 'cp031', layer: 'body', source: 'builtin', text: '写他/她在极度平静时身体里发生的事。那种表面静止、内部在燃烧的状态，从皮肤往里写。' },
  { id: 'cp032', layer: 'body', source: 'builtin', text: '他/她的身体记住了一件他/她的意识想忘记的事。写它在什么时候、以什么方式提醒他/她。' },
  { id: 'cp033', layer: 'body', source: 'builtin', text: '写他/她习惯用来占据空间的方式，以及他/她在某个人面前第一次不知道该把手放在哪里。' },
  { id: 'cp034', layer: 'body', source: 'builtin', text: '（奇幻向）他/她的异能在情绪失控时会做什么？写一次他/她拼命压制又没能完全压住的时刻。' },
  { id: 'cp035', layer: 'body', source: 'builtin', text: '他/她的疲惫有一种别人无法看出来的形状。写他/她疲惫到极点时身体做的那些微小的事。' },
  { id: 'cp036', layer: 'body', source: 'builtin', text: '他/她在接受触碰时和主动触碰别人时的方式截然不同。写他/她更害怕哪一个，以及为什么。' },
  { id: 'cp037', layer: 'body', source: 'builtin', text: '他/她有一个身体上的旧伤或旧痕。写他/她如何与它共处，以及什么时候它让他/她想起了来源。' },
  { id: 'cp038', layer: 'body', source: 'builtin', text: '写他/她的某个身体反应——不是他/她选择的那种——在他/她试图控制的时候如何出卖了他/她。' },
  { id: 'cp039', layer: 'body', source: 'builtin', text: '他/她有一个小动作，只在非常放松或非常害怕的时候才会出现。这两种情境下那个动作看起来是否一样？' },

  // ── 历史层 ──────────────────────────────────────────────
  { id: 'cp040', layer: 'history', source: 'builtin', text: '他/她有一个非常小的习惯，没有人知道是从哪里来的。写那个习惯的来源，以及他/她现在做这件事时还不还记得为什么。' },
  { id: 'cp041', layer: 'history', source: 'builtin', text: '写他/她生命里某个从未得到过答案的问题。虽然已经停止寻找答案，但还没停止想这个问题。' },
  { id: 'cp042', layer: 'history', source: 'builtin', text: '他/她在某件事上永远是第一个离开的那个人。写他/她第一次学会这件事的时候。' },
  { id: 'cp043', layer: 'history', source: 'builtin', text: '他/她人生中有一个"之前"和"之后"。写那个分界点，但不要从事件本身写，从一个细节切入。' },
  { id: 'cp044', layer: 'history', source: 'builtin', text: '他/她曾经非常在乎某样东西，现在假装不在乎了——但碰到它时身体还是记得。写那样东西，写那一碰。' },
  { id: 'cp045', layer: 'history', source: 'builtin', text: '他/她有一段时间从来不跟人提——不是因为那段时间很糟，而是因为它太好了，像一个只属于记忆的房间。写他/她某次差点打开那扇门。' },
  { id: 'cp046', layer: 'history', source: 'builtin', text: '他/她从某个人身上学会了某种方式——照顾别人的方式、离开的方式、说谎的方式。写他/她第一次意识到自己在复制那个人。' },
  { id: 'cp047', layer: 'history', source: 'builtin', text: '他/她生命里有一次道路的岔口，走了其中一条。写他/她偶尔想起另一条路的那个时刻——不是后悔，只是想起。' },
  { id: 'cp048', layer: 'history', source: 'builtin', text: '他/她的某个坚持，其实是为了完成很久以前答应过某人的一件事。那个人现在还在不在了？他/她有没有想过如果取消那个承诺会怎样？' },

  // ── 边缘视角 ──────────────────────────────────────────────
  { id: 'cp049', layer: 'edge', source: 'builtin', text: '一个几乎不认识他/她的人写下了对他/她的第一印象。那个印象大部分是错的，但有一处出奇地准确。' },
  { id: 'cp050', layer: 'edge', source: 'builtin', text: '写一个每天见到他/她的人（保洁、店员、邻居等）。他/她们注意到了什么，而主角完全不知道自己正在被观察。' },
  { id: 'cp051', layer: 'edge', source: 'builtin', text: '他/她最亲近的人有一件关于他/她的事，从来没告诉过他/她——因为说出来会改变两人之间的某个平衡。' },
  { id: 'cp052', layer: 'edge', source: 'builtin', text: '写一个曾经喜欢过他/她、现在不再喜欢了的人如何看他/她——哪些地方还在，哪些地方变了，哪些地方其实从来就不存在。' },
  { id: 'cp053', layer: 'edge', source: 'builtin', text: '他/她的对手或竞争者是如何描述他/她的？写那个版本——可能刻薄、可能误解，但里面藏着一点真相。' },
  { id: 'cp054', layer: 'edge', source: 'builtin', text: '写一个孩子对他/她的看法。孩子用来形容他/她的词语，是他/她自己绝想不到要用的。' },
  { id: 'cp055', layer: 'edge', source: 'builtin', text: '他/她走进一个房间之后，那个房间里的人怎么变了？写那些人，而不是他/她本人。' },
  { id: 'cp056', layer: 'edge', source: 'builtin', text: '写一个在他/她最脆弱的时候见过他/她的陌生人，以及他/她是否知道对方见到过那个时刻。' },
  { id: 'cp057', layer: 'edge', source: 'builtin', text: '他/她离开之后，他/她留下的那个地方发生了什么变化？写那些留下来的人，他/她不在场的日子里是什么样的。' },
];

export function pickRandomCharacterPrompt(
  layer?: CharacterLayerId | null,
  excludeId?: string,
  extra: CharacterPrompt[] = [],
): CharacterPrompt | null {
  const all = [...BUILTIN_CHARACTER_PROMPTS, ...extra];
  const pool = all.filter(c => c.id !== excludeId && (!layer || c.layer === layer));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
