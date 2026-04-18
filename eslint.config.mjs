import eslint from '@eslint/js';
import eslintPluginAstro from 'eslint-plugin-astro';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{
		ignores: [
			'**/node_modules/**',
			'**/dist/**',
			'**/out/**',
			'**/.astro/**',
			'**/coverage/**',
			'**/.turbo/**',
			'**/build/**',
			'**/bun.lock',
			'**/.cache/**',
			'**/*.min.js',
			'**/public/**',
		],
	},
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ['src/**/*.{ts,tsx}'],
		languageOptions: {
			globals: globals.browser,
		},
	},
	{
		files: ['astro.config.mjs', 'eslint.config.mjs'],
		languageOptions: {
			globals: globals.node,
		},
	},
	{
		files: ['**/*.cjs'],
		languageOptions: {
			globals: globals.node,
			sourceType: 'script',
		},
	},
	...eslintPluginAstro.configs.recommended,
	eslintConfigPrettier
);
