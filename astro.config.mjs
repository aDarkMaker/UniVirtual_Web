import { fileURLToPath } from 'node:url';

import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

export default defineConfig({
	site: 'https://example.com',
	compressHTML: true,
	integrations: [react()],
	vite: {
		resolve: {
			alias: {
				'@': fileURLToPath(new URL('./src', import.meta.url)),
			},
		},
	},
});
