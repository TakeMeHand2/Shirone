/**
 * 回退封面解析：无封面文章按 slug 确定性从回退封面池取图。
 * 确定性轮换（FNV-1a 哈希取模）保证同一篇文章每次构建拿到同一张封面，
 * 列表页与文章页之间也不会漂移；池为空或文章已有封面时原样返回。
 */
import type { CollectionEntry } from "astro:content";
import { coverConfig } from "@/config/coverConfig";

function hashSlug(slug: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < slug.length; i++) {
		hash ^= slug.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

/**
 * 返回文章应使用的封面源值（未做构建期产物解析，消费方按既有管线处理）。
 * 优先 frontmatter `image`；未填时从 coverConfig.fallbackCovers 确定性取一张。
 */
export function resolvePostCoverImage(
	entry: Pick<CollectionEntry<"posts">, "id" | "data">,
): string {
	if (entry.data.image) return entry.data.image;
	const pool = coverConfig.fallbackCovers ?? [];
	if (pool.length === 0) return "";
	return pool[hashSlug(entry.id) % pool.length];
}
