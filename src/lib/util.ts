/** 去掉空白和输入法留下的零宽字符后还有字 */
export function hasMeaningfulContent(content: string) {
  return content.replace(/[\s\u200B-\u200D\uFEFF]/g, '').length > 0;
}

/** 中文字数：不算空白 */
export function countChars(content: string) {
  return content.replace(/\s/g, '').length;
}

/** 本地日期 YYYY-MM-DD（不能用 toISOString，那是 UTC，北京时间 0–8 点会算成前一天） */
export function dayKey(d: Date | string | number = new Date()) {
  const t = new Date(d);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

/** 2026年11月27日 · 星期五 */
export function todayLabel(d = new Date()) {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · 星期${'日一二三四五六'[d.getDay()]}`;
}

export function downloadText(filename: string, text: string, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
