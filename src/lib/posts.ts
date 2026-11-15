import { getCollection, type CollectionEntry } from 'astro:content';
export type Post = CollectionEntry<'posts'>;
export const getPosts = async () => (await getCollection('posts', ({ data }) => !data.draft)).sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
export const dateLabel = (date: Date) => new Intl.DateTimeFormat('zh-CN', {year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Shanghai'}).format(date).replaceAll('/', '.');
export const readingTime = (body = '') => Math.max(1, Math.ceil(body.replace(/\s/g, '').length / 400));
