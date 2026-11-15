import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeShiki from '@shikijs/rehype';

const repository = process.env.GITHUB_REPOSITORY;
const [owner, name] = (repository || '22935/W_KN').split('/');
const site = process.env.SITE_URL || (owner ? `https://${owner}.github.io` : 'https://example.com');
const base = process.env.BASE_PATH ?? (name && !name.endsWith('.github.io') ? `/${name}` : '/');

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  integrations: [sitemap()],
  markdown: {
    remarkPlugins: [remarkMath],
    syntaxHighlight: false,
    rehypePlugins: [[rehypeSanitize, { ...defaultSchema, clobberPrefix: '', attributes: { ...defaultSchema.attributes, code: [...(defaultSchema.attributes?.code || []), ['className', /^language-./, 'math-inline', 'math-display']] } }], rehypeKatex, [rehypeShiki, { themes: { light: 'github-light', dark: 'github-dark' } }]],
  },
  vite: { server: { fs: { deny: ['**/.local/**', '**/.references/**', '**/.env', '**/.env.*', '**/.git/**', '**/*.{crt,pem}'] } } },
});
