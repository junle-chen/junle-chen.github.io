#!/bin/bash
# 部署脚本，适用于本地 Jekyll ➜ GitHub Pages（gh-pages 分支）
# ----------------------------------------

set -e  # 任一命令出错即退出

# -------- 0) 变量 --------
DEV_BRANCH="master"        # 如果你的默认分支是 main，请改成 main
DEPLOY_BRANCH="gh-pages"   # 部署分支
BUILD_DIR="_site"          # Jekyll 的输出目录
TMP_DIR=$(mktemp -d /tmp/jekyll-deploy-XXXX)   # 系统临时目录，确保跨分支可访问

# -------- 1) 构建 --------
echo "🔨 1/7  Building site with Jekyll ..."
bundle exec jekyll build

# 验证构建结果是否存在
if [ ! -d "$BUILD_DIR" ]; then
  echo "❌ Build dir '$BUILD_DIR' not found! Abort."
  exit 1
fi

# -------- 2) 复制到临时目录 --------
echo "📁 2/7  Copy build result to temp: $TMP_DIR"
cp -R "$BUILD_DIR"/. "$TMP_DIR"/

# -------- 3) 切换 / 初始化 gh-pages 分支 --------
if git show-ref --quiet refs/heads/$DEPLOY_BRANCH; then
  echo "📦 3/7  Switching to existing $DEPLOY_BRANCH ..."
  git checkout $DEPLOY_BRANCH
else
  echo "🚧 3/7  Creating orphan branch $DEPLOY_BRANCH ..."
  git checkout --orphan $DEPLOY_BRANCH
  git rm -rf . 2>/dev/null || true   # 清空工作区（忽略空目录提示）
fi

# -------- 4) 清理旧文件 --------
echo "🧹 4/7  Cleaning old files ..."
rm -rf *

# -------- 5) 拷贝新文件 --------
echo "🚚 5/7  Moving new site into $DEPLOY_BRANCH ..."
cp -R "$TMP_DIR"/. ./        # temp → 工作区
touch .nojekyll              # 禁止 GitHub 再跑 Jekyll

# -------- 6) 提交并推送 --------
echo "📝 6/7  Committing & pushing ..."
git add .
git commit -m "🚀 Deploy $(date '+%Y-%m-%d %H:%M:%S')" || echo "ℹ️  Nothing to commit."
git push -f origin $DEPLOY_BRANCH

# -------- 7) 收尾 --------
echo "🔙 7/7  Switching back to $DEV_BRANCH ..."
git checkout $DEV_BRANCH
rm -rf "$TMP_DIR"

echo "✅ Deployment finished! 站点已更新 🎉"
