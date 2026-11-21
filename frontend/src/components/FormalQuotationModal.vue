<template>
  <Modal :visible="visible" title="Cotización formal con RUC" @close="close">
    <template v-if="!done">
      <p class="text-sm text-gray-600 mb-4">
        Para tu área de compras: un PDF con razón social, RUC, IGV, condiciones y
        cuenta para el depósito. Te la enviamos también por correo.
      </p>
      <form @submit.prevent="submit" novalidate>
        <label class="block text-gray-700 text-sm font-bold mb-1" for="fq-ruc">
          RUC <span class="text-red-500">*</span>
        </label>
        <input id="fq-ruc" v-model="form.ruc" type="text" inputmode="numeric" maxlength="11"
          autocomplete="off" placeholder="Ej. 20123456789"
          :class="errors.ruc ? 'border-red-300' : ''"
          class="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight
          focus:outline-none focus:border-blue-400 mb-1" />
        <p v-if="errors.ruc" class="text-red-500 text-xs italic mb-2">{{ errors.ruc }}</p>

        <label class="block text-gray-700 text-sm font-bold mb-1 mt-2" for="fq-business-name">
          Razón social <span class="text-red-500">*</span>
        </label>
        <input id="fq-business-name" v-model="form.business_name" type="text" maxlength="200"
          autocomplete="organization" placeholder="Como figura en SUNAT"
          :class="errors.business_name ? 'border-red-300' : ''"
          class="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight
          focus:outline-none focus:border-blue-400 mb-1" />
        <p v-if="errors.business_name" class="text-red-500 text-xs italic mb-2">
          {{ errors.business_name }}
        </p>

        <label class="block text-gray-700 text-sm font-bold mb-1 mt-2" for="fq-contact-name">
          Contacto
        </label>
        <input id="fq-contact-name" v-model="form.contact_name" type="text" maxlength="120"
          autocomplete="name" placeholder="Ej. Ana Pérez – Logística"
          class="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight
          focus:outline-none focus:border-blue-400 mb-1" />

        <label class="block text-gray-700 text-sm font-bold mb-1 mt-2" for="fq-contact-email">
          Correo <span class="text-red-500">*</span>
        </label>
        <input id="fq-contact-email" v-model="form.contact_email" type="email" maxlength="255"
          autocomplete="email" placeholder="compras@empresa.com"
          :class="errors.contact_email ? 'border-red-300' : ''"
          class="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight
          focus:outline-none focus:border-blue-400 mb-1" />
        <p v-if="errors.contact_email" class="text-red-500 text-xs italic mb-2">
          {{ errors.contact_email }}
        </p>

        <p class="text-xs text-gray-500 mt-3 mb-4">
          El precio de la cotización va sin IGV; el 18 % se suma en el PDF.
        </p>
        <p v-if="errors.general" class="text-red-500 text-xs italic mb-3">{{ errors.general }}</p>
        <button type="submit" :disabled="sending"
          class="w-full bg-green-500 hover:bg-green-700 text-white py-2 px-4 rounded
          focus:outline-none disabled:opacity-50">
          {{ sending ? 'Generando…' : 'Descargar cotización (PDF)' }}
        </button>
      </form>
    </template>
    <template v-else>
      <p class="text-gray-700 mb-2">Listo, se descargó la cotización.</p>
      <p class="text-sm text-gray-600 mb-4">
        También la enviamos a <span class="font-bold">{{ form.contact_email }}</span>.
        Si no se descargó, <a :href="downloadUrl" :download="filename" class="underline">ábrela aquí</a>.
      </p>
      <button type="button" @click="close"
        class="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded focus:outline-none">
        Cerrar
      </button>
    </template>
  </Modal>
</template>

<script>
import Modal from '@/components/Modal.vue';
import chalan from '../api/chalan';
import { track } from '../utils/analytics';
import { isValidRuc, normalizeRuc } from '../utils/ruc';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const FIELD_MESSAGES = {
  ruc: 'Revisa el RUC: son 11 dígitos y el último no coincide.',
  business_name: 'Escribe la razón social.',
  contact_email: 'Revisa el correo.',
};

