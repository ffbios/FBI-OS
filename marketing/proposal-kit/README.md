# FBI proposal kit

Builds one-page proposals on the official FBI letterhead.

    python3 marketing/proposal-kit/gen.py batch.json out/

`batch.json` is a list like `example-batch.json` (slug, org, email, phone, kicker, title,
subtitle, details, tagline, date, to, re, salutation, paras). Paragraphs starting `## ` are
gold headings, `- ` are bullets; `<b>` is allowed; escape `&` as `&amp;`.
Every proposal must fit on ONE page (check with `pdfinfo`); trim wording if not.

Publish: copy PDFs to `public/proposals/` (slug ends in a random 4-char suffix),
commit, push to main. Railway deploys; confirm each
`https://fbigh.com/proposals/<slug>.pdf` returns 200 application/pdf.

Needs: python3, reportlab, Liberation Sans fonts (`/usr/share/fonts/truetype/liberation/`).
