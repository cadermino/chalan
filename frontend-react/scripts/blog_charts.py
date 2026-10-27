"""Genera los gráficos SVG del estudio de precios (datos de 2026-10-27).

Imágenes estáticas para el blog: fondo claro propio y la marca adentro, para
que viajen con la fuente si alguien las copia. Los datos van también en el texto
de cada post. Los montos de precio llevan la comisión de Chalán.

Cada gráfico sale en dos tamaños: el ancho (720 px) y uno angosto para celular
(`-movil`, 400 px), porque a 720 px las etiquetas quedan ilegibles en un
teléfono. El post los pone en un <picture>.

Para actualizarlos, cambiar los números de abajo y correr:
    python3 scripts/blog_charts.py public/blog/graficos
"""
import os
import sys

FONT = "Inter, 'Inter Tight', -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
INK, INK2, MUTED = "#0f172a", "#475569", "#64748b"
GRID, SURFACE = "#e2e8f0", "#ffffff"
ACCENT, ACCENT_SOFT, TRACK = "#4f46e5", "#818cf8", "#e0e7ff"
QUOTES = "Fuente: cotizaciones recibidas en Chalán. Abril–octubre 2026."
PRICES = QUOTES + " Precio final, con todo incluido."
DECLINES = "Fuente: avisos de transportistas en Chalán. 2026."

WIDE = {"w": 720, "pad": 32, "title": 22, "sub": 14, "label": 15, "small": 13, "foot": 12}
NARROW = {"w": 400, "pad": 20, "title": 20, "sub": 14, "label": 15, "small": 13, "foot": 12}


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def text(x, y, s, size, fill=INK2, weight=400, anchor="start"):
    return (f'<text x="{x:g}" y="{y:g}" font-size="{size}" fill="{fill}" font-weight="{weight}" '
            f'text-anchor="{anchor}">{esc(s)}</text>')


def hbar(x0, x1, y, h, fill, round_end=True):
    """Barra horizontal: cuadrada en la base, 4px redondeada en la punta."""
    r = 4 if round_end and x1 - x0 > 8 else 0
    if not r:
        return f'<rect x="{x0:g}" y="{y:g}" width="{x1 - x0:g}" height="{h}" fill="{fill}"/>'
    return (f'<path d="M{x0:g} {y:g} H{x1 - r:g} A{r} {r} 0 0 1 {x1:g} {y + r:g} V{y + h - r:g} '
            f'A{r} {r} 0 0 1 {x1 - r:g} {y + h:g} H{x0:g} Z" fill="{fill}"/>')


class Chart:
    """Arma el SVG de arriba hacia abajo: encabezado, cuerpo y pie."""

    def __init__(self, L, title, subtitle, label, source):
        self.L, self.label, self.source = L, label, source
        self.parts, p = [], L["pad"]
        y = p + L["title"]
        for line in title:
            self.parts.append(text(p, y, line, L["title"], INK, 650))
            y += L["title"] + 6
        y += 2
        for line in subtitle:
            self.parts.append(text(p, y, line, L["sub"], INK2))
            y += L["sub"] + 6
        self.y = y + 22  # donde empieza el cuerpo

    def add(self, *parts):
        self.parts.extend(parts)

    def svg(self):
        L, w, p = self.L, self.L["w"], self.L["pad"]
        y = self.y + 8
        foot = [f'<line x1="{p}" y1="{y}" x2="{w - p}" y2="{y}" stroke="{GRID}"/>']
        y += 24
        narrow = w < 600
        lines = self.source.split(". ") if narrow else [self.source]
        for i, line in enumerate(lines):
            line = line if line.endswith(".") else line + "."
            foot.append(text(p, y, line, L["foot"], MUTED))
            if i < len(lines) - 1:
                y += L["foot"] + 6
        if narrow:
            y += 24
        foot.append(text(w - p, y, "chalan.pe", 14, ACCENT, 700, "end"))
        h = y + 22
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
                f'role="img" aria-label="{esc(self.label)}" font-family="{FONT}">\n'
                f'<rect width="{w}" height="{h}" rx="16" fill="{SURFACE}"/>\n'
                f'<rect x="0.5" y="0.5" width="{w - 1}" height="{h - 1}" rx="16" fill="none" stroke="{GRID}"/>\n'
                + "\n".join(self.parts + foot) + "\n</svg>\n"), h


