export interface FeedForwardBlock {
	nickname: string;
	face: string;
	content: string;
	cover?: string;
	title?: string;
	deleted?: boolean;
	link?: string;
}

export interface FeedLiveBlock {
	title: string;
	cover: string;
	link: string;
	status: 'living' | 'preview' | 'ended';
	area?: string;
}

export type RichKind = 'text' | 'at' | 'emoji' | 'link' | 'topic' | 'br';

export interface RichNode {
	kind: RichKind;
	text: string;
	emoji?: string;
}

export interface FeedItem {
	uid: number;
	nickname: string;
	face: string;
	kind: 'video' | 'dynamic_text' | 'dynamic_image' | 'dynamic_live' | 'dynamic_forward';
	timestamp: number;
	cover?: string;
	title?: string;
	dynamicTitle?: string;
	bvid?: string;
	duration?: number;
	content?: string;
	rich?: RichNode[];
	images?: string[];
	live?: FeedLiveBlock;
	forward?: FeedForwardBlock;
	link: string;
}

export function timeAgo(ts: number): string {
	const diff = Math.floor(Date.now() / 1000) - ts;
	if (diff < 60) return '刚刚';
	if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
	if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
	if (diff < 2592000) return `${Math.floor(diff / 86400)} 天前`;
	return `${Math.floor(diff / 2592000)} 个月前`;
}

export function formatDuration(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	return `${m}:${String(s).padStart(2, '0')}`;
}

export function escapeHtml(input: string): string {
	return input
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}
