"""
Remove solid background from logo PNG. Makes pixels matching the background color transparent.
Usage: python scripts/remove_logo_bg.py <input.png> <output.png>
"""
import sys

try:
    from PIL import Image
except ImportError:
    print("Pillow kerak: pip install Pillow")
    sys.exit(1)


def remove_background(input_path: str, output_path: str, tolerance: int = 30) -> None:
    img = Image.open(input_path).convert("RGBA")
    data = list(img.getdata())
    # Background: use top-left corner color as reference (dark blue)
    ref = data[0][:3]
    new_data = []
    for item in data:
        r, g, b, a = item
        if (
            abs(r - ref[0]) <= tolerance
            and abs(g - ref[1]) <= tolerance
            and abs(b - ref[2]) <= tolerance
        ):
            new_data.append((r, g, b, 0))
        else:
            new_data.append(item)
    img.putdata(new_data)
    img.save(output_path, "PNG")
    print(f"Saqlandi: {output_path}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Ishlatish: python remove_logo_bg.py <kirish.png> <chiqish.png>")
        sys.exit(1)
    remove_background(sys.argv[1], sys.argv[2], tolerance=40)
