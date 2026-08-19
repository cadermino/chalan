<template>
  <Modal :visible="visible" title="Confirma tu pedido" @close="$emit('close')">
    <div class="mb-4">
      <p class="text-gray-900 font-bold text-lg">
        {{ quotation.brand }} {{ quotation.model }}
      </p>
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
    <label class="block text-gray-700 text-sm font-bold mb-2" for="modal-phone">
      Teléfono de contacto <span class="text-red-500">*</span>
    </label>
    <input id="modal-phone"
      v-model="phone"
      type="number"
      :class="error ? 'border-red-300' : ''"
      class="appearance-none border rounded w-full py-2 px-3 text-gray-700
      leading-tight focus:outline-none focus:border-blue-400 mb-1"
      placeholder="Ej. 987654321" />
    <p v-if="error" class="text-red-500 text-xs italic mb-3">
      {{ error }}
    </p>
    <p class="text-sm text-gray-500 mb-4">
      Por el momento el pago es en efectivo. Pago con tarjeta próximamente.
    </p>
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
import chalan from '../api/chalan';

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
  },
  data() {
    return {
      phone: null,
      error: null,
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
      if (!this.phone) {
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
        this.setCustomerData({ field: 'mobile_phone', value: this.phone });
        await chalan.updateCustomerProfile({
          mobilePhone: this.phone,
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
        this.setViewsMessages({
          view: 'dashboard',
          message: {
            text: 'Muy bien, tu vehículo ha sido agendado!',
            type: 'success',
          },
        });
        this.$router.push({ name: 'dashboard' });
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
