#!/usr/bin/env python3
"""Generate the README visuals for dsh-policy-ledger.

Outputs (idempotent overwrite):
  docs/assets/dsh-policy-ledger-hero-{zh,en}-{light,dark}.webp   (1440x576, Pillow)
  docs/assets/dsh-policy-ledger-flow-v5-{light,dark}.svg         (1100x660, hand-written SVG)

Design, grounded in the plugin's real pipeline:

  Hero  - a ledger sheet for one pre-install checkup. The left leaf posts the
          declared capabilities of `samples/quickstart`'s synthetic tarball
          (bundle patch +1, binary +1 -> balance 2 -> R2), the right leaf
          posts the install log (stage `link`, E_TRUST_LINK_EACCES,
          confidence 0.90, three actions), and the card footer carries the
          real quickstart rows (`assert ok 3/3`, `risk_matrix 1 pkg`). The
          R2 seal sits on the ledger header like a stamp. Every number comes
          from the shipped quickstart output in the README; no invented run.

  Flow  - a two-page ledger spread: page A is the tarball ledger
          (input roots -> in-memory gzip/tar -> declared-surface extraction
          -> fixed risk ladder -> snapshots posting), page B is the install-log
          ledger (log_text -> six stages + unknown -> incident record). Both
          pages post into the shared `trust` storage shelf (snapshots /
          incidents), which feeds the two statements below (assert/diff and
          install.bundle). Grammar: two-page ledger spread + shared posting
          shelf + paired statements. Deliberately not a left-to-right node
          chain.

All strings are real tokens/values from src/core/trust.ts, src/plugin/tools.ts,
cordis.patch.yml and the README quickstart block.

Run:  python scripts/gen-readme-assets.py
Needs: Python 3, Pillow (hero), Chrome/Edge only for the manual overflow check.
"""
from __future__ import annotations

import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets")

F_SANS = r"C:\Windows\Fonts\msyh.ttc"
F_SANS_BOLD = r"C:\Windows\Fonts\msyhbd.ttc"
F_MONO = r"C:\Windows\Fonts\consola.ttf"
F_MONO_BOLD = r"C:\Windows\Fonts\consolab.ttf"
for _p in (F_SANS, F_SANS_BOLD, F_MONO, F_MONO_BOLD):
    if not os.path.exists(_p):
        raise SystemExit(f"FATAL: missing font {_p}")

W, H = 1440, 576

# --- palettes: light #f9f6fd -> #e4eaf8 / dark #131a2a -> #0c1016 ---------
P = {
    "light": dict(
        bg_top=(249, 246, 253), bg_bot=(228, 234, 248),
        card=(255, 255, 255), node=(251, 250, 253), edge=(226, 222, 239),
        track=(243, 241, 248), ink=(22, 23, 29), sub=(86, 91, 107),
        faint=(128, 133, 150), accent=(75, 103, 180), accent_soft=(236, 235, 249),
        warn=(176, 83, 9), warn_soft=(253, 241, 227), warn_border=(228, 178, 116),
        ok=(31, 122, 74), ok_soft=(233, 246, 238),
    ),
    "dark": dict(
        bg_top=(19, 26, 42), bg_bot=(12, 16, 22),
        card=(26, 34, 51), node=(32, 42, 64), edge=(43, 54, 80),
        track=(21, 28, 44), ink=(233, 237, 249), sub=(154, 166, 196),
        faint=(124, 136, 166), accent=(132, 150, 245), accent_soft=(35, 44, 74),
        warn=(240, 180, 95), warn_soft=(52, 40, 25), warn_border=(122, 91, 45),
        ok=(111, 211, 154), ok_soft=(28, 47, 38),
    ),
}

_FONTS: dict[tuple[str, int], ImageFont.FreeTypeFont] = {}


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    key = (path, size)
    if key not in _FONTS:
        _FONTS[key] = ImageFont.truetype(path, size)
    return _FONTS[key]


def sans(size: int):
    return font(F_SANS, size)


def sans_b(size: int):
    return font(F_SANS_BOLD, size)


def mono(size: int):
    return font(F_MONO, size)


def mono_b(size: int):
    return font(F_MONO_BOLD, size)


def tw(text: str, f: ImageFont.FreeTypeFont) -> float:
    return f.getlength(text)


def blend(c1, c2, t: float):
    return tuple(round(a + (b - a) * t) for a, b in zip(c1, c2))


def fit_size(text, start, maxw, bold=True, mono_=False, minimum=10):
    """Largest size <= start whose measured width fits maxw."""
    size = start
    while size > minimum:
        f = (mono_b if mono_ else sans_b)(size) if bold else (
            mono(size) if mono_ else sans(size))
        if tw(text, f) <= maxw:
            return f
        size -= 1
    return (mono_b if mono_ else sans_b)(minimum) if bold else (
        mono(minimum) if mono_ else sans(minimum))


