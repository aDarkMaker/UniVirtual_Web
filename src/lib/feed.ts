import type { BiliSnapshot } from '@/types/bili';
import type { FeedItem } from '@/lib/feed-format';

const snapshots = import.meta.glob<BiliSnapshot>('@/data/bili/*.json', {
	eager: true,
	import: 'default',
});

function toHttps(url: string): string {
	return url.replace(/^http:\/\//, 'https://');
}

export function buildFeed(): FeedItem[] {
	const items: FeedItem[] = [];

	for (const snap of Object.values(snapshots)) {
		const author = {
			uid: snap.user.uid,
			nickname: snap.user.nickname,
			face: toHttps(snap.user.face),
		};

		for (const dyn of snap.dynamics) {
			if (dyn.type === 'VIDEO') continue;

			const base = {
				...author,
				timestamp: Number(dyn.timestamp),
				content: dyn.content || undefined,
				rich: dyn.rich,
				dynamicTitle: dyn.title || undefined,
				link: `https://t.bilibili.com/${dyn.id_str}`,
			};

			if (dyn.type === 'LIVE' && dyn.live) {
				items.push({
					...base,
					kind: 'dynamic_live',
					live: { ...dyn.live, cover: toHttps(dyn.live.cover) },
					link: dyn.live.link || base.link,
				});
				continue;
			}

			if (dyn.type === 'FORWARD' && dyn.forward) {
				items.push({
					...base,
					kind: 'dynamic_forward',
					forward: {
						...dyn.forward,
						face: toHttps(dyn.forward.face),
						cover: dyn.forward.cover ? toHttps(dyn.forward.cover) : undefined,
					},
				});
				continue;
			}

			if (dyn.type === 'IMAGE' && dyn.images.length > 0) {
				items.push({
					...base,
					kind: 'dynamic_image',
					images: dyn.images.map(toHttps),
				});
				continue;
			}

			if (base.content || base.rich || base.dynamicTitle) {
				items.push({ ...base, kind: 'dynamic_text' });
			}
		}

		for (const vid of snap.videos) {
			items.push({
				...author,
				kind: 'video',
				timestamp: Number(vid.created),
				cover: toHttps(vid.pic),
				title: vid.title,
				bvid: vid.bvid,
				duration: vid.duration,
				link: `https://www.bilibili.com/video/${vid.bvid}`,
			});
		}
	}

	items.sort((a, b) => b.timestamp - a.timestamp);
	return items;
}
