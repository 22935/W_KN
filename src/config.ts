import brand from './site.json';
export const site = {
  name: brand.name,
  englishName: brand.englishName,
  author: 'W.KN',
  description: brand.description,
  intro: '一间关于写作、人工智能与研究的数字书斋。',
  email: '',
  github: 'https://github.com/22935/W_KN',
  csdn: 'https://blog.csdn.net/Hismybestlove',
};

export const url = (path = '') => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
