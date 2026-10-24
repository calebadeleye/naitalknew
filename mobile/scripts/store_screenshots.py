#!/usr/bin/env python3
"""
Turns real phone screenshots of the app into the sizes Google Play asks for.

    python3 mobile/scripts/store_screenshots.py <folder with screenshots> [output folder]

Name the screenshots with a number and a topic, for example
  01-inbox.png  02-menu.png  03-reader.png  04-compose.png  05-calendar.png  06-tasks.png
(PNG or JPEG straight from the phone). For each one it writes, with a green
background, a caption and the unaltered screenshot in a rounded frame:
  phone/        1080 x 1920   (9:16)
  tablet-7/     1080 x 1920   (9:16; allowed 320-3840 px per side)
  tablet-10/    1440 x 2560   (9:16; allowed 1080-7680 px per side)
Needs Pillow:  python3 -m pip install pillow
"""
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

CAPTIONS = {
    "welcome": "Business email on your phone",
    "accounts": "Several accounts, one tap apart",
    "inbox": "Your business inbox",
    "menu": "All your folders and tools",
    "drawer": "All your folders and tools",
    "reader": "Read email in a safe viewer",
    "message": "Read email in a safe viewer",
    "compose": "Write and send in seconds",
    "calendar": "Your calendar, always with you",
    "tasks": "Tasks that keep you on track",
    "notes": "Notes next to your mail",
    "offline": "Works offline, sends when back",
    "outbox": "Works offline, sends when back",
    "templates": "Reply faster with templates",
    "assistant": "Summarise or draft a reply",
    "settings": "Simple settings",
}
SIZES = {"phone": (1080, 1920), "tablet-7": (1080, 1920), "tablet-10": (1440, 2560)}
TOP, BOT = (11, 61, 36), (8, 42, 25)


def font(size: int, bold=True):
    for path in (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def background(w: int, h: int) -> Image.Image:
    base = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / h
        base.putpixel((0, y), tuple(int(TOP[i] + (BOT[i] - TOP[i]) * t) for i in range(3)))
    img = base.resize((w, h)).convert("RGBA")
    d = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    over = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    d.ellipse((w * 0.55, -h * 0.08, w * 1.3, h * 0.2), fill=(34, 160, 79, 44))
    d.ellipse((-w * 0.35, h * 0.78, w * 0.5, h * 1.1), fill=(34, 160, 79, 36))
    return Image.alpha_composite(img, over)


def caption_for(stem: str) -> str:
    slug = re.sub(r"^\d+[-_ ]*", "", stem).lower()
    for key, text in CAPTIONS.items():
        if key in slug:
            return text
    return slug.replace("-", " ").replace("_", " ").title() or "Green Mail"


def render(shot: Image.Image, caption: str, size) -> Image.Image:
    w, h = size
    canvas = background(w, h)
    d = ImageDraw.Draw(canvas)
    f = font(int(w * 0.065))
    # wrap the caption to the width
    words, lines, line = caption.split(), [], ""
    for word in words:
        trial = f"{line} {word}".strip()
        if d.textlength(trial, font=f) <= w * 0.86:
            line = trial
        else:
            lines.append(line)
            line = word
    lines.append(line)
    y = int(h * 0.045)
    for text in lines:
        d.text(((w - d.textlength(text, font=f)) / 2, y), text, font=f, fill=(255, 255, 255))
        y += int(f.size * 1.25)
    top = y + int(h * 0.025)
    room_h, room_w = h - top - int(h * 0.04), int(w * 0.84)
    scale = min(room_w / shot.width, room_h / shot.height)
    sw, sh = int(shot.width * scale), int(shot.height * scale)
    shot = shot.resize((sw, sh), Image.LANCZOS)
    x, y0 = (w - sw) // 2, top
    mask = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, sw - 1, sh - 1), radius=int(sw * 0.06), fill=255)
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    shadow.paste((0, 0, 0, 130), (x, y0 + 12, x + sw, y0 + sh + 12), mask)
    canvas = Image.alpha_composite(canvas, shadow.filter(ImageFilter.GaussianBlur(18)))
    canvas.paste(shot, (x, y0), mask)
    # A thin light edge so dark screens stand out from the background.
    ImageDraw.Draw(canvas).rounded_rectangle((x, y0, x + sw - 1, y0 + sh - 1), radius=int(sw * 0.06), outline=(255, 255, 255), width=max(3, w // 300))
    return canvas.convert("RGB")


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1]).expanduser()
    dest = Path(sys.argv[2]).expanduser() if len(sys.argv) > 2 else src / "play-store"
    files = sorted(p for p in src.iterdir() if p.suffix.lower() in (".png", ".jpg", ".jpeg"))
    if not files:
        sys.exit(f"No PNG or JPEG screenshots in {src}")
    for name in SIZES:
        (dest / name).mkdir(parents=True, exist_ok=True)
    for i, path in enumerate(files[:8], 1):
        shot = Image.open(path).convert("RGB")
        text = caption_for(path.stem)
        for name, size in SIZES.items():
            out = dest / name / f"{i:02d}-{re.sub(r'^\d+[-_ ]*', '', path.stem) or 'screen'}.png"
            render(shot, text, size).save(out, optimize=True)
        print(f"{path.name}: \"{text}\"")
    print(f"Done. Upload the files from {dest}/phone, tablet-7 and tablet-10 (up to 8 each).")


if __name__ == "__main__":
    main()
