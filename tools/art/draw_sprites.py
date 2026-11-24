"""Author the game's original car, character and city sprite PNGs with Pillow."""
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw

ART = Path(__file__).resolve().parents[2] / "public" / "art"


@dataclass(frozen=True)
class Model:
    shape: str
    left: int
    top: int
    right: int
    bottom: int
    rear_axle: int
    front_axle: int
    glass_start: int
    roof_start: int
    roof_end: int
    glass_end: int
    paint: tuple[int, int, int]


MODELS = [
    Model("coupe", 5, 6, 58, 25, 15, 47, 19, 23, 34, 40, (183, 68, 53)),
    Model("hatch", 8, 6, 55, 25, 16, 46, 11, 15, 33, 39, (66, 143, 138)),
    Model("sedan", 4, 7, 60, 24, 14, 49, 16, 22, 35, 42, (119, 135, 162)),
    Model("wagon", 3, 6, 61, 25, 14, 49, 8, 14, 35, 42, (172, 127, 68)),
    Model("pickup", 4, 5, 60, 26, 15, 50, 26, 29, 37, 43, (124, 102, 152)),
    Model("roadster", 8, 7, 56, 24, 16, 47, 21, 24, 33, 39, (76, 128, 95)),
    Model("rally", 6, 5, 59, 26, 16, 49, 17, 21, 35, 42, (87, 119, 181)),
    Model("muscle", 3, 5, 61, 26, 14, 50, 14, 21, 33, 41, (196, 97, 57)),
    Model("super", 3, 5, 61, 26, 14, 51, 18, 25, 37, 47, (144, 74, 154)),
    Model("track", 5, 5, 60, 26, 15, 49, 17, 23, 36, 43, (70, 150, 127)),
    Model("gt", 3, 5, 60, 26, 13, 50, 13, 21, 35, 45, (176, 79, 88)),
    Model("prototype", 2, 5, 61, 26, 14, 51, 21, 26, 38, 49, (175, 155, 105)),
]


def tone(color, factor):
    if factor < 179:
        return tuple(round(channel * factor / 179) for channel in color)
    return tuple(round(channel + (255 - channel) * (factor - 179) / 76) for channel in color)


