import base64, os, sys
from playwright.sync_api import sync_playwright

import json, urllib.request, tempfile
D = os.path.dirname(os.path.abspath(__file__))
SPEC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
FLYERS = json.load(open(SPEC))
CACHE = tempfile.mkdtemp()

def img_path(src):
    """src: local path, or a site path like /assets/drone/drone-aerial.jpg (fetched from fbigh.com)."""
    if os.path.exists(src): return src
    url = src if src.startswith("http") else "https://fbigh.com" + src
    p = os.path.join(CACHE, os.path.basename(src))
    if not os.path.exists(p):
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (FBI flyer kit)"})
        open(p, "wb").write(urllib.request.urlopen(req).read())
    return p

def b64(path):
    ext = "png" if path.endswith(".png") else "jpeg"
    return f"data:image/{ext};base64," + base64.b64encode(open(path, "rb").read()).decode()

LOGO = b64(os.path.join(D, "logo.png"))


CSS = """
@import url('https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,800;100..125,900&family=IBM+Plex+Sans:wght@400;500;600&display=block');
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1125px;height:2000px;background:#0f1013;overflow:hidden}
.f{position:relative;width:1125px;height:2000px;background:#0f1013;font-family:'IBM Plex Sans',sans-serif}
.strip{position:absolute;top:0;left:0;right:0;height:14px;background:#22242a}
.strip:after{content:"";position:absolute;right:0;top:0;width:337px;height:14px;background:#d8b04a}
.top{position:absolute;top:14px;left:0;right:0;height:171px;display:flex;align-items:center;justify-content:space-between;padding:0 77px 0 76px}
.top img{height:72px}
.brand{color:#d9d9d9;font-family:'Archivo',sans-serif;font-stretch:112%;font-weight:800;font-size:25px;letter-spacing:5px;line-height:36px;text-align:left}
.photo{position:absolute;top:185px;left:0;width:1125px;height:896px;overflow:hidden;background:#000}
.photo img{width:100%;height:100%;object-fit:cover}
.panel{position:absolute;top:1081px;left:0;right:0;padding:0 76px}
.kicker{margin-top:68px;color:#d8b04a;font-family:'Archivo',sans-serif;font-stretch:125%;font-weight:900;font-size:27px;letter-spacing:7px}
h1{margin-top:44px;color:#f4f1ea;font-family:'Archivo',sans-serif;font-stretch:108%;font-weight:900;font-size:100px;line-height:96px;letter-spacing:-2.5px}
h1.sm{font-size:86px;line-height:88px}
ul{list-style:none;margin-top:54px}
li{position:relative;padding-left:54px;color:#e8e6e0;font-size:35px;line-height:65px;font-weight:400}
li svg{position:absolute;left:0;top:20px;width:32px;height:26px}
.foot{position:absolute;left:0;right:0;bottom:0;height:205px;background:#d8b04a;padding:44px 76px 0}
.wa{font-family:'Archivo',sans-serif;font-stretch:105%;font-weight:900;font-size:55px;color:#121212;letter-spacing:-.5px}
.ct{margin-top:10px;font-size:29px;font-weight:600;color:#121212}
/* SMS mockup */
.sms{position:absolute;inset:0;background:radial-gradient(circle at 70% 30%,#3a3220 0,#16171b 55%,#0f1013 100%);overflow:hidden}
.ring{position:absolute;border:2px solid rgba(216,176,74,.18);border-radius:50%}
.phone{position:absolute;left:50%;top:70px;transform:translateX(-50%) rotate(-6deg);width:420px;height:860px;border-radius:60px;background:#08090b;border:10px solid #2b2d33;box-shadow:0 40px 80px rgba(0,0,0,.6)}
.scr{position:absolute;inset:14px;border-radius:44px;background:#f4f1ea;padding:70px 26px 0;overflow:hidden}
.nm{text-align:center;font-weight:600;font-size:22px;color:#121212}
.nm small{display:block;font-weight:400;font-size:16px;color:#777;margin-bottom:24px}
.av{width:72px;height:72px;margin:0 auto 10px;border-radius:50%;background:#121212;display:flex;align-items:center;justify-content:center}
.av img{width:58px}
.b{background:#e4e1d8;border-radius:22px 22px 22px 6px;padding:16px 18px;font-size:19px;line-height:26px;color:#121212;margin-bottom:16px}
.b.g{background:#d8b04a}
.badge{position:absolute;right:120px;top:120px;background:#d8b04a;color:#121212;font-family:'Archivo',sans-serif;font-weight:900;font-size:30px;border-radius:40px;padding:14px 28px;transform:rotate(6deg);box-shadow:0 12px 30px rgba(0,0,0,.4)}
.badge2{position:absolute;left:100px;bottom:150px;background:#f4f1ea;color:#121212;font-family:'Archivo',sans-serif;font-weight:900;font-size:28px;border-radius:40px;padding:14px 28px;transform:rotate(-5deg);box-shadow:0 12px 30px rgba(0,0,0,.4)}
"""

CHECK = '<svg viewBox="0 0 32 26"><path d="M3 13l9 9L29 4" fill="none" stroke="#d8b04a" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'

SMS = f"""<div class="sms">
<div class="ring" style="width:900px;height:900px;left:110px;top:-10px"></div>
<div class="ring" style="width:1300px;height:1300px;left:-90px;top:-210px"></div>
<div class="phone"><div class="scr">
<div class="av" style="color:#d8b04a;font-family:Archivo;font-weight:900;font-size:28px">YB</div>
<div class="nm">YOUR BRAND<small>Sender ID</small></div>
<div class="b">Dear Member, join us this Sunday at 8am for our Thanksgiving Service. God bless you!</div>
<div class="b g">Reminder: PTA meeting holds on Friday at 3pm in the school hall. Thank you.</div>
<div class="b">Black Friday! 20% off all items this weekend only. Visit any of our branches.</div>
<div class="b">Your appointment is confirmed for Monday, 10:00am. Reply 1 to confirm.</div>
</div></div>
<div class="badge">✓ Delivered</div>
<div class="badge2">Sent to all, in seconds</div>
</div>"""

def html(f):
    photo = SMS if not f.get("img") else f'<img src="{b64(img_path(f["img"]))}" style="object-position:{f.get("pos","50% 50%")}">'
    cls = "sm" if len(f["head"].replace("<br>", "")) > 30 else ""
    lis = "".join(f"<li>{CHECK}{b}</li>" for b in f["bullets"])
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body><div class="f">
<div class="strip"></div>
<div class="top"><img src="{LOGO}"><div class="brand">FILM BEYOND<br>IMAGINATION</div></div>
<div class="photo">{photo}</div>
<div class="panel"><div class="kicker">{f['kicker']}</div><h1 class="{cls}">{f['head']}</h1><ul>{lis}</ul></div>
<div class="foot"><div class="wa">WhatsApp 025 740 7350</div><div class="ct">fbigh.com · info@fbigh.com · Accra, Ghana-wide</div></div>
</div></body></html>"""

only = sys.argv[3:]
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1125, "height": 2000})
    for f in FLYERS:
        if only and f["slug"] not in only: continue
        path = os.path.join(OUT, f["slug"] + ".html")
        open(path, "w").write(html(f))
        pg.goto("file://" + path)
        pg.wait_for_load_state("networkidle")
        pg.evaluate("document.fonts.ready")
        pg.screenshot(path=os.path.join(OUT, f"{f['slug']}.png"))
        os.remove(path)
        print("ok", f["slug"])
    b.close()
