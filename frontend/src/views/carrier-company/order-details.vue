<template>
  <div>
    <ViewsMessages :view-name="viewName" class="lg:w-4/5 mx-auto mt-8" />
    <section class="py-10 bg-gray-50 sm:py-1 lg:py-1 mb-20">
      <div class="px-4 mx-auto sm:px-6 lg:px-8 max-w-7xl">
        <div class="max-w-2xl mx-auto text-center">
          <h2 v-if="orderData"
            class="text-3xl
              font-bold
              leading-tight
              text-gray-800
              sm:text-2xl
              lg:text-2xl"
          >
            Cotización orden número {{orderData.id}}
          </h2>
        </div>
        <div class="max-w-3xl mx-auto mt-8 space-y-4 md:mt-16">
          <div
            class="transition-all
              duration-500
              bg-white
              border
              border-gray-200
              shadow-lg
              cursor-pointer
              hover:bg-gray-50"
          >
            <button
              @click="accordionButton('answer0', 'arrow0')"
              id="question1"
              type="button"
              data-state="closed"
              class="flex
                items-center
                justify-between
                w-full
                px-4
                py-5
                sm:p-6
                focus:outline-none"
            >
              <span
                class="flex text-lg font-semibold text-gray-800">
                Datos generales
              </span>
              <svg
                id="arrow0"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                class="w-6 h-6 text-gray-400">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                ></path>
              </svg>
            </button>
            <div v-if="orderData"
              id="answer0"
              class="px-4 pb-5 sm:px-6 sm:pb-6">
              <p>
                <span class="font-bold
                  mr-1">Fecha de mudanza: </span>
                {{ orderData.appointment_date |
                          moment("dddd D MMMM YYYY - h:mm A") }}
              </p>
            </div>
          </div>
          <div
            class="transition-all
              duration-500
              bg-white
              border
              border-gray-200
              shadow-lg
              cursor-pointer
              hover:bg-gray-50"
          >
            <button
              @click="accordionButton('answer1', 'arrow1')"
              id="question1"
              type="button"
              data-state="closed"
              class="flex
                items-center
                justify-between
                w-full
                px-4
                py-5
                sm:p-6
                focus:outline-none"
            >
              <span
                class="flex text-lg font-semibold text-gray-800">
                Datos de dirección de origen
              </span>
              <svg
                id="arrow1"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                class="w-6 h-6 text-gray-400">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                ></path>
              </svg>
            </button>
            <div v-if="fromAddress"
              id="answer1"
              class="px-4 pb-5 sm:px-6 sm:pb-6">
              <p>
                <span class="font-bold
                  mr-1">Mapa: </span>
                <a :href="fromAddress.map_url"
                  class="underline"
                  target="_blank">Link a la dirección</a>
              </p>
              <p>
                <span class="font-bold
                  mr-1">Dirección: </span>
                {{fromAddress.street}}
              </p>
              <p>
                <span class="font-bold
                  mr-1">Piso: </span>
                {{fromAddress.floor_number}}
              </p>
              <p>
                <span class="font-bold
                  mr-1">Elevador: </span>
                Sí
              </p>
              <p>
                <span class="font-bold
                  mr-1">Distancia del estacionamiento a la puerta: </span>
                10mts.
              </p>
              <p>
                <span class="font-bold
                  mr-1">Servicio de empacado: </span>
                No
              </p>
            </div>
          </div>
          <div
            class="transition-all
              duration-500
              bg-white
              border
              border-gray-200
              shadow-lg
              cursor-pointer
              hover:bg-gray-50"
          >
            <button @click="accordionButton('answer2', 'arrow2')"
              type="button"
              id="question2"
              data-state="closed"
              class="flex
                items-center
                justify-between
                w-full
                px-4
                py-5
                sm:p-6
                focus:outline-none"
            >
              <span class="flex text-lg font-semibold text-gray-800"
                >Datos de dirección de destino</span
              >
              <svg
                id="arrow2"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                class="w-6 h-6 text-gray-400"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                ></path>
              </svg>
            </button>
            <div v-if="toAddress"
              id="answer2"
              class="px-4 pb-5 sm:px-6 sm:pb-6">
              <p>
                <span class="font-bold
                  mr-1">Mapa: </span>
                <a :href="toAddress.map_url"
                  class="underline"
                  target="_blank">Link a la dirección</a>
              </p>
              <p>
                <span class="font-bold
                  mr-1">Dirección: </span>
                {{toAddress.street}}
              </p>
              <p>
                <span class="font-bold
                  mr-1">Piso: </span>
                {{toAddress.floor_number}}
              </p>
              <p>
                <span class="font-bold
                  mr-1">Elevador: </span>
                No
              </p>
              <p>
                <span class="font-bold
                  mr-1">Distancia del estacionamiento a la puerta: </span>
                2mts.
              </p>
              <p>
                <span class="font-bold
                  mr-1">Servicio de empacado: </span>
                No
              </p>
            </div>
          </div>
          <div
            class="transition-all
              duration-500
              bg-white
              border
              border-gray-200
              shadow-lg
              cursor-pointer
              hover:bg-gray-50"
          >
            <button @click="accordionButton('answer3', 'arrow3')"
              type="button"
              id="question3"
              data-state="closed"
              class="flex
                items-center
                justify-between
                w-full
                px-4
                py-5
                sm:p-6
                focus:outline-none"
            >
              <span class="flex text-lg font-semibold text-gray-800"
                >Carga</span
              >
              <svg
                id="arrow3"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                class="w-6 h-6 text-gray-400"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                ></path>
              </svg>
            </button>
            <div v-if="itemsToMoveList"
              id="answer3"
              class="px-4 pb-5 sm:px-6 sm:pb-6">
              <p>
                <pre>{{ itemsToMoveList }}</pre>
              </p>
            </div>
          </div>
        </div>
        <div v-if="hasQuotation" class="max-w-3xl mx-auto mt-8 space-y-4">
          <p>
            <span class="font-bold
              mr-1">Cotización actual:
            </span>
            {{amountFromDatabase}}
          </p>
        </div>
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
    </section>
  </div>
