// 用户自建的词条分类（名字 + 图标键），存 localStorage
const KEY = 'writemore_custom_categories_v1';
const EVENT = 'writemore:custom-categories-updated';

export interface CustomCategoryDef {
  name: string;
  iconKey: string;
}

export function loadCustomCategories(): CustomCategoryDef[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is CustomCategoryDef => !!item && typeof item.name === 'string' && typeof item.iconKey === 'string')
      .map(item => ({ name: item.name.trim(), iconKey: item.iconKey.trim() }))
      .filter(item => item.name.length > 0);
  } catch {
    return [];
  }
}

export function saveCustomCategories(list: CustomCategoryDef[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(EVENT));
}

/** 本页或别的窗口改了分类时回调，返回取消订阅 */
export function onCustomCategoriesChange(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}
