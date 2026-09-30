# 🚀 Quick Start Guide - Memo System with GitHub Pages

## ✨ Overview

Your memo system now supports:
- **🌍 Public memos**: Synced to GitHub Pages, visible to everyone
- **🔐 Private memos**: Stored locally, visible only to you
- **📎 File attachments**: Up to 10MB per file
- **🎯 Smart filtering**: By category, priority, and visibility

## 📝 How to Use

### 1. Add a Memo

1. Open `/memos` page on your website
2. Fill in the form:
   - Title (optional)
   - Content (required)
   - Category (General/Todo/Idea/Note)
   - Priority (Normal/Important/Urgent)
   - **Visibility**:
     - 🌍 **Public**: Will be synced to server
     - 🔐 **Private**: Stays on your device only
3. Add attachments if needed
4. Click "Add Memo"

### 2. Sync Public Memos to Server

After adding a public memo:

1. Click the **☁️ Sync** button on the memo
2. Copy the generated command
3. Run in your terminal:
   ```bash
   echo '{...}' | ruby sync_memo.rb sync
   git add _data/memos.yml assets/
   git commit -m "Add memo: Your Title"
   git push
   ```
4. Wait 1-2 minutes for GitHub Pages to rebuild
5. Your memo is now live!

### 3. Manage Memos

- **Filter**: Click category or visibility buttons
- **Search**: Type in search box
- **Complete**: Click ✓ to mark as done
- **Delete**: Click 🗑️ to remove
- **View attachments**: Click images or download files

## 🔒 Privacy & Visibility

| Feature | Public 🌍 | Private 🔐 |
|---------|-----------|------------|
| Storage | GitHub repo | Browser IndexedDB |
| Who can see | Everyone on website | Only you |
| Synced | Yes (manual) | No |
| Survives browser clear | Yes | No |
| Needs git push | Yes | No |

## ⚠️ Important Limits

### GitHub Pages Constraints
- **Repository size**: Stay under 1GB
- **File size**: Max 10MB per attachment
- **Build frequency**: Max 10 builds/hour
- **Bandwidth**: 100GB/month (soft limit)

### Recommendations
1. **Use private for sensitive data**: Passwords, personal notes
2. **Use public for sharing**: Blog drafts, public todos
3. **Compress files**: Before uploading large attachments
4. **Monitor repo size**:
   ```bash
   du -sh .git
   du -sh assets/
   ```

## 🛠️ Manual Commands

### Sync a specific memo
```bash
# Get memo JSON (from browser console):
# const memo = localMemos.find(m => m.id === YOUR_ID);
# console.log(JSON.stringify(memo));

echo 'PASTE_JSON_HERE' | ruby sync_memo.rb sync
```

### Delete synced memo
```bash
ruby sync_memo.rb delete <memo_id>
git add -A
git commit -m "Delete memo"
git push
```

### Check storage usage
```bash
# Check Git repository size
du -sh .git

# Check assets folder
du -sh assets/images/memos/
du -sh assets/files/memos/

# Find large files
find assets/ -type f -size +5M -ls
```

## 📊 Example Workflow

### Scenario: Taking Meeting Notes

1. **During meeting** (Private):
   - Create private memo with notes
   - Attach photos of whiteboard
   - Mark important points

2. **After meeting** (Convert to Public):
   - Review and clean up notes
   - Remove sensitive info
   - Create new public memo with summary
   - Sync to share with team

3. **Follow-up** (Public Todos):
   - Create public todos for action items
   - Set priority (Important/Urgent)
   - Team can see on website

## 🎯 Best Practices

### 1. File Management
- Compress images: `convert image.jpg -quality 80 image_compressed.jpg`
- Use PDF compression tools
- Link to external storage for very large files

### 2. Organization
- Use categories consistently
- Set meaningful titles
- Add dates in content for time-sensitive items

### 3. Security
- Never put passwords in public memos
- Review before syncing
- Remember: public = everyone can see

### 4. Performance
- Keep total attachments < 100MB
- Delete old memos periodically
- Clean up unused attachments

## 🐛 Troubleshooting

### Memo not syncing?
1. Check file sizes (< 10MB)
2. Verify JSON format
3. Check Ruby is installed: `ruby --version`
4. Look for error messages in terminal

### Can't find memo after browser clear?
- Private memos are lost if you clear browser data
- Public memos are safe (they're on GitHub)
- Always sync important memos!

### Repository too large?
```bash
# Remove large files from git history
git filter-branch --tree-filter 'rm -rf assets/files/memos/large_file.pdf' HEAD

# Force push (⚠️  destructive!)
git push --force
```

### GitHub Pages not updating?
1. Check GitHub Actions tab for build status
2. Wait 2-3 minutes
3. Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
4. Check for build errors

## 📞 Quick Reference

```bash
# Start local Jekyll server
bundle exec jekyll serve

# Visit memos page
open http://localhost:4000/memos

# Sync memo
echo 'JSON' | ruby sync_memo.rb sync

# Delete memo
ruby sync_memo.rb delete <id>

# Check sizes
du -sh assets/

# Commit changes
git add _data/memos.yml assets/
git commit -m "Update memos"
git push
```

## 🎉 Tips for Success

1. **Start with private**: Test features with private memos first
2. **Batch syncs**: Sync multiple public memos at once
3. **Regular cleanup**: Review and delete old memos monthly
4. **Backup important**: Copy critical private memos elsewhere
5. **Monitor size**: Check repo size weekly if uploading many files

---

**Happy memo-taking! 📝✨**

Need help? Check `MEMO_SYSTEM_README.md` for detailed documentation.
