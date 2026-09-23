<template>
  <Modal :visible="visible" title="Confirma tu mudanza" @close="$emit('close')">
    <div class="mb-4">
      <p class="text-gray-900 font-bold text-xl mb-2">
        {{ formattedAmount }}
      </p>
      <p class="text-sm text-gray-600">
        {{ orderDetailsOrigin.from_street }} &rarr; {{ orderDetailsDestination.to_street }}
      </p>
      <p class="text-sm text-gray-600" v-if="currentOrder.appointment_date">
        {{ currentOrder.appointment_date | moment("dddd D MMMM YYYY - h:mm A") }}
      </p>
    </div>
    <!-- Solo se pide si no lo tenemos ya. Quien entró con Google no trae
         teléfono (Google no lo da) y el prompt de Step-one se puede omitir, así
         que este es el último punto donde capturarlo: sin él el transportista
         no tiene cómo coordinar ni sale el WhatsApp de la cotización. -->
    <template v-if="needsPhone">
      <label class="block text-gray-700 text-sm font-bold mb-2" for="modal-phone">
        Teléfono de contacto <span class="text-red-500">*</span>
      </label>
      <input id="modal-phone"
        v-model="phone"
        type="tel"
        :class="error ? 'border-red-300' : ''"
        class="appearance-none border rounded w-full py-2 px-3 text-gray-700
        leading-tight focus:outline-none focus:border-blue-400 mb-1"
        placeholder="Ej. 987654321" />
    </template>
    <p v-if="error" class="text-red-500 text-xs italic mb-3">
      {{ error }}
    </p>
    <!-- Solo si no se muestra la reserva: cuando el bloque de Yape está
         visible este aviso lo contradice (anuncia efectivo junto a un medio
         que no lo es) y además ese bloque ya dice que el resto va en efectivo
         al transportista. Sin el bloque, en cambio, esta es la única señal de
         cómo se paga y no puede faltar. -->
    <p v-if="!yapeQrVisible" class="text-sm text-gray-500 mb-4">
      El pago es en efectivo, directo al transportista.
    </p>
    <!-- Reserva opcional con Yape. Solo Perú y detrás de VUE_APP_YAPE_QR_ENABLED.
         No bloquea la confirmación: el servicio se sigue pagando en efectivo al
         transportista, esto solo aparta la fecha. La verificación del yapeo es
         manual (Yape personal no tiene webhook), así que nada aquí marca la
         orden como pagada. -->
    <div v-if="yapeQrVisible" class="border border-gray-200 rounded p-3 mb-4">
      <p class="text-sm font-bold text-gray-700 mb-1">
        Aparta tu fecha con Yape
        <span class="font-normal text-gray-500">(opcional)</span>
      </p>
      <p class="text-xs text-gray-500 mb-3">
        Yapea <span class="font-bold text-gray-700">S/ {{ reservationLabel }}</span>
        para reservar. El resto (S/ {{ remainingLabel }}) lo pagas en efectivo al
        transportista el día de la mudanza.
      </p>
      <img :src="yapeQrSrc"
        alt="Código QR de Yape para reservar tu mudanza"
        class="w-40 mx-auto rounded" />
      <!-- Desde el celular no se puede escanear la pantalla del propio equipo.
           La app de Yape deja subir una imagen desde "Escanear QR", así que en
           móvil se ofrece descargar el código en vez de pedir que lo escanee. -->
      <p class="hidden sm:block text-xs text-gray-400 text-center mt-2">
        Escanéalo desde la app de Yape.
      </p>
      <div class="sm:hidden text-center mt-3">
        <a :href="yapeQrSrc"
          download="yape-chalan.jpg"
          class="text-xs text-blue-600 underline">
          Descargar el QR
        </a>
        <p class="text-xs text-gray-400 mt-1">
          Luego en Yape: Escanear QR &rarr; subir imagen.
        </p>
      </div>
    </div>
    <button type="button"
      :disabled="loading"
      :class="loading ? 'opacity-50 cursor-not-allowed' : ''"
      class="w-full bg-green-500 hover:bg-green-700 text-white py-2 px-4
      rounded focus:outline-none"
      @click="confirmCashCheckout">
      Agendar vehículo
    </button>
  </Modal>
</template>

<script>
import { mapState, mapMutations } from 'vuex';
import 'moment/locale/es';
import Modal from '@/components/Modal.vue';
import yapeQr from '@/assets/yape-qr.jpg';
import chalan from '../api/chalan';
import { track } from '../utils/analytics';

const quotationFields = {
  quotation_id: 'id',
  amount: 'total_amount',
  vehicle_brand: 'brand',
  vehicle_model: 'model',
  vehicle_weight: 'weight',
  vehicle_description: 'description',
  vehicle_picture: 'picture',
};

