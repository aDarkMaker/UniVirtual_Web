import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BiliSnapshot, BiliUserInfo, BiliVideo, BiliDynamic } from '@/types/bili';

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

interface DynamicItem {
	id_str: string;
	type: string;
	modules: {
		module_author?: { pub_ts?: number };
		module_dynamic?: {
			major?: {
				archive?: { aid: string; bvid: string; title: string; cover: string; desc: string; duration_text: string };
				draw?: { items: Array<{ src: string }> };
			};
			desc?: { text: string } | null;
		};
	};
}

async function fetchDynamicFeed(uid: number): Promise<DynamicItem[]> {
	if (!COOKIE) {
		console.warn(`  ⚠  no Bili cookie, skip dynamics for uid=${uid}`);
		return [];
	}
	const res = await fetch(`https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid=${uid}&offset=`, {
		headers: buildHeaders(uid),
	});
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

function extractDynamics(items: DynamicItem[]): BiliDynamic[] {
	return items.slice(0, 5).map((item) => {
		const major = item.modules.module_dynamic?.major;
		const desc = item.modules.module_dynamic?.desc?.text ?? '';
		let type: BiliDynamic['type'] = 'TEXT';
		let images: string[] = [];
		if (major?.draw) {
			type = 'IMAGE';
			images = major.draw.items.map((i) => i.src);
		} else if (major?.archive) {
			type = 'VIDEO';
		}
		return {
			id_str: item.id_str,
			type,
			timestamp: item.modules.module_author?.pub_ts ?? 0,
			content: desc,
			images,
		};
	});
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
		const dynamics = extractDynamics(items);

		const snapshot: BiliSnapshot = {
			updated_at: new Date().toISOString(),
			user,
			videos,
			dynamics,
		};

		const outPath = resolve(DATA_DIR, `${uid}.json`);
		writeFileSync(outPath, JSON.stringify(snapshot, null, '\t'));

		console.log(`  ✓ Saved: ${uid}.json (${user.nickname}, ${videos.length} videos, ${dynamics.length} dynamics)`);

		await new Promise((r) => setTimeout(r, 2000));
	}

	console.log('\nAll done!');
}

main().catch(console.error);
