// node --test frontend/src/utils/   (sin dependencias: el runner de Node)
import test from 'node:test';
import assert from 'node:assert/strict';
import { isCrammed, splitItems } from './splitItems.js';

// Tal como llegó la orden 343: la lista pegada con los saltos de línea hechos espacios.
const ORDER_343 = 'Una tarima de 2 plazas con respaldo  Una cama de plaza y media  3 colchones uno de 2 plazas, '
  + 'de plaza y media y una plaza  Una refrigeradora Un comedor de 4 sillas y mesa redonda de vidrio  '
  + 'Un mueble de 200cm de ancho Una tele de 65  Una tele de 45 Un zapatero  Un equipo radio  Vajilla y ollas';

test('a pasted list is split into one thing per line', () => {
  assert.deepEqual(splitItems(ORDER_343), [
    'Una tarima de 2 plazas con respaldo',
    'Una cama de plaza y media',
    '3 colchones uno de 2 plazas',
    'de plaza y media y una plaza',
    'Una refrigeradora',
    'Un comedor de 4 sillas y mesa redonda de vidrio',
    'Un mueble de 200cm de ancho',
    'Una tele de 65',
    'Una tele de 45',
    'Un zapatero',
    'Un equipo radio',
    'Vajilla y ollas',
  ]);
  assert.equal(isCrammed(ORDER_343), true);
});

test('commas, semicolons and line breaks separate things', () => {
  assert.deepEqual(splitItems('cama, refrigeradora; 5 cajas\nlavadora'), ['cama', 'refrigeradora', '5 cajas', 'lavadora']);
});

test('a loose number belongs to the thing before it', () => {
  assert.deepEqual(splitItems('juego de sofá 3,2,1, mesa, 4 sillas'), ['juego de sofá 3, 2, 1', 'mesa', '4 sillas']);
});

test('one or two things on a line are left alone', () => {
  assert.equal(isCrammed('1 armario metálico'), false);
  assert.equal(isCrammed('refrigeradora y lavadora'), false);
  assert.equal(isCrammed('cama, colchón'), false);
  // Una sola cosa escrita con doble espacio, o con "una" en minúscula.
  assert.equal(isCrammed('2  cajas con pantallas'), false);
  assert.equal(isCrammed('mesa con una silla'), false);
});

test('what is inside parentheses stays with its thing', () => {
  assert.deepEqual(splitItems('un frigider, un ordenador de ropa y algunas cosas de cocina (ollas, platos), 2 cajas'),
    ['un frigider', 'un ordenador de ropa y algunas cosas de cocina (ollas, platos)', '2 cajas']);
});

test('a list with dots as bullets is split at them', () => {
  assert.deepEqual(splitItems('Armario . Base de cama . Colchon 2 plaza . Un estante pequeño'),
    ['Armario', 'Base de cama', 'Colchon 2 plaza', 'Un estante pequeño']);
  // Un punto decimal no corta.
  assert.deepEqual(splitItems('mesa de 1.10 m, 4 sillas, ropero'), ['mesa de 1.10 m', '4 sillas', 'ropero']);
});

test('bullets and empty pieces are dropped', () => {
  assert.deepEqual(splitItems('. Armario  . Base de cama  - Colchón , ,'), ['Armario', 'Base de cama', 'Colchón']);
});
