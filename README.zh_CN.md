# ⭐ Academic Homepage Template

If you like this template or wish to use it, please consider giving this repository a ⭐ star.

这是一个静态 academic homepage / research workspace 模板，适合把个人主页、研究笔记、论文阅读和轻量实时交互放在同一个网页里。

- 🌐 在线示例：[junle-chen.github.io](https://junle-chen.github.io)
- 🧩 源码仓库：[junle-chen/ac-homepage](https://github.com/junle-chen/ac-homepage)
- ⭐ 如果这个模板对你有帮助，给仓库一个 star 就可以了。

## ✨ 模板能力

- 👤 `About`：个人介绍、研究方向、代表论文、联系方式和站点入口。
- 📝 `Notes`：站内 Markdown reader，支持搜索、分类、归档、目录、图片和 MathJax。
- 💬 `Memos`：时间线式 memo，支持 owner 登录后的实时写入。
- 📚 `Academic`：Daily Paper、Paper List、论文星标、阅读摘要、详情弹窗和文本导出。
- ⚡ `Realtime`：通过 Supabase 同步 memos、paper stars、Zotero stars 和 note archive 状态。
- 💭 `Comments`：通过 Giscus + GitHub Discussions 给 notes 添加评论。
- 🚀 `Deploy`：静态构建，可部署到 GitHub Pages，并支持自定义域名。

## 🛠️ 如何改成自己的主页

优先替换这些位置：

| 文件或目录 | 用途 |
| --- | --- |
| `config.json` | 网页标题、描述、入口文案、头像、个人链接和背景开关。 |
| `src/assets/avatar.png` | 头像。 |
| `src/assets/content/pages/aboutme.md` | About 页面内容。 |
| `src/assets/content/notes/` | 长笔记 Markdown。 |
| `src/assets/content/data/daily-papers.json` | Daily Paper 数据。 |
| `src/assets/content/data/zotero-paper-list.json` | Paper List 数据。 |
| `src/js/realtime-config.js` | Supabase public config 和 owner GitHub 身份。 |
| `supabase/homepage-realtime.sql` | Supabase tables、RLS policies、owner checks 和 realtime publication。 |
| `src/js/main.js` | Giscus 配置和主要前端交互。 |

## 🔌 可选集成

| 集成 | 是否必需 | 作用 |
| --- | --- | --- |
| Supabase | 可选 | 同步 memos、paper stars、Zotero stars 和 note archive。 |
| GitHub OAuth | 可选 | owner 登录和写权限控制。 |
| Giscus | 可选 | GitHub Discussions 评论。 |
| GitHub Pages | 推荐 | 静态部署和自定义域名。 |
| Zotero export | 可选 | 生成长期 Paper List。 |

完整截图、运行方式、Supabase realtime 架构、Giscus 配置、部署步骤和引用到的网站/服务列表，请看 [README.md](README.md)。
