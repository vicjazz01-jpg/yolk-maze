"""用 Pillow 產生三種尺寸的蛋黃大冒險圖示。"""

from pathlib import Path

from PIL import Image, ImageDraw


SUPERSAMPLE = 3
SIDE = 512
SIZE = SIDE * SUPERSAMPLE


def coords(values):
    return tuple(round(value * SUPERSAMPLE) for value in values)


def get_icon():
    image = Image.new("RGB", (SIZE, SIZE))
    draw = ImageDraw.Draw(image)

    for y in range(SIZE):
        amount = y / (SIZE - 1)
        top = (255, 248, 229)
        bottom = (246, 216, 163)
        color = tuple(round(a + (b - a) * amount) for a, b in zip(top, bottom))
        draw.line((0, y, SIZE, y), fill=color)

    def ellipse(box, color, outline=None, width=1):
        draw.ellipse(coords(box), fill=color, outline=outline, width=round(width * SUPERSAMPLE))

    def rounded(box, radius, color, outline=None, width=1):
        draw.rounded_rectangle(
            coords(box), radius=round(radius * SUPERSAMPLE),
            fill=color, outline=outline, width=round(width * SUPERSAMPLE),
        )

    def shine(x, y, size, color):
        points = [
            (x, y - size), (x + size * .25, y - size * .25), (x + size, y),
            (x + size * .25, y + size * .25), (x, y + size),
            (x - size * .25, y + size * .25), (x - size, y),
            (x - size * .25, y - size * .25),
        ]
        draw.polygon([coords(point) for point in points], fill=color)

    rounded((38, 38, 474, 474), 104, "#ffe6b1", "#efd29a", 2)
    rounded((49, 49, 463, 463), 94, "#fff0ca", "#fff7df", 3)
    ellipse((107, 99, 405, 404), "#ffebba")
    shine(118, 126, 20, "#e2a957")
    shine(390, 109, 12, "#dba05c")
    shine(411, 154, 19, "#e8b863")
    shine(100, 365, 12, "#eaba72")

    ellipse((134, 364, 378, 401), "#e7c58c")
    ellipse((174, 346, 230, 384), "#d78233", "#a8662e", 4)
    ellipse((282, 346, 338, 384), "#d78233", "#a8662e", 4)
    ellipse((120, 248, 196, 333), "#ffca49", "#a46b2d", 5)
    ellipse((316, 248, 392, 333), "#ffca49", "#a46b2d", 5)
    ellipse((126, 103, 386, 363), "#ffb93a", "#a46b2d", 6)
    ellipse((136, 111, 376, 345), "#ffd458")
    ellipse((152, 130, 347, 285), "#ffdb66")
    ellipse((173, 145, 231, 171), "#ffefaa")
    ellipse((229, 139, 251, 150), "#ffefaa")

    ellipse((198, 216, 222, 245), "#452c25")
    ellipse((290, 216, 314, 245), "#452c25")
    ellipse((204, 220, 211, 227), "#fff2ca")
    ellipse((296, 220, 303, 227), "#fff2ca")
    ellipse((177, 251, 209, 267), "#eea04e")
    ellipse((303, 251, 335, 267), "#eea04e")
    draw.polygon(
        [coords(point) for point in [(226, 252), (237, 244), (275, 244), (286, 252), (257, 276)]],
        fill="#dc7a2d",
    )
    ellipse((237, 244, 275, 255), "#ed9137")
    return image


def main():
    folder = Path(__file__).resolve().parent / "icons"
    folder.mkdir(exist_ok=True)
    art = get_icon()
    for side, name in [(180, "apple-touch-icon.png"), (192, "icon-192.png"), (512, "icon-512.png")]:
        art.resize((side, side), Image.Resampling.LANCZOS).save(folder / name, optimize=True)


if __name__ == "__main__":
    main()
