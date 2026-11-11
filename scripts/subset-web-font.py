#!/usr/bin/env python3
"""Subset LXGW WenKai for Chinese text only, preserving the original Latin font stack.

Requires fonttools[woff]. Pass the official Regular and Medium TTF paths.
"""
from pathlib import Path
import sys

from fontTools import subset

root = Path(__file__).resolve().parents[1]
if len(sys.argv) != 3:
    raise SystemExit('Usage: python3 scripts/subset-web-font.py LXGWWenKai-Regular.ttf LXGWWenKai-Medium.ttf')

# Keep this coverage aligned with unicode-range in src/css/common/common.less.
CJK_RANGES = [(0x2E80, 0x2FFF), (0x3000, 0x303F), (0x3100, 0x312F),
              (0x31A0, 0x31BF), (0x31C0, 0x31EF), (0x3200, 0x33FF),
              (0x3400, 0x4DBF), (0x4E00, 0x9FFF), (0xF900, 0xFAFF),
              (0xFE10, 0xFE1F), (0xFE30, 0xFE4F), (0xFF01, 0xFF60),
              (0xFFE0, 0xFFE6), (0x20000, 0x2FFFF), (0x30000, 0x323AF)]


def is_cjk(character):
    codepoint = ord(character)
    return any(start <= codepoint <= end for start, end in CJK_RANGES)


characters = set()
for path in (root / 'src').rglob('*'):
    if path.suffix in {'.pug', '.js', '.json', '.md', '.yml'}:
        characters.update(char for char in path.read_text(encoding='utf-8', errors='replace') if is_cjk(char))

for source, weight in zip(sys.argv[1:], ['regular', 'medium']):
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    options.name_IDs = ['*']
    options.name_languages = ['*']
    options.notdef_glyph = True
    options.notdef_outline = True
    font = subset.load_font(source, options)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=''.join(sorted(characters)))
    subsetter.subset(font)
    assert all(is_cjk(chr(code)) for code in font.getBestCmap()), 'Latin glyphs must not enter the Chinese web font'
    output = root / 'src/assets/fonts' / f'lxgw-wenkai-{weight}-cjk.woff2'
    subset.save_font(font, str(output), options)
    print(f'{output.relative_to(root)}: {output.stat().st_size:,} bytes; {len(characters):,} requested CJK characters')
