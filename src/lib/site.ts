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
	{
		label: '首页',
		href: '/',
	},
];
