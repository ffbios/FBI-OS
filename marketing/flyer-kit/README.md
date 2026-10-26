# FBI flyer kit

Story-size (1125×2000) flyers in the FBI design: dark header with logo, photo, gold kicker,
big headline, three ticked benefits, gold WhatsApp footer.

    python3 marketing/flyer-kit/make.py marketing/flyer-kit/services.json out/

Spec fields per flyer: `slug` (output file name), `img` (local path, or a site path such as
`/assets/drone/drone-aerial.jpg` or `/media/assets/...`, fetched from fbigh.com; `null` draws the
Bulk SMS phone mock-up), `pos` (CSS object-position for cropping), `kicker`, `head` (use `<br>`
for the line break), `bullets` (3 short lines). Escape `&` as `&amp;`.
Only use real FBI photos. Needs Python Playwright + Chromium (Google Fonts: Archivo, IBM Plex Sans).
`services.json` holds one flyer per service on the website.