</template>
<script>
import 'moment/locale/es';
import ViewsMessages from '@/components/ViewsMessages.vue';
import { mapMutations, mapState } from 'vuex';
import chalan from '../../api/chalan';

export default {
  name: 'carrierCompanyOrderDetails',
  props: {
    token: String,
    orderId: Number,
  },
  data() {
    return {
      viewName: 'carrierCompanyOrderDetails',
      orderData: {},
      orderDetails: [],
      carrierCompanyId: null,
      amount: null,
      quotations: [],
    };
  },
  mounted() {
    this.$moment.locale('es');
    this.getOrder();
  },
  components: {
    ViewsMessages,
  },
  computed: {
    ...mapState([
      'formValidationMessages',
    ]),
    fromAddress() {
      let carryFrom;
      this.orderDetails.forEach((item) => {
        if (item.type === 'carry_from') {
          carryFrom = item;
        }
      });
      return carryFrom;
    },
    toAddress() {
      let carryTo;
      this.orderDetails.forEach((item) => {
        if (item.type === 'deliver_to') {
          carryTo = item;
        }
      });
      return carryTo;
    },
    itemsToMoveList() {
      return this.orderData?.comments;
    },
    hasQuotation() {
      return Boolean(this.amountFromDatabase) || false;
    },
    amountFromDatabase() {
      const currentQuotation = this.quotations
        .filter(quotation => quotation.carrier_company_id === this.carrierCompanyId);
      if (currentQuotation.length === 0) {
        return null;
      }
      return currentQuotation[0].amount;
    },
  },
  methods: {
    ...mapMutations([
      'setFormValidationMessages',
      'setViewsMessages',
      'setLoader',
    ]),
    goBack() {
      if (window.history.length > 1) {
        this.$router.go(-1);
      } else {
        this.$router.push('/');
      }
    },
    accordionButton(contentTagElementId, arrowTagElementId) {
      const content = document.getElementById(contentTagElementId);
      const arrow = document.getElementById(arrowTagElementId);
      if (content.style.display === 'none' || content.style.display === '') {
        content.style.display = 'block';
        arrow.style.transform = 'rotate(0deg)';
      } else {
        content.style.display = 'none';
        arrow.style.transform = 'rotate(-180deg)';
      }
    },
    getOrder() {
      this.setLoader(true);
      chalan
        .getOrderDetails(this.token)
        .then((response) => {
          if (response.status === 200) {
            this.orderData = response.data.order;
            this.carrierCompanyId = response.data.carrier_company_id;
            this.orderDetails = this.orderData.order_details;
            this.quotations = this.orderData.quotations;
          }
        })
        .catch((error) => {
          let message = '';
          if (error.response.status === 400) {
            message = 'El token es inválido';
          } else if (error.response.status === 401) {
            message = 'Proporciona un toke por favor';
          } else {
            message = 'Hubo un error, intenta después de recargar la página';
          }
          this.setViewsMessages({
            view: this.viewName,
            message: {
              text: message,
              type: 'error',
            },
          });
        });
      this.setLoader(false);
    },
  },
};
</script>
