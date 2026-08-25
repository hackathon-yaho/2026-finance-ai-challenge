"""cases.py의 명세에서 합성 캡처 PNG를 그려낸다.

기대값과 같은 명세에서 그리므로 이미지와 기대값이 어긋날 수 없다.
생성된 PNG는 저장소에 커밋한다 — PRD §1.4가 요구하는 **고정** 평가 세트여야
측정값을 회차 간 비교할 수 있기 때문이다. 평소에는 다시 돌릴 필요가 없다.

실행: python -m evals.generate   (ai-server/ 에서)
"""

from __future__ import annotations

import pathlib
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from .cases import ALL_CASES, Case

OUT = pathlib.Path(__file__).parent / "images"

# 실제 전송본 규격에 맞춘다 — 프론트 실측 738×1600 PNG
# (docs/response/ai/image-delivery-spec.md). 글자 크기는 27px 그대로 두고
# 세로만 늘려 이벤트 밀도를 실전에 맞춘다.
W, H = 738, 1600
TOPBAR_H = 96

FONT_CANDIDATES = [
    "C:/Windows/Fonts/malgun.ttf",
    "C:/Windows/Fonts/malgunsl.ttf",
    "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
    "/System/Library/Fonts/AppleSDGothicNeo.ttc",
]


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    paths = ["C:/Windows/Fonts/malgunbd.ttf", *FONT_CANDIDATES] if bold else FONT_CANDIDATES
    for path in paths:
        if pathlib.Path(path).exists():
            return ImageFont.truetype(path, size)
    raise SystemExit(
        "한글 폰트를 찾지 못했습니다. 이미지는 이미 커밋되어 있으므로 보통은 재생성이 필요 없습니다.\n"
        f"재생성하려면 다음 중 하나가 필요합니다: {FONT_CANDIDATES}"
    )


def topbar(draw: ImageDraw.ImageDraw, title: str, bg: tuple, fg: tuple) -> None:
    draw.rectangle([0, 0, W, TOPBAR_H], fill=bg)
    draw.text((32, 34), title, font=load_font(30, bold=True), fill=fg)


def wrap(text: str, font: ImageFont.FreeTypeFont, max_w: int) -> list[str]:
    lines, cur = [], ""
    for ch in text:
        if font.getlength(cur + ch) > max_w and cur:
            lines.append(cur)
            cur = ch
        else:
            cur += ch
    if cur:
        lines.append(cur)
    return lines


def render_chat(case: Case, img: Image.Image) -> None:
    draw = ImageDraw.Draw(img)
    img.paste((186, 206, 224), [0, 0, W, H])
    topbar(draw, case.title, (245, 226, 90), (30, 30, 30))

    body, meta = load_font(27), load_font(19)
    y = TOPBAR_H + 40
    for who, text, when in case.rows:
        if who == "notice":
            # 대화 화면 안에 뜬 은행 입금 알림 카드 — 한 이미지에 유형이 섞이는 조건
            card_h = 118
            draw.rounded_rectangle([40, y, W - 40, y + card_h], radius=14, fill=(255, 255, 255))
            draw.rectangle([40, y, 48, y + card_h], fill=(28, 63, 148))
            draw.text((70, y + 16), "입금 알림", font=meta, fill=(28, 63, 148))
            draw.text((70, y + 44), text, font=body, fill=(20, 20, 20))
            draw.text((70, y + 84), when, font=meta, fill=(120, 126, 138))
            y += card_h + 26
            continue
        mine = who == "me"
        lines = wrap(text, body, 400)
        bw = max(body.getlength(line) for line in lines) + 36
        bh = len(lines) * 38 + 26
        x = W - 40 - bw if mine else 40
        draw.rounded_rectangle(
            [x, y, x + bw, y + bh], radius=16, fill=(255, 235, 51) if mine else (255, 255, 255)
        )
        for i, line in enumerate(lines):
            draw.text((x + 18, y + 13 + i * 38), line, font=body, fill=(20, 20, 20))
        tw = meta.getlength(when)
        draw.text(
            (x - tw - 10 if mine else x + bw + 10, y + bh - 26), when, font=meta, fill=(90, 100, 110)
        )
        y += bh + 26