def draw_vehicle(index, model):
    canvas = Image.new("RGBA", (64, 32))
    mask = Image.new("RGBA", canvas.size)
    pen = ImageDraw.Draw(canvas)
    stencil = ImageDraw.Draw(mask)
    left, top, right, bottom = model.left, model.top, model.right, model.bottom
    y = 15
    for x in (model.rear_axle, model.front_axle):
        for upper in (True, False):
            tread = top - 2 if upper else bottom - 4
            pen.rectangle((x - 4, tread, x + 4, tread + 6), "#0a131c")
            pen.line((x - 3, tread + 1, x + 3, tread + 1), fill="#273846")
            for groove in (-2, 0, 2):
                pen.line((x + groove, tread + 3, x + groove, tread + 5), fill="#17232f")
            lip = tread if upper else tread + 6
            pen.line((x - 2, lip, x + 2, lip), fill="#697782")

    tapered = model.shape in ("roadster", "super", "prototype", "gt")
    blunt = 2 if tapered else 1
    rear_shoulder = 4 if tapered else 2
    front_shoulder = 8 if tapered else 4
    hull = [
        (left, top + 3), (left + rear_shoulder, top), (right - front_shoulder, top),
        (right - blunt, top + 2), (right, top + (6 if tapered else 4)),
        (right, bottom - (6 if tapered else 4)), (right - blunt, bottom - 2),
        (right - front_shoulder, bottom), (left + rear_shoulder, bottom), (left, bottom - 3),
    ]
    pen.polygon(hull, "#060d18")
    def paint(method, geometry, factor, width=1):
        args = {"fill": tone(model.paint, factor)}
        mask_args = {"fill": (factor, factor, factor, 255)}
        if method == "line":
            args["width"] = width
            mask_args["width"] = width
        getattr(pen, method)(geometry, **args)
        getattr(stencil, method)(geometry, **mask_args)

    inner = [(px + (1 if px < 30 else -1), py + (1 if py < y else -1)) for px, py in hull]
    paint("polygon", inner, 155)
    paint("polygon", [(left + 2,top+4),(left+5,top+1),(right-7,top+1),
                      (right-2,top+4),(right-3,bottom-5),(right-8,bottom-3),
                      (left+5,bottom-3),(left+2,bottom-5)], 179)
    paint("line", (left + 4, top + 2, right - 7, top + 2), 231)
    paint("line", (left + 4, bottom - 2, right - 7, bottom - 2), 88)
    paint("line", (left + 2, top + 5, left + 2, bottom - 5), 107)
    paint("line", (right - 4, top + 6, right - 4, bottom - 6), 208)
    paint("line", (left + 5, top + 4, left + 6, top + 4), 242)
    paint("line", (right - 10, top + 4, right - 6, top + 4), 242)
    paint("line", (right - 10, bottom - 4, right - 6, bottom - 4), 196)
    for x in (model.rear_axle, model.front_axle):
        paint("line", (x - 3, top + 1, x + 2, top + 1), 216)
        paint("line", (x - 3, bottom - 1, x + 2, bottom - 1), 103)

    def detail(method, geometry, color, width=1):
        args = {"fill": color}
        mask_args = {"fill": (0, 0, 0, 0)}
        if method == "line":
            args["width"] = width
            mask_args["width"] = width
        getattr(pen, method)(geometry, **args)
        getattr(stencil, method)(geometry, **mask_args)

    glass0, roof0, roof1, glass1 = model.glass_start, model.roof_start, model.roof_end, model.glass_end
    hood_top, hood_bottom = top + 4, bottom - 4
    if model.shape == "pickup":
        detail("rectangle", (left + 4, hood_top, glass0 - 2, hood_bottom), "#101d29")
        detail("rectangle", (left + 5, hood_top + 1, glass0 - 3, hood_bottom - 1), "#334450")
        for row in range(hood_top + 2, hood_bottom, 3):
            detail("line", (left + 6, row, glass0 - 5, row), "#53616c")
            detail("line", (left + 6, row + 1, glass0 - 5, row + 1), "#293843")
        detail("line", (left + 6, hood_bottom - 2, left + 6, hood_top + 2), "#74818a")

    if model.shape in ("prototype", "super"):
        hood_top += 2
        hood_bottom -= 2
        for px in (left + 8, right - 12):
            detail("line", (px, top + 5, px + 4, top + 5), "#273a48", 2)
            detail("line", (px, bottom - 5, px + 4, bottom - 5), "#162430", 2)
        detail("line", (glass1 + 2, y, right - 7, y), "#233640")
        paint("line", (glass1 + 3, y + 1, right - 8, y + 1), 214)
    elif model.shape != "pickup":
        paint("line", (glass1 + 1, hood_top + 1, right - 6, hood_top + 1), 132)
        paint("line", (glass1 + 1, hood_bottom - 1, right - 6, hood_bottom - 1), 122)

    if model.shape in ("rally", "muscle", "gt"):
        for row in (y - 2, y - 1, y + 1, y + 2):
            detail("line", (glass1, row, right - 5, row), "#cacbc1" if index != 7 else "#342e36")
    if model.shape in ("super", "gt", "track", "prototype", "rally"):
        detail("line", (left + 3, top + 2, left + 3, bottom - 2), "#102030", 3)
        detail("line", (left + 2, top + 2, left + 2, bottom - 2), "#6d7d84")
        detail("point", (left + 3, top + 2), "#b4c6c5")

    cabin = [(glass0, y - 5), (roof0 - 1, hood_top - 1), (roof1 + 1, hood_top - 1),
             (glass1, y - 4), (glass1, y + 5), (roof1 + 1, hood_bottom + 1),
             (roof0 - 1, hood_bottom + 1), (glass0, y + 6)]
    detail("polygon", cabin, "#102131")
    detail("polygon", [(roof1, hood_top), (glass1 - 1, y - 4), (glass1 - 1, y + 5),
                       (roof1, hood_bottom)], "#366171")
    detail("line", (glass1 - 2, y - 4, glass1 - 2, y + 4), "#678a96")
    detail("line", (roof1, hood_top + 1, glass1 - 2, hood_top + 4), "#81a5a7")
    detail("line", (roof1 + 1, hood_bottom - 2, glass1 - 2, hood_bottom - 4), "#233b4e")

    detail("polygon", [(glass0 + 1, y - 5), (roof0, hood_top), (roof0, hood_bottom),
                       (glass0 + 1, y + 5)], "#274553")
    detail("line", (glass0 + 2, y - 4, glass0 + 2, y + 3), "#496a79")
    if model.shape == "roadster":
        detail("rectangle", (roof0 - 1, y - 5, roof1, y + 6), "#111c26")
        for row in (y - 4, y + 2):
            detail("rectangle", (roof0, row, roof0 + 2, row + 2), "#9c6b52")
            detail("line", (roof0 + 3, row, roof1 - 2, row + 2), "#674c42", 2)
            detail("line", (roof0, row, roof0 + 2, row), "#ae8c73")
        detail("line", (roof1 - 1, y - 2, roof1 - 1, y - 1), "#a8b9b3")
    else:
        paint("polygon", [(roof0 + 1, hood_top + 2), (roof1 - 2, hood_top + 2),
                          (roof1 - 1, hood_bottom - 2), (roof0 + 1, hood_bottom - 2)], 194)
        paint("line", (roof0 + 2, hood_top + 2, roof1 - 2, hood_top + 2), 231)
        paint("line", (roof0 + 2, hood_bottom - 2, roof1 - 2, hood_bottom - 2), 134)
        detail("line", (roof0 + 1, hood_top, roof1 - 2, hood_top), "#5b7783")
        detail("line", (roof0 + 1, hood_bottom, roof1 - 2, hood_bottom), "#324d63")
        if model.shape in ("super", "prototype", "track"):
            detail("rectangle", (roof0 + 2, y - 2, roof1 - 2, y + 2), "#2d4351")
            detail("line", (roof0 + 2, y - 2, roof1 - 2, y - 2), "#62838c")

    for py in (top + 4, bottom - 4):
        detail("line", (glass1 - 6, py, glass1 - 4, py), "#293643")
        detail("point", (glass1 - 4, py), "#95a5a6")
    for py in (top, bottom):
        detail("rectangle", (glass1 - 4, py - 1, glass1 - 2, py + 1), "#14232e")
        paint("line", (glass1 - 4, py, glass1 - 2, py), 160)
    # Lamps and bumper are kept off the body-only tint mask.
    head_bounds = top + (4 if tapered else 3), bottom - (4 if tapered else 3)
    for py in head_bounds:
        lamp = [(right - 4,py - 1), (right - 1,py), (right - 1,py + 2), (right - 4,py + 1)]
        if py > y:
            lamp = [(px, 2 * py - oy) for px, oy in lamp]
        detail("polygon", lamp, "#98c1c4")
        detail("line", (right - 3, py, right - 1, py), "#fff1c5")
        detail("point", (right - 2, py + (1 if py < y else -1)), "#f8d08f")
    detail("line", (right - 1, y - 3, right - 1, y + 4), "#0d1923")
    detail("point", (right - 2, y), "#b7a77f")
    tail_y = top + 4, bottom - 4
    for py in tail_y:
        detail("line", (left + 1, py - 1, left + 1, py + 1), "#da4b47")
        detail("point", (left + 1, py), "#ff927e")
    detail("line", (left + 1, y - 3, left + 1, y + 3), "#2b3640")
    detail("line", (left + 1, y - 1, left + 1, y + 1), "#c4b9a5")
    detail("point", (left + 1, bottom - 6), "#87919b")

    canvas.save(ART / f"car-{index:02}.png", optimize=True)
    mask.save(ART / f"car-mask-{index:02}.png", optimize=True)