function filenameFrom(disposition) {
  const match = /filename="?([^";]+)"?/.exec(disposition || '');
  return match ? match[1] : 'Cotizacion_Chalan.pdf';
}

export default {
  name: 'FormalQuotationModal',
  components: { Modal },
  emits: ['close'],
  props: {
    visible: { type: Boolean, required: true },
    orderId: { type: [Number, String], default: null },
    quotation: { type: Object, default: null },
    customer: { type: Object, required: true },
  },
  data() {
    return {
      form: {
        ruc: '', business_name: '', contact_name: '', contact_email: '',
      },
      errors: {},
      sending: false,
      done: false,
      downloadUrl: null,
      filename: null,
      prefilled: false,
    };
  },
  watch: {
    visible(open) {
      if (open) this.open();
    },
  },
  beforeUnmount() {
    if (this.downloadUrl) URL.revokeObjectURL(this.downloadUrl);
  },
  methods: {
    async open() {
      this.done = false;
      this.errors = {};
      if (this.prefilled) return;
      this.prefilled = true;
      this.form.contact_name = this.form.contact_name || this.customer.customer_name || '';
      this.form.contact_email = this.form.contact_email || this.customer.email || '';
      // La empresa que ya pidió una antes no vuelve a escribir su RUC.
      try {
        const { data } = await chalan.getFormalQuotations({
          orderId: this.orderId, token: this.customer.token,
        });
        const last = data.last_client;
        if (last && !this.form.ruc) {
          this.form = {
            ruc: last.ruc,
            business_name: last.business_name,
            contact_name: last.contact_name || this.form.contact_name,
            contact_email: last.contact_email || this.form.contact_email,
          };
        }
      } catch (e) {
        // Sin precarga se escribe a mano.
      }
    },
    validate() {
      const errors = {};
      if (!isValidRuc(this.form.ruc)) errors.ruc = FIELD_MESSAGES.ruc;
      if (this.form.business_name.trim().length < 2) errors.business_name = FIELD_MESSAGES.business_name;
      if (!EMAIL_RE.test(this.form.contact_email.trim())) errors.contact_email = FIELD_MESSAGES.contact_email;
      this.errors = errors;
      return Object.keys(errors).length === 0;
    },
    async submit() {
      this.form.ruc = normalizeRuc(this.form.ruc);
      if (!this.validate()) {
        track('formal_quotation_blocked', { missing_field: Object.keys(this.errors)[0] });
        return;
      }
      this.sending = true;
      try {
        const res = await chalan.createFormalQuotation({
          orderId: this.orderId,
          token: this.customer.token,
          data: {
            quotation_id: this.quotation.id,
            ruc: this.form.ruc,
            business_name: this.form.business_name.trim(),
            contact_name: this.form.contact_name.trim(),
            contact_email: this.form.contact_email.trim(),
          },
        });
        this.filename = filenameFrom(res.headers['content-disposition']);
        if (this.downloadUrl) URL.revokeObjectURL(this.downloadUrl);
        this.downloadUrl = URL.createObjectURL(res.data);
        const link = document.createElement('a');
        link.href = this.downloadUrl;
        link.download = this.filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        this.done = true;
        track('formal_quotation_downloaded', {
          order_id: this.orderId,
          ruc_type: this.form.ruc.slice(0, 2),
        });
      } catch (error) {
        await this.showError(error);
      } finally {
        this.sending = false;
      }
    },
    async showError(error) {
      const status = error.response && error.response.status;
      let body = {};
      try {
        body = JSON.parse(await error.response.data.text());
      } catch (e) {
        body = {};
      }
      if (status === 400 && FIELD_MESSAGES[body.field]) {
        this.errors = { [body.field]: FIELD_MESSAGES[body.field] };
      } else if (status === 401 || status === 403) {
        this.errors = { general: 'Tu sesión venció. Vuelve a entrar para descargarla.' };
      } else {
        this.errors = { general: 'No pudimos generar la cotización. Inténtalo de nuevo en un momento.' };
      }
      track('formal_quotation_failed', { reason: body.field || String(status || 'network') });
    },
    close() {
      this.$emit('close');
    },
  },
};
</script>
