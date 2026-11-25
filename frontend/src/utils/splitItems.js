// Una lista pegada en el campo de una línea del paso 2 llegaba amontonada: el
// navegador cambia los saltos de línea por espacios, y el transportista leía
// "Una refrigeradora  Un comedor de 4 sillas  Una tele de 65" en un renglón
// (orden 343). Corta en saltos de línea, en dos o más espacios, en " . " (una
// lista con puntos como viñetas), antes de "Un", "Una", "Unos", "Unas" con
// mayúscula y en comas o punto y coma fuera de paréntesis ("cosas de cocina
// (ollas, platos)" es una). El API lee los m³ con una regla parecida
// (`split_lines` en app/api/order/volume.py).
const SEPARATORS = /\n|\s{2,}|\s+\.\s+|\s+(?=(?:Un|Una|Unos|Unas)\b)|\s*[,;](?![^(]*\))\s*/;
// Desde cuántas cosas en un solo renglón se le ofrece separarlas.
export const CRAMMED_MIN_ITEMS = 3;

export function splitItems(text) {
  const items = [];
  (text || '').split(SEPARATORS).forEach((raw) => {
    const piece = raw.trim().replace(/^[-.•*+]+\s*/, '').trim();
    if (!piece) return;
    // "juego de sofá 3, 2, 1": un número suelto es parte de la cosa de antes.
    if (!/[a-záéíóúüñ]/i.test(piece) && items.length) {
      items[items.length - 1] += `, ${piece}`;
    } else {
      items.push(piece);
    }
  });
  return items;
}

export function isCrammed(text) {
  return splitItems(text).length >= CRAMMED_MIN_ITEMS;
}
