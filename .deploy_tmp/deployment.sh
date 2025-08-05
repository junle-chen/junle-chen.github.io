#!/bin/bash
set -e  # 任何命令出错时立即退出脚本

# 1) 构建 Jekyll 站点
echo "🔨 1/6  Building site with Jekyll..."
bundle exec jekyll build

# 2) 把 _site 复制到临时目录，防止切分支后丢失
echo "📁 2/6  Copy _site to temporary directory..."
rm -rf .deploy_tmp        # 确保干净
mkdir  .deploy_tmp
cp -R  _site/. .deploy_tmp/   # 注意：cp -R 源路径后面的点表示复制隐藏文件

# 3) 切换 / 初始化 gh-pages 分支
if git show-ref --quiet refs/heads/gh-pages; then
  echo "📦 3/6  Switching to existing gh-pages branch..."
  git checkout gh-pages
else
  echo "🚧 3/6  gh-pages not found, creating orphan branch..."
  git checkout --orphan gh-pages
  git rm -rf . 2>/dev/null || true   # 清空工作区（忽略空目录的报错）
fi

# 4) 删除旧文件并复制新的静态文件
echo "🧹 4/6  Cleaning old files..."
rm -rf *

echo "🚚 5/6  Moving new site into branch..."
cp -R ../.deploy_tmp/. ./           # 把临时目录内容移进来
touch .nojekyll                     # 告诉 GitHub Pages 不要再跑 Jekyll
rm -rf ../.deploy_tmp               # 清理临时目录

# 5) 提交并推送
echo "📝 6/6  Committing & pushing..."
git add .
git commit -m "🚀 Deploy $(date '+%Y-%m-%d %H:%M:%S')"
git push -f origin gh-pages         # -f 避免历史不一致

# 切回开发分支（改成 main 如果你默认分支叫 main）
git checkout master

echo "✅ Done! 站点已部署到 gh-pages 🎉"
