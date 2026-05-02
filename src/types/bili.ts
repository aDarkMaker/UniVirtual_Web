export interface BiliUserInfo {
	uid: number;
	nickname: string;
	face: string;
	sign: string;
}

export interface BiliVideo {
	aid: number;
	bvid: string;
	title: string;
	pic: string;
	duration: number;
	play: number;
	created: number;
	description: string;
}

export interface BiliLiveBlock {
	title: string;
	cover: string;
	link: string;
	status: 'living' | 'preview' | 'ended';
	area?: string;
}

export interface BiliForwardBlock {
	nickname: string;
	face: string;
	content: string;
	cover?: string;
	title?: string;
	deleted?: boolean;
	link?: string;
}

export type RichKind = 'text' | 'at' | 'emoji' | 'link' | 'topic' | 'br';

export interface RichNode {
	kind: RichKind;
	text: string;
	emoji?: string;
}

export interface BiliDynamic {
	id_str: string;
	type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'LIVE' | 'FORWARD';
	timestamp: number;
	content: string;
	rich?: RichNode[];
	title?: string;
	images: string[];
	live?: BiliLiveBlock;
	forward?: BiliForwardBlock;
}

export interface BiliSnapshot {
	updated_at: string;
	user: BiliUserInfo;
	videos: BiliVideo[];
	dynamics: BiliDynamic[];
}

export interface PersonBiliDat {
	bili_uid: number;
}