def bar_rows(c, rows, scale, x0, bh, value_fmt, wide, stacked=None):
    """Filas de barras: etiqueta a la izquierda (ancho) o encima (angosto)."""
    L, y = c.L, c.y
    top = y
    for i, (label, v) in enumerate(rows):
        if wide:
            c.add(text(x0 - 12, y + 17, label, L["label"], INK, 500, "end"))
        else:
            c.add(text(x0, y + 4, label, L["label"], INK, 500))
            y += 12
        if stacked and i == stacked[0]:
            base, extra = stacked[1], v
            c.add(hbar(x0, x0 + base * scale - 1, y, bh, ACCENT_SOFT, round_end=False),
                  hbar(x0 + base * scale + 1, x0 + extra * scale, y, bh, ACCENT),
                  text(x0 + (base + extra) / 2 * scale, y - 8, stacked[2], L["small"], INK, 600, "middle"))
        else:
            c.add(hbar(x0, x0 + v * scale, y, bh, stacked[3] if stacked else ACCENT))
        c.add(text(x0 + v * scale + 10, y + 17, value_fmt(v), L["label"], INK, 600))
        y += bh + (20 if wide else 26)
    if wide:
        c.add(f'<line x1="{x0}" y1="{top - 12}" x2="{x0}" y2="{y - 8}" stroke="{GRID}"/>')
    c.y = y


def spread(L):
    wide = L is WIDE
    c = Chart(L,
              ["La cotización más cara costó 67% más que la más barata"] if wide else
              ["La cotización más cara costó", "67% más que la más barata"],
              ["Por cada S/ 100 que costó la más barata. Mediana de 25 solicitudes de mudanza con 2 o más cotizaciones."] if wide else
              ["Por cada S/ 100 que costó la más barata.", "Mediana de 25 solicitudes de mudanza", "con 2 o más cotizaciones."],
              "Por cada S/ 100 de la cotización más barata, la más cara costó S/ 167 (mediana de 25 solicitudes de mudanza en Chalán, 2026).",
              QUOTES)
    x0 = 200 if wide else L["pad"]
    scale = 400 / 167 if wide else 290 / 167
    c.y += 4 if wide else 8
    bar_rows(c, [("La más barata", 100), ("La más cara", 167)], scale, x0, 24, lambda v: f"S/ {v}", wide,
             stacked=(1, 100, "+ S/ 67", ACCENT_SOFT))
    c.y += 6
    if wide:
        legend = [(x0, "Precio de la más barata", ACCENT_SOFT), (x0 + 200, "Lo que costó de más la más cara", ACCENT)]
    else:
        legend = [(x0, "Precio de la más barata", ACCENT_SOFT)]
    for x, label, color in legend:
        c.add(f'<rect x="{x}" y="{c.y - 10}" width="12" height="12" rx="3" fill="{color}"/>',
              text(x + 18, c.y, label, L["small"]))
    if not wide:
        c.y += 22
        c.add(f'<rect x="{x0}" y="{c.y - 10}" width="12" height="12" rx="3" fill="{ACCENT}"/>',
              text(x0 + 18, c.y, "Lo que costó de más la más cara", L["small"]))
    c.y += 18
    return c


def declines(L):
    wide = L is WIDE
    rows = [("Ya tiene esa fecha ocupada", 38), ("No trabaja en esa zona", 25),
            ("No tiene el vehículo adecuado", 22), ("Otro motivo", 9), ("El presupuesto no le alcanza", 6)]
    c = Chart(L,
              ["Por qué un transportista no cotiza tu mudanza"] if wide else
              ["Por qué un transportista", "no cotiza tu mudanza"],
              ["32 veces en que un transportista avisó que no podía tomar una mudanza en Chalán."] if wide else
              ["32 veces en que un transportista avisó", "que no podía tomar una mudanza en Chalán."],
              "Motivos por los que un transportista no cotizó en Chalán: fecha ocupada 38%, zona 25%, vehículo 22%, otro 9%, presupuesto 6%.",
              DECLINES)
    bar_rows(c, rows, 9.0 if wide else 7.6, 270 if wide else L["pad"], 24, lambda v: f"{v}%", wide)
    return c


def response(L):
    wide = L is WIDE
    rows = [("En menos de 1 hora", 76), ("En menos de 6 horas", 81), ("En menos de 24 horas", 92)]
    c = Chart(L, ["La primera cotización llega en minutos"] if wide else
              ["La primera cotización", "llega en minutos"],
              ["Desde que avisamos a los transportistas. 37 solicitudes de mudanza."] if wide else
              ["Desde que avisamos a los transportistas.", "37 solicitudes de mudanza."],
              "En Chalán la primera cotización llegó en una mediana de 6 minutos: en 76% de las solicitudes en menos de 1 hora, 81% en menos de 6 horas y 92% en menos de 24 horas.",
              QUOTES)
    p = L["pad"]
    if wide:
        y0 = c.y
        c.add(text(p, y0 + 46, "6 min", 56, INK, 650),
              text(p, y0 + 74, "tiempo mediano hasta", 14, INK2),
              text(p, y0 + 92, "la primera cotización", 14, INK2))
        x0, x1, y = 410, 610, y0 + 8
        for label, pct in rows:
            c.add(text(x0 - 12, y + 13, label, L["label"], INK, 500, "end"))
            y = meter(c, x0, x1, y, pct) + 30
        c.y = max(y, y0 + 110) - 10
    else:
        c.add(text(p, c.y + 34, "6 min", 48, INK, 650),
              text(p + 132, c.y + 18, "tiempo mediano hasta", 14, INK2),
              text(p + 132, c.y + 36, "la primera cotización", 14, INK2))
        y = c.y + 74
        for label, pct in rows:
            c.add(text(p, y, label, L["label"], INK, 500))
            y = meter(c, p, 320, y + 10, pct) + 28
        c.y = y - 14
    return c