def truncate(text, f, maxw):
    if tw(text, f) <= maxw:
        return text
    out = text.rstrip()
    while out and tw(out + "…", f) > maxw:
        out = out[:-1]
    return out + "…"


# --- shared drawing helpers ------------------------------------------------
def add_shadow(img, box, radius, dy=10, blur=18, alpha=38, color=(24, 18, 48)):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle(
        (box[0], box[1] + dy, box[2], box[3] + dy),
        radius=radius, fill=color + (alpha,),
    )
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    img.alpha_composite(layer)


def draw_bg(theme: str) -> Image.Image:
    p = P[theme]
    small = Image.new("RGB", (72, 72))
    px = small.load()
    top, bot = p["bg_top"], p["bg_bot"]
    for y in range(72):
        for x in range(72):
            t = (0.70 * y + 0.30 * x) / 71.0
            px[x, y] = blend(top, bot, t)
    img = small.resize((W, H), Image.BICUBIC).convert("RGBA")

    deco = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dd = ImageDraw.Draw(deco)
    accent = p["accent"]
    if theme == "light":
        dd.ellipse((1060, -190, 1600, 330),
                   fill=blend(p["bg_top"], (255, 255, 255), 0.55) + (100,))
        line_col = accent + (10,)
    else:
        dd.ellipse((1060, -190, 1600, 330),
                   fill=blend(p["bg_top"], accent, 0.08) + (120,))
        line_col = accent + (16,)
    deco = deco.filter(ImageFilter.GaussianBlur(30))
    img.alpha_composite(deco)

    # faint ledger ruling; the card covers most of it, so only the margins show
    rules = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rules)
    for yy in range(96, H - 24, 26):
        rd.line([(0, yy), (W, yy)], fill=line_col, width=1)
    rd.line([(64, 0), (64, H)], fill=line_col, width=1)
    rules = rules.filter(ImageFilter.GaussianBlur(0.6))
    img.alpha_composite(rules)
    return img


def put(d, x, y, s, f, fill, anchor="ls"):
    d.text((x, y), s, font=f, fill=fill, anchor=anchor)


def put_right(d, x_right, y, s, f, fill):
    d.text((x_right, y), s, font=f, fill=fill, anchor="rs")


def pill(d, x, y, h, text, f, fg, bg, padx=11, border=None):
    w = tw(text, f) + padx * 2
    d.rounded_rectangle((x, y, x + w, y + h), radius=h / 2, fill=bg,
                        outline=border, width=1 if border else 0)
    d.text((x + padx, y + h / 2 + 0.5), text, font=f, fill=fg, anchor="lm")
    return w


def dotted(d, x0, x1, y, color, step=6, seg=2):
    x = x0
    while x < x1:
        d.line([(x, y), (min(x + seg, x1), y)], fill=color, width=1)
        x += step


# --- hero copy -------------------------------------------------------------
HERO: dict[str, dict] = {
    "zh": dict(
        kicker="DeepSeek Harness 插件 · 安装体检账",
        value=["能力与风险，先记一笔账", "装失败，对到具体阶段"],
        subtitle=["只读：从本地 .tgz 抽声明能力、折算 R0–R3，",
                  "再断言快照，并把安装日志归到阶段。"],
        meta="快照 · 断言 · diff · 归因 · 探针 · 脱敏证据包",
        footer="Apache-2.0 · PerryLink DSH plugin family",
        card_title="安装体检账",
        card_sub="samples/quickstart · @synthetic/widget@1.0.0",
        sect_a="A · 能力账",
        sect_a_tool="trust.capability_snapshot",
        pkg_line="@synthetic/widget@1.0.0",
        caps_line="3 caps · integrity sha256",
        balance_label="balance",
        balance_value="1 + 1 = 2",
        balance_arrow="→ R2",
        risk_label="RISK",
        risk_value="R2",
        risk_score="2 分 / ≥3",
        sect_b="B · 日志账",
        sect_b_tool="install.diagnose",
        stages=["resolve", "fetch", "extract", "link", "build", "activate", "unknown"],
        error="E_TRUST_LINK_EACCES",
        confidence="confidence 0.90",
        root="根因 · linking 时文件系统权限被拒",
        actions="actions 3 · stage link",
        note="证据不足 → unknown，不猜",
        sample="samples/quickstart · 合成样例",
        asserts="assert ok 3/3 · risk_matrix 1 pkg",
        value_size=40,
        sub_size=20,
        meta_size=15,
        footer_size=14,
        kicker_size=14,
    ),
    "en": dict(
        kicker="DeepSeek Harness plugin · install checkup",
        value=["Declared risk, booked first", "Failure traced to its stage"],
        subtitle=["Read-only: snapshot a local .tgz and score R0–R3,",
                  "then assert it and attribute the install log."],
        meta="snapshot · assert · diff · diagnose · probe · bundle",
        footer="Apache-2.0 · PerryLink DSH plugin family",
        card_title="Install checkup ledger",
        card_sub="samples/quickstart · @synthetic/widget@1.0.0",
        sect_a="A · Capability ledger",
        sect_a_tool="trust.capability_snapshot",
        pkg_line="@synthetic/widget@1.0.0",
        caps_line="3 caps · integrity sha256",
        balance_label="balance",
        balance_value="1 + 1 = 2",
        balance_arrow="→ R2",
        risk_label="RISK",
        risk_value="R2",
        risk_score="2 pts / ≥3",
        sect_b="B · Install-log ledger",
        sect_b_tool="install.diagnose",
        stages=["resolve", "fetch", "extract", "link", "build", "activate", "unknown"],
        error="E_TRUST_LINK_EACCES",
        confidence="confidence 0.90",
        root="root cause · permission denied while linking",
        actions="actions 3 · stage link",
        note="not enough evidence → unknown, never a guess",
        sample="samples/quickstart · synthetic sample",
        asserts="assert ok 3/3 · risk_matrix 1 pkg",
        value_size=39,
        sub_size=19.5,
        meta_size=15,
        footer_size=14,
        kicker_size=13.5,
    ),
}

