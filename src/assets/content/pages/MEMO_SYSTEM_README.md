# 📝 GitHub Pages Memo System - README

## ✨ Features

- **Public & Private Memos**: Control visibility of your memos
- **Sync to GitHub Pages**: Public memos visible to everyone
- **Local Storage**: Private memos stay on your device only
- **File Attachments**: Support images and files (max 10MB each)
- **Categories & Priorities**: Organize your memos

## 🌍 How It Works

### Public Memos (🌍)
- Stored in `_data/memos.yml`
- Synced to GitHub repository
- Visible to all website visitors
- Attachments saved in `assets/` folder

### Private Memos (🔐)
- Stored in browser IndexedDB only
- Never synced to server
- Only visible on your device
- Lost if you clear browser data

## 📊 GitHub Pages Limitations

| Resource | Limit | Our Approach |
|----------|-------|--------------|
| Repository Size | 1GB (recommended) | Monitor `assets/` folder size |
| File Size | 100MB (hard limit) | Enforce 10MB max per file |
| Build Time | 10 minutes | Static files, fast builds |
| Bandwidth | 100GB/month | Reasonable for personal site |

## 🚀 Usage

### 1. Add a Memo

1. Fill in the form
2. Choose visibility:
   - **Public 🌍**: Will be synced to server
   - **Private 🔐**: Stays local only
3. Click "Add Memo" - saves to IndexedDB

### 2. Sync to Server (Public Memos Only)

Click the "☁️ Sync" button next to any public memo, then run the command:

```bash
# The sync command will be generated automatically
echo '{ memo data }' | ruby sync_memo.rb sync
git add _data/memos.yml assets/
git commit -m "Add memo: Your Title"
git push
```

### 3. Automatic Deployment

- GitHub Pages auto-builds after push (~1-2 minutes)
- Public memos appear on website
- Private memos remain local

## 📁 File Structure

```
junle-cc-website/
├── _data/
│   └── memos.yml                 # Public memos data
├── assets/
│   ├── images/
│   │   └── memos/               # Synced images
│   └── files/
│       └── memos/               # Synced files
├── _layouts/
│   └── memo.html                # Memo page template
├── memos.md                      # Memo page
└── sync_memo.rb                 # Sync script
```

## 💾 Storage Guidelines

### Recommended Limits
- **Single file**: < 10MB
- **Total memo attachments**: < 100MB
- **Total repository**: < 500MB (stay safe)

### File Size Tips
1. Compress images before upload
2. Use PDF compression for documents
3. Store large files elsewhere (Google Drive, etc.) and link them
4. Regularly review and clean old attachments

## 🔒 Privacy & Security

- **Private memos**: Never leave your browser
- **Public memos**: Anyone can see them on your website
- **Attachments**: Public attachments are publicly accessible
- **Git history**: All commits are public on GitHub

## 🛠️ Manual Sync Commands

### Sync a single memo
```bash
cat memo.json | ruby sync_memo.rb sync
```

### Delete a memo
```bash
ruby sync_memo.rb delete <memo_id>
```

### Check repository size
```bash
du -sh .git
du -sh assets/
```

### Clean up old attachments
```bash
# Remove unused files manually
rm assets/images/memos/old_*
rm assets/files/memos/old_*
```

## 🎯 Best Practices

1. **Use Private for sensitive info**: Personal notes, passwords, etc.
2. **Use Public for sharing**: Blog drafts, public todos, ideas
3. **Monitor repo size**: Check occasionally with `du -sh`
4. **Compress files**: Before uploading large attachments
5. **Regular cleanup**: Delete old/unused memos and attachments

## 🐛 Troubleshooting

### Sync failed?
- Check file sizes (must be < 10MB)
- Ensure Ruby is installed
- Check JSON format

### Memo not appearing?
- Public memos: Wait 1-2 min for GitHub Pages build
- Private memos: Check browser console for errors
- Clear cache and refresh

### Repository too large?
```bash
# Find large files
find assets/ -type f -size +5M -ls

# Clean git history (nuclear option)
git filter-branch --tree-filter 'rm -rf assets/old_folder' HEAD
```

## 📞 Support

- File sizes too large? Consider external storage
- Need more space? Create separate GitHub repo for attachments
- Questions? Check Jekyll and GitHub Pages documentation

---

**Happy memo-taking! 📝✨**
