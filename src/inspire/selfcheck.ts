// 灵感模块自检：npm run check:inspire
import {
  BUILTIN_WORDS, BUILTIN_CHALLENGES, BUILTIN_CHARACTER_PROMPTS, SCENE_PROMPTS, CHARACTER_LAYERS,
  drawWords, pickGenre, pickScene, pickChallenge, pickCharacterPrompt, parseWordList, formatWordListMd, normalizeWord,
  parsePromptLines, parseAiScene, buildCharacterGeneratePrompt, buildInspirationRemixPrompt,
  buildSceneGeneratePrompt, buildChallengeGeneratePrompt, WRITING_PERSONA,
} from './index';
import type { Word } from './index';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`✗ ${msg}`);
}

// 固定种子，结果可复现
function seeded(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
}

for (const [name, list] of [['词', BUILTIN_WORDS], ['场景', SCENE_PROMPTS], ['挑战', BUILTIN_CHALLENGES], ['角色题', BUILTIN_CHARACTER_PROMPTS]] as const) {
  assert(new Set(list.map(x => x.id)).size === list.length, `${name} id 有重复`);
}
assert(BUILTIN_CHARACTER_PROMPTS.every(p => CHARACTER_LAYERS.some(l => l.id === p.layer)), '角色题的维度不存在');

const five = drawWords(5, { rng: seeded(1) });
assert(five.length === 5 && new Set(five.map(w => w.id)).size === 5, '抽 5 个词应不重复');
assert(JSON.stringify(drawWords(5, { rng: seeded(1) })) === JSON.stringify(five), '同种子应抽到同一组');

const locked = new Map<number, Word>([[1, BUILTIN_WORDS[0]]]);
for (let i = 0; i < 50; i++) {
  const ws = drawWords(3, { locked, rng: seeded(i) });
  assert(ws[1].id === BUILTIN_WORDS[0].id && ws.filter(w => w.id === BUILTIN_WORDS[0].id).length === 1, '锁定位置应不变且不重复');
}
assert(drawWords(4, { categories: ['典故'] }).every(w => w.category === '典故'), '分类筛选失效');
const tiny: Word[] = [{ ...BUILTIN_WORDS[0] }, { ...BUILTIN_WORDS[1], enabled: false }];
assert(drawWords(3, { pool: tiny }).length === 1, '候选不够时只返回能抽到的，跳过停用词');

assert(pickGenre(['通用']) !== '通用', '只有「通用」时应退回全部题材');
assert(pickGenre(['武侠', '通用']) === '武侠', '应从给定池里抽');
assert(pickScene({ exclude: SCENE_PROMPTS[0].id, rng: () => 0 }).id !== SCENE_PROMPTS[0].id, 'exclude 失效');
assert(pickChallenge({ extra: [{ id: 'u1', text: 'x', source: 'user' }], rng: () => 0.9999 })?.id === 'u1', 'extra 应参与抽题');
assert(pickCharacterPrompt({ layer: 'voice' })?.layer === 'voice', '维度筛选失效');

assert(normalizeWord({ id: 'x', text: '旧', genre: '武侠', source: 'user', enabled: true }).genres[0] === '武侠', '旧格式 genre 应迁到 genres');

const md = parseWordList('# 注释\n[意象]（月光）：（夜里的光）\n[实物](钥匙):(开锁的)\n[人物] 侦探：查案的人\n孤词\n这一行 有空格不算', 'md');
assert(md.length === 4, `md 应解析出 4 条，实际 ${md.length}`);
assert(md[0].text === '月光' && md[0].explanation === '夜里的光' && md[0].category === '意象', 'md 全括号格式');
assert(md[2].category === '人物' && md[2].text === '侦探', 'md 空格格式');
assert(md[3].category === '通用', '单词行归「通用」');
assert(JSON.stringify(parseWordList(formatWordListMd(md.slice(0, 3)), 'md')) === JSON.stringify(md.slice(0, 3)), '导出再导入应一致');
assert(parseWordList('[{"text":"甲","genre":"武侠"},{"nope":1}]', 'json')[0].category === '武侠', 'json 旧 genre 字段当分类');

const lines = parsePromptLines('1. 雨停之后\n2、他们约好\n（3）写一个人\n① 门缝里的信\n- 灯亮着\n• 第三杯咖啡\n\n一封信没有署名\n一、开头\n3 天后她回来\n1.5 倍速的人生');
assert(JSON.stringify(lines) === JSON.stringify(
  ['雨停之后', '他们约好', '写一个人', '门缝里的信', '灯亮着', '第三杯咖啡', '一封信没有署名', '开头', '3 天后她回来', '1.5 倍速的人生'],
), `parsePromptLines 结果不对：${JSON.stringify(lines)}`);

const scene = { title: '凌晨的车站', description: '最后一班车开走了', tags: ['夜晚'] };
assert(JSON.stringify(parseAiScene(JSON.stringify(scene))) === JSON.stringify(scene), '裸 JSON 场景');
assert(parseAiScene('好的，这是场景：\n```json\n' + JSON.stringify(scene) + '\n```\n希望喜欢')?.title === '凌晨的车站', '代码块包着的场景');
assert(parseAiScene('前面一句话 {"title":"甲","description":"乙"} 后面一句')?.tags.length === 0, '缺 tags 时给空数组');
assert(parseAiScene('不是 JSON') === null && parseAiScene('{"title":"只有标题"}') === null, '解析不出要返回 null');

const voice = CHARACTER_LAYERS[2];
const mine = { id: 'u_voice', text: '我自己加的声音层题目', layer: voice.id, source: 'user' as const };
const charMsgs = buildCharacterGeneratePrompt({ layer: voice, genre: '武侠', pool: [...BUILTIN_CHARACTER_PROMPTS, mine], rng: seeded(3) });
const charText = charMsgs[1].content;
assert(charText.includes('声音层') && charText.includes('武侠'), '角色出题提示要带上维度和风格');
assert(!charText.includes(BUILTIN_CHARACTER_PROMPTS.find(p => p.layer === 'inner')!.text), '别的维度的题不该出现');
assert(charText.includes(mine.text), '用户自己的题要参与去重（声音层只有 10 条，应全部列出）');
assert(charMsgs[0].content === WRITING_PERSONA, '第一条是默认人设');

const current = SCENE_PROMPTS[5];
const sceneText = buildSceneGeneratePrompt({ current, rng: seeded(4) })[1].content;
const exampleLines = sceneText.split('\n').filter(l => l.startsWith('- 「'));
assert(exampleLines.length === 3, `场景出题要带 3 个范例，实际 ${exampleLines.length}`);
assert(sceneText.includes(current.title), '当前场景一定在避开清单里');
const avoidLine = sceneText.split('\n').find(l => l.includes('不要和这些已有场景重复'))!;
assert(avoidLine.split('、').length === 13, '避开清单 = 3 个范例 + 10 个抽样（含当前）');

const chText = buildChallengeGeneratePrompt({ current: '当前这道题', rng: seeded(5) })[1].content;
const chAvoid = chText.split('\n').find(l => l.includes('不要和这些已有题目太相似'))!;
assert(chAvoid.includes('当前这道题') && chAvoid.split('；').length === 10, '挑战题避开清单：当前这道 + 抽 9 条');
assert(buildInspirationRemixPrompt([{ title: '甲', content: '内容' }])[1].content.includes('《甲》：内容'), '宫殿重组只需要标题和正文');

console.log('✓ inspire 自检通过');
