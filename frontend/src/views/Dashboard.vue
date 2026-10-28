<template>
  <div>
    <div class="flex flex-wrap my-10 px-4">
      <div class="w-full mb-4 max-w-xl mx-auto">
        <ViewsMessages :view-name="viewName"/>
        <h1 class="text-center text-xl font-medium mb-8">Tu mudanza</h1>

        <div v-if="loaded && !order" class="text-center mb-10">
          No tienes mudanza agendada con nosotros
          <div class="mt-10">
            <router-link :to="{ name: 'step-one' }" class="bg-blue-500 hover:bg-blue-700 text-white font-bold
              rounded py-2 px-4 tracking-wider">
              Agenda tu mudanza
            </router-link>
          </div>
        </div>

        <!-- Sin agendar (sin elegir, o eligió y no confirmó): vuelve a las cotizaciones. -->
        <div v-else-if="order && notScheduled"
          class="rounded-lg border border-gray-300 bg-white p-5 text-center">
          <p class="font-semibold">Tu mudanza todavía no está agendada</p>
          <p class="mt-1 text-sm text-gray-700">
            <template v-if="order.carrier_company_id">
              Elegiste a {{ order.carrier_company_name }}: falta confirmarla.
            </template>
            <template v-else>Elige una de las cotizaciones para agendarla.</template>
          </p>
          <router-link :to="{ name: 'step-three', params: { order_id: order.order_id } }"
            class="inline-block mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold rounded py-2 px-4">
            Ver cotizaciones
          </router-link>
        </div>

        <div v-else-if="order && order.status === 'cancelled'"
          class="rounded-lg border border-gray-300 bg-white p-5 text-center">
          <p class="font-semibold">Tu última mudanza fue cancelada</p>
          <router-link :to="{ name: 'step-one' }"
            class="inline-block mt-4 bg-blue-500 hover:bg-blue-700 text-white font-bold rounded py-2 px-4">
            Agenda una nueva mudanza
          </router-link>
        </div>

        <!-- Eligió y yapeó la reserva: Chalán la verifica antes de avisarle al transportista. -->
        <div v-else-if="order && verifying" role="status"
          class="rounded-lg border border-yellow-400 bg-yellow-100 p-5 text-sm">
          <p class="font-semibold text-base">Estamos verificando tu yapeo</p>
          <p class="mt-1 text-gray-800">
            Elegiste a {{ order.carrier_company_name }} para el {{ date }}, por
            {{ money(order.total_amount) }}. Tu yapeo de
            {{ money(order.reservation.amount) }} (operación {{ order.reservation.reference }}) está en revisión.
            Cuando lo confirmemos te avisamos por correo y {{ order.carrier_company_name }} recibe el pedido.
          </p>
        </div>

        <div v-else-if="order" role="status" class="rounded-lg border border-green-500 bg-green-50 p-5">
          <p class="font-semibold text-base">
            <template v-if="order.status === 'completed'">
              Tu mudanza con {{ order.carrier_company_name }} se completó. ¡Gracias por confiar en Chalán!
            </template>
            <template v-else>
              ¡Listo! Tu mudanza con {{ order.carrier_company_name }} quedó agendada para el {{ date }}.
            </template>
          </p>

          <dl class="mt-4 text-sm divide-y divide-green-200">
            <div class="flex justify-between py-2">
              <dt class="text-gray-700">Total de la mudanza</dt>
              <dd class="font-semibold">{{ money(order.total_amount) }}</dd>
            </div>
            <div v-if="reservationPaid" class="flex justify-between py-2">
              <dt class="text-gray-700">Reserva yapeada</dt>
              <dd>{{ money(order.reservation.amount) }}</dd>
            </div>
            <div class="flex justify-between py-2">
              <dt class="text-gray-700">
                {{ order.carrier_cash_status === 'paid' ? 'Pagado al transportista' : 'Saldo pendiente' }}
              </dt>
              <dd class="font-semibold">{{ money(balance) }}</dd>
            </div>
          </dl>
          <p v-if="order.carrier_cash_status !== 'paid' && order.status !== 'completed'"
            class="mt-2 text-sm text-gray-800">
            Le pagas {{ money(balance) }} en efectivo a {{ order.carrier_company_name }} el día de la mudanza.
          </p>

          <div v-if="order.carrier_contact && order.carrier_contact.phone"
            class="mt-4 rounded border border-green-200 bg-white p-4 text-sm">
            <p class="text-gray-800">
              Coordina los detalles directo con {{ order.carrier_contact.name }}:
              <span class="font-semibold whitespace-nowrap">{{ order.carrier_contact.phone }}</span>
            </p>
            <a v-if="order.carrier_contact.whatsapp_url" :href="order.carrier_contact.whatsapp_url"
              target="_blank" rel="noopener noreferrer"
              class="inline-block mt-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded py-2 px-4">
              Escribirle por WhatsApp
            </a>
          </div>

          <router-link :to="{ name: 'carrier-company', params: { id: order.carrier_company_id } }"
            class="inline-block mt-4 text-sm text-blue-600 underline">
            Ver a {{ order.carrier_company_name }} y sus vehículos
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
import { mapState, mapActions } from 'pinia';
import { useStore } from '@/store';
import ViewsMessages from '@/components/ViewsMessages.vue';
import chalan from '../api/chalan';

