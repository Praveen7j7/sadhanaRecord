# A small converter for the subset the brief uses: headings, paragraphs, lists, tables, rules, bold, italic, links.
import re, sys, html, base64
src = open(sys.argv[1]).read()
def inline(t):
    codes = []
    def keep(m): codes.append('<code>' + html.escape(m.group(1), quote=False) + '</code>'); return f'\x00{len(codes)-1}\x00'
    t = re.sub(r'`([^`]+)`', keep, t.replace('\\|', '|'))
    t = html.escape(t, quote=False)
    t = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])', r'<em>\1</em>', t)
    t = re.sub(r'(?<![">])(https://[^\s<)`]+)', r'<a href="\1">\1</a>', t)
    t = re.sub(r'\x00(\d+)\x00', lambda m: codes[int(m.group(1))], t)
    return t
out, i, L = [], 0, src.split('\n')
while i < len(L):
    l = L[i]
    if not l.strip(): i += 1; continue
    if l.startswith('```'):
        i += 1; code = []
        while i < len(L) and not L[i].startswith('```'): code.append(L[i]); i += 1
        i += 1; out.append('<pre>' + html.escape('\n'.join(code), quote=False) + '</pre>'); continue
    m = re.match(r'^(#{1,4}) (.*)', l)
    if m: n = len(m.group(1)); out.append(f'<h{n}>{inline(m.group(2))}</h{n}>'); i += 1; continue
    if l.strip() == '---': out.append('<hr>'); i += 1; continue
    m = re.match(r'^!\[([^\]]*)\]\(([^)]+)\)\s*$', l)   # an image on its own line, embedded (path relative to the .md)
    if m:
        import os
        p = os.path.join(os.path.dirname(os.path.abspath(sys.argv[1])), m.group(2))
        mime = 'image/jpeg' if p.lower().endswith(('.jpg', '.jpeg')) else 'image/png'
        out.append(f'<figure><img alt="{html.escape(m.group(1))}" style="max-width:100%;border-radius:8px" src="data:{mime};base64,{base64.b64encode(open(p, "rb").read()).decode()}"><figcaption style="font-size:9pt;color:#6b6380">{inline(m.group(1))}</figcaption></figure>')
        i += 1; continue
    if l.startswith('|'):
        rows = []
        while i < len(L) and L[i].startswith('|'): rows.append([c.strip() for c in re.split(r'(?<!\\)\|', L[i].strip().strip('|'))]); i += 1
        head, body = rows[0], rows[2:]
        out.append('<table><thead><tr>' + ''.join(f'<th>{inline(c)}</th>' for c in head) + '</tr></thead><tbody>' +
                   ''.join('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in r) + '</tr>' for r in body) + '</tbody></table>')
        continue
    if re.match(r'^(\s*)([-*]|\d+\.) ', l):
        ordered = bool(re.match(r'^\d+\. ', l)); items = []
        while i < len(L) and re.match(r'^(\s*)([-*]|\d+\.) ', L[i]):
            ind = len(L[i]) - len(L[i].lstrip()); txt = re.sub(r'^\s*([-*]|\d+\.) ', '', L[i])
            items.append((ind, txt)); i += 1
        h, depth = [], []
        for ind, txt in items:
            if not depth or ind > depth[-1]: h.append('<ol>' if ordered and not depth else '<ul>'); depth.append(ind)
            else:
                while depth and ind < depth[-1]: h.append('</li></ul>'); depth.pop()
                h.append('</li>')
            h.append('<li>' + inline(txt))
        while depth: h.append('</li>' + ('</ol>' if ordered and len(depth) == 1 else '</ul>')); depth.pop()
        out.append(''.join(h)); continue
    para = []
    while i < len(L) and L[i].strip() and not re.match(r'^(#{1,4} |\||---|```|\s*([-*]|\d+\.) )', L[i]): para.append(L[i]); i += 1
    out.append('<p>' + inline(' '.join(para)) + '</p>')
body = '\n'.join(out)
em = base64.b64encode(open(sys.argv[2], 'rb').read()).decode()
css = """
@page { size: A4; margin: 16mm 15mm 16mm 15mm; }
* { box-sizing: border-box; }
body { font-family: 'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1f1b2e; font-size: 10.2pt; line-height: 1.5; margin: 0; }
.cover { display: flex; align-items: center; gap: 16px; padding: 18px 20px; margin-bottom: 18px; border-radius: 14px;
  background: radial-gradient(120% 140% at 0% 0%, #5a3a9e 0%, #3b2270 55%, #23154a 100%); color: #fff; }
.cover img { width: 64px; height: 64px; border-radius: 50%; box-shadow: 0 0 0 2px rgba(227,196,122,.7); }
.cover .t { font-family: 'Fraunces', Georgia, serif; font-size: 22pt; font-weight: 600; line-height: 1.1; }
.cover .s { color: #e3c47a; font-size: 9pt; letter-spacing: .14em; text-transform: uppercase; font-weight: 650; margin-top: 4px; }
h1 { display: none; }
h2 { font-family: 'Fraunces', Georgia, serif; font-size: 15pt; color: #3b2270; margin: 18px 0 8px; page-break-after: avoid; }
h3 { font-size: 11.5pt; color: #3b2270; margin: 14px 0 6px; page-break-after: avoid; }
p { margin: 0 0 8px; }
ul, ol { margin: 0 0 10px; padding-left: 18px; } li { margin: 3px 0; } li ul { margin-top: 3px; }
hr { border: 0; border-top: 1px solid #e3dcf0; margin: 14px 0; }
strong { color: #23154a; }
a { color: #4b2d8f; text-decoration: none; }
table { width: 100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 9pt; page-break-inside: auto; }
tr { page-break-inside: avoid; }
th { text-align: left; background: #f1ecfa; color: #3b2270; font-weight: 650; padding: 6px 8px; border-bottom: 1.5px solid #cdbfe8; }
td { padding: 6px 8px; border-bottom: 1px solid #ece7f5; vertical-align: top; overflow-wrap: anywhere; }
pre { font-family: ui-monospace, Menlo, monospace; font-size: 8.4pt; line-height: 1.45; background: #f6f3fb; border: 1px solid #e6dff3; border-radius: 8px; padding: 8px 10px; white-space: pre-wrap; overflow-wrap: anywhere; page-break-inside: avoid; }
code { font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace; font-size: .86em; background: #f3f0f9; color: #3b2270; padding: 0 3px; border-radius: 3px; }
td:first-child { font-weight: 600; color: #2b2245; width: 27%; }
em { color: #5e5675; }
"""
title, sub = (sys.argv[4] if len(sys.argv) > 4 else 'Sadhana Record'), (sys.argv[5] if len(sys.argv) > 5 else 'ISKCON Youth Forum, Delhi · Stakeholder brief')
cover = f'<div class="cover"><img src="data:image/png;base64,{em}"><div><div class="t">{title}</div><div class="s">{sub}</div></div></div>'
page = f'<!doctype html><html><head><meta charset="utf-8"><title>{title}</title><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Inter:wght@400;600;650;700&display=block" rel="stylesheet"><style>{css}</style></head><body>{cover}{body}</body></html>'
open(sys.argv[3], 'w').write(page)