def render_bank(case: Case, img: Image.Image) -> None:
    draw = ImageDraw.Draw(img)
    img.paste((255, 255, 255), [0, 0, W, H])
    topbar(draw, case.title, (28, 63, 148), (255, 255, 255))

    label, amount, sub = load_font(26), load_font(30, bold=True), load_font(21)
    y = TOPBAR_H + 36
    for when, who, value, balance in case.rows:
        draw.text((32, y), when, font=sub, fill=(120, 126, 138))
        draw.text((32, y + 32), who, font=label, fill=(24, 24, 28))
        minus = value.startswith("-")
        vw = amount.getlength(value + "원")
        draw.text(
            (W - 32 - vw, y + 22),
            value + "원",
            font=amount,
            fill=(190, 40, 40) if minus else (28, 63, 148),
        )
        bw = sub.getlength("잔액 " + balance + "원")
        draw.text((W - 32 - bw, y + 60), "잔액 " + balance + "원", font=sub, fill=(140, 145, 155))
        y += 118
        draw.line([24, y - 20, W - 24, y - 20], fill=(232, 234, 238), width=2)


def render_shipping(case: Case, img: Image.Image) -> None:
    draw = ImageDraw.Draw(img)
    img.paste((250, 250, 252), [0, 0, W, H])
    topbar(draw, case.title, (40, 40, 46), (255, 255, 255))

    label, sub = load_font(27, bold=True), load_font(22)
    y = TOPBAR_H + 44
    for when, status, where in case.rows:
        draw.ellipse([36, y + 10, 56, y + 30], fill=(52, 132, 92))
        draw.text((78, y), status, font=label, fill=(24, 24, 28))
        draw.text((78, y + 38), f"{when}   {where}", font=sub, fill=(120, 126, 138))
        y += 108
        if y < H - 80:
            draw.line([46, y - 26, 46, y - 4], fill=(200, 204, 210), width=3)


def render_sms(case: Case, img: Image.Image) -> None:
    draw = ImageDraw.Draw(img)
    img.paste((255, 255, 255), [0, 0, W, H])
    topbar(draw, case.title, (238, 240, 244), (30, 30, 30))

    body, meta = load_font(27), load_font(19)
    y = TOPBAR_H + 40
    for _who, text, when in case.rows:
        lines = wrap(text, body, 420)
        bw = max(body.getlength(line) for line in lines) + 36
        bh = len(lines) * 38 + 26
        draw.rounded_rectangle([40, y, 40 + bw, y + bh], radius=16, fill=(236, 238, 242))
        for i, line in enumerate(lines):
            draw.text((58, y + 13 + i * 38), line, font=body, fill=(20, 20, 20))
        draw.text((40, y + bh + 6), when, font=meta, fill=(120, 126, 138))
        y += bh + 48


RENDERERS = {
    "chat": render_chat,
    "bank": render_bank,
    "shipping": render_shipping,
    "sms": render_sms,
}


def build(case: Case) -> Image.Image:
    img = Image.new("RGB", (W, H), (255, 255, 255))
    RENDERERS[case.render](case, img)

    if case.crop_top_px:
        # 사용자가 위쪽을 잘라 올린 캡처. 자르는 양에 따라 사라지는 정보가 다르다.
        img = img.crop((0, case.crop_top_px, W, H))
    if case.blur:
        img = img.filter(ImageFilter.GaussianBlur(case.blur))
    return img


def main() -> int:
    # Windows 콘솔 기본 인코딩(cp949)은 '—' 같은 문자를 못 찍는다.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    OUT.mkdir(parents=True, exist_ok=True)
    for case in ALL_CASES:
        path = OUT / f"{case.case_id}.png"
        build(case).save(path, optimize=True)
        print(f"{path.name:24s} {path.stat().st_size // 1024:>4d} KB  {', '.join(case.checks)}")
    print(f"\n{len(ALL_CASES)}건 생성 → {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
