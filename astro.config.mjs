import { fileURLToPath } from 'node:url';

import { defineConfig } from 'astro/config';

export default defineConfig({
	site: 'https://univirtual.cn',
	compressHTML: true,
	integrations: [],
	vite: {
		resolve: {
			alias: {
				'@': fileURLToPath(new URL('./src', import.meta.url)),
			},
		},
	},
});
