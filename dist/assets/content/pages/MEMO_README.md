# 📝 Memo Feature Guide

A beautiful memo management system for your Jekyll website with support for images and files.

## ✨ Features

- ✅ Add memos with title, content, category, and priority
- 🖼️ Upload and attach images
- 📎 Attach files with size display
- 🏷️ Categorize memos (General, Todo, Idea, Note)
- ⭐ Set priorities (Normal, Important, Urgent)
- 🔍 Search and filter memos
- ✓ Mark memos as completed
- 🗑️ Delete unwanted memos
- 💾 Auto-save to browser localStorage
- 📱 Responsive design

## 🎨 Design

- **Color Scheme**: Light purple gradient (`#e0c3fc` to `#d4a5f9`)
- **Modern UI**: Card-based layout with smooth animations
- **Mobile-Friendly**: Adapts to different screen sizes

## 📖 Usage

### On Website

1. Visit `/memos` page
2. Fill in the form:
   - **Title**: Optional memo title
   - **Content**: Main content (supports multiple lines)
   - **Category**: Choose from 4 categories
   - **Priority**: Set importance level
   - **Attachments**: Add images or files
3. Click "Add Memo"
4. Your memo will appear instantly below

### Command Line (for permanent storage)

```bash
# Interactive mode
./add_memo.sh

# Direct mode
ruby add_memo.rb "content" "title" "category" "priority"
```

**Example:**
```bash
ruby add_memo.rb "Fix database bug" "Bug Fix" "todo" "urgent"
```

Then commit to Git:
```bash
git add _data/memos.yml
git commit -m "Add new memo"
git push
```

## 🗂️ Files Structure

```
├── memos.md              # Memo page
├── _layouts/
│   └── memo.html         # Memo layout template
├── _data/
│   └── memos.yml         # Memo data storage
├── add_memo.sh           # Shell script for adding memos
└── add_memo.rb           # Ruby script for memo management
```

## 📊 Data Storage

- **Client-side**: Browser localStorage (instant, temporary)
- **Server-side**: `_data/memos.yml` file (permanent, synced via Git)

## 🎯 Categories

- 📋 **General**: General notes
- ✅ **Todo**: Tasks to complete
- 💡 **Idea**: Creative ideas
- 📖 **Note**: Important notes

## ⭐ Priorities

- 📌 **Normal**: Regular priority
- ⭐ **Important**: High priority
- 🔥 **Urgent**: Critical priority

## 🔧 Customization

Edit `_layouts/memo.html` to customize:
- Colors in CSS `:root` variables
- Form fields and categories
- Display layout
- Attachment handling

## 💡 Tips

1. **Images**: Stored as base64 in localStorage
2. **Files**: Limited by browser localStorage size (~5-10MB)
3. **Search**: Searches in both title and content
4. **Filters**: Click category buttons to filter
5. **Completion**: Click ✓ to mark as complete

## 🚀 Local Development

```bash
# Start Jekyll server
bundle exec jekyll serve

# Visit memos page
open http://localhost:4000/memos
```

---

**Enjoy taking memos! 📝✨**
