<template>
  <div>
    <div class="flex flex-wrap">
      <div class="w-full mb-4">
        <Tracker :current-view="viewName"></Tracker>
        <div class="w-full max-w-xl mx-auto sm:p-0 p-5 sm:pb-8">
          <ViewsMessages :view-name="viewName"/>
          <p class="text-center font-bold mb-10" id="text-header">
            Elige la cotización adecuada para tu mudanza <span class="text-red-500">*</span>
          </p>
          <div class="flex flex-wrap mb-4" v-if="quotationsList.length > 0">
            <div v-if="quotationsList.length == 0">
              Estamos cargando las cotizaciones...
            </div>
            <div v-for="(quotation, index) in quotationsList"
              v-bind:value="index"
              v-bind:key="index"
              class="w-full my-5 md:w-1/2 px-3">
              <div :class="(selectedQuotation.id == quotation.id) ? 'bg-gray-200' : ''"
                class="w-full">
                <img class="h-auto
                  w-full
                  flex-none
                  bg-cover
                  border-l border-r border-b-0 border-t border-gray-400
                  rounded-t
                  text-center
                  overflow-hidden"
                  :src="quotation.picture"
                  alt="Sunset in the mountains">
                <div class="w-full border-r
                  border-b
                  border-l
                  border-gray-400
                  rounded-b
                  p-4
                  flex
                  flex-col
                  justify-between
                  leading-normal">
                  <div class="mb-8">
                    <div>
                      <span id="stars" class="flex items-center">
                        <svg
                          fill="currentColor"
                          stroke="currentColor"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          class="w-4 h-4 text-blue-500"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M12
                            2l3.09
                            6.26L22
                            9.27l-5
                            4.87
                            1.18
                            6.88L12
                            17.77l-6.18
                            3.25L7
                            14.14
                            2
                            9.27l6.91-1.01L12
                            2z"
                          ></path>
                        </svg>
                        <svg
                          fill="currentColor"
                          stroke="currentColor"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          class="w-4 h-4 text-blue-500"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M12
                            2l3.09
                            6.26L22
                            9.27l-5
                            4.87
                            1.18
                            6.88L12
                            17.77l-6.18
                            3.25L7
                            14.14
                            2
                            9.27l6.91-1.01L12
                            2z"
                          ></path>
                        </svg>
                        <svg
                          fill="currentColor"
                          stroke="currentColor"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          class="w-4 h-4 text-blue-500"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M12
                            2l3.09
                            6.26L22
                            9.27l-5
                            4.87
                            1.18
                            6.88L12
                            17.77l-6.18
                            3.25L7
                            14.14
                            2
                            9.27l6.91-1.01L12
                            2z"
                          ></path>
                        </svg>
                        <svg
                          fill="currentColor"
                          stroke="currentColor"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          class="w-4 h-4 text-blue-500"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M12
                            2l3.09
                            6.26L22
                            9.27l-5
                            4.87
                            1.18
                            6.88L12
                            17.77l-6.18
                            3.25L7
                            14.14
                            2
                            9.27l6.91-1.01L12
                            2z"
                          ></path>
                        </svg>
                        <svg
                          fill="none"
                          stroke="currentColor"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          class="w-4 h-4 text-blue-500"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M12
                            2l3.09
                            6.26L22
                            9.27l-5
                            4.87
                            1.18
                            6.88L12
                            17.77l-6.18
                            3.25L7
                            14.14
                            2
                            9.27l6.91-1.01L12
                            2z"
                          ></path>
                        </svg>
                        <span class="text-gray-600 ml-3">0 Evaluaciones</span>
                      </span>
                    </div>
                    <div class="text-gray-900 font-bold text-xl mb-2">
                      {{  quotation.amount
                            .toLocaleString('en-US', {
                              style: 'currency',
                              currency: countryData.currency,
                              maximumSignificantDigits: 5,
                            }
                          )
                      }}
                    </div>
                    <ul>
                      <li><span>Marca:</span>
                        <span class="font-bold"> {{ quotation.brand }}</span>
                      </li>
                      <li><span>Modelo:</span>
                        <span class="font-bold"> {{ quotation.model }}</span>
                      </li>
                      <li><span>Peso de carga:</span>
                        <span class="font-bold"> {{ quotation.weight }} kg</span>
                      </li>
                      <li class="mt-3">
                        {{ quotation.description }}
                      </li>
                    </ul>
                  </div>
                  <div class="flex items-center">
                    <button @click="(selectedQuotation.id == quotation.id) ?
                        '' : selectQuotation({quotation})"
                      type="button"
                      :class="(selectedQuotation.id == quotation.id) ?
                        'opacity-50 cursor-not-allowed bg-gray-600 hover:bg-gray-700' :
                        'bg-green-500 hover:bg-green-700'"
                      class="w-full
                      bg-green-500
                      hover:bg-green-700
                      text-white
                      py-2
                      px-4
                      rounded
                      focus:outline-none
                      focus:border-blue-400">
                      {{ (selectedQuotation.id == quotation.id) ?
                        'Seleccionado' : 'Elegir' }}
                    </button>
                    <button @click="goToCarrierCompanyView(quotation)"
                      type="button"
                      class="py-2 px-4focus:outline-none underline
                      focus:border-blue-400 w-full ml-10">
                      {{ 'Ver más' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="mb-8" v-else>
            <div class="items-center mb-8">
              <div class="flex
                mb-8
                text-sm
                items-center
                w-full
                border
                px-4
                py-3
                rounded
                relative
                bg-blue-100
                border-blue-400
                text-blue-700"
                role="alert">
                <svg class="fill-current w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M12.432 0c1.34 0 2.01.912 2.01 1.957 0 1.305-1.164 2.512-2.679 2.512-1.269 0-2.009-.75-1.974-1.99C9.789 1.436 10.67 0 12.432 0zM8.309 20c-1.058 0-1.833-.652-1.093-3.524l1.214-5.092c.211-.814.246-1.141 0-1.141-.317 0-1.689.562-2.502 1.117l-.528-.88c2.572-2.186 5.531-3.467 6.801-3.467 1.057 0 1.233 1.273.705 3.23l-1.391 5.352c-.246.945-.141 1.271.106 1.271.317 0 1.357-.392 2.379-1.207l.6.814C12.098 19.02 9.365 20 8.309 20z"/></svg>
                <span class="block sm:inline">
                  Estamos buscando tu chalán ideal, en breve obtendras las
                  cotizaciones que más se ajusten a tu mudanza.
                </span>
              </div>
              <div class="md:flex mb-8">
                <CardSkeleton class="mb-8 md:mb-0"/>
                <CardSkeleton class="md:ml-8" />
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between">
            <router-link :to="{ name: steps[viewName].previous }" class="bg-green-500
              hover:bg-green-700
              text-white
              py-2
              px-4
              rounded
              focus:outline-none
              focus:border-blue-400">
              Atras
            </router-link>
            <button
              :disabled="loading || !isStepComplete"
              :class="(loading || !isStepComplete)?'opacity-50 cursor-not-allowed':''"
              type="button"
              class="bg-green-500
              hover:bg-green-700
              text-white
              py-2
              px-4
              rounded
              focus:outline-none
              focus:border-blue-400"
              @click="nextStep">
              Siguiente
              </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState, mapActions, mapMutations } from 'vuex';
import Tracker from '@/components/Tracker.vue';
import ViewsMessages from '@/components/ViewsMessages.vue';
import CardSkeleton from '@/components/CardSkeleton.vue';
import chalan from '../../api/chalan';

export default {
  name: 'step-three',
  data() {
    return {
      viewName: 'step-three',
      getQuotationsDelayInMilliseconds: 5000,
      intervalId: null,
      quotationsList: [],
      quotationFields: {
        quotation_id: 'id',
        amount: 'amount',
        vehicle_brand: 'brand',
        vehicle_model: 'model',
        vehicle_weight: 'weight',
        vehicle_description: 'description',
        vehicle_picture: 'picture',
      },
      selectedQuotation: {},
    };
  },
  components: {
    Tracker,
    ViewsMessages,
    CardSkeleton,
  },
  mounted() {
    this.getQuotations();
    this.getQuotationsInLoop();
  },
  beforeDestroy() {
    clearInterval(this.intervalId);
  },
  props: {
    countryData: Object,
  },
  methods: {
    ...mapActions([
      'validateRequiredFields',
    ]),
    ...mapMutations([
      'setOrder',
      'setViewsMessages',
      'setLoader',
    ]),
    getQuotationsInLoop() {
      this.intervalId = setInterval(() => this.getQuotations(),
        this.getQuotationsDelayInMilliseconds);
    },
    goToCarrierCompanyView(quotation) {
      this.selectQuotation({ quotation, jumpToNextStep: false });
      this.$router.push({
        name: 'carrier-company',
        params: { id: quotation.carrier_company_id },
      });
    },
    nextStep() {
      this.validateRequiredFields(this.viewName);
      if (this.isStepComplete) {
        this.pickQuotation();
        this.updateOrder();
      }
    },
    async pickQuotation() {
      this.setLoader(true);
      const quotationPayload = {
        quotationId: this.selectedQuotation.id,
        selected: true,
        token: this.customer.token,
      };
      try {
        await chalan.updateQuotation(quotationPayload);
      } catch (error) {
        this.setLoader(false);
        this.setViewsMessages({
          view: this.viewName,
          message: {
            text: 'Hubo un error, intenta después de recargar la página',
            type: 'error',
          },
        });
      }
    },
    updateOrder() {
      const payload = {
        order: this.currentOrder,
        customer: this.customer,
        orderDetailsOrigin: this.orderDetailsOrigin,
        orderDetailsDestination: this.orderDetailsDestination,
        services: this.services,
      };
      chalan.updateOrder(payload)
        .then((response) => {
          if (response.status === 200) {
            this.$router.push({ name: this.steps[this.viewName].next });
          }
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
    getQuotations() {
      this.selectedQuotation.id = this.currentOrder.quotation_id || null;
      const payload = {
        orderId: this.currentOrder.order_id,
        token: this.customer.token,
      };
      chalan.getQuotations(payload)
        .then((response) => {
          this.unSelectQuotation();
          this.quotationsList = response.data;
          this.quotationsList.forEach((quotation) => {
            if (quotation.selected) {
              this.selectQuotation({ quotation, jumpToNextStep: false });
            }
          });
          this.setLoader(false);
        })
        .catch((e) => {
          this.setViewsMessages({
            view: this.viewName,
            message: {
              text: 'Hubo un error, intenta después de recargar la página',
              type: 'error',
            },
          });
          this.setLoader(false);
          throw new Error(e);
        });
    },
    selectQuotation({ quotation, jumpToNextStep = true }) {
      this.selectedQuotation = quotation;
      Object.keys(this.quotationFields).forEach((field) => {
        this.setOrder({ section: 'currentOrder', field, value: this.selectedQuotation[this.quotationFields[field]] });
      });
      if (jumpToNextStep) {
        this.nextStep();
      }
    },
    unSelectQuotation() {
      Object.keys(this.quotationFields).forEach((field) => {
        this.setOrder({ section: 'currentOrder', field, value: null });
      });
    },
  },
  computed: {
    ...mapState([
      'currentOrder',
      'customer',
      'orderDetailsOrigin',
      'orderDetailsDestination',
      'services',
      'formValidationMessages',
      'steps',
      'viewsMessages',
      'loading',
    ]),
    isStepComplete() {
      return this.steps[this.viewName].isComplete;
    },
  },
};
</script>
