"""Build FBI proposal letters on the official letterhead.

Usage: python3 gen.py proposals.json outdir
Each entry: slug, kicker, title, subtitle, details, tagline, date, to, re,
salutation, paras (list), signoff. Paragraphs may use <b> tags.
"""
import json, sys, os
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, KeepTogether
from reportlab.platypus.flowables import HRFlowable

HERE = os.path.dirname(os.path.abspath(__file__))
FD = '/usr/share/fonts/truetype/liberation/'
pdfmetrics.registerFont(TTFont('LS', FD + 'LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('LSB', FD + 'LiberationSans-Bold.ttf'))
pdfmetrics.registerFontFamily('LS', normal='LS', bold='LSB', italic='LS', boldItalic='LSB')

W, H = A4
GOLD = HexColor('#B8901F')
INK = HexColor('#111111')
GREY = HexColor('#5F636E')
M = 46  # side margin, matches the gold rule in the header image

HEADER_H = W * 347 / 1654
FOOTER_H = W * 194 / 1654

def page(c, doc):
    c.drawImage(os.path.join(HERE, 'header.jpg'), 0, H - HEADER_H, W, HEADER_H)
    c.drawImage(os.path.join(HERE, 'footer.png'), 0, 0, W, FOOTER_H)
    if doc.page > 1:
        c.setFont('LS', 7); c.setFillColor(GREY)
        c.drawRightString(W - M, FOOTER_H - 34, f'Page {doc.page}')

S = dict(
    kicker=ParagraphStyle('k', fontName='LSB', fontSize=7, leading=9, textColor=GOLD, spaceAfter=6),
    title=ParagraphStyle('t', fontName='LSB', fontSize=17, leading=21, textColor=INK, spaceAfter=3),
    sub=ParagraphStyle('s', fontName='LSB', fontSize=10, leading=13, textColor=GOLD, spaceAfter=3),
    det=ParagraphStyle('d', fontName='LSB', fontSize=9, leading=12, textColor=INK, spaceAfter=3),
    tag=ParagraphStyle('g', fontName='LS', fontSize=10, leading=13, textColor=GREY, spaceAfter=10),
    meta=ParagraphStyle('m', fontName='LS', fontSize=9, leading=12.5, textColor=INK, spaceAfter=2),
    body=ParagraphStyle('b', fontName='LS', fontSize=9, leading=12.3, textColor=INK, spaceAfter=5),
    bul=ParagraphStyle('u', fontName='LS', fontSize=9, leading=12.3, textColor=INK, leftIndent=12,
                       bulletIndent=2, spaceAfter=3),
    h=ParagraphStyle('h', fontName='LSB', fontSize=9.5, leading=13, textColor=GOLD, spaceBefore=4, spaceAfter=4),
)

def build(p, out):
    doc = BaseDocTemplate(out, pagesize=A4, leftMargin=M, rightMargin=M,
                          topMargin=HEADER_H + 10, bottomMargin=FOOTER_H + 6,
                          title=p['title'], author='Film Beyond Imagination (FBI)')
    fr = Frame(M, FOOTER_H + 6, W - 2 * M, H - HEADER_H - FOOTER_H - 16, id='f', leftPadding=0,
               rightPadding=0, topPadding=0, bottomPadding=0)
    doc.addPageTemplates([PageTemplate('p', [fr], onPage=page)])
    st = [Paragraph(p['kicker'], S['kicker']), Paragraph(p['title'], S['title'])]
    if p.get('subtitle'): st.append(Paragraph(p['subtitle'], S['sub']))
    if p.get('details'): st.append(Paragraph(p['details'], S['det']))
    st.append(Paragraph(p.get('tagline', 'Creative vision. Made in Ghana.'), S['tag']))
    for k, v in (('Date', p['date']), ('To', p['to']), ('From', p.get('from', 'Film Beyond Imagination (FBI), Dome, Accra')), ('Re', p['re'])):
        st.append(Paragraph(f'<b>{k}:</b> {v}', S['meta']))
    st += [Spacer(1, 12), Paragraph(p['salutation'], S['body'])]
    for para in p['paras']:
        if para.startswith('## '):
            st.append(Paragraph(para[3:], S['h']))
        elif para.startswith('- '):
            st.append(Paragraph(para[2:], S['bul'], bulletText='•'))
        else:
            st.append(Paragraph(para, S['body']))
    st.append(KeepTogether([
        Spacer(1, 4), Paragraph(p.get('signoff', 'Yours faithfully,'), S['body']), Spacer(1, 24),
        HRFlowable(width=155, thickness=0.8, color=INK, hAlign='LEFT', spaceAfter=6),
        Paragraph('<b>Jerbel Mark Addeh</b>', S['meta']),
        Paragraph('Founder &amp; CEO, Film Beyond Imagination (FBI)', S['meta']),
        Paragraph('0257407350 · info@fbigh.com · fbigh.com', ParagraphStyle('c', parent=S['meta'], textColor=GREY)),
    ]))
    doc.build(st)

if __name__ == '__main__':
    items = json.load(open(sys.argv[1]))
    os.makedirs(sys.argv[2], exist_ok=True)
    for p in items:
        out = os.path.join(sys.argv[2], p['slug'] + '.pdf')
        build(p, out); print(out)