# six fixed risk factors, in src/core/trust.ts order; quickstart sample values
FACTORS = [
    ("bundle patch", 1), ("client call", 0),
    ("binary", 1), ("build script", 0),
    ("outbound host", 0), ("credential ref", 0),
]


def hero(locale: str, theme: str) -> Image.Image:
    p = P[theme]
    t = HERO[locale]
    img = draw_bg(theme)
    d = ImageDraw.Draw(img)

    # ---------------- left column ----------------
    kf = sans(t["kicker_size"])
    kw = tw(t["kicker"], kf) + 32
    d.rounded_rectangle((72, 58, 72 + kw, 90), radius=16,
                        fill=p["accent_soft"])
    d.text((88, 74), t["kicker"], font=kf, fill=p["accent"], anchor="lm")

    title = "dsh-policy-ledger"
    tf = mono_b(58)
    x = 72
    for ch in title:
        d.text((x, 184), ch, font=tf, fill=p["ink"], anchor="ls")
        x += tw(ch, tf) + 0.5
    title_w = x - 72 - 0.5
    assert title_w < 612, title_w

    vf = fit_size(max(t["value"], key=lambda s: tw(s, sans_b(t["value_size"]))),
                  t["value_size"], 608, bold=True)
    vmax = max(tw(line, vf) for line in t["value"])
    assert vmax < 612, vmax
    for i, line in enumerate(t["value"]):
        put(d, 72, 264 + i * 54, line, vf, p["ink"])
    # keep a single size for both value lines
    for i, line in enumerate(t["value"]):
        assert tw(line, vf) <= 612

    sf = fit_size(max(t["subtitle"], key=lambda s: tw(s, sans(t["sub_size"]))),
                  t["sub_size"], 608, bold=False)
    for i, line in enumerate(t["subtitle"]):
        put(d, 72, 366 + i * 31, line, sf, p["sub"])

    mf = fit_size(t["meta"], t["meta_size"], 608, bold=False)
    put(d, 72, 448, t["meta"], mf, p["sub"])

    d.line([(72, 480), (664, 480)], fill=p["edge"], width=1)
    put(d, 72, 512, t["footer"], sans(t["footer_size"]), p["faint"])

    # ---------------- ledger card ----------------
    box = (700, 56, 1368, 524)
    add_shadow(img, box, 20, dy=12, blur=24, alpha=34)
    d.rounded_rectangle(box, radius=20, fill=p["card"], outline=p["edge"],
                        width=1)

    put(d, 726, 94, t["card_title"], sans_b(15.5), p["ink"])
    put(d, 726, 113, t["card_sub"], mono(10), p["faint"])
    d.line([(726, 128), (1252, 128)], fill=p["edge"], width=1)

    # R2 seal, stamped on the header
    cx, cy, r = 1300, 94, 36
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=p["warn_soft"],
              outline=p["warn"], width=2)
    d.ellipse((cx - r + 5, cy - r + 5, cx + r - 5, cy + r - 5),
              outline=p["warn_border"], width=1)
    d.text((cx, cy - 17), t["risk_label"], font=mono_b(8),
           fill=p["warn"], anchor="mm")
    d.text((cx, cy + 2), t["risk_value"], font=sans_b(26),
           fill=p["warn"], anchor="mm")
    d.text((cx, cy + 23), t["risk_score"], font=sans(8.5),
           fill=p["warn"], anchor="mm")

    # ---- section A: capability posting ----
    put(d, 726, 158, t["sect_a"], sans_b(12.5), p["ink"])
    put_right(d, 1342, 158, t["sect_a_tool"], mono(9.6), p["faint"])
    put(d, 726, 180, t["pkg_line"], mono(11), p["ink"])
    put_right(d, 1342, 180, t["caps_line"], sans(10), p["faint"])

    col_x = (726, 1030)
    pts_x = (1006, 1326)
    for idx, (name, points) in enumerate(FACTORS):
        col = 0 if idx % 2 == 0 else 1
        row = idx // 2
        lx = col_x[col]
        px = pts_x[col]
        ly = 206 + row * 22
        lab_f = sans(11)
        put(d, lx, ly, name, lab_f, p["ink"])
        lead = lx + tw(name, lab_f) + 8
        dotted(d, lead, px - 26, ly - 4, p["edge"])
        val = f"+{points}" if points else "0"
        vcol = p["warn"] if points else p["faint"]
        put_right(d, px, ly, val, mono_b(11), vcol)

    # balance strip
    d.rounded_rectangle((726, 266, 1342, 302), radius=12, fill=p["accent_soft"])
    put(d, 742, 290, t["balance_label"], sans(10), p["faint"])
    put(d, 800, 290, t["balance_value"], mono_b(12), p["ink"])
    put_right(d, 1326, 290, t["balance_arrow"], sans_b(14), p["warn"])
    d.line([(726, 316), (1342, 316)], fill=p["edge"], width=1)

    # ---- section B: install-log posting ----
    put(d, 726, 342, t["sect_b"], sans_b(12.5), p["ink"])
    put_right(d, 1342, 342, t["sect_b_tool"], mono(9.6), p["faint"])

    x = 726
    for stage in t["stages"]:
        f = mono(10.5)
        w = tw(stage, f) + 18
        hot = stage == "link"
        unk = stage == "unknown"
        fill = p["warn_soft"] if hot else p["track"]
        fg = p["warn"] if hot else (p["faint"] if unk else p["sub"])
        edge = p["warn_border"] if hot else None
        d.rounded_rectangle((x, 354, x + w, 378), radius=10, fill=fill,
                            outline=edge, width=1 if edge else 0)
        d.text((x + w / 2, 366.5), stage, font=f, fill=fg, anchor="mm")
        x += w + 6
    assert x - 6 <= 1343, x

    put(d, 726, 402, t["error"], mono_b(12), p["warn"])
    put_right(d, 1342, 402, t["confidence"], mono(10.5), p["sub"])
    put(d, 726, 424, t["root"], sans(11), p["sub"])
    put_right(d, 1342, 424, t["actions"], sans(10), p["faint"])
    put(d, 726, 446, t["note"], sans(10.5), p["faint"])

    d.line([(726, 466), (1342, 466)], fill=p["edge"], width=1)
    put(d, 726, 500, t["sample"], sans(9.6), p["faint"])
    put_right(d, 1342, 500, t["asserts"], mono(9.6), p["sub"])

    # accent under-line on the card, echoing the ledger rule
    d.rounded_rectangle((726, 514, 1342, 517), radius=2, fill=p["accent_soft"])
    return img


