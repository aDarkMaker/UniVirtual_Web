import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
	BiliSnapshot,
	BiliUserInfo,
	BiliVideo,
	BiliDynamic,
	BiliForwardBlock,
	BiliLiveBlock,
	RichNode,
	RichKind,
} from '@/types/bili';

function buildCookie(): string {
	const fields: Array<[string, string]> = [
		['DedeUserID', process.env.BILI_DEDE_USER_ID ?? ''],
		['DedeUserID__ckMd5', process.env.BILI_DEDE_USER_ID_CKMD5 ?? ''],
		['SESSDATA', process.env.BILI_SESSDATA ?? ''],
		['bili_jct', process.env.BILI_JCT ?? ''],
	];
	return fields
		.filter(([, v]) => v)
		.map(([k, v]) => `${k}=${v}`)
		.join('; ');
}

const COOKIE = buildCookie();
const DATA_DIR = resolve(import.meta.dirname, '../data/bili');
const PEOPLE_DIR = resolve(import.meta.dirname, '../content/people');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function buildHeaders(uid?: number): Record<string, string> {
	const h: Record<string, string> = {
		'User-Agent': UA,
		Accept: 'application/json, text/plain, */*',
		Referer: uid ? `https://space.bilibili.com/${uid}/dynamic` : 'https://www.bilibili.com/',
	};
	if (COOKIE) h.Cookie = COOKIE;
	return h;
}

async function fetchUserInfo(uid: number): Promise<BiliUserInfo | null> {
	const res = await fetch(`https://api.bilibili.com/x/web-interface/card?mid=${uid}&photo=false`, {
		headers: buildHeaders(uid),
	});
	const json = (await res.json()) as {
		code: number;
		message?: string;
		data?: { card: { name: string; face: string; sign: string } };
	};
	if (json.code !== 0 || !json.data) {
		console.error(`  ✗ user info code=${json.code} msg=${json.message}`);
		return null;
	}
	return {
		uid,
		nickname: json.data.card.name,
		face: json.data.card.face,
		sign: json.data.card.sign,
	};
}

interface DrawItem {
	src: string;
}

interface ArchiveBlock {
	aid: string;
	bvid: string;
	title: string;
	cover: string;
	desc: string;
	duration_text: string;
	jump_url?: string;
}

interface LiveRcmdBlock {
	content: string;
}

interface RawRichNode {
	type?: string;
	text?: string;
	orig_text?: string;
	emoji?: { icon_url?: string; text?: string };
}

interface RichDesc {
	text?: string;
	rich_text_nodes?: RawRichNode[];
}

interface DynamicModules {
	module_author?: { name?: string; face?: string; pub_ts?: number };
	module_dynamic?: {
		major?: {
			archive?: ArchiveBlock;
			draw?: { items: DrawItem[] };
			live_rcmd?: LiveRcmdBlock;
			pgc?: { title?: string; cover?: string; jump_url?: string };
			article?: { title?: string; covers?: string[]; jump_url?: string; desc?: string };
			opus?: {
				title?: string;
				summary?: RichDesc;
				pics?: Array<{ url: string }>;
				jump_url?: string;
			};
		};
		desc?: RichDesc | null;
	};
}

interface DynamicItem {
	id_str: string;
	type: string;
	modules: DynamicModules;
	orig?: DynamicItem;
}

const OPUS_FEATURES =
	'itemOpusStyle,opusBigCover,onlyfansVote,decorationCard,onlyfansAssetsV2,forwardListHidden,ugcDelete,onlyfansQaCard,editorIcon,opusPrivateVisible,fakeReply';

async function fetchDynamicFeed(uid: number): Promise<DynamicItem[]> {
	if (!COOKIE) {
		console.warn(`  ⚠  no Bili cookie, skip dynamics for uid=${uid}`);
		return [];
	}
	const res = await fetch(
		`https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid=${uid}&offset=&features=${OPUS_FEATURES}&platform=web`,
		{ headers: buildHeaders(uid) },
	);
	const json = (await res.json()) as {
		code: number;
		message?: string;
		data?: { items: DynamicItem[] };
	};
	if (json.code !== 0 || !json.data) {
		console.error(`  ✗ dynamic feed code=${json.code} msg=${json.message}`);
		return [];
	}
	return json.data.items;
}

async function fetchDynamicDetail(id: string, uid: number): Promise<DynamicItem | null> {
	if (!COOKIE) return null;
	try {
		const res = await fetch(
			`https://api.bilibili.com/x/polymer/web-dynamic/v1/detail?id=${id}&features=${OPUS_FEATURES}&platform=web`,
			{ headers: buildHeaders(uid) },
		);
		const json = (await res.json()) as {
			code: number;
			data?: { item: DynamicItem };
		};
		if (json.code !== 0 || !json.data?.item) return null;
		return json.data.item;
	} catch {
		return null;
	}
}

