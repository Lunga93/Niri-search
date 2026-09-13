#!/usr/bin/env python3
"""Generate a seamless tileable frost-grain noise PNG for Look's glass effect.

The texture is layered over glass surfaces with `mix-blend-mode: overlay`
to add the microscopic grain that plain Gaussian blur lacks (real frosted
glass is etched, not smeared).

Construction: periodic value-noise octaves at 16/32/64/128 lattice cells.
Every octave wraps its lattice, so the 256x256 tile is seamless by
construction. Output is white RGB with the noise carried in the alpha
channel; mid-gray alpha (~128) is neutral under `overlay`, lighter/darker
specks brighten/darken.

Usage:
    python3 scripts/generate-frost-noise.py [--out PATH] [--size N] [--seed N]

Requires: Pillow (pip install pillow)
"""

import argparse
import random
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("error: Pillow is required (pip install pillow)")


def smooth(t: float) -> float:
    """Smoothstep: zero derivative at 0 and 1, so wrapped edges stay C1."""
    return t * t * (3.0 - 2.0 * t)


def periodic_octave(size: int, cells: int, rng: random.Random) -> "Image.Image":
    """One octave of periodic value noise, seamless by construction.

    The lattice wraps mod `cells`, so pixel (size-1) interpolates toward the
    same lattice value that pixel 0 starts from, and smoothstep kills the
    derivative at both ends. Tiling the output is therefore C1-continuous.
    """
    lattice = [rng.random() for _ in range(cells * cells)]

    def at(ix: int, iy: int) -> float:
        return lattice[(iy % cells) * cells + (ix % cells)]

    img = Image.new("L", (size, size))
    px = img.load()
    scale = cells / size
    for y in range(size):
        gy = y * scale
        y0 = int(gy)
        ty = smooth(gy - y0)
        for x in range(size):
            gx = x * scale
            x0 = int(gx)
            tx = smooth(gx - x0)
            a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx
            b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx
            px[x, y] = int((a + (b - a) * ty) * 255)
    return img


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", default="apps/linows/src/assets/frost-noise.png")
    ap.add_argument("--size", type=int, default=256)
    ap.add_argument("--seed", type=int, default=1337)
    args = ap.parse_args()

    size = args.size
    rng = random.Random(args.seed)

    # (lattice cells, blend weight). Higher octaves weighted up so the
    # spectrum stays grainy instead of blobby.
    layers = [(16, 0.15), (32, 0.25), (64, 0.35), (128, 0.25)]

    acc = None
    for cells, weight in layers:
        layer = periodic_octave(size, cells, rng)
        acc = layer if acc is None else Image.blend(acc, layer, weight)

    # Soften single-pixel harshness (replicate-edge blur preserves the seam).
    # NOTE: no GaussianBlur here on purpose. Pillow's blur replicates edge
    # pixels instead of wrapping, which would break the periodic seam the
    # octaves guarantee. The bilerp+smoothstep octaves are already smooth.

    # Gentle S-curve around mid-gray to keep the grain visible after averaging.
    acc = acc.point(lambda v: min(255, max(0, int(128 + (v - 128) * 1.35))))

    rgba = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    rgba.putalpha(acc)
    rgba.save(args.out)
    print(f"wrote {args.out} ({size}x{size} RGBA)")

    # --- verification ---
    px = acc.load()
    n = size * size
    mean = sum(px[x, y] for y in range(size) for x in range(size)) / n
    var = sum((px[x, y] - mean) ** 2 for y in range(size) for x in range(size)) / n
    print(f"alpha mean={mean:.1f} std={var ** 0.5:.1f} (want ~128 / 25-45)")

    # Seamlessness in the sampled sense: the tile is a uniform sampling of a
    # periodic function, so tiling continues the sampling. The gate is that a
    # tile boundary introduces no step larger than steps already inside the
    # tile (demanding edge pixels be *equal* would force a stalled column).
    t2 = Image.new("L", (size * 2, size * 2))
    for y in (0, size):
        for x in (0, size):
            t2.paste(acc, (x, y))
    tp = t2.load()
    W = H = size * 2

    def hstep(x: int, y: int) -> int:
        return abs(tp[x, y] - tp[(x + 1) % W, y])

    def vstep(x: int, y: int) -> int:
        return abs(tp[x, y] - tp[x, (y + 1) % H])

    bnd_h = max(hstep(size - 1, y) for y in range(H))
    int_h = max(hstep(x, y) for y in range(H) for x in range(W) if x % size != size - 1)
    bnd_v = max(vstep(x, size - 1) for x in range(W))
    int_v = max(vstep(x, y) for y in range(H) for x in range(W) if y % size != size - 1)
    print(f"horizontal: boundary step max={bnd_h} interior step max={int_h}")
    print(f"vertical:   boundary step max={bnd_v} interior step max={int_v}")
    assert bnd_h <= int_h and bnd_v <= int_v, "tile boundary introduces a seam!"


if __name__ == "__main__":
    main()
