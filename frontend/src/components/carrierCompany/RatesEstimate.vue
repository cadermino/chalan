<template>
  <div class="border border-indigo-200 bg-indigo-100 rounded px-4 py-4 mb-4 text-sm text-gray-700">
    <p class="text-base text-gray-800">
      Con tus tarifas: <span class="font-bold">{{ soles(estimate.total) }}</span>
    </p>
    <p class="text-xs text-gray-600 mb-3">
      Lo calculamos con las tarifas que guardaste en Chalán. Es una referencia: el precio lo pones tú.
    </p>
    <div class="flex flex-wrap items-center">
      <template v-for="(line, i) in estimate.lines" :key="i">
        <span v-if="i > 0" class="text-gray-500 mx-1 mb-1">+</span>
        <span :class="KIND_CLASSES[line.kind] || KIND_CLASSES.other"
          class="rounded px-2 py-1 mb-1 whitespace-nowrap">
          {{ line.label }}<span v-if="line.label.includes('×')" class="ml-1">=</span><span
            class="font-semibold ml-1">{{ soles(line.amount) }}</span>
        </span>
      </template>
      <span class="text-gray-500 mx-1 mb-1">=</span>
      <span class="rounded px-2 py-1 mb-1 bg-gray-800 text-white font-semibold whitespace-nowrap">
        {{ soles(estimate.total) }}
      </span>
    </div>
    <p v-if="estimate.minimum_applied" class="text-xs text-gray-600 mt-1">
      La suma da menos que tu tarifa mínima ({{ soles(estimate.minimum_fare) }}), así que va la mínima.
    </p>
    <button type="button" @click="$emit('use', estimate.total)"
      class="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded px-3 py-1">
      Usar {{ soles(estimate.total) }}
    </button>
    <button type="button" class="mt-2 block text-xs text-indigo-700 underline" @click="showVolume = !showVolume">
      {{ showVolume ? 'Ocultar' : `¿De dónde salen los ${number(estimate.m3)} m³?` }}
    </button>
    <div v-if="showVolume" class="mt-2 bg-white border border-indigo-200 rounded px-3 py-2 text-xs">
      <p v-if="estimate.volume.stated">El cliente escribió que son {{ number(estimate.m3) }} m³.</p>
      <template v-else>
        <p class="mb-1 text-gray-600">Lo que leímos en la lista del cliente:</p>
        <p v-for="(item, i) in estimate.volume.items" :key="i" class="flex justify-between">
          <span :class="item.recognized ? '' : 'text-gray-500'" class="mr-2">
            {{ item.text }}<span v-if="!item.recognized"> (no lo reconocimos)</span>
          </span>
          <span class="whitespace-nowrap">{{ number(item.m3) }} m³</span>
        </p>
        <p class="mt-1 text-gray-600">
          + {{ estimate.volume.packing_percent }} % por cajas y cosas sueltas que no se listan.
        </p>
      </template>
    </div>
  </div>
</template>

<script>
// Lo que la empresa cobraría con sus propias tarifas, al lado de donde escribe
// el precio (app/api/auto_quote.py, estimate_for_carrier): una empresa cotizaba en
// mediana 25 % arriba del más barato y nadie lo elegía. Un color por tipo de
// línea, para que se lea de un vistazo qué pesa más. "Usar S/ N" lo copia al
// campo del precio (evento `use`): no se precarga, así lo pone el transportista.
const KIND_CLASSES = {
  base: 'bg-gray-200 text-gray-800',
  m3: 'bg-green-200 text-green-900',
  loaders: 'bg-yellow-200 text-yellow-900',
  floors: 'bg-purple-200 text-purple-900',
  km: 'bg-blue-200 text-blue-900',
  weekend: 'bg-pink-200 text-pink-900',
  other: 'bg-gray-200 text-gray-800',
};

export default {
  name: 'RatesEstimate',
  props: {
    estimate: { type: Object, required: true },
  },
  emits: ['use'],
  data() {
    return { showVolume: false, KIND_CLASSES };
  },
  methods: {
    number(value) {
      return Number(value).toLocaleString('es-PE', { maximumFractionDigits: 2 });
    },
    soles(value) {
      return `S/ ${this.number(value)}`;
    },
  },
};
</script>
