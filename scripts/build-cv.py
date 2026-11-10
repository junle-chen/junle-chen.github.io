#!/usr/bin/env python3
"""Render both CVs from the same bilingual profile used by the homepage.

Requires XeLaTeX (TeX Live / MacTeX). No Python packages are required.
"""
import argparse
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SPECIAL = {"\\": r"\textbackslash{}", "&": r"\&", "%": r"\%", "$": r"\$", "#": r"\#", "_": r"\_", "{": r"\{", "}": r"\}", "~": r"\textasciitilde{}", "^": r"\textasciicircum{}", "³": r"\textsuperscript{3}", "†": r"\textsuperscript{\(\dagger\)}"}


def tex(value):
    return "".join(SPECIAL.get(char, char) for char in str(value))


def link(url, label):
    # Profile links are trusted repository data; escape characters special in URLs.
    url = str(url).replace("%", r"\%").replace("#", r"\#")
    return r"\href{" + url + "}{" + label + "}"


def render(data, lang):
    def local(value):
        return tex(value[lang])

    def section(en, zh):
        return r"\section*{" + (en if lang == "en" else zh) + "}\n"

    cv_contact = data.get('cvContact', {}).get(lang, {})
    phone = cv_contact.get('phone', data['contact'][1])
    lines = [r"\begin{center}", r"{\fontsize{24}{26}\selectfont\bfseries " + local(data['name']) + r"}\\[1pt]",
             r"{\large " + local(data['cvRole']) + r"}\\[3pt]",
             local(data['location']) + r"\enspace|\enspace " + link('mailto:' + data['contact'][0]['value'], tex(data['contact'][0]['value'])) + r"\enspace|\enspace " + link(phone['href'], tex(phone['value'])) + r"\\[1pt]",
             link(data['links']['website'], 'junle-chen.github.io') + r"\enspace|\enspace " + link(data['links']['github'], 'GitHub: junle-chen') + r"\enspace|\enspace " + link(data['links']['scholar'], 'Google Scholar'), r"\end{center}", r"\vspace{-8pt}"]
    if lang == 'zh':
        # Explicit paragraphs retain the large Chinese glyphs' line heights.
        lines[1] = r"{\fontsize{24}{32}\selectfont\bfseries " + local(data['name']) + r"\par}\vspace{4pt}"
        lines[2] = r"{\fontsize{12}{18}\selectfont " + local(data['cvRole']) + r"\par}\vspace{3pt}"
        lines[3] = lines[3].replace(r"\\[1pt]", r"\par\vspace{2pt}")
        if cv_contact.get('wechat'):
            lines[4] += r"\enspace|\enspace 微信：" + tex(cv_contact['wechat'])
    lines += [section('Research Profile', '研究概况'), local(data['cvSummary'])]
    lines += [section('Education', '教育经历')]
    for item in reversed(data['education']):
        lines += [r"\noindent\textbf{" + local(item['institution']) + r"}\hfill " + local(item['cvDate']) + r"\\", local(item['cvDegree']) + r"\par\vspace{3pt}"]
    lines += [section('Research Interests', '研究方向'), local(data['cvResearchIntro']), r"\begin{itemize}[leftmargin=12pt,itemsep=1pt,topsep=2pt]"]
    for item in data['research']:
        lines += [r"\item \textbf{" + local(item['title']) + '}: ' + local(item['cvDescription'])]
    publication_spacing = '1.2pt' if lang == 'zh' else '3pt'
    lines += [r"\end{itemize}", section('Publications', '发表论文'), r"\begin{enumerate}[label={[\arabic*]},leftmargin=18pt,itemsep=" + publication_spacing + r",topsep=1pt]"]
    for item in data['publications']:
        authors = tex(item['authors']).replace('Junle Chen', r'\textbf{Junle Chen}')
        venue = tex(item['venue'])
        if not item['venue'].startswith('arXiv:'):
            venue = r'\textbf{' + venue + '}'
        lines += [r"\item " + authors + '. ' + link(item['href'], r'\textbf{' + tex(item['title']) + '}') + '. ' + venue + '.']
    lines += [r"\end{enumerate}", r"{\footnotesize " + (r"\textsuperscript{\(\dagger\)} Co-first author." if lang == 'en' else r"\textsuperscript{\(\dagger\)} 共同第一作者。") + r"}\par"]
    lines += [section('Honors and Awards', '获奖情况'), r"\begin{tabularx}{\linewidth}{@{}X X@{}}"]
    awards = data['awards']
    for i in range(0, len(awards), 2):
        left = r'\textbullet\ ' + local(awards[i])
        right = r'\textbullet\ ' + local(awards[i+1]) if i+1 < len(awards) else ''
        lines += [left + ' & ' + right + r'\\']
    lines += [r"\end{tabularx}", section('Research Experience', '科研经历')]
    item = data['experience']
    lines += [r"\textbf{" + local(item['org']) + r"}\hfill " + local(item['date']) + r"\\", local(item['detail'])]
    template = (ROOT / 'cv' / 'template.tex').read_text()
    title = 'Junle Chen - Curriculum Vitae' if lang == 'en' else '陈俊乐 - 个人简历'
    section_format = (
        r"\titleformat{\section}{\fontsize{11.5}{15}\selectfont\bfseries}{}{0pt}{}[\vspace{1.5pt}\titlerule]" + '\n'
        + r"\titlespacing*{\section}{0pt}{6pt}{4pt}"
        if lang == 'zh' else
        r"\titleformat{\section}{\large\bfseries}{}{0pt}{}[\vspace{-4pt}\titlerule]" + '\n'
        + r"\titlespacing*{\section}{0pt}{6pt}{3pt}"
    )
    return template.replace('@@TITLE@@', tex(title)).replace('@@SECTION_FORMAT@@', section_format).replace('@@CONTENT@@', '\n'.join(lines))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-only', action='store_true', help='Write editable .tex files without compiling')
    parser.add_argument('--language', choices=['en', 'zh', 'all'], default='all', help='Regenerate only one language or both')
    args = parser.parse_args()
    data = json.loads((ROOT / 'src/data/profile.json').read_text())
    output = ROOT / 'src/assets/cv'
    output.mkdir(parents=True, exist_ok=True)
    for language, name in [('en', 'Junle_Chen_CV'), ('zh', 'Junle_Chen_CV_ZH')]:
        if args.language != 'all' and language != args.language:
            continue
        source = ROOT / 'cv' / (name + '.tex')
        source.write_text(render(data, language))
        if not args.source_only:
            engine = shutil.which('xelatex')
            if not engine:
                raise SystemExit('XeLaTeX is required. Install TeX Live / MacTeX, or use --source-only.')
            build = ROOT / 'tmp/pdfs' / language
            build.mkdir(parents=True, exist_ok=True)
            result = subprocess.run([engine, '-interaction=nonstopmode', '-halt-on-error', '-no-shell-escape', '-output-directory=' + str(build), str(source)], cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            (build / 'build-output.log').write_text(result.stdout)
            if result.returncode:
                raise SystemExit('CV build failed; see ' + str(build / 'build-output.log'))
            if 'Missing character:' in result.stdout or 'Overfull' in result.stdout:
                raise SystemExit('CV has missing glyphs or overflowing text; see ' + str(build / 'build-output.log'))
            shutil.copyfile(build / (name + '.pdf'), output / (name + '.pdf'))
        print(source.relative_to(ROOT) if args.source_only else (output / (name + '.pdf')).relative_to(ROOT))


if __name__ == '__main__':
    main()