# --- structure diagram (SVG) ----------------------------------------------
SANS_STACK = ("'Microsoft YaHei','PingFang SC','Noto Sans CJK SC',"
              "'Source Han Sans SC',sans-serif")
MONO_STACK = "'Consolas','SFMono-Regular','Menlo',ui-monospace,monospace"

T = {
    "light": dict(
        bg1="#f9f6fd", bg2="#e4eaf8", card="#ffffff", node="#fbfafd",
        edge="#e6e2ef", track="#f3f1f8", ink="#16171d", sub="#565b6b",
        faint="#83879a", accent="#4B67B4", accent_soft="#ecebf9",
        warn="#b45309", warn_soft="#fdf1e3", warn_border="#e4b274",
        ok="#1f7a4a", ok_soft="#e9f6ee",
        shadow="#16122c", shadow_op="0.10",
    ),
    "dark": dict(
        bg1="#131a2a", bg2="#0c1016", card="#1a2233", node="#202a40",
        edge="#2b3650", track="#151c2c", ink="#e9edf9", sub="#9aa6c4",
        faint="#7e8aab", accent="#8496f5", accent_soft="#232c4a",
        warn="#f0b45f", warn_soft="#3a2d1c", warn_border="#7a5b2d",
        ok="#6fd39a", ok_soft="#1c2f26",
        shadow="#000000", shadow_op="0.45",
    ),
}


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def stext(x, y, s, size, fill, *, weight=400, family="sans", anchor="start",
          opacity=None):
    fam = SANS_STACK if family == "sans" else MONO_STACK
    attrs = [f'x="{x:g}"', f'y="{y:g}"', f'fill="{fill}"',
             f'font-family="{fam}"', f'font-size="{size:g}"']
    if weight != 400:
        attrs.append(f'font-weight="{weight}"')
    if anchor != "start":
        attrs.append(f'text-anchor="{anchor}"')
    if opacity is not None:
        attrs.append(f'opacity="{opacity}"')
    return f'<text {" ".join(attrs)}>{esc(s)}</text>'


