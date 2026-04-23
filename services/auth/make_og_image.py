"""
OG Image & Favicon generator for Frindle Tools
Output: images/og-image.png (1200x630), images/favicon.png (64x64)
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import os, sys

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "images")
os.makedirs(OUT, exist_ok=True)

CI_SRC  = os.path.join(BASE, "../../.archive/legacy-dashboard/images/프린들CI.png")
SCR_SRC = os.path.join(BASE, "../../.archive/legacy-dashboard/images/edu.frindle.synology.me_2.png")

W, H = 1200, 630
BG     = (10, 10, 15)
PURPLE = (99, 102, 241)
PURPLE2= (79, 70, 229)
TEXT_W = (241, 245, 249)
TEXT_G = (100, 116, 139)

def load_font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/AppleSDGothicNeo.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/SFNSDisplay.ttf",
    ]
    for p in candidates:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size, index=1 if bold else 0)
            except Exception:
                try:
                    return ImageFont.truetype(p, size)
                except Exception:
                    continue
    return ImageFont.load_default()

def round_corners(img, radius):
    img = img.convert("RGBA")
    mask = Image.new("L", img.size, 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle((0, 0, img.width, img.height), radius=radius, fill=255)
    img.putalpha(mask)
    return img

# ── Canvas ────────────────────────────────────────────────────────────────────
canvas = Image.new("RGB", (W, H), BG)
draw   = ImageDraw.Draw(canvas)

# Background subtle glow (top-left purple blob)
glow_r = 500
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd   = ImageDraw.Draw(glow)
gd.ellipse((-glow_r//2, -glow_r//2, glow_r, glow_r), fill=(99, 102, 241, 30))
glow = glow.filter(ImageFilter.GaussianBlur(80))
canvas.paste(Image.new("RGB", canvas.size, BG), (0, 0))
canvas.paste(glow, (0, 0), glow)

# Divider line (vertical, subtle)
draw.line([(460, 40), (460, H - 40)], fill=(30, 30, 50), width=1)

# ── CI Logo (left panel) ──────────────────────────────────────────────────────
ci_img = Image.open(CI_SRC).convert("RGBA")

# Circular white background for CI
CI_D = 180
ci_bg = Image.new("RGBA", (CI_D, CI_D), (0, 0, 0, 0))
mask  = Image.new("L", (CI_D, CI_D), 0)
ImageDraw.Draw(mask).ellipse((0, 0, CI_D, CI_D), fill=255)
# Subtle glow ring
ring  = Image.new("RGBA", (CI_D + 12, CI_D + 12), (0, 0, 0, 0))
ImageDraw.Draw(ring).ellipse((0, 0, CI_D + 12, CI_D + 12), fill=(99, 102, 241, 60))
ring  = ring.filter(ImageFilter.GaussianBlur(6))
canvas.paste(ring, (80 - 6, 100 - 6), ring)

ci_rsz = ci_img.resize((CI_D, CI_D), Image.LANCZOS)
tmp    = Image.new("RGBA", (CI_D, CI_D), (255, 255, 255, 255))
tmp.paste(ci_rsz, (0, 0), ci_rsz)
tmp.putalpha(mask)
canvas.paste(tmp, (80, 100), tmp)

# Brand text
fx_bold = load_font(56, bold=True)
fx_reg  = load_font(32)
fx_sub  = load_font(19)

brand_x = 80
brand_y = 308

# "Frindle" in purple + "Tools" in white
draw.text((brand_x, brand_y), "Frindle", font=fx_bold, fill=PURPLE)
fr_w = draw.textlength("Frindle", font=fx_bold)
draw.text((brand_x + fr_w + 10, brand_y + 8), "Tools", font=fx_reg, fill=TEXT_W)

# Tagline
draw.text((brand_x, brand_y + 70), "미국 주식 시장 분석 서비스", font=fx_sub, fill=TEXT_G)
draw.text((brand_x, brand_y + 98), "edu.frindle.synology.me", font=fx_sub, fill=(70, 80, 120))

# ── Market Regime Screenshot (right panel) ────────────────────────────────────
scr = Image.open(SCR_SRC).convert("RGB")

RIGHT_PAD = 30
RIGHT_W   = W - 460 - RIGHT_PAD * 2   # ≈ 680
ratio     = RIGHT_W / scr.width
RIGHT_H   = min(int(scr.height * ratio), H - 60)
scr_rsz   = scr.resize((RIGHT_W, int(scr.height * ratio)), Image.LANCZOS)

if scr_rsz.height > RIGHT_H:
    scr_rsz = scr_rsz.crop((0, 0, RIGHT_W, RIGHT_H))

scr_rsz = round_corners(scr_rsz, 12)

scr_x = 460 + RIGHT_PAD
scr_y = (H - scr_rsz.height) // 2
canvas.paste(scr_rsz, (scr_x, scr_y), scr_rsz)

# Label tag over screenshot
tag_font = load_font(14)
tag_text = "  MARKET REGIME  "
tag_w    = int(draw.textlength(tag_text, font=tag_font)) + 4
tag_h    = 26
tag_x, tag_y = scr_x + 12, scr_y + 12
draw.rounded_rectangle((tag_x, tag_y, tag_x + tag_w, tag_y + tag_h), radius=5, fill=PURPLE)
draw.text((tag_x + 2, tag_y + 5), tag_text, font=tag_font, fill=(255, 255, 255))

# ── Save OG image ─────────────────────────────────────────────────────────────
og_path = os.path.join(OUT, "og-image.png")
canvas.save(og_path, "PNG", optimize=True)
print(f"OG image → {og_path}")

# ── Favicon (64x64 circular crop of CI) ──────────────────────────────────────
fav_d   = 64
fav_img = ci_img.resize((fav_d, fav_d), Image.LANCZOS)
bg_fav  = Image.new("RGBA", (fav_d, fav_d), (10, 10, 15, 255))  # dark bg
mask_f  = Image.new("L", (fav_d, fav_d), 0)
ImageDraw.Draw(mask_f).ellipse((0, 0, fav_d, fav_d), fill=255)
white_c = Image.new("RGBA", (fav_d, fav_d), (255, 255, 255, 255))
white_c.putalpha(mask_f)
bg_fav.paste(white_c, (0, 0), white_c)
bg_fav.paste(fav_img, (0, 0), fav_img)

fav_path = os.path.join(OUT, "favicon.png")
bg_fav.save(fav_path, "PNG")
print(f"Favicon  → {fav_path}")
