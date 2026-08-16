import eslintPluginAstro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';

export default [
	{
		ignores: [
			'dist/**',
			'node_modules/**',
			'.astro/**',
			'playwright-report/**',
			'test-results/**',
		],
	},
	...tseslint.configs.recommended,
	...eslintPluginAstro.configs['flat/recommended'],
];
