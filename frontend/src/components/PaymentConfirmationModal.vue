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
         que no lo es) y además ese bloque ya dice que el resto se le paga al
         transportista. Sin el bloque, en cambio, esta es la única señal de
         cómo se paga y no puede faltar. -->
    <p v-if="!yapeQrVisible" class="text-sm text-gray-500 mb-4">
      El pago es en efectivo, directo al transportista.
    </p>
    <!-- Reserva con Yape, obligatoria para agendar. Solo Perú y detrás de
         VUE_APP_YAPE_QR_ENABLED. El resto del servicio se le paga directo al
         transportista (el modal no dice con qué medio: puede ser efectivo,
         Yape o transferencia); esto aparta la fecha. Yape personal no tiene webhook, así
         que el cliente informa su número de operación y un admin lo verifica en
         el backoffice: hasta entonces la orden queda pendiente y el
         transportista no recibe el pedido. -->
    <div v-if="yapeQrVisible" class="border border-gray-200 rounded p-3 mb-4">
      <p class="text-sm font-bold text-gray-700 mb-1">
        Yapea tu reserva para agendar
      </p>
      <p class="text-xs text-gray-500 mb-3">
        Yapea <span class="font-bold text-gray-700">S/ {{ reservationLabel }}</span>
        para agendar. El resto (S/ {{ remainingLabel }}) lo pagas al
        transportista el día de la mudanza.
      </p>
      <!-- width/height son los píxeles reales del archivo. No fijan el tamaño
           (lo manda w-40), sirven para que el navegador reserve la caja por
           relación de aspecto antes de bajar el JPG: sin ellos la imagen mide
           cero hasta que carga y el modal da un salto de 243px al abrirse. -->
      <img :src="yapeQrSrc"
        alt="Código QR de Yape para reservar tu mudanza"
        width="460"
        height="700"
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
      <label class="block text-gray-700 text-sm font-bold mt-4 mb-2" for="modal-operation-number">
        Número de operación <span class="text-red-500">*</span>
      </label>
      <input id="modal-operation-number"
        v-model="operationNumber"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        :class="operationError ? 'border-red-300' : ''"
        class="appearance-none border rounded w-full py-2 px-3 text-gray-700
        leading-tight focus:outline-none focus:border-blue-400 mb-1"
        placeholder="Ej. 12345678" />
      <p class="text-xs text-gray-400">
        Lo ves en el comprobante de Yape después de yapear.
      </p>
      <!-- Plegado por defecto: en un celular la imagen sola ocupa casi media
           pantalla y el modal ya trae el QR. Quien no sepa dónde está el número
           la abre. La captura está censurada y lleva un número de ejemplo. -->
      <details class="mt-2">
        <summary class="text-xs text-blue-600 underline cursor-pointer">
          ¿Dónde está el número de operación?
        </summary>
        <img :src="yapeOperationSrc"
          alt="Comprobante de Yape con el Nro. de operación resaltado"
          width="640"
          height="612"
          class="w-full max-w-xs mx-auto rounded mt-2" />
      </details>
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
import yapeOperation from '@/assets/yape-operation-number.jpg';
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
    // Pide la reserva con Yape. Lo activan las dos vistas donde el cliente
    // agenda: Step-three y la página pública del transportista (CarrierCompany).
    showYapeQr: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      phone: null,
      error: null,
      operationNumber: '',
      // Distingue el error del número de operación del resto para marcar solo
      // ese campo en rojo.
      operationError: false,
      yapeQrSrc: yapeQr,
      yapeOperationSrc: yapeOperation,
      cashPaymentCreated: false,
      // Si el checkout agendó la orden en esta llamada o si ya estaba agendada.
      // Sobrevive a un reintento dentro del mismo montaje, porque en ese caso
      // no se vuelve a llamar al endpoint y el dato ya no llegaría.
      checkoutCreated: false,
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
          this.operationNumber = '';
          this.operationError = false;
          this.cashPaymentCreated = false;
          this.checkoutCreated = false;
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
      this.operationError = false;
      // Con la reserva visible no se agenda sin el número de operación. Se
      // valida antes de tocar nada: el servidor repite el chequeo, esto solo
      // evita el viaje y le dice al cliente qué falta.
      const reserved = this.yapeQrVisible;
      const operationNumber = this.operationNumber.replace(/\D/g, '');
      if (reserved && (operationNumber.length < 4 || operationNumber.length > 20)) {
        this.error = 'ingresa el número de operación de tu yapeo';
        this.operationError = true;
        return;
      }
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
          const { data } = await chalan.checkoutCash({
            orderId: this.currentOrder.order_id,
            token: this.customer.token,
            operationNumber: reserved ? operationNumber : null,
          });
          this.cashPaymentCreated = true;
          this.checkoutCreated = !data || data.created !== false;
        }
        this.setCustomerData({ field: 'mobile_phone', value: phone });
        await chalan.updateCustomerProfile({
          mobilePhone: phone,
          customerId: this.customer.customer_id,
          token: this.customer.token,
        });
        const paymentMethod = reserved ? 'yape_reservation' : 'cash';
        this.setOrder({ section: 'currentOrder', field: 'payment_method', value: paymentMethod });
        // El estado de la orden lo escribe checkout-cash en el backend. Esto
        // solo lo ponia en el store: el PUT de abajo no lleva
        // orderEditedByCustomer —a proposito, reenvia el localStorage— asi que
        // nunca llegaba a la base y simulaba un guardado que no ocurria.
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
        // Solo si se agendó ahora. Volver desde el dashboard y confirmar otra
        // vez la misma cotización llegaba hasta aquí y contaba una conversión
        // por cada repetición.
        if (this.checkoutCreated) {
          track('order_confirmed', {
            order_id: this.currentOrder.order_id,
            quotation_id: this.quotation.id,
            value: this.quotation.total_amount,
            currency: this.currency,
            payment_method: paymentMethod,
          });
        }
        this.setViewsMessages({
          view: 'dashboard',
          message: {
            text: reserved
              ? 'Recibimos tu número de operación. Verificaremos tu pago y te confirmaremos el agendamiento por correo.'
              : 'Muy bien, tu vehículo ha sido agendado!',
            type: 'success',
          },
        });
        this.$router.push({ name: 'dashboard' }).catch(() => {});
      } catch (error) {
        this.setLoader(false);
        // Se mira el mensaje y no solo el código: updateQuotation, que corre
        // antes, también puede devolver 400/409 por otras razones.
        const reason = error.response && error.response.data && error.response.data.message;
        if (reserved && reason === 'invalid_operation_number') {
          this.error = 'revisa el número de operación';
          this.operationError = true;
        } else if (reserved && reason === 'operation_number_already_used') {
          this.error = 'ese número de operación ya se usó en otra orden';
          this.operationError = true;
        } else {
          this.error = 'Hubo un error, intenta nuevamente';
        }
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
