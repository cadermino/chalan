<template>
  <div>
    <div class="flex flex-wrap my-10">
      <div class="w-full mb-4 max-w-4xl mx-auto">
        <div class="">
          <ViewsMessages :view-name="viewName"/>
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
                  <th class="px-4 py-2">Chalán</th>
                  <th class="px-4 py-2">Monto</th>
                  <th class="px-4 py-2">Estado del pago</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(order, key, index) in pendingOrders"
                    v-bind:key="index">
                  <td class="border px-4 py-2">{{ order.appointment_date |
                    moment("dddd D MMMM - h:mm A") }}</td>
                  <td class="border px-4 py-2">{{ order.carrier_company_name }}</td>
                  <td class="border px-4 py-2">{{
                    order.amount.toLocaleString('en-US', {
                      style: 'currency',
                      currency: countryData.currency,
                      maximumSignificantDigits: 5,
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
import { mapMutations, mapState } from 'vuex';
import 'moment/locale/es';
import ViewsMessages from '@/components/ViewsMessages.vue';
import chalan from '../api/chalan';

export default {
  name: 'dashboard',
  props: {
    countryData: Object,
  },
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
  components: {
    ViewsMessages,
  },
  mounted() {
    this.$moment.locale('es');
    this.getPendingOrders();
  },
  methods: {
    ...mapMutations([
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
          this.setViewsMessages({
            view: this.viewName,
            message: {
              text: 'Hubo un error, intenta después de recargar la página',
              type: 'error',
            },
          });
        });
    },
    goBack() {
      if (window.history.length > 1) {
        this.$router.go(-1);
      } else {
        this.$router.push('/').catch(() => {});
      }
    },
  },
  computed: {
    ...mapState([
      'customer',
      'viewsMessages',
    ]),
  },
};
</script>
