import { db } from '../db';
import { pullDrafts, pushDraft, pullWordSets, pushWordSet } from '../services/supabase';
import { isGhostDreamDraft } from './drafts';

/** 草稿按 updatedAt 双向合并（本地被覆盖前先留一份隐藏的冲突备份），词组只补缺不覆盖 */
export async function syncWithCloud(userId: string) {
  const cloudDrafts = (await pullDrafts(userId)).filter(d => !isGhostDreamDraft(d));
  const localRaw = await db.drafts.toArray();
  const localDrafts = localRaw.filter(d => !isGhostDreamDraft(d));

  // 顺手清掉本地遗留的空梦境稿，免得刷新后又冒出来
  for (const d of localRaw) {
    if (isGhostDreamDraft(d)) await db.drafts.delete(d.id);
  }

  const localById = new Map(localDrafts.map(d => [d.id, d]));
  const cloudById = new Map(cloudDrafts.map(d => [d.id, d]));
  for (const cd of cloudDrafts) {
    const local = localById.get(cd.id);
    if (local && new Date(cd.updatedAt) <= new Date(local.updatedAt)) continue;
    if (local && local.content !== cd.content) {
      await db.drafts.put({
        ...local,
        id: `${local.id}_backup_${Date.now()}`,
        title: `[冲突备份] ${local.title || '无标题'}`,
        deletedFromPalace: true,
        updatedAt: new Date(),
      });
    }
    await db.drafts.put(cd);
  }
  for (const ld of localDrafts) {
    const cloud = cloudById.get(ld.id);
    if (!cloud || new Date(ld.updatedAt) > new Date(cloud.updatedAt)) await pushDraft(ld, userId);
  }

  const cloudSets = await pullWordSets(userId);
  const localSets = await db.wordSets.toArray();
  const localSetIds = new Set(localSets.map(w => w.id));
  const cloudSetIds = new Set(cloudSets.map(w => w.id));
  for (const cws of cloudSets) {
    if (!localSetIds.has(cws.id)) await db.wordSets.put(cws);
  }
  for (const lws of localSets) {
    if (!cloudSetIds.has(lws.id)) await pushWordSet(lws, userId);
  }
}