export default {
  name: 'PaymentConfirmationModal',
  components: {
    Modal,
  },
  props: {
    visible: {
      type: Boolean,
      required: true,
    },
    quotation: {
      type: Object,
      required: true,
    },
    currency: {
      type: String,
      required: true,
    },
    // El modal se monta también en la vista de carrier company, donde el QR no
    // tiene sentido. Solo el flujo del cliente (Step-three) lo pide.
    showYapeQr: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      phone: null,
      error: null,
      yapeQrSrc: yapeQr,
      cashPaymentCreated: false,
      orderStatusId: {
        pending: 1,
        'in progress': 2,
      },
    };
  },
  mounted() {
    this.$moment.locale('es');
  },
  watch: {
    quotation: {
      immediate: true,
      handler(newVal, oldVal) {
        if (!newVal || !newVal.id) return;
        if (!oldVal || oldVal.id !== newVal.id) {
          this.error = null;
          this.cashPaymentCreated = false;
        }
        if (!this.phone) {
          this.phone = this.customer.mobile_phone;
        }
      },
    },
  },
  methods: {
    ...mapMutations([
      'setOrder',
      'setCustomerData',
      'setViewsMessages',
      'setLoader',
    ]),
    async confirmCashCheckout() {
      // Cae al teléfono del perfil: con el campo oculto `phone` puede seguir en
      // null si el watcher no alcanzó a poblarlo, y validar solo contra él
      // dejaría al usuario con un error que no tiene cómo corregir.
      const phone = this.phone || this.customer.mobile_phone;
      if (!phone) {
        this.error = 'no olvides ingresar tu teléfono';
        return;
      }
      this.error = null;
      this.setLoader(true);
      try {
        Object.keys(quotationFields).forEach((field) => {
          this.setOrder({ section: 'currentOrder', field, value: this.quotation[quotationFields[field]] });
        });
        await chalan.updateQuotation({
          quotationId: this.quotation.id,
          selected: true,
          token: this.customer.token,
        });
        if (!this.cashPaymentCreated) {
          await chalan.checkoutCash({
            orderId: this.currentOrder.order_id,
            token: this.customer.token,
          });
          this.cashPaymentCreated = true;
        }
        this.setCustomerData({ field: 'mobile_phone', value: phone });
        await chalan.updateCustomerProfile({
          mobilePhone: phone,
          customerId: this.customer.customer_id,
          token: this.customer.token,
        });
        this.setOrder({ section: 'currentOrder', field: 'payment_method', value: 'cash' });
        this.setOrder({
          section: 'currentOrder',
          field: 'order_status_id',
          value: this.orderStatusId['in progress'],
        });
        const orderPayload = {
          order: this.currentOrder,
          customer: this.customer,
          orderDetailsOrigin: this.orderDetailsOrigin,
          orderDetailsDestination: this.orderDetailsDestination,
          services: this.services,
        };
        await chalan.updateOrder(orderPayload);
        // Conversión final del embudo. No se llama `purchase` a propósito:
        // eso queda reservado para cuando entre Culqi y haya cobro real, para
        // no tener que reinterpretar el histórico. El guard cashPaymentCreated
        // ya evita el doble disparo si el usuario reintenta.
        track('order_confirmed', {
          order_id: this.currentOrder.order_id,
          quotation_id: this.quotation.id,
          value: this.quotation.total_amount,
          currency: this.currency,
          payment_method: 'cash',
        });
        this.setViewsMessages({
          view: 'dashboard',
          message: {
            text: 'Muy bien, tu vehículo ha sido agendado!',
            type: 'success',
          },
        });
        this.$router.push({ name: 'dashboard' }).catch(() => {});
      } catch (error) {
        this.setLoader(false);
        this.error = 'Hubo un error, intenta nuevamente';
      }
    },
  },
  computed: {
    ...mapState([
      'currentOrder',
      'customer',
      'orderDetailsOrigin',
      'orderDetailsDestination',
      'services',
      'loading',
    ]),
    needsPhone() {
      return !this.customer.mobile_phone;
    },
    yapeQrVisible() {
      return this.showYapeQr
        && this.currency === 'PEN'
        && process.env.VUE_APP_YAPE_QR_ENABLED === 'true'
        && this.reservationAmount > 0;
    },
    // Lo que el cliente le debe a Chalán: el total menos el precio crudo del
    // transportista. Sale exacto de los dos montos que ya manda el API, sin
    // replicar PLATFORM_FEE aquí, y queda bien solo en órdenes referidas (ahí
    // el total también trae la comisión del agente). Se redondea a soles
    // enteros: el QR personal no lleva monto, la cifra la tipea el cliente.
    reservationAmount() {
      const total = Number(this.quotation.total_amount);
      const base = Number(this.quotation.amount);
      if (!total || !base) return 0;
      return Math.round((total - base) * 100) / 100;
    },
    // Con el IGV dentro de la comisión el monto deja de ser redondo (11.80, no
    // 12) y tiene que calzar al céntimo con la boleta que se emite por ese
    // cobro, así que va con dos decimales en vez de redondearse a soles. Yape
    // acepta céntimos.
    reservationLabel() {
      return this.reservationAmount.toFixed(2);
    },
    // Lo que recibe el transportista en efectivo: su precio crudo, tal cual.
    remainingLabel() {
      return (Number(this.quotation.amount) || 0).toFixed(2);
    },
    formattedAmount() {
      if (!this.quotation.total_amount) return '';
      return this.quotation.total_amount.toLocaleString('en-US', {
        style: 'currency',
        currency: this.currency,
        maximumSignificantDigits: 5,
      });
    },
  },
};
</script>
