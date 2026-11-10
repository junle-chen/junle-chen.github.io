#!/usr/bin/env python3
"""Subset official Noto Sans SC to the website's current text, keeping variable weights.

Requires fonttools[woff]. Pass the upstream NotoSansSC[wght].ttf as the only argument.
"""
from pathlib import Path
import sys

from fontTools import subset

root = Path(__file__).resolve().parents[1]
if len(sys.argv) != 2:
    raise SystemExit('Usage: python3 scripts/subset-web-font.py /path/to/NotoSansSC[wght].ttf')

characters = set(chr(code) for code in range(32, 256))
for path in (root / 'src').rglob('*'):
    if path.suffix in {'.pug', '.js', '.json', '.md', '.yml'}:
        characters.update(path.read_text(encoding='utf-8', errors='replace'))

options = subset.Options()
options.flavor = 'woff2'
options.layout_features = ['*']
options.name_IDs = ['*']
options.name_languages = ['*']
options.notdef_glyph = True
options.notdef_outline = True
font = subset.load_font(sys.argv[1], options)
subsetter = subset.Subsetter(options=options)
subsetter.populate(text=''.join(sorted(characters)))
subsetter.subset(font)
output = root / 'src/assets/fonts/noto-sans-sc-variable.woff2'
subset.save_font(font, str(output), options)
print(f'{output.relative_to(root)}: {output.stat().st_size:,} bytes; {len(characters):,} requested characters')