def tlen(s, size, *, bold=False, mono_=False) -> float:
    f = mono_b(size) if (mono_ and bold) else (
        mono(size) if mono_ else (sans_b(size) if bold else sans(size)))
    return tw(s, f)


def fit(s, size, maxw, *, bold=False, mono_=False) -> str:
    if tlen(s, size, bold=bold, mono_=mono_) <= maxw:
        return s
    s = s.rstrip()
    while s and tlen(s + "…", size, bold=bold, mono_=mono_) > maxw:
        s = s[:-1]
    return s + "…"


def spath(d, stroke, width=1.4, opacity=None, fill="none", dash=None):
    extra = f' stroke-dasharray="{dash}"' if dash else ""
    op = f' opacity="{opacity}"' if opacity is not None else ""
    return (f'<path d="{d}" fill="{fill}" stroke="{stroke}" '
            f'stroke-width="{width}" stroke-linecap="round" '
            f'stroke-linejoin="round"{op}{extra}/>')


def srect(x0, y0, x1, y1, fill, stroke=None, r=12, sw=1.2, shadow=False,
          op=None, dash=None):
    extra = ' filter="url(#soft)"' if shadow else ""
    st = f' stroke="{stroke}" stroke-width="{sw}"' if stroke else ""
    if dash:
        st += f' stroke-dasharray="{dash}"'
    o = f' opacity="{op}"' if op is not None else ""
    return (f'<rect x="{x0:g}" y="{y0:g}" width="{x1 - x0:g}" '
            f'height="{y1 - y0:g}" rx="{r:g}" fill="{fill}"{st}{o}{extra}/>')


def sput(x, y, s, size, fill, *, bold=False, mono_=False, anchor="start",
         op=None):
    return stext(x, y, s, size, fill, weight=700 if bold else 400,
                 family="mono" if mono_ else "sans", anchor=anchor,
                 opacity=op)


def chip(x, y, h, s, size, fg, bg, *, mono_=True, bold=True, padx=8,
         stroke=None, fixed=None, anchor="middle"):
    w = fixed if fixed is not None else tlen(s, size, bold=bold,
                                             mono_=mono_) + padx * 2
    out = [f'<rect x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}" '
           f'rx="{min(h / 2, 10):g}" fill="{bg}"'
           + (f' stroke="{stroke}" stroke-width="1.1"' if stroke else "") + "/>"]
    tx = x + w / 2 if anchor == "middle" else x + padx
    out.append(stext(tx, y + h / 2 + size * 0.34, s, size, fg,
                     weight=700 if bold else 400,
                     family="mono" if mono_ else "sans",
                     anchor="middle" if anchor == "middle" else "start"))
    return "".join(out), w


def arrow(x0, y0, x1, y1, color, width=2, marker="arr", opacity=None):
    op = f' opacity="{opacity}"' if opacity is not None else ""
    return (f'<path d="M{x0:g} {y0:g} L{x1:g} {y1:g}" stroke="{color}" '
            f'stroke-width="{width}" stroke-linecap="round" '
            f'marker-end="url(#{marker})"{op}/>')


