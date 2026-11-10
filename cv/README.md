# Bilingual CV

The homepage and both CVs share [`src/data/profile.json`](../src/data/profile.json).
Edit its `en` and `zh` fields together; publication titles, authors, order, and venues
are shared between the two languages. The Chinese CV translates the existing English
profile and keeps official publication titles in English.

To regenerate the editable LaTeX and one-page A4 PDFs with TeX Live / MacTeX:

```sh
python3 scripts/build-cv.py
npm run build
```

The generator requires XeLaTeX and the TeX Live fonts TeX Gyre Termes and Fandol Song.
Use `--language zh` or `--language en` to regenerate only the requested version.
CV-only contact overrides live in `profile.json` under `cvContact` by language;
the Chinese CV uses its own phone and WeChat without changing the English CV or homepage contacts.
It uses only the Python standard library. Use `--source-only` to regenerate `.tex`
files without a TeX installation. The ordinary site build uses the committed PDFs
and does not require LaTeX.

- English: `src/assets/cv/Junle_Chen_CV.pdf` (the existing URL remains valid).
- Chinese: `src/assets/cv/Junle_Chen_CV_ZH.pdf`.
- Template: `cv/template.tex`; generated editable sources: `cv/Junle_Chen_CV*.tex`.

The topbar's 中文 / EN buttons switch the landing and About Me profile, navigation,
search label, and CV action. The choice is stored locally when available.
`?lang=zh#info` and `?lang=en#info` are shareable links to the corresponding profile.
An explicit query parameter takes priority over the saved preference, then the
browser language is used. Each view shows only its matching CV download link.
Research notes, memos, and paper-reading content retain their original language.

Re-render and visually inspect both PDFs after changing CV content. The generator
rejects missing glyphs and overflowing text; check that each PDF still fits one page.
