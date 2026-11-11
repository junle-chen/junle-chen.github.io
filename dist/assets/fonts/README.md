# Chinese font paired with the original English typography

The original English font stack remains Comic Sans MS, Helvetica Neue,
Microsoft Yahei, -apple-system, sans-serif. LXGW WenKai is inserted only as a
Chinese fallback: both CSS `unicode-range` and the font cmap exclude Latin
letters and ASCII digits. English uses its original fonts in both language views.

The self-hosted Chinese faces are subsets of the official
[LXGW WenKai v1.530 release](https://github.com/lxgw/LxgwWenKai/releases/tag/v1.530).
They retain the release's Regular (400) and Medium (500) weights. The browser
synthesizes bold for heavier headings, as it does for other static fallback fonts.

- `LXGWWenKai-Regular.ttf`: Version 1.530; October 18, 2026; weight 400; SHA-256 `2d73eea94ad808999d90c0000c239a84a33b09d4bc6ab6c5b8bbf1eda8a7fc8b`.
- `LXGWWenKai-Medium.ttf`: Version 1.530; October 18, 2026; weight 500; SHA-256 `f4b8a34d1f838fe411540cb7c97b1c384ac9738a876c4104500bc42508b2312a`.

The font is licensed under the SIL Open Font License 1.1; see
[OFL-LXGWWenKai.txt](OFL-LXGWWenKai.txt). It covers Chinese characters in the current
site text. Characters outside the subset use the original platform fallback.

To extend the subset after adding text, download the official release TTFs and run:

```sh
uv run --with 'fonttools[woff]' python scripts/subset-web-font.py /path/to/LXGWWenKai-Regular.ttf /path/to/LXGWWenKai-Medium.ttf
npm run build
```

The normal website build uses the committed WOFF2 files and needs no font tooling.
