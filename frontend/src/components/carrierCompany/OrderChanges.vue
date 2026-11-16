<template>
  <div class="border border-yellow-300 bg-yellow-100 shadow-lg px-4 py-5 sm:p-6">
    <p class="text-lg font-semibold text-gray-800">{{ title }}</p>
    <p class="text-sm text-gray-600 mb-3">Último cambio: {{ when(changes.changed_at) }}</p>
    <dl>
      <div v-for="entry in changes.entries" :key="entry.field" class="mb-2">
        <dt class="text-sm font-bold text-gray-700">{{ entry.label }}</dt>
        <dd>
          <div v-if="entry.kind === 'lines'"
            class="mt-1 bg-white border border-gray-300 font-mono text-sm overflow-x-auto">
            <div v-for="(line, i) in collapse(entry.lines)" :key="i"
              :class="lineClass(line.op)" class="px-2 whitespace-pre-wrap">
              <span class="mr-2 select-none">{{ sign(line.op) }}</span>{{ line.op === '…' ? '…' : line.text }}
            </div>
          </div>
          <div v-else-if="entry.kind === 'list'" class="text-sm">
            <p v-for="name in entry.added" :key="`+${name}`" class="text-green-700">+ {{ name }}</p>
            <p v-for="name in entry.removed" :key="`-${name}`" class="text-red-700">− {{ name }}</p>
          </div>
          <p v-else class="text-sm">
            <template v-if="entry.before !== null">
              <span class="text-red-700 line-through">{{ entry.before }}</span>
              <span class="mx-1 text-gray-500">→</span>
            </template>
            <span class="text-green-700 font-semibold">{{ entry.after }}</span>
          </p>
        </dd>
      </div>
    </dl>
    <p v-if="hint" class="mt-3 text-sm font-semibold text-gray-800">{{ hint }}</p>
    <div v-if="changes.history.length > 1" class="mt-3">
      <button type="button" class="text-sm text-gray-700 underline" @click="showHistory = !showHistory">
        {{ showHistory ? 'Ocultar historial' : 'Ver historial' }}
      </button>
      <ol v-if="showHistory" class="mt-2">
        <li v-for="version in changes.history" :key="version.number"
          class="mb-3 border-l-2 border-yellow-300 pl-3">
          <p class="text-sm text-gray-600">
            {{ when(version.created_date) }} · {{ version.author === 'chalan' ? 'Chalán' : 'El cliente' }}
          </p>
          <p v-for="entry in version.entries" :key="entry.field" class="text-sm">
            <span class="font-bold text-gray-700">{{ entry.label }}:</span>
            <template v-if="entry.kind === 'lines'">
              <span v-for="(line, i) in changedLines(entry.lines)" :key="i"
                :class="line.op === '+' ? 'text-green-700' : 'text-red-700'" class="ml-1">
                {{ sign(line.op) }} {{ line.text }}
              </span>
            </template>
            <template v-else-if="entry.kind === 'list'">
              <span v-for="name in entry.added" :key="`+${name}`" class="ml-1 text-green-700">+ {{ name }}</span>
              <span v-for="name in entry.removed" :key="`-${name}`" class="ml-1 text-red-700">− {{ name }}</span>
            </template>
            <template v-else>
              <span v-if="entry.before !== null" class="ml-1 text-red-700 line-through">{{ entry.before }}</span>
              <span v-if="entry.before !== null" class="mx-1 text-gray-500">→</span>
              <span class="text-green-700">{{ entry.after }}</span>
            </template>
          </p>
        </li>
      </ol>
    </div>
  </div>
</template>

<script>
// Lo que cambió la orden desde que el transportista cotizó (o desde que se le
// mandó): `changes` del link (changes_for_carrier en app/api/order/versions.py),
// con los textos ya escritos. Aquí solo se pinta, como en el backoffice
// (components/OrderChangeEntries.jsx).

// Más de 6 líneas iguales seguidas: se dejan 2 de cada lado.
const CONTEXT = 2;
const MAX_SAME = 6;

const LINE_CLASS = {
  '-': 'bg-red-100 text-red-800',
  '+': 'bg-green-100 text-green-800',
  '=': 'text-gray-600',
  '…': 'text-gray-500',
};
const SIGN = {
  '-': '−', '+': '+', '=': ' ', '…': ' ',
};

export default {
  name: 'OrderChanges',
  props: {
    changes: { type: Object, required: true },
    // Tiene una cotización viva: se le pide revisar su precio.
    hasQuotation: { type: Boolean, default: false },
    // La mudanza ya es suya: el precio quedó cerrado.
    selected: { type: Boolean, default: false },
  },
  data() {
    return { showHistory: false };
  },
  computed: {
    title() {
      return this.changes.since === 'quotation'
        ? 'Esta orden cambió después de tu cotización'
        : 'Esta orden cambió desde que te la enviamos';
    },
    hint() {
      if (this.selected) {
        return 'Si esto cambia tu precio, escríbenos.';
      }
      return this.hasQuotation ? 'Revisa tu precio y vuelve a enviarlo si cambia.' : null;
    },
  },
  methods: {
    when(iso) {
      return this.$moment(iso).format('D [de] MMMM, h:mm A');
    },
    sign(op) {
      return SIGN[op];
    },
    lineClass(op) {
      return LINE_CLASS[op];
    },
    changedLines(lines) {
      return lines.filter(line => line.op !== '=');
    },
    collapse(lines) {
      const out = [];
      let run = [];
      const flush = () => {
        if (run.length > MAX_SAME) {
          out.push(...run.slice(0, CONTEXT), { op: '…' }, ...run.slice(-CONTEXT));
        } else {
          out.push(...run);
        }
        run = [];
      };
      lines.forEach((line) => {
        if (line.op === '=') {
          run.push(line);
        } else {
          flush();
          out.push(line);
        }
      });
      flush();
      return out;
    },
  },
};
</script>
