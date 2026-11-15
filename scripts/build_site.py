"""Build a portable HTML reader from the original chapter Markdown, without dependencies."""
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
chapters = []
for path in sorted((ROOT / '小说').glob('*.md')):
    source = path.read_text(encoding='utf-8')
    match = re.match(r'^---\n(.*?)\n---\n(.*)$', source, re.S)
    if not match:
        raise ValueError(f'Missing chapter metadata: {path.name}')
    meta = dict((key, json.loads(value)) for key, value in
                (line.split(': ', 1) for line in match[1].splitlines()))
    if meta['type'] != 'chapter':
        continue
    assert isinstance(meta['chapter'], int) and meta['chapter'] >= 0
    assert re.fullmatch(r'[a-z0-9-]+', meta['slug'])
    body = re.sub(r'^\s*# [^\n]*\n', '', match[2], count=1)
    # Original manuscript uses bold delimiters on virtually all prose.
    # Preserve words and punctuation while presenting body text at normal weight.
    paragraphs = [p.replace('**', '').strip() for p in re.split(r'\n\s*\n', body) if p.strip()]
    chapters.append({**meta, 'paragraphs': paragraphs,
                     'characters': sum(len(p) for p in paragraphs)})
chapters.sort(key=lambda chapter: chapter['chapter'])
assert chapters, 'No chapters found'
assert len({c['slug'] for c in chapters}) == len(chapters), 'Duplicate chapter slug'
assert len({c['chapter'] for c in chapters}) == len(chapters), 'Duplicate chapter number'
data = json.dumps(chapters, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
page = (ROOT / 'web/template.html').read_text(encoding='utf-8')
page = page.replace('/* INLINE_STYLES */', (ROOT / 'web/styles.css').read_text(encoding='utf-8'))
page = page.replace('/* INLINE_SCRIPT */', (ROOT / 'web/app.js').read_text(encoding='utf-8'))
page = page.replace('/* NOVEL_DATA */', data)
(ROOT / 'index.html').write_text(page, encoding='utf-8')
site = ROOT / '_site'
site.mkdir(exist_ok=True)
shutil.copy2(ROOT / 'index.html', site / 'index.html')
shutil.copytree(ROOT / 'assets', site / 'assets', dirs_exist_ok=True)
(site / '.nojekyll').touch()
print(f'Built index.html: {len(chapters)} chapters, {sum(c["characters"] for c in chapters):,} characters')
