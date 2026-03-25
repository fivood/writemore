/**
 * Migration script v2: Better classification using expanded rules + text-only heuristics
 * 
 * Run with: node migrate_categories.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const wordsPath = resolve(__dirname, 'words.json');

const words = JSON.parse(readFileSync(wordsPath, 'utf-8'));

// ── Explicit overrides (highest priority) ──
const EXPLICIT_CATEGORY = {
  // 人物
  '仿生人': '人物', '侦探': '人物', '杀手': '人物', '刺客': '人物', '暗探': '人物',
  '线人': '人物', '盗贼': '人物', '黑客': '人物', '间谍': '人物', '赏金猎人': '人物',
  '巫师': '人物', '骑士': '人物', '精灵': '人物', '矮人': '人物', '亡灵': '人物',
  '龙骑士': '人物', '祭司': '人物', '游侠': '人物', '预言家': '人物', '炼金术士': '人物',
  '少年': '人物', '少女': '人物', '公主': '人物', '王子': '人物', '王': '人物',
  '通灵者': '人物', '驱魔人': '人物', '猎魔人': '人物', '赛博格': '人物',
  '侠客': '人物', '剑客': '人物', '浪人': '人物', '镖客': '人物', '武僧': '人物',
  '将军': '人物', '丞相': '人物', '皇帝': '人物', '太监': '人物', '谋士': '人物',
  '门客': '人物', '刺史': '人物', '游医': '人物', '隐士': '人物',
  
  // 地名
  '密室': '地名', '咖啡馆': '地名', '酒吧': '地名', '地下室': '地名',
  '太空站': '地名', '空间站': '地名', '殖民地': '地名', '废墟': '地名',
  '荒星': '地名', '虫洞': '地名', '迷宫': '地名', '墓地': '地名',
  '古堡': '地名', '深渊': '地名', '地牢': '地名', '禁区': '地名',
  '战场': '地名', '遗迹': '地名', '祭坛': '地名', '边塞': '地名',
  '客栈': '地名', '镖局': '地名', '武馆': '地名', '江湖': '地名',
  '朝堂': '地名', '后宫': '地名', '茶楼': '地名', '酒肆': '地名',

  // 实物
  '芯片': '实物', '飞船': '实物', '卫星': '实物', '电子眼': '实物',
  '咖啡': '实物', '雨伞': '实物', '钥匙': '实物', '照片': '实物',
  '日记': '实物', '手机': '实物', '信件': '实物', '毒药': '实物',
  '光合装甲': '实物', '力场护盾': '实物', '基因锁': '实物',
  '龙晶': '实物', '魔杖': '实物', '圣杯': '实物', '魔镜': '实物',
  '飞毯': '实物', '符箓': '实物', '法器': '实物', '护身符': '实物',

  // 典故
  '玄武门之变': '典故', '诺亚方舟': '典故', '潘多拉魔盒': '典故',
  '特洛伊木马': '典故', '大禹治水': '典故',

  // 状态
  '初吻': '状态', '背叛': '状态', '孤独': '状态', '暗恋': '状态',
  '失忆': '状态', '复仇': '状态', '重生': '状态', '觉醒': '状态',
  '宿命': '状态', '轮回': '状态', '沉沦': '状态', '救赎': '状态',
  '守护': '状态', '牺牲': '状态', '信念': '状态',

  // 抽象
  '因果律': '抽象', '平行世界': '抽象', '时间悖论': '抽象',
  '蝴蝶效应': '抽象', '量子纠缠': '抽象', '暗物质': '抽象',
  '暗能量': '抽象', '引力波': '抽象', '时间膨胀': '抽象',
  '全息投影': '抽象', '反物质': '抽象',
};

// ── Category rules (pattern-based) ──

function classifyCategory(word) {
  const text = word.text || '';
  const expl = word.explanation || '';
  const combined = text + '|' + expl;

  // 1. Explicit override
  if (EXPLICIT_CATEGORY[text]) return EXPLICIT_CATEGORY[text];

  // 2. 人物 — people, characters, roles
  if (/[人者侠客师手王士族僧将相]$/.test(text) && text.length <= 4) return '人物';
  if (/人物|角色|身份|职业|生命体|种族|模拟|机器人|生物体|实体|灵魂|古人|某人|术师|法师|战士/.test(combined)) return '人物';

  // 3. 地名 — locations
  if (/[城宫殿岛山谷洞楼馆院寺庄镇村堡塔阁]$/.test(text) && text.length <= 4) return '地名';
  if (/地点|地方|场所|空间|区域|建筑|城市|位于|世界$|星球|基地|领域|领地|国度/.test(combined)) return '地名';
  if (/^.{1,3}(市|县|州|国|域)$/.test(text)) return '地名';

  // 4. 典故 — historical events, legends
  if (/(之变|之战|之乱|之盟|之约)$/.test(text)) return '典故';
  if (/事件|政变|战役|典故|传说|神话|寓言|史记|历史记载|成语/.test(combined)) return '典故';

  // 5. 实物 — objects, devices, tools
  if (/[器机剑刀甲锁盾弓枪药丹晶弩箭鞭锤斧]$/.test(text) && text.length <= 4) return '实物';
  if (/装置|设备|工具|武器|物质|材料|物品|仪器|器具|载体|容器|药物|机械|物件/.test(combined)) return '实物';
  if (/^(.*)(系统|引擎|芯片|装置|飞船|基地|装甲|护盾)$/.test(text)) return '实物';

  // 6. 动作 — actions, techniques, events
  if (/[术法功技]$/.test(text) && text.length <= 4) return '动作';
  if (/技术|技能|方法|行为|能力|方式|操作|过程|发动|进行|实施|攻击|防御/.test(combined)) return '动作';
  if (/穿越|逃亡|追杀|寻宝|破解|伏击|刺杀|绑架|潜入|冒险|探索|占领|征服/.test(text)) return '动作';

  // 7. 感官 — sensory
  if (/[光声影色香味]$/.test(text) && text.length <= 3) return '感官';
  if (/视觉|听觉|触觉|味觉|嗅觉|声音|光芒|颜色|气息|温度|质感|气味|触感/.test(combined)) return '感官';

  // 8. 状态 — emotions, states, conditions
  if (/情感|情绪|心理|关系|状态|感情|精神|内心|心灵|渴望|恐惧|孤独|绝望|希望/.test(combined)) return '状态';
  if (/爱恨|执念|迷恋|嫉妒|愧疚|悲伤|喜悦|恐惧|憎恨|绝望|希望|失落|迷茫/.test(text)) return '状态';

  // 9. 抽象 — concepts, theories
  if (/[论律则道义]$/.test(text) && text.length <= 4) return '抽象';
  if (/概念|理论|原理|哲学|规律|法则|思想|命运|真理|本质|定律|悖论|维度|时空/.test(combined)) return '抽象';

  // ── Fallback heuristics based on word length + genre ──
  
  // Short words (1-2 chars) without explanation: likely 意象 or 实物
  if (text.length <= 2 && !expl) {
    // Common concrete nouns
    if (/[花鸟鱼虫草木树叶石铁金银铜水火风土冰雪雨雷云雾月星日]/.test(text)) return '实物';
    return '意象';
  }

  // Words from specific genres have tendencies
  const genre = word.genre || (word.genres && word.genres[0]) || '';
  
  if (genre === '言情' || genre === '都市') {
    // Romance/Urban words are often states or objects
    if (/[情爱恋心泪梦思忆恨愁怨忧]/.test(text)) return '状态';
    return '意象';
  }
  
  if (genre === '武侠') {
    if (/[剑刀拳掌招式功法]/.test(text)) return '动作';
    return '意象';
  }

  if (genre === '恐怖') {
    if (/[鬼灵魂尸骨棺墓]/.test(text)) return '意象';
    return '意象';
  }

  return '意象';
}

// ── Cross-genre mapping ──

const CROSS_GENRE_KEYWORDS = {
  '科幻': [/量子/, /纳米/, /基因/, /人工智能/, /机器/, /虚拟/, /赛博/, /仿生/, /太空/, /星际/, /时间/, /时空/, /克隆/, /芯片/, /数字/, /网络/, /代码/, /算法/, /宇宙/, /黑洞/, /外星/, /光速/, /引擎/],
  '悬疑': [/密室/, /谋杀/, /线索/, /推理/, /案件/, /证据/, /嫌疑/, /秘密/, /真相/, /阴谋/, /追踪/, /暗号/, /密码/, /调查/, /犯罪/, /陷阱/, /凶手/],
  '奇幻': [/魔法/, /精灵/, /龙/, /巫/, /魔/, /咒/, /符/, /结界/, /异界/, /法术/, /召唤/, /变身/, /幻/, /神力/, /魂/, /妖/],
  '言情': [/爱/, /心/, /吻/, /恋/, /婚/, /缘/, /约/, /誓/, /泪/, /思念/, /暗恋/],
  '武侠': [/剑/, /刀/, /武/, /功/, /侠/, /拳/, /掌/, /内力/, /江湖/, /门派/, /招式/, /轻功/, /暗器/],
  '都市': [/城市/, /都市/, /公司/, /职场/, /商业/, /金融/, /咖啡/, /酒吧/, /公寓/, /办公/, /地铁/],
  '历史': [/朝代/, /皇帝/, /宫廷/, /古代/, /帝国/, /王朝/, /战国/, /三国/],
  '恐怖': [/血/, /鬼/, /尸/, /亡/, /死/, /暗/, /诅咒/, /噩梦/, /恐惧/, /亡灵/, /墓/, /幽灵/],
};

function classifyGenres(word) {
  const text = word.text || '';
  const expl = word.explanation || '';
  const combined = text + expl;
  const originalGenre = word.genre || (word.genres && word.genres[0]) || '通用';
  
  const genres = new Set();
  genres.add(originalGenre);

  for (const [genre, patterns] of Object.entries(CROSS_GENRE_KEYWORDS)) {
    if (genre === originalGenre) continue;
    for (const p of patterns) {
      if (p.test(combined)) {
        genres.add(genre);
        break;
      }
    }
  }

  return Array.from(genres);
}

// ── Run ──

console.log(`Migrating ${words.length} words...`);

const migrated = words.map(w => {
  const category = classifyCategory(w);
  const genres = classifyGenres(w);

  return {
    id: w.id,
    text: w.text,
    ...(w.explanation ? { explanation: w.explanation } : {}),
    category,
    genres,
    source: w.source || 'builtin',
    enabled: w.enabled !== false,
  };
});

// Stats
const catCounts = {};
migrated.forEach(w => catCounts[w.category] = (catCounts[w.category] || 0) + 1);
console.log('\nCategory distribution:');
Object.entries(catCounts).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));

const multiGenre = migrated.filter(w => w.genres.length > 1).length;
console.log(`\nMulti-genre words: ${multiGenre}/${migrated.length}`);

// Samples per category
for (const cat of Object.keys(catCounts)) {
  const samples = migrated.filter(w => w.category === cat).slice(0, 3);
  console.log(`\n  [${cat}] samples: ${samples.map(w => w.text).join(', ')}`);
}

writeFileSync(wordsPath, JSON.stringify(migrated, null, 2), 'utf-8');
console.log(`\n✅ Written to ${wordsPath}`);
