<template>
  <div>
    <div class="flex flex-wrap my-10">
      <div class="w-full mb-4 max-w-4xl mx-auto">
        <div class="">
          <div class="flex items-center mb-8"
             v-if="viewsMessages[viewName]">
            <div class="bg-blue-100
              w-full
              border
              border-blue-400
              text-blue-700
              px-4
              py-3
              rounded
              relative"
              role="info">
              <span class="block sm:inline">
                {{ viewsMessages[viewName] }}
              </span>
            </div>
          </div>
          <h1 class="text-center text-xl font-medium mb-10">
            Servicio pediente
          </h1>
          <div class="text-center mb-10" v-if="pendingOrders.length == 0">
            No tienes mudanza agendada con nosotros
            <div class="mt-10">
              <router-link :to="{ name: 'step-one' }" class="bg-blue-500
                hover:bg-blue-700
                text-white
                font-bold
                rounded
                py-2 px-4
                tracking-wider">
                Agenda tu mudanza
              </router-link>
            </div>
          </div>
          <div v-else class="overflow-scroll">
            <table class="table-auto w-full mb-10">
              <thead>
                <tr>
                  <th class="px-4 py-2">Fecha agendada</th>
                  <th class="px-4 py-2">Vehículo</th>
                  <th class="px-4 py-2">Peso</th>
                  <th class="px-4 py-2">Monto</th>
                  <th class="px-4 py-2">Estado del pago</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(order, key, index) in pendingOrders"
                    v-bind:key="index">
                  <td class="border px-4 py-2">{{ order.appointment_date |
                    moment("dddd D MMMM - h:mm A") }}</td>
                  <td class="border px-4 py-2">{{ order.vehicle_name }}</td>
                  <td class="border px-4 py-2">{{ order.weight }}</td>
                  <td class="border px-4 py-2">{{
                    order.amount.toLocaleString('en-US', {
                      style: 'currency',
                      currency: 'MXN',
                      maximumSignificantDigits: 3,
                    }) }}
                  </td>
                  <td class="border px-4 py-2">{{ paymentStatus[order.payment_status] }}</td>
                </tr>
              </tbody>
            </table>
            <div class="text-center">
              <button class="bg-blue-500
                hover:bg-blue-700
                text-white
                font-bold
                rounded
                py-2 px-4
                tracking-wider"
                type="button"
                @click="goBack">
                Volver
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
import { mapMutations, mapActions, mapState } from 'vuex';
import 'moment/locale/es';
import chalan from '../api/chalan';

export default {
  name: 'dashboard',
  props: ['sessionId'],
  data() {
    return {
      viewName: 'dashboard',
      pendingOrders: [],
      paymentStatus: {
        pending: 'Pendiente',
        paid: 'Pagado',
        cancelled: 'Cancelado',
      },
    };
  },
  mounted() {
    this.$moment.locale('es');
    this.getPendingOrders();
    if (this.sessionId && this.currentOrder.order_id) {
      const payload = {
        sessionId: this.sessionId,
        orderId: this.currentOrder.order_id,
        token: this.customer.token,
      };
      chalan.confirmStripePayment(payload)
        .then((response) => {
          if (response.status === 200) {
            this.setViewsMessages({
              view: this.viewName,
              message: 'Su pago ha sido recibido con exito!',
            });
            Object.keys(this.currentOrder).forEach((field) => {
              this.setOrder({ field, value: null });
            });
            this.addDataToLocalStorage(['currentOrder']);
            this.$router.push(this.$route.path);
          }
        })
        .catch(() => {
          this.setViewsMessages({
            view: this.viewName,
            message: 'Hubo un error, intenta después de recargar la página',
          });
        });
    }
  },
  methods: {
    ...mapActions([
      'addDataToLocalStorage',
    ]),
    ...mapMutations([
      'setOrder',
      'setViewsMessages',
      'setLoader',
    ]),
    getPendingOrders() {
      const payload = {
        customerId: this.customer.customer_id,
        token: this.customer.token,
      };
      chalan.getPendingOrders(payload)
        .then((response) => {
          this.pendingOrders = response.data;
          this.setLoader(false);
        })
        .catch(() => {
          this.setViewsMessages({ view: this.viewName, message: 'Hubo un error, intenta después de recargar la página' });
        });
    },
    goBack() {
      if (window.history.length > 1) {
        this.$router.go(-1);
      } else {
        this.$router.push('/');
      }
    },
  },
  computed: {
    ...mapState([
      'currentOrder',
      'customer',
      'viewsMessages',
    ]),
  },
};
</script>