def flow_svg(theme: str) -> str:
    c = T[theme]
    parts: list[str] = []
    A = parts.append

    A(f'<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="660" '
      f'viewBox="0 0 1100 660" role="img" aria-labelledby="fig-title fig-desc">')
    A('<title id="fig-title">dsh-policy-ledger 结构：tarball 能力账 + 安装日志账，共用 trust 存储架</title>')
    A('<desc id="fig-desc">左页能力账：pkg.tgz 经输入根校验，在内存中 gzip/tar 解析，'
      '抽取声明面并按固定分折算 R0–R3，快照写入 trust.snapshots；'
      '右页日志账：install.log 归到 resolve/fetch/extract/link/build/activate 或 unknown，'
      'incident 写入 trust.incidents；两页共用存储架，向下出具 assert/diff 对账与'
      ' install.bundle 脱敏证据包（R1 本地写）。</desc>')
    A('<defs>')
    A(f'<linearGradient id="bg" x1="0" y1="0" x2="0.30" y2="1">'
      f'<stop offset="0" stop-color="{c["bg1"]}"/>'
      f'<stop offset="1" stop-color="{c["bg2"]}"/></linearGradient>')
    A(f'<filter id="soft" x="-8%" y="-14%" width="116%" height="140%">'
      f'<feDropShadow dx="0" dy="7" stdDeviation="9" flood-color="{c["shadow"]}" '
      f'flood-opacity="{c["shadow_op"]}"/></filter>')
    A(f'<marker id="arr" viewBox="0 0 10 10" refX="8.2" refY="5" '
      f'markerWidth="6.4" markerHeight="6.4" orient="auto-start-reverse">'
      f'<path d="M0 1.8 L9 5 L0 8.2 z" fill="{c["accent"]}"/></marker>')
    A(f'<marker id="arrWarn" viewBox="0 0 10 10" refX="8.2" refY="5" '
      f'markerWidth="6.4" markerHeight="6.4" orient="auto-start-reverse">'
      f'<path d="M0 1.8 L9 5 L0 8.2 z" fill="{c["warn"]}"/></marker>')
    A('</defs>')
    A('<rect width="1100" height="660" fill="url(#bg)"/>')

    # faint ruled paper, outside the book
    A(f'<g opacity="0.35">')
    for yy in range(96, 648, 26):
        A(f'<line x1="0" y1="{yy}" x2="1100" y2="{yy}" stroke="{c["edge"]}" '
          f'stroke-width="1" opacity="0.55"/>')
    A('</g>')

    # ---------- header ----------
    A(sput(44, 44, "dsh-policy-ledger", 26, c["ink"], bold=True, mono_=True))
    sub = fit("两本账一次体检：tarball 能力账（快照 / 断言 / diff）+ 安装日志账"
              "（归因 / 证据包），落在同一个 trust 存储域。",
              13.2, 840, bold=False)
    A(sput(44, 70, sub, 13.2, c["sub"]))
    btxt = "R0 只读 · R1 仅证据包"
    bw = tlen(btxt, 11, bold=False, mono_=False) * 1.03 + 20
    bg, _ = chip(1056 - bw, 28, 26, btxt, 11, c["accent"], c["accent_soft"],
                 mono_=False, bold=False, padx=10)
    A(bg)
    A(f'<line x1="44" y1="88" x2="1056" y2="88" stroke="{c["edge"]}" '
      f'stroke-width="1.2"/>')

    # ---------- ledger book ----------
    A(srect(44, 100, 1056, 470, c["card"], c["edge"], 20, 1.2, shadow=True))
    A(spath("M550 114 L550 458", c["edge"], 1.3, dash="3 6"))
    for yy in (152, 240, 328, 416):
        A(spath(f"M542 {yy} L558 {yy}", c["edge"], 1.2, opacity="0.8"))

    def page_head(x0, x1, label, pill_text, hot=False):
        A(sput(x0, 128, label, 14, c["ink"], bold=True))
        fw = tlen(pill_text, 11, bold=False, mono_=True) * 1.03 + 20
        bg, _ = chip(x1 - 20 - fw, 113, 22, pill_text, 11,
                     c["warn"] if hot else c["accent"],
                     c["warn_soft"] if hot else c["accent_soft"],
                     mono_=True, bold=False, padx=10)
        A(bg)
        A(f'<line x1="{x0}" y1="140" x2="{x1 - 20}" y2="140" '
          f'stroke="{c["edge"]}" stroke-width="1"/>')

    page_head(64, 540, "A · TARBALL 能力账", "R0 只读")

    # input card
    A(srect(64, 150, 520, 194, c["node"], c["edge"], 12, 1.0))
    A(sput(78, 174, "pkg.tgz", 14, c["ink"], bold=True, mono_=True))
    A(sput(78, 188, "本地 npm tarball · 只读", 11, c["sub"]))
    A(sput(506, 174, "DSH_TRUST_INPUT_ROOTS", 11, c["accent"],
           mono_=True, anchor="end"))
    A(sput(506, 188, "realpath 逐段校验", 11, c["faint"], anchor="end"))

    # parse strip
    A(srect(64, 202, 520, 240, c["track"], r=12))
    A(sput(78, 222, "gzip → tar 内存解析", 13.5, c["ink"], bold=True))
    A(sput(506, 222, "8 MiB · 32 MiB · 5000 条", 11, c["sub"],
           mono_=True, anchor="end"))
    A(sput(78, 237, "不落盘 · 不 require · 不跑安装脚本", 11, c["faint"]))

    # declared surface
    A(sput(64, 260, "声明面抽取", 13, c["ink"], bold=True))
    A(sput(520, 260, "caps · tool_names · unknowns", 11, c["faint"],
           mono_=True, anchor="end"))
    row1 = [("bundle", "hot"), ("client", "hot"), ("bin", "hot"),
            ("skill", "plain"), ("tool", "plain")]
    x = 64
    for label, kind in row1:
        fg = c["accent"] if kind == "hot" else c["sub"]
        bg = c["accent_soft"] if kind == "hot" else c["track"]
        svg, w = chip(x, 268, 24, label, 13, fg, bg)
        A(svg)
        x += w + 6
    row2 = [("build_scripts", "warn"), ("outbound_hosts", "warn"),
            ("cred_refs", "warn"), ("unknowns", "faint")]
    x = 64
    for label, kind in row2:
        fg = c["warn"] if kind == "warn" else c["faint"]
        bg = c["warn_soft"] if kind == "warn" else c["track"]
        svg, w = chip(x, 298, 24, label, 13, fg, bg,
                      stroke=c["warn_border"] if kind == "warn" else None)
        A(svg)
        x += w + 6
    assert x - 6 <= 521, x

    # risk ladder
    A(sput(64, 336, "风险折算 · 固定分", 13, c["ink"], bold=True))
    A(sput(520, 336, "score → R0–R3", 11, c["faint"], mono_=True,
           anchor="end"))
    steps = [
        (64, 360, "R0 · 0", "plain"),
        (180, 354, "R1 · 1", "plain"),
        (296, 348, "R2 · 2", "hot"),
        (412, 342, "R3 · ≥3", "plain"),
    ]
    for x0, y0, label, kind in steps:
        hot = kind == "hot"
        A(srect(x0, y0, x0 + 108, 384,
                c["warn_soft"] if hot else c["track"],
                c["warn"] if hot else c["edge"], 9, 1.6 if hot else 1.0))
        A(sput(x0 + 10, 379, label, 13,
               c["warn"] if hot else c["sub"], bold=True, mono_=True))
    A(sput(64, 402, "bundle / client / bin +1 · build / host / cred +2",
           11, c["sub"]))

    # snapshot posting
    A(srect(64, 410, 520, 458, c["node"], c["edge"], 12, 1.0,
            dash="5 4"))
    A(sput(78, 432, "snapshot_id", 13, c["ink"], bold=True, mono_=True))
    A(sput(78, 448, "→ trust · snapshots", 11, c["accent"]))
    A(sput(506, 432, "integrity · caps · risk · unknowns", 11, c["faint"],
           anchor="end"))
    A(sput(506, 448, "evidence_sha256 · 内容哈希去重", 11, c["faint"],
           anchor="end"))

    # ---------- page B ----------
    page_head(566, 1036, "B · INSTALL.LOG 日志账", "R0 + R1", hot=True)

    A(srect(566, 150, 1036, 194, c["node"], c["edge"], 12, 1.0))
    A(sput(580, 174, "install.log", 14, c["ink"], bold=True, mono_=True))
    A(sput(580, 188, "UTF-8 纯文本 · log_text", 11, c["sub"]))
    A(sput(1022, 174, "原样传入", 11, c["accent"], anchor="end"))
    A(sput(1022, 188, "不执行包内代码", 11, c["faint"], anchor="end"))

    A(sput(566, 214, "归因到阶段 · 6 + unknown", 13, c["ink"], bold=True))
    A(sput(1036, 214, "install.diagnose", 11, c["faint"], mono_=True,
           anchor="end"))
    stages = ["resolve", "fetch", "extract", "link", "build", "activate"]
    for idx, stage in enumerate(stages):
        col = idx % 3
        row = idx // 3
        x0 = 566 + col * 158
        y0 = 222 + row * 28
        hot = stage == "link"
        A(srect(x0, y0, x0 + 150, y0 + 24,
                c["warn_soft"] if hot else c["track"],
                c["warn"] if hot else None, 10, 1.2))
        A(sput(x0 + 75, y0 + 17, stage, 13,
               c["warn"] if hot else c["sub"], bold=True, mono_=True,
               anchor="middle"))
    A(sput(566, 296, "unknown", 11, c["warn"], bold=True, mono_=True))
    A(sput(634, 296, "证据不足 → 不猜，不硬判", 11, c["faint"]))

    # diagnosis card
    A(srect(566, 304, 1036, 366, c["node"], c["warn_border"], 12, 1.2))
    A(sput(580, 326, "E_TRUST_LINK_EACCES", 13, c["warn"], bold=True,
           mono_=True))
    A(sput(1022, 326, "confidence 0.90", 11, c["sub"], mono_=True,
           anchor="end"))
    A(sput(580, 346, "根因 · linking 时文件系统权限被拒", 11, c["sub"]))
    A(sput(1022, 346, "actions 3", 11, c["warn"], anchor="end"))
    A(sput(580, 360, "evidence_lines · stage link", 11, c["faint"]))

    # incident posting
    A(srect(566, 374, 1036, 458, c["node"], c["edge"], 12, 1.0,
            dash="5 4"))
    A(sput(580, 396, "incident_id", 13, c["ink"], bold=True, mono_=True))
    A(sput(1022, 396, "→ trust · incidents", 11, c["accent"], anchor="end"))
    A(sput(580, 414, "stage · error_code · root_cause · confidence",
           11, c["faint"]))
    A(sput(580, 430, "actions ×3 · evidence_lines · created_at · run_id",
           11, c["faint"]))
    A(sput(580, 446, "log_sha256 登记；证据不足也记 unknown", 11,
           c["faint"]))

    # arrows into the shared shelf
    A(arrow(292, 460, 292, 486, c["accent"], 2, opacity="0.85"))
    A(arrow(800, 460, 800, 486, c["accent"], 2, opacity="0.85"))

    # ---------- shared storage shelf ----------
    A(srect(44, 480, 1056, 532, c["node"], c["edge"], 18, 1.2,
            shadow=True))
    A(sput(60, 501, "TRUST 存储域", 13, c["ink"], bold=True))
    A(sput(60, 516, "宿主 storageDomain", 11, c["faint"]))

    A(srect(200, 488, 620, 524, c["card"], c["edge"], 10, 1.0))
    A(sput(212, 506, "snapshots", 13, c["ink"], bold=True, mono_=True))
    A(sput(608, 506, "内容哈希去重", 11, c["faint"], anchor="end"))
    A(sput(212, 520, "snapshot_id · risk · caps · evidence_sha256",
           11, c["faint"], mono_=True))

    A(srect(636, 488, 1040, 524, c["card"], c["edge"], 10, 1.0))
    A(sput(648, 506, "incidents", 13, c["ink"], bold=True, mono_=True))
    A(sput(1028, 506, "log_sha256", 11, c["faint"], mono_=True,
           anchor="end"))
    A(sput(648, 520, "incident_id · stage · confidence · evidence",
           11, c["faint"], mono_=True))

    # ---------- paired statements ----------
    A(arrow(292, 534, 292, 540, c["accent"], 1.8, opacity="0.8"))
    A(arrow(800, 534, 800, 540, c["accent"], 1.8, opacity="0.8"))

    A(srect(44, 542, 536, 612, c["card"], c["edge"], 18, 1.2,
            shadow=True))
    A(sput(60, 562, "对账 · assert_tarball / diff", 13.5, c["ink"],
           bold=True))
    A(sput(520, 562, "risk_matrix 1 pkg · R2 1", 11, c["sub"],
           anchor="end"))
    A(sput(60, 582, "pass 3 · missing 0 · extra 0 · changed 0 → ok",
           11.5, c["accent"], bold=True, mono_=True))
    A(sput(60, 598, "diff · added / removed / escalated / blockers",
           11, c["sub"]))

    A(srect(564, 542, 1056, 612, c["card"], c["edge"], 18, 1.2,
            shadow=True))
    A(sput(580, 562, "出具 · install.bundle", 13.5, c["ink"], bold=True))
    r1w = tlen("R1 本地写", 11, bold=False, mono_=False) * 1.03 + 20
    bg, _ = chip(1040 - r1w, 549, 22, "R1 本地写", 11, c["warn"],
                 c["warn_soft"], mono_=False, bold=False, padx=10)
    A(bg)
    A(sput(580, 582, "token / secret / password / api_key → <redacted>",
           11.5, c["sub"], mono_=True))
    A(sput(580, 598, "incident.json · log.redacted.txt · manifest.json",
           11, c["faint"], mono_=True))

    # ---------- footer ----------
    A(sput(44, 640, "network: 仅 install.probe network:true · model: 无 · "
           "原 tarball 不改", 11, c["faint"], mono_=True))
    A(sput(1056, 640, "samples/quickstart · 合成样例 · 非认证", 11,
           c["faint"], mono_=True, anchor="end"))
    A('</svg>')
    return "\n".join(parts) + "\n"


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for locale in ("zh", "en"):
        for theme in ("light", "dark"):
            img = hero(locale, theme)
            path = os.path.join(
                OUT, f"dsh-policy-ledger-hero-{locale}-{theme}.webp")
            img.convert("RGB").save(path, "WEBP", quality=92, method=6)
            print(f"wrote {os.path.relpath(path, ROOT)}")
    for theme in ("light", "dark"):
        path = os.path.join(OUT, f"dsh-policy-ledger-flow-v5-{theme}.svg")
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(flow_svg(theme))
        print(f"wrote {os.path.relpath(path, ROOT)}")


if __name__ == "__main__":
    main()
