---
title: 用 Markdown，搭建可迁移的内容工作流
description: 从一篇文章到多个出口，让内容与平台解耦。聊聊纯文本、版本管理，以及一个更长久的写作习惯。
date: 2026-11-10
category: 技术探索
tags: [Markdown, 工作流]
cover: images/mountains.svg
sample: true
---

这是一篇用于展示技术文章的示例内容。

## 内容格式与平台适配

一份源文档可以有多个发布目标，但目标平台支持的格式往往不同。图片需要重新上传，代码高亮可能不同，标题和摘要也可能有长度要求。

最稳妥的做法是保留一个清晰的源格式，在发布边界再转换。

```typescript
type PublishTarget = {
  platform: string;
  accountId: string;
};

type Delivery = {
  target: PublishTarget;
  state: 'queued' | 'draft-created' | 'needs-review' | 'published';
  remoteUrl?: string;
};
```

## 分清草稿与发布

文章进入平台草稿箱，并不等于已经公开。发布记录需要保存每个目标的实际结果，而不是给一次批量操作打一个笼统的勾。

### 重试也要有记忆

网络超时之后，远端可能已经接收了请求。重试前检查远端文章 ID，可以减少重复文章。无法确认时，应该标记为待核验。

## 文件是一种朴素的长期主义

文本、图片与元数据放在一起，容易备份，也容易迁移。工具会变化，内容可以留下。

公式也可以直接写在 Markdown 中，例如 $E = mc^2$。展示公式：

$$
\mathrm{value}(t) = \sum_{i=1}^{n} \mathrm{small\ steps}_i
$$