def meter(c, x0, x1, y, pct):
    """Barra sobre un riel del 100%; devuelve el borde de abajo."""
    bh = 16
    c.add(f'<rect x="{x0}" y="{y}" width="{x1 - x0}" height="{bh}" rx="4" fill="{TRACK}"/>',
          hbar(x0, x0 + (x1 - x0) * pct / 100, y, bh, ACCENT),
          text(x1 + 10, y + 13, f"{pct}%", c.L["label"], INK, 600))
    return y + bh


def lima(L):
    wide = L is WIDE
    c = Chart(L, ["Cuánto cuesta una mudanza dentro de Lima"] if wide else
              ["Cuánto cuesta una mudanza", "dentro de Lima"],
              ["43 cotizaciones de 23 solicitudes de mudanza, de 7 transportistas."] if wide else
              ["43 cotizaciones de 23 solicitudes", "de mudanza, de 7 transportistas."],
              "Mudanza dentro de Lima en Chalán: precio mediano S/ 330; la mitad de las cotizaciones entre S/ 220 y S/ 390 (2026).",
              PRICES)
    p, w, vmax = L["pad"], L["w"], 600
    x0, x1 = (60, 660) if wide else (p + 16, w - p - 16)
    sx = lambda v: x0 + (x1 - x0) * v / vmax
    yb, bh = c.y + 54, 24
    if wide:
        for v in range(0, vmax + 1, 100):
            c.add(f'<line x1="{sx(v):g}" y1="{yb - 22}" x2="{sx(v):g}" y2="{yb + bh + 10}" stroke="{GRID}"/>',
                  text(sx(v), yb + bh + 30, f"S/ {v}", L["small"], MUTED, 400, "middle"))
    else:
        c.add(f'<line x1="{x0}" y1="{yb + bh / 2:g}" x2="{x1}" y2="{yb + bh / 2:g}" stroke="{GRID}"/>',
              text(x0, yb + bh + 22, "S/ 0", L["small"], MUTED),
              text(x1, yb + bh + 22, "S/ 600", L["small"], MUTED, 400, "end"))
    c.add(f'<rect x="{sx(220):g}" y="{yb}" width="{sx(390) - sx(220):g}" height="{bh}" rx="4" fill="{ACCENT_SOFT}"/>',
          f'<circle cx="{sx(330):g}" cy="{yb + bh / 2:g}" r="8" fill="{ACCENT}" stroke="{SURFACE}" stroke-width="2"/>',
          text(sx(330), yb - 30, "S/ 330", 18, INK, 650, "middle"),
          text(sx(330), yb - 12, "mediana", 12, INK2, 400, "middle"))
    if wide:
        c.add(text(sx(220) - 8, yb + 17, "S/ 220", 14, INK, 600, "end"),
              text(sx(390) + 8, yb + 17, "S/ 390", 14, INK, 600))
    else:  # no caben a los lados: van debajo de los extremos del rango
        c.add(text(sx(220), yb + bh + 22, "S/ 220", 14, INK, 600, "middle"),
              text(sx(390), yb + bh + 22, "S/ 390", 14, INK, 600, "middle"))
    y = yb + bh + 64
    c.add(f'<rect x="{x0}" y="{y - 10}" width="12" height="12" rx="3" fill="{ACCENT_SOFT}"/>',
          text(x0 + 18, y, "La mitad de las cotizaciones", L["small"]))
    if not wide:
        y += 22
    lx = x0 + 236 if wide else x0
    c.add(f'<circle cx="{lx + 6}" cy="{y - 4}" r="6" fill="{ACCENT}"/>',
          text(lx + 18, y, "Precio mediano", L["small"]))
    c.y = y + 18
    return c


CHARTS = {
    "cotizacion-mas-cara-vs-mas-barata": spread,
    "por-que-no-cotizan": declines,
    "cuanto-tarda-la-primera-cotizacion": response,
    "precio-mudanza-lima": lima,
}

if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for name, build in CHARTS.items():
        for L, suffix in ((WIDE, ""), (NARROW, "-movil")):
            svg, h = build(L).svg()
            with open(os.path.join(out, f"{name}{suffix}.svg"), "w") as f:
                f.write(svg)
            print(f"{name}{suffix}.svg {L['w']}x{h}")
