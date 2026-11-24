"""Render original top-down city architecture and props for Night Garage."""
from pathlib import Path
from random import Random

from PIL import Image, ImageDraw

ART = Path(__file__).resolve().parents[2] / "public" / "art"


def line(draw, points, color, width=1):
    draw.line(points, fill=color, width=width)


def slab(draw, box, body, top="#52636e", bottom="#141e2c"):
    x0, y0, x1, y1 = box
    draw.rectangle(box, fill=body)
    line(draw, (x0, y0, x1, y0), top)
    line(draw, (x0, y0, x0, y1), top)
    line(draw, (x0 + 1, y1, x1, y1), bottom)
    line(draw, (x1, y0 + 1, x1, y1), bottom)


def puddle(draw, x, y, size, color="#314451"):
    line(draw, (x, y, x + size, y), color)
    line(draw, (x + size // 5, y + 1, x + size * 5 // 6, y + 1), color)
    line(draw, (x + size // 3, y + 2, x + size * 3 // 5, y + 2), "#233447")


def ac_unit(draw, x, y, w=18, d=9):
    draw.rectangle((x + 2, y + 4, x + w + 3, y + d + 3), fill="#111d27")
    slab(draw, (x, y, x + w, y + d), "#415562", "#61727a", "#273747")
    draw.rectangle((x + 2, y + 2, x + w - 3, y + d - 2), fill="#1b2937")
    for row in range(y + 2, y + d - 1, 2):
        line(draw, (x + 3, row, x + w - 4, row), "#465761")
    line(draw, (x + w - 1, y + 3, x + w - 1, y + d - 2), "#57646b")
    draw.point((x + w - 2, y + d - 1), fill="#967d5c")


def canopy(draw, x, y, w, h, color, edge):
    draw.polygon([(x + 2, y), (x + w - 2, y), (x + w + 3, y + h),
                  (x - 3, y + h)], fill="#111c27")
    draw.polygon([(x + 3, y + 1), (x + w - 3, y + 1), (x + w + 1, y + h - 2),
                  (x - 1, y + h - 2)], fill=color)
    for pos in range(x + 8, x + w - 4, 6):
        line(draw, (pos, y + 1, pos, y + h - 2), edge)
    line(draw, (x - 1, y + h - 2, x + w + 1, y + h - 2), "#7a7770")


def window(draw, x, y, w, h, lit=False):
    slab(draw, (x, y, x + w, y + h), "#101c28", "#667078", "#132131")
    glass = "#8d6955" if lit else "#314c60"
    reflection = "#b78662" if lit else "#547483"
    draw.rectangle((x + 2, y + 2, x + w - 2, y + h - 2), fill=glass)
    line(draw, (x + 2, y + 2, x + w - 2, y + 2), reflection)
    line(draw, (x + w // 2, y + 1, x + w // 2, y + h - 1), "#12212c")
    if w >= 12:
        line(draw, (x + 1, y + h // 2, x + w - 1, y + h // 2), "#172936")
    line(draw, (x + 2, y + h + 1, x + w - 1, y + h + 1), "#8b8580" if lit else "#465661")


def roof_texture(draw, rng, left, right, top, bottom, color="#2a3947"):
    draw.rectangle((left, top, right, bottom), fill=color)
    for _ in range((right - left) * (bottom - top) // 17):
        x, y = rng.randrange(left + 1, right), rng.randrange(top + 1, bottom)
        swatch = rng.choice(("#293846", "#354653", "#2d3f4b", "#3b4953", "#40505a"))
        line(draw, (x, y, min(x + rng.choices((0, 1, 2, 3, 5), (12, 8, 5, 1, 1))[0], right - 1), y), swatch)
    for row in range(top + 8, bottom, 14):
        line(draw, (left, row, right, row), "#2a3745")
        line(draw, (left, row + 1, right, row + 1), "#374755")
        for x in range(left + 8 + (row % 5) * 4, right, 32):
            line(draw, (x, row - 7, x, min(row + 1, bottom)), "#273541")


def brick(draw, rng, left, top, right, bottom, base, seams):
    draw.rectangle((left, top, right, bottom), fill=base)
    for row in range(top + 3, bottom + 1, 5):
        line(draw, (left, row, right, row), seams)
        for col in range(left + (row % 2) * 4 + 4, right, 9):
            line(draw, (col, row - 3, col, row - 1), seams)
    for _ in range((right - left) * (bottom - top) // 28):
        x, y = rng.randrange(left, right), rng.randrange(top, bottom)
        draw.point((x, y), fill=rng.choice(("#283841", "#293943", "#53606a", "#655953")))


def building(kind):
    canvas = Image.new("RGBA", (192, 144))
    draw = ImageDraw.Draw(canvas)
    rng = Random({"industrial": 36, "corner": 67, "apartments": 123}[kind])
    left, right = (21, 182) if kind == "industrial" else (21, 172)
    roof_top = {"industrial": 55, "corner": 59, "apartments": 21}[kind]
    roof_end = {"industrial": 90, "corner": 99, "apartments": 70}[kind]
    ground = 124
    outside = left - 13

    draw.polygon([(outside, ground - 12), (right + 6, ground - 12),
                  (right + 10, ground + 7), (right + 10, ground + 11),
                  (outside + 12, ground + 11), (outside - 4, ground + 3)],
                 fill="#08121bd5")
    draw.polygon([(outside, ground - 7), (right + 7, ground - 7), (right + 7, ground + 5),
                  (left - 7, ground + 5), (outside, ground + 1)], fill="#34434b")
    line(draw, (left - 5, ground + 5, right + 7, ground + 5), "#4e6065")
    for x in range(left, right, 17):
        line(draw, (x, ground + 3, x, ground + 5), "#22313d")
    for x, y, length in [(29, 130, 21), (106, 133, 18), (145, 130, 11)]:
        puddle(draw, x, y, length)

    draw.polygon([(outside, roof_top + 7), (left, roof_top), (left, ground), (outside, ground - 7)],
                 fill="#1c2b39")
    line(draw, (outside, roof_top + 7, outside, ground - 8), "#4e5a65")
    for y in range(roof_end + 4, ground - 3, 5):
        line(draw, (outside + 2, y - 5, left - 1, y), "#263744")
        if y % 3 == 0:
            line(draw, (outside + 8, y - 6, outside + 8, y - 3), "#263744")
    brick(draw, rng, left, roof_end, right, ground, "#3d4650" if kind == "industrial" else "#46505a", "#333d48")
    line(draw, (left + 1, roof_end + 6, left + 1, ground), "#58616a")
    line(draw, (right, roof_end, right, ground), "#1a2836")
    line(draw, (left + 1, ground - 1, right - 1, ground - 1), "#172431")
    line(draw, (left + 1, ground, right - 1, ground), "#58636a")

    draw.polygon([(outside, roof_top + 7), (left, roof_top), (right, roof_top),
                  (right + 2, roof_end), (left + 1, roof_end), (outside, roof_end - 7)], fill="#1a2735")
    roof_texture(draw, rng, left + 3, right - 3, roof_top + 4, roof_end - 4)
    line(draw, (left, roof_top, right, roof_top), "#68747b")
    line(draw, (outside, roof_top + 7, left, roof_top), "#6b787c")
    line(draw, (outside, roof_top + 8, outside, roof_end - 7, left, roof_end), "#4b5d69", 2)
    line(draw, (left - 1, roof_end, right, roof_end), "#667480", 3)
    line(draw, (left - 1, roof_end + 2, right, roof_end + 2), "#263544", 2)
    line(draw, (right, roof_top + 1, right, roof_end), "#5b6975")
    line(draw, (left + 3, roof_top + 2, right - 1, roof_top + 2), "#273744")

    if kind == "industrial":
        for gap in (left + 19, left + 65, left + 111):
            slab(draw, (gap - 3, roof_end + 6, gap + 36, ground - 1), "#283a48")
            draw.rectangle((gap, roof_end + 8, gap + 33, ground - 2), fill="#41505b")
            for y in range(roof_end + 10, ground - 2, 3):
                line(draw, (gap + 1, y, gap + 32, y), "#5c656b")
                line(draw, (gap + 1, y + 1, gap + 32, y + 1), "#334351")
            line(draw, (gap + 2, ground - 4, gap + 31, ground - 4), "#a5794e")
            for x in (gap - 3, gap + 36):
                draw.rectangle((x, ground - 8, x + 2, ground - 1), fill="#b48d5b")
                line(draw, (x, ground - 5, x + 2, ground - 4), "#24323b")
            draw.rectangle((gap + 13, roof_end + 4, gap + 19, roof_end + 5), fill="#dfae79")
        for x in (left + 19, left + 64, left + 108):
            slab(draw, (x, roof_top + 12, x + 28, roof_end - 9), "#374f5b", "#718084")
            line(draw, (x + 1, roof_top + 15, x + 27, roof_top + 15), "#637f88")
            for off in (7, 14, 21):
                line(draw, (x + off, roof_top + 12, x + off, roof_end - 9), "#222f3b")
        ac_unit(draw, right - 23, roof_top + 8, 13, 12)
        ac_unit(draw, left + 8, roof_top + 7, 8, 5)
        line(draw, (right - 5, roof_top + 22, right - 5, ground - 2), "#1c2733", 2)
        line(draw, (right - 6, roof_top + 22, right - 6, ground - 2), "#6e6866")
    elif kind == "corner":
        for order, x in enumerate((left + 10, left + 49, left + 100)):
            window(draw, x, roof_end + 8, 30, 13, order != 2)
            if order < 2:
                canopy(draw, x - 2, roof_end + 3, 34, 7, "#496e73" if order == 0 else "#99594c",
                       "#68898b" if order == 0 else "#be7760")
        slab(draw, (left + 83, roof_end + 7, left + 95, ground - 1), "#213b4c")
        window(draw, left + 84, roof_end + 8, 10, 9, True)
        draw.point((left + 93, ground - 4), fill="#cfae7d")
        for x, y, w, h in [(left + 10, roof_top + 11, 18, 8),
                           (left + 32, roof_top + 11, 15, 8),
                           (right - 56, roof_top + 13, 12, 6), (right - 35, roof_top + 15, 20, 11)]:
            ac_unit(draw, x, y, w, h)
        line(draw, (left + 17, roof_top + 23, left + 17, roof_end - 9,
                    right - 70, roof_end - 9, right - 70, roof_top + 14, right - 56, roof_top + 14),
             "#73818a", 2)
        line(draw, (left + 17, roof_end - 8, right - 69, roof_end - 8), "#263745")
        slab(draw, (left + 7, ground + 1, left + 16, ground + 6), "#545447", "#8d8460")
        for x in range(left + 8, left + 16, 2):
            line(draw, (x, ground + 2, x + 1, ground), "#65736d")
    else:
        for floor, y in enumerate((roof_end + 8, roof_end + 22, roof_end + 36)):
            for i, x in enumerate(range(left + 10, right - 11, 23)):
                window(draw, x, y, 13, 7, (i * 3 + floor * 2) % 7 < 3)
                if (i + floor) % 3 == 0:
                    slab(draw, (x - 1, y + 8, x + 14, y + 11), "#3b4d58", "#60727b")
                    for post in (x, x + 4, x + 8, x + 12):
                        line(draw, (post, y + 8, post, y + 10), "#162534")
            line(draw, (left + 3, y + 13, right - 2, y + 13), "#293845")
        slab(draw, (left + 63, roof_end + 35, left + 80, ground), "#2e495a", "#667e85")
        line(draw, (left + 65, roof_end + 37, left + 78, roof_end + 37), "#b88463")
        line(draw, (left + 73, roof_end + 38, left + 73, ground - 1), "#1c2c3d")
        draw.point((left + 76, ground - 6), fill="#d2ae7e")
        canopy(draw, left + 60, roof_end + 35, 23, 7, "#844f48", "#a06b52")
        for x in (left + 8, left + 32, right - 38):
            ac_unit(draw, x, roof_top + 13 + (x % 5), 15, 12)
        slab(draw, (left + 64, roof_top + 11, left + 103, roof_end - 12), "#374955", "#6b7880")
        slab(draw, (left + 70, roof_top + 14, left + 98, roof_end - 16), "#455b64", "#586d75")
        draw.rectangle((left + 78, roof_end - 17, left + 91, roof_end - 12), fill="#273846")
        line(draw, (left + 96, roof_top + 8, left + 96, roof_top - 10), "#7d8486")
        line(draw, (left + 90, roof_top - 5, left + 102, roof_top - 5), "#818488")
        line(draw, (left + 92, roof_top - 8, left + 92, roof_top - 3), "#707e82")
        line(draw, (left + 99, roof_top - 8, left + 99, roof_top - 3), "#707e82")
        draw.point((left + 96, roof_top - 10), fill="#cb6c55")
    canvas.save(ART / f"building-{kind}.png", optimize=True)


def tree(draw):
    draw.ellipse((9, 47, 54, 60), fill="#0a1420b0")
    for x, y in ((31, 49), (34, 47), (37, 48)):
        line(draw, (x, 55, x, y - 24), "#61514c", 2)
    draw.polygon([(16,21),(21,15),(24,8),(35,6),(42,12),(42,17),(50,20),(53,28),
                  (48,35),(49,41),(41,49),(33,48),(28,52),(21,46),(14,45),(10,36),
                  (13,31),(11,26)], fill="#1d353b")
    rng = Random(9)
    for _ in range(125):
        x, y = rng.randrange(14, 49), rng.randrange(9, 48)
        if ((x - 31) / 18) ** 2 + ((y - 28) / 18) ** 2 < 1:
            color = rng.choice(("#354d4d", "#41605c", "#294649", "#263f46", "#597361"))
            line(draw, (x, y, x + rng.choice((0, 1, 2, 3)), y), color)
    line(draw, (31, 54, 32, 49, 33, 46), "#7b6860")


def container(draw):
    draw.rectangle((7, 29, 61, 52), fill="#111c27b0")
    draw.polygon([(2,24),(10,18),(59,18),(61,24),(61,43),(12,43),(2,37)], fill="#263748")
    slab(draw, (11,18,59,29), "#397273", "#608a84", "#254852")
    slab(draw, (11,29,59,43), "#2b555c", "#698581", "#16333e")
    for x in range(14, 58, 3):
        line(draw, (x, 20, x, 28), "#4d7b7c")
        line(draw, (x, 31, x, 41), "#25454f")
    for x in range(15, 58, 3):
        line(draw, (x, 32, x, 41), "#46666d")
    line(draw, (2,24,10,18,10,41,2,37,2,24), "#4d6c73")
    line(draw, (4,26,4,36,7,38,7,23), "#6f8586")
    line(draw, (8,25,8,39), "#172f3b")
    draw.rectangle((48,33,56,36), fill="#b49964")
    line(draw, (49,35,55,35), "#7b694f")


def pump(draw):
    draw.ellipse((10, 54, 59, 61), fill="#0a1420a0")
    slab(draw, (7, 50, 53, 57), "#45515b", "#7c8584")
    for x in (14, 35):
        draw.polygon([(x,51),(x,21),(x+3,16),(x+14,16),(x+17,21),(x+17,52)], fill="#1f2936")
        slab(draw, (x + 2, 20, x + 14, 51), "#77716e", "#9e9589")
        draw.rectangle((x + 3, 22, x + 13, 26), fill="#b35349")
        draw.rectangle((x + 4, 28, x + 12, 37), fill="#203d49")
        line(draw, (x + 5, 30, x + 11, 30), "#69a498")
        line(draw, (x + 7, 32, x + 11, 32), "#c6ba87")
        line(draw, (x + 14, 39, x + 17, 45, x + 16, 49, x + 13, 48), "#101f2a", 2)
    line(draw, (13, 57, 49, 57), "#685944")


def barrier(draw):
    draw.ellipse((5, 46, 60, 56), fill="#0a1420a0")
    for offset in (0, 27):
        x = 8 + offset
        draw.polygon([(x,46),(x+2,43),(x+4,33),(x+17,33),(x+19,43),(x+21,46)],
                     fill="#899385")
        draw.rectangle((x + 4, 37, x + 17, 39), fill="#683b34")
        line(draw, (x + 5, 35, x + 17, 35), "#aab0a0")
        for rel in (7, 13):
            line(draw, (x + rel, 39, x + rel + 2, 37), "#b96050")
        line(draw, (x + 2, 45, x + 19, 45), "#515a56")


def city_props():
    sheet = Image.new("RGBA", (256, 64))
    for index, render in enumerate((tree, container, pump, barrier)):
        prop = Image.new("RGBA", (64, 64))
        render(ImageDraw.Draw(prop))
        sheet.paste(prop, (index * 64, 0))
    sheet.save(ART / "city-props.png", optimize=True)


def main():
    ART.mkdir(parents=True, exist_ok=True)
    for kind in ("industrial", "corner", "apartments"):
        building(kind)
    city_props()


if __name__ == "__main__":
    main()
