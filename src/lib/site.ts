export type SiteMeta = {
	title: string;
	description: string;
	lang: string;
};

export type NavItem = {
	label: string;
	href: string;
	external?: boolean;
};

export const siteMeta: SiteMeta = {
	title: 'Univirtual',
	description: 'Welcome to Univirtual!',
	lang: 'zh-CN',
};

export const mainNav: NavItem[] = [
	{ label: '我们是谁', href: '/about' },
	{ label: '动态资讯', href: '/news' },
	{ label: '详情介绍', href: '/intro' },
	{ label: '加入我们', href: '/join' },
];
