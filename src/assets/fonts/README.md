# Noto Sans SC web font

The self-hosted variable font is a subset of the official
[Noto Sans SC](https://github.com/google/fonts/tree/main/ofl/notosanssc) font,
Version 2.004-H2;hotconv 1.0.118;makeotfexe 2.5.65603. Upstream source: `NotoSansSC[wght].ttf`.
SHA-256 of the upstream font used: `a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da`.

The font is licensed under the SIL Open Font License 1.1; see
[OFL-NotoSansSC.txt](OFL-NotoSansSC.txt). It covers the current site text, Latin
characters and variable weights 100-900. New characters fall back to the platform's
Chinese sans-serif fonts if they are outside this subset.

To extend the subset after adding text, download the official upstream font and run:

```sh
uv run --with 'fonttools[woff]' python scripts/subset-web-font.py '/path/to/NotoSansSC[wght].ttf'
npm run build
```

The standard website build uses the committed WOFF2 and needs no font tooling.