def draw_character(direction, frame):
    canvas = Image.new("RGBA", (16, 24))
    draw = ImageDraw.Draw(canvas)
    jacket = "#a44432"
    highlights = "#d4734f"
    inside = "#71392f"
    dark = "#182133"
    hair = "#1b2230"
    hair_light = "#513c3b"
    skin = "#c19778"
    skin_shadow = "#916653"
    denim = "#3a4656"
    denim_lit = "#58606c"
    sole = "#909697"
    stride = [0, -2, 0, 2][frame]
    bob = [0, 0, 1, 0][frame]
    head_y = 2 + bob
    draw.ellipse((2, 19, 13, 23), "#11172367")
    if direction in ("up", "down"):
        front = direction == "down"
        for leg, side in ((5, -1), (8, 1)):
            step = side * stride
            draw.polygon([(leg, 14), (leg + 2, 14), (leg + 2, 20 + step),
                          (leg, 21 + step)], "#202838")
            draw.line((leg + (1 if front else 0), 16, leg + (1 if front else 0), 19 + step),
                      fill=denim_lit if front else denim)
            draw.rectangle((leg - 1, 20 + step, leg + 2, 21 + step), dark)
            draw.line((leg - 1, 21 + step, leg + 1, 21 + step), fill=sole)
        for arm, side in ((3, -1), (12, 1)):
            shift = -side * stride
            draw.line((arm, 9 + bob, arm, 14 + shift), fill=inside, width=2)
            draw.point((arm, 15 + shift), fill=skin_shadow if front else skin)
        draw.polygon([(5,8+bob),(10,8+bob),(12,10+bob),(11,15+bob),(4,15+bob),
                      (3,10+bob)], inside)
        draw.polygon([(5,9+bob),(10,9+bob),(11,11+bob),(10,14+bob),(5,14+bob),
                      (4,11+bob)], jacket)
        draw.line((5, 10 + bob, 10, 10 + bob), fill=highlights)
        draw.line((5, 15 + bob, 10, 15 + bob), fill=dark)
        if front:
            draw.line((7, 10 + bob, 7, 14 + bob), fill="#382e35")
            draw.point((8, 11 + bob), fill="#e2b895")
            draw.line((9, 13 + bob, 10, 13 + bob), fill="#6d3930")
        else:
            draw.line((5, 13 + bob, 10, 13 + bob), fill="#7d3f36")
            draw.rectangle((7, 11 + bob, 8, 12 + bob), fill="#9c875b")
        draw.polygon([(5,head_y),(9,head_y),(11,head_y+2),(11,head_y+5),
                      (9,head_y+7),(6,head_y+7),(4,head_y+5),(4,head_y+2)], hair)
        draw.line((6, head_y + 1, 9, head_y + 1), fill=hair_light)
        if front:
            draw.rectangle((5, head_y + 3, 10, head_y + 6), fill=skin)
            draw.line((5, head_y + 3, 6, head_y + 3), fill=hair)
            draw.point((9, head_y + 4), fill=hair)
            draw.point((6, head_y + 4), fill=hair)
            draw.point((7, head_y + 6), fill=skin_shadow)
        else:
            draw.line((6, head_y + 5, 9, head_y + 5), fill="#38313b")
            draw.line((6, head_y + 7, 9, head_y + 7), fill=skin_shadow)
    else:
        draw.polygon([(6,14),(9,14),(9-stride,20),(6-stride,20)], dark)
        draw.line((6-stride, 20, 9-stride, 21), fill="#5d656d")
        draw.polygon([(7,14),(10,14),(10+stride,19),(10+stride,21),(7+stride,21)], denim)
        draw.line((8, 16, 8 + stride, 19), fill=denim_lit)
        draw.line((7 + stride, 21, 11 + stride, 21), fill=dark, width=2)
        draw.line((8 + stride, 22, 11 + stride, 22), fill=sole)
        draw.polygon([(6,8+bob),(9,8+bob),(11,11+bob),(10,15+bob),
                      (5,15+bob),(4,12+bob)], jacket)
        draw.line((5, 11+bob, 6, 9+bob, 9, 9+bob), fill=highlights)
        draw.line((5, 15+bob, 10, 15+bob), fill=inside)
        draw.line((6, 11 + bob, 7 - stride, 14), fill=inside, width=2)
        draw.point((7 - stride, 15), fill=skin)
        draw.polygon([(6,head_y),(9,head_y),(11,head_y+2),(11,head_y+5),
                      (10,head_y+7),(7,head_y+7),(5,head_y+5),(5,head_y+2)], hair)
        draw.line((6, head_y + 1, 9, head_y + 1), fill=hair_light)
        draw.polygon([(9, head_y + 3),(11, head_y + 3),(12, head_y + 5),
                      (11, head_y + 6),(10, head_y + 7),(8, head_y + 6)], skin)
        draw.point((10, head_y + 4), fill=hair)
        draw.point((8, head_y + 5), fill=skin_shadow)
        if direction == "left":
            canvas = canvas.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    return canvas


def draw_character_sheet():
    sheet = Image.new("RGBA", (64, 96))
    for row, direction in enumerate(("down", "left", "right", "up")):
        for frame in range(4):
            sheet.paste(draw_character(direction, frame), (frame * 16, row * 24))
    sheet.save(ART / "protagonist.png", optimize=True)


def main():
    ART.mkdir(parents=True, exist_ok=True)
    for index, model in enumerate(MODELS):
        draw_vehicle(index, model)
    draw_character_sheet()


if __name__ == "__main__":
    main()