// A dónde llega el cliente después de agendar. Muestra su última mudanza como
// la página de cotizaciones de los servicios (services-web Quotations.jsx): el
// transportista, cuánto le queda por pagarle y su WhatsApp una vez confirmada.
export default {
  name: 'dashboard',
  props: {
    countryData: Object,
  },
  data() {
    return {
      viewName: 'dashboard',
      order: null,
      loaded: false,
    };
  },
  components: {
    ViewsMessages,
  },
  mounted() {
    this.getLastOrder();
  },
  methods: {
    ...mapActions(useStore, [
      'setViewsMessages',
      'setLoader',
    ]),
    getLastOrder() {
      const payload = {
        customerId: this.customer.customer_id,
        token: this.customer.token,
      };
      chalan.getPendingOrders(payload)
        .then((response) => {
          this.order = response.data[0] || null;
          this.loaded = true;
          this.setLoader(false);
        })
        .catch(() => {
          this.setLoader(false);
          this.setViewsMessages({
            view: this.viewName,
            message: {
              text: 'Hubo un error, intenta después de recargar la página',
              type: 'error',
            },
          });
        });
    },
    money(amount) {
      return new Intl.NumberFormat('es-PE', {
        style: 'currency',
        currency: (this.countryData && this.countryData.currency) || 'PEN',
      }).format(Number(amount) || 0);
    },
  },
  computed: {
    ...mapState(useStore, [
      'customer',
      'viewsMessages',
    ]),
    // Con Intl y no con moment: el locale de moment no siempre está cargado y
    // salía "Saturday 31 de October".
    date() {
      const date = new Date(this.order.appointment_date);
      if (Number.isNaN(date.getTime())) return '';
      const day = date.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
      // "10:08 am" y no el "10:08 a. m." de es-PE, que con el punto de la
      // frase quedaba en "a. m..".
      const hour = date.getHours() % 12 || 12;
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day} a las ${hour}:${minutes} ${date.getHours() < 12 ? 'am' : 'pm'}`;
    },
    reservationPaid() {
      return this.order.reservation && this.order.reservation.status === 'paid';
    },
    notScheduled() {
      return this.order.status === 'pending' && !this.verifying;
    },
    // Informó el número de operación y Chalán todavía no lo confirma.
    verifying() {
      return this.order.status === 'pending'
        && this.order.reservation
        && this.order.reservation.status === 'pending'
        && Boolean(this.order.reservation.reference);
    },
    // Con la reserva yapeada, al transportista le toca su precio; sin ella, el total.
    balance() {
      return this.reservationPaid ? this.order.carrier_amount : this.order.total_amount;
    },
  },
};
</script>
