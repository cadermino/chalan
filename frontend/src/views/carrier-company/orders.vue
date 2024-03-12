<template>
  <div>
    <div class="flex flex-wrap my-10">
      <div class="w-full mb-4 max-w-4xl mx-auto">
        <div class="">
          <ViewsMessages :view-name="viewName"/>
          <h1 class="text-center text-xl font-medium mb-10">
            Ordenes pedientes
          </h1>
          <div class="text-center mb-10" v-if="orders.length === 0">
            No tienes mudanzas agendadas
          </div>
          <div v-else class="overflow-scroll">
            <table class="table-auto w-full mb-10">
              <thead>
                <tr>
                  <th class="px-4 py-2">Orden</th>
                  <th class="px-4 py-2">Fecha agendada</th>
                  <th class="px-4 py-2">Cliente</th>
                  <th class="px-4 py-2">Teléfono cliente</th>
                  <th class="px-4 py-2">Monto</th>
                  <th class="px-4 py-2">Estado del pago</th>
                  <th class="px-4 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(order, key, index) in orders"
                    v-bind:key="index">
                  <td class="border px-4 py-2">{{ order.id }}</td>
                  <td class="border px-4 py-2">{{ order.appointment_date |
                    moment("dddd D MMMM - h:mm A") }}</td>
                  <td class="border px-4 py-2">{{ order.customers.name }}</td>
                  <td class="border px-4 py-2">{{ order.customers.mobile_phone }}</td>
                  <td class="border px-4 py-2">{{
                    order.payments[0].amount.toLocaleString('en-US', {
                      style: 'currency',
                      currency: countryData.currency,
                      maximumSignificantDigits: 5,
                    }) }}
                  </td>
                  <td class="border px-4 py-2">{{ paymentStatus[order.payments[0].status] }}</td>
                  <td class="border px-4 py-2 text-xs">
                    <router-link :to="{
                        name: 'carrierCompanyOrderDetails',
                        params: { id: order.id, token: order.token, }
                    }"
                        class="tracking-wider underline text-blue-500">
                        Detalles
                    </router-link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
import { mapMutations } from 'vuex';
import 'moment/locale/es';
import ViewsMessages from '@/components/ViewsMessages.vue';
import chalan from '@/api/chalan';

export default {
  name: 'ordersByCarrierCompany',
  props: {
    token: String,
    countryData: Object,
  },
  data() {
    return {
      viewName: 'ordersByCarrierCompany',
      orders: [],
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
        token: this.token,
      };
      chalan.getOrdersByCarrierCompany(payload)
        .then((response) => {
          this.orders = response.data.orders;
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
  },
};
</script>
