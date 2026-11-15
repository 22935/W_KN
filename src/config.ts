export const site = {
  name: '山外山',
  englishName: 'WKN JOURNAL',
  author: 'W.KN',
  description: '在技术与生活之间，寻找自己的山海。记录创造，分享思考，留住日常。',
  intro: '一个关于技术、设计与生活的个人博客。',
  email: '',
  github: 'https://github.com/22935/W_KN',
  csdn: 'https://blog.csdn.net/Hismybestlove',
};

export const url = (path = '') => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