async function enrichOpus(items: DynamicItem[], uid: number): Promise<DynamicItem[]> {
	const out: DynamicItem[] = [];
	for (const item of items) {
		const major = item.modules.module_dynamic?.major;
		const desc = item.modules.module_dynamic?.desc;
		const opus = major?.opus;
		const needsDetail =
			opus &&
			!desc?.text &&
			!desc?.rich_text_nodes?.length &&
			!opus.summary?.text &&
			!opus.summary?.rich_text_nodes?.length &&
			!opus.title;
		if (!needsDetail) {
			out.push(item);
			continue;
		}
		await sleep(150);
		const detail = await fetchDynamicDetail(item.id_str, uid);
		out.push(detail ?? item);
	}
	return out;
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

function parseDuration(text: string): number {
	if (!text) return 0;
	const parts = text.split(':').map(Number);
	if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
	if (parts.length === 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
	return 0;
}

function extractVideos(items: DynamicItem[]): BiliVideo[] {
	const videos: BiliVideo[] = [];
	for (const item of items) {
		if (item.type !== 'DYNAMIC_TYPE_AV') continue;
		const archive = item.modules.module_dynamic?.major?.archive;
		if (!archive) continue;
		videos.push({
			aid: Number(archive.aid),
			bvid: archive.bvid,
			title: archive.title,
			pic: archive.cover,
			duration: parseDuration(archive.duration_text),
			play: 0,
			created: item.modules.module_author?.pub_ts ?? 0,
			description: archive.desc ?? '',
		});
		if (videos.length >= 10) break;
	}
	return videos;
}

function parseLiveRcmd(raw: string): BiliLiveBlock | undefined {
	try {
		const parsed = JSON.parse(raw) as {
			live_play_info?: {
				title?: string;
				cover?: string;
				link?: string;
				live_status?: number;
				parent_area_name?: string;
				area_name?: string;
			};
		};
		const v = parsed.live_play_info;
		if (!v) return undefined;
		const status: BiliLiveBlock['status'] =
			v.live_status === 1 ? 'living' : v.live_status === 2 ? 'preview' : 'ended';
		return {
			title: v.title ?? '',
			cover: v.cover ?? '',
			link: v.link?.startsWith('//') ? `https:${v.link}` : (v.link ?? ''),
			status,
			area: v.parent_area_name ?? v.area_name,
		};
	} catch {
		return undefined;
	}
}

function buildForward(orig: DynamicItem): BiliForwardBlock {
	const author = orig.modules.module_author;
	const md = orig.modules.module_dynamic;
	const text = md?.desc?.text ?? '';
	const major = md?.major;
	let cover = '';
	let title = '';
	if (major?.archive) {
		cover = major.archive.cover;
		title = major.archive.title;
	} else if (major?.draw?.items?.length) {
		cover = major.draw.items[0]?.src ?? '';
	} else if (major?.live_rcmd) {
		const live = parseLiveRcmd(major.live_rcmd.content);
		cover = live?.cover ?? '';
		title = live?.title ?? '';
	} else if (major?.pgc) {
		cover = major.pgc.cover ?? '';
		title = major.pgc.title ?? '';
	} else if (major?.article) {
		cover = major.article.covers?.[0] ?? '';
		title = major.article.title ?? '';
	} else if (major?.opus) {
		cover = major.opus.pics?.[0]?.url ?? '';
		title = major.opus.title ?? '';
	}
	return {
		nickname: author?.name ?? '',
		face: author?.face ?? '',
		content: text,
		cover,
		title,
		deleted: orig.type === 'DYNAMIC_TYPE_NONE',
		link: `https://t.bilibili.com/${orig.id_str}`,
	};
}

const RICH_KIND_MAP: Record<string, RichKind> = {
	RICH_TEXT_NODE_TYPE_TEXT: 'text',
	RICH_TEXT_NODE_TYPE_AT: 'at',
	RICH_TEXT_NODE_TYPE_EMOJI: 'emoji',
	RICH_TEXT_NODE_TYPE_WEB: 'link',
	RICH_TEXT_NODE_TYPE_BV: 'link',
	RICH_TEXT_NODE_TYPE_TOPIC: 'topic',
	RICH_TEXT_NODE_TYPE_LOTTERY: 'link',
	RICH_TEXT_NODE_TYPE_VOTE: 'link',
};

function extractRich(d?: RichDesc | null): { text: string; rich: RichNode[] } {
	const rich: RichNode[] = [];
	if (!d) return { text: '', rich };
	const nodes = d.rich_text_nodes;
	if (!nodes || !nodes.length) {
		return { text: d.text ?? '', rich };
	}
	for (const n of nodes) {
		const kind = RICH_KIND_MAP[n.type ?? ''] ?? 'text';
		const raw = n.orig_text ?? n.text ?? '';
		if (kind === 'emoji') {
			rich.push({ kind: 'emoji', text: raw, emoji: n.emoji?.icon_url });
			continue;
		}
		const parts = raw.split('\n');
		parts.forEach((part, i) => {
			if (part) rich.push({ kind, text: part });
			if (i < parts.length - 1) rich.push({ kind: 'br', text: '' });
		});
	}
	const text = rich.map((n) => (n.kind === 'br' ? '\n' : n.text)).join('');
	return { text, rich };
}

function classifyDynamic(item: DynamicItem): BiliDynamic | null {
	const md = item.modules.module_dynamic;
	const major = md?.major;
	const ts = item.modules.module_author?.pub_ts ?? 0;
	const base = { id_str: item.id_str, timestamp: ts };

	const descRich = extractRich(md?.desc ?? undefined);
	const opusRich = extractRich(major?.opus?.summary);
	const opusTitle = major?.opus?.title?.trim() || undefined;

	const richBundle = descRich.rich.length
		? descRich
		: opusRich.rich.length
			? opusRich
			: { text: descRich.text || opusRich.text || '', rich: [] };
	const richField = richBundle.rich.length ? richBundle.rich : undefined;

	if (item.type === 'DYNAMIC_TYPE_FORWARD' && item.orig) {
		return {
			...base,
			type: 'FORWARD',
			content: richBundle.text,
			rich: richField,
			title: opusTitle,
			images: [],
			forward: buildForward(item.orig),
		};
	}

	if (major?.live_rcmd) {
		const live = parseLiveRcmd(major.live_rcmd.content);
		if (live) {
			return {
				...base,
				type: 'LIVE',
				content: richBundle.text,
				rich: richField,
				title: opusTitle,
				images: live.cover ? [live.cover] : [],
				live,
			};
		}
	}

	if (major?.archive) {
		return {
			...base,
			type: 'VIDEO',
			content: richBundle.text,
			rich: richField,
			images: [],
		};
	}

	if (major?.draw?.items?.length) {
		return {
			...base,
			type: 'IMAGE',
			content: richBundle.text,
			rich: richField,
			title: opusTitle,
			images: major.draw.items.map((i) => i.src),
		};
	}

	if (major?.opus?.pics?.length) {
		return {
			...base,
			type: 'IMAGE',
			content: richBundle.text,
			rich: richField,
			title: opusTitle,
			images: major.opus.pics.map((p) => p.url),
		};
	}

	const text = richBundle.text || opusTitle || major?.article?.title || '';
	if (text || richField) {
		return {
			...base,
			type: 'TEXT',
			content: text,
			rich: richField,
			title: opusTitle,
			images: [],
		};
	}

	return null;
}

function extractDynamics(items: DynamicItem[]): BiliDynamic[] {
	const out: BiliDynamic[] = [];
	for (const item of items) {
		const d = classifyDynamic(item);
		if (d) out.push(d);
		if (out.length >= 12) break;
	}
	return out;
}

async function main() {
	const peopleFiles = readdirSync(PEOPLE_DIR).filter((f) => f.endsWith('.json'));
	const uids: { uid: number; file: string }[] = [];

	for (const file of peopleFiles) {
		const raw = readFileSync(resolve(PEOPLE_DIR, file), 'utf-8');
		const person = JSON.parse(raw);
		if (person.bili_uid) uids.push({ uid: person.bili_uid, file });
	}

	if (uids.length === 0) {
		console.log('No Bili users found in people directory');
		return;
	}

	console.log(`Found ${uids.length} uid(s): ${uids.map((u) => u.uid).join(', ')}\n`);

	for (const { uid } of uids) {
		console.log(`Fetching uid=${uid}...`);

		const [user, items] = await Promise.all([fetchUserInfo(uid), fetchDynamicFeed(uid)]);

		if (!user) {
			console.error(`  ✗ Failed to fetch user info for uid=${uid}`);
			continue;
		}

		const videos = extractVideos(items);
		const enriched = await enrichOpus(items.slice(0, 14), uid);
		const dynamics = extractDynamics(enriched);

		const snapshot: BiliSnapshot = {
			updated_at: new Date().toISOString(),
			user,
			videos,
			dynamics,
		};

		const outPath = resolve(DATA_DIR, `${uid}.json`);
		writeFileSync(outPath, JSON.stringify(snapshot, null, '\t'));

		console.log(
			`  ✓ Saved: ${uid}.json (${user.nickname}, ${videos.length} videos, ${dynamics.length} dynamics)`,
		);

		await new Promise((r) => setTimeout(r, 2000));
	}

	console.log('\nAll done!');
}

main().catch(console.error);
