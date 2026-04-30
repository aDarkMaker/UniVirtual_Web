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

export interface BiliDynamic {
    id_str: string;
    type: 'TEXT' | 'IMAGE' | 'VIDEO';
    timestamp: number;
    content: string;
    images: string[];
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