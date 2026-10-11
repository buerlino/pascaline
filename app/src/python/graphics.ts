// SPDX-License-Identifier: GPL-3.0-or-later
// The Python graphics modules, as source written into MicroPython's /lib at start (see pyHost.ts).
// Both turn calls into GfxCmd tuples (types.ts) on the 320x240 screen: integer pixels, origin top-left,
// y down, colours 0xRRGGBB. The canvas starts white; a run doesn't clear it; Cancel keeps what was drawn.
//
// - `draw`: our own API.
// - the compatibility module: the Python graphics API of the reference calculator, written from public
//   descriptions in our own words. Only its module name is fixed by compatibility. Its function names
//   and argument orders are `assumed` until checked on a G2 (tests/golden/g2.yaml items 26-28).

/** Python module name needed for compatibility with scripts written for the reference calculator. */
export const COMPAT_MODULE = "hpprime";

export const DRAW_PY = `# draw: graphics on the 320x240 screen (origin top-left, y down, colours 0xRRGGBB)
from _gfx import c as _c

WIDTH = 320
HEIGHT = 240
BLACK = 0x000000
WHITE = 0xFFFFFF
RED = 0xFF0000
GREEN = 0x00FF00
BLUE = 0x0000FF

def _n(v):
    return int(round(v)) if isinstance(v, float) else int(v)

def _col(c):
    return int(c) & 0xFFFFFF

def rgb(r, g, b):
    """A colour from red, green and blue (0-255 each)."""
    return ((int(r) & 255) << 16) | ((int(g) & 255) << 8) | (int(b) & 255)

def clear(color=WHITE):
    _c("clear", _col(color))

def pixel(x, y, color=BLACK):
    _c("pixel", _n(x), _n(y), _col(color))

def line(x1, y1, x2, y2, color=BLACK):
    _c("line", _n(x1), _n(y1), _n(x2), _n(y2), _col(color))

def rect(x, y, w, h, color=BLACK):
    """The outline of a w x h rectangle with its top-left corner at (x, y)."""
    _c("rect", _n(x), _n(y), _n(w), _n(h), _col(color))

def fill_rect(x, y, w, h, color=BLACK):
    _c("fillrect", _n(x), _n(y), _n(w), _n(h), _col(color))

def circle(x, y, r, color=BLACK):
    _c("circle", _n(x), _n(y), _n(r), _col(color))

def fill_circle(x, y, r, color=BLACK):
    _c("fillcircle", _n(x), _n(y), _n(r), _col(color))

def text(x, y, s, color=BLACK, size="medium"):
    """Text with its top-left corner at (x, y); size is "small", "medium" or "large"."""
    if size not in ("small", "medium", "large"):
        raise ValueError("size must be 'small', 'medium' or 'large'")
    _c("text", _n(x), _n(y), str(s), _col(color), size)

def show():
    """Send what was drawn so far to the screen now (it is also sent on its own while a script runs)."""
    _c("show")
`;

export const COMPAT_PY = `# Compatibility with the reference calculator's Python graphics module (assumed API, screen G0 only)
import draw as _d

def _g(g):
    if g != 0:
        raise ValueError("only the screen (G0) is supported")

def pixon(g, x, y, color=0):
    _g(g)
    _d.pixel(x, y, color)

def line(g, x1, y1, x2, y2, color=0):
    _g(g)
    _d.line(x1, y1, x2, y2, color)

def rect(g, x, y, w, h, edgecolor=0, fillcolor=None):
    _g(g)
    if fillcolor is not None:
        _d.fill_rect(x, y, w, h, fillcolor)
    _d.rect(x, y, w, h, edgecolor)

def fillrect(g, x, y, w, h, edgecolor=0, fillcolor=0):
    _g(g)
    _d.fill_rect(x, y, w, h, fillcolor)
    _d.rect(x, y, w, h, edgecolor)

def circle(g, x, y, r, color=0):
    _g(g)
    _d.circle(x, y, r, color)

def fillcircle(g, x, y, r, edgecolor=0, fillcolor=None):
    _g(g)
    _d.fill_circle(x, y, r, edgecolor if fillcolor is None else fillcolor)
    _d.circle(x, y, r, edgecolor)

def textout(g, x, y, s, color=0):
    _g(g)
    _d.text(x, y, s, color)

def eval(expr):
    import calc
    return calc.cas(expr)
`;
