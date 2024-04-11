<template>
  <div>
    <div class="flex flex-wrap">
      <div class="w-full mb-4">
        <Tracker :current-view="viewName"></Tracker>
        <div class="w-full max-w-xl mx-auto sm:p-0 p-5 sm:pb-8">
          <ViewsMessages :view-name="viewName"/>
          <p class="text-center font-bold mb-10">
            {{ customer.customer_name }}
             confirma que todo esté en orden antes del pago
          </p>
          <div class="flex flex-wrap mb-4">
            <div class="w-full pxx-3 mb-4">
              <div class="bg-white overflow-hidden sm:rounded-lg">
                <div class="pt-0 px-4 py-5 border-b border-gray-200">
                  <h3 class="text-2xl leading-6 font-medium text-gray-900">
                    {{ currentOrder.amount
                        .toLocaleString('en-US', {
                          style: 'currency',
                          currency: countryData.currency,
                          maximumSignificantDigits: 5,
                        }
                      )
                    }}
                  </h3>
                  <p class="mt-1 max-w-2xl text-sm leading-5 text-gray-500">
                    Total a pagar
                  </p>
                </div>
                <div>
                  <dl>
                    <div class="bg-white px-4 py-2">
                      <dt class="text-sm leading-5 font-medium text-gray-500">
                        Detalles del vehículo
                      </dt>
                      <dd class="mt-1 text-base leading-5 text-gray-900 sm:mt-0 sm:col-span-2">
                        <div class="max-w-sm w-full lg:max-w-full lg:flex">
                          <div class=" mt-2
                          h-48 lg:h-auto
                          lg:w-64
                          flex-none
                          lg:bg-contain
                          lg:bg-cente
                          lg:bg-no-repeat
                          bg-cover
                          rounded-t
                          lg:rounded-t-none
                          lg:rounded-l
                          text-center
                          overflow-hidden"
                          style="background-image: url('/img/card-left.jpg')"
                          :style="{ backgroundImage:
                            'url(' + `${currentOrder.vehicle_picture}` + ')'}">
                          </div>
                          <div class="border-r
                          border-b
                          border-l
                          border-gray-400
                          lg:border-0
                          lg:border-gray-400
                          bg-white
                          rounded-b
                          lg:rounded-b-none
                          lg:rounded-r
                          pt-0
                          p-4
                          flex
                          flex-col
                          justify-between
                          leading-normal">
                            <div class="">
                              <div class="text-gray-900 font-bold text-xl">
                                {{ currentOrder.vehicle_brand }} {{ currentOrder.vehicle_model }}
                              </div>
                              <p class="mb-2">
                                <span class="text-gray-700 text-base">Peso de carga:</span>
                                  {{ currentOrder.vehicle_weight }} Kg.
                              </p>
                              <p class="text-gray-700 text-base">
                                {{ currentOrder.vehicle_description }}
                              </p>
                            </div>
                          </div>
                        </div>
                      </dd>
                    </div>
                    <div class="bg-gray-50 px-4 py-2">
                      <dt class="text-sm leading-5 font-medium text-gray-500">
                        Dirección de recojo
                      </dt>
                      <dd class="mt-1 text-base leading-5 text-gray-900 sm:mt-0 sm:col-span-2">
                        {{ completeFromAddress }}
                      </dd>
                    </div>
                    <div class="bg-white px-4 py-2">
                      <dt class="text-sm leading-5 font-medium text-gray-500">
                        Dirección de entrega
                      </dt>
                      <dd class="mt-1 text-base leading-5 text-gray-900 sm:mt-0 sm:col-span-2">
                        {{ completeToAddress }}
                      </dd>
                    </div>
                    <div class="bg-gray-50 px-4 py-2">
                      <dt class="text-sm leading-5 font-medium text-gray-500">
                        Fecha y hora de la mudanza
                      </dt>
                      <dd class="mt-1 text-base leading-5 text-gray-900 sm:mt-0 sm:col-span-2">
                        {{ currentOrder.appointment_date |
                          moment("dddd D MMMM YYYY - h:mm A") }}
                      </dd>
                    </div>
                    <div class="bg-gray-50 px-4 py-2">
                      <dt class="text-sm leading-5 font-medium text-gray-500">
                        Carga
                      </dt>
                      <dd class="mt-1 text-xs leading-4 text-gray-900 sm:mt-0 sm:col-span-2">
                        <pre>{{ itemsToMoveList }}</pre>
                      </dd>
                    </div>
                    <div class="bg-gray-50 px-4 py-2">
                      <dt class="text-sm leading-5 font-medium text-gray-500">
                        Teléfono de contacto <span class="text-red-500">*</span>
                        <span v-if="!phoneNumber"
                          class="ml-2 text-red-500
                          text-xs
                          italic">No olvides ingresar tu teléfono.</span>
                      </dt>
                      <dd class="mt-1 text-base leading-5 text-gray-900 sm:mt-0 sm:col-span-2">
                        <div class="pr-4
                          py-3
                          flex
                          items-center
                          justify-between
                          text-base
                          leading-5">
                          <div v-if="!isMobilePhoneFieldActive"
                            class="w-0 flex-1 flex items-center">
                            {{ customer.mobile_phone?customer.mobile_phone:'-' }}
                          </div>
                          <input v-if="isMobilePhoneFieldActive"
                            :class="!phoneNumber
                              ?'border-red-300':''"
                            class="appearance-none
                            border rounded
                            w-full
                            py-2
                            px-3
                            text-gray-700
                            leading-tight
                            focus:outline-none
                            focus:border-blue-400"
                            v-model="phoneNumber"
                            type="number">
                          <div class="ml-4 flex-shrink-0">
                            <div
                              @click="editMobilePhone()"
                              class="cursor-pointer font-medium
                              text-indigo-600
                              hover:text-indigo-500
                              transition
                              duration-150
                              ease-in-out">
                              {{ isMobilePhoneFieldActive?'Aceptar':'Editar' }}
                            </div>
                          </div>
                        </div>
                      </dd>
                    </div>
                    <div class="bg-white px-4 py-2">
                      <dt class="text-sm leading-5 font-medium text-gray-500">
                        Opciones de pago <span class="text-red-500">*</span>
                        <span v-if="formValidationMessages['payment_method']"
                          class="ml-2 text-red-500
                          text-xs
                          italic">{{ formValidationMessages['payment_method'] }}.</span>
                      </dt>
                      <dd class="mt-1 text-base leading-5 text-gray-900 sm:mt-0 sm:col-span-2">
                        <ul class="border border-gray-200 rounded-md">
                          <li class="border-gray-200
                          pl-3
                          pr-4
                          py-3
                          flex
                          items-center
                          justify-between
                          text-base
                          leading-5">
                            <div class="w-0 flex-1 flex items-center">
                              <i class="fa fa-credit-card"></i>
                              <span class="ml-2 flex-1 w-0 truncate">
                                Tarjeta débito/crédito
                                <i class="fa fa-check text-green-400 ml-2"
                                  v-if="currentOrder.payment_method=='card'"
                                ></i>
                              </span>
                            </div>
                            <div class="ml-4 flex-shrink-0">
                              <div
                                class="
                                opacity-50
                                cursor-pointer
                                font-medium
                                text-indigo-600
                                hover:text-indigo-500
                                transition
                                duration-150
                                ease-in-out">
                                {{ currentOrder.payment_method=='card'?
                                  'Seleccionado':'Elegir (No disponible)' }}
                              </div>
                            </div>
                          </li>
                          <li class="border-t
                          border-gray-200
                          pl-3
                          pr-4
                          py-3
                          flex
                          items-center
                          justify-between
                          text-base
                          leading-5">
                            <div class="w-0 flex-1 flex items-center">
                              <i class="fa fa-money-bill-alt"></i>
                              <span class="ml-2 flex-1 w-0 truncate">
                                Efectivo
                                <i class="fa fa-check text-green-400 ml-2"
                                  v-if="currentOrder.payment_method=='cash'"
                                ></i>
                              </span>
                            </div>
                            <div class="ml-4 flex-shrink-0">
                              <div
                                @click="paymentTypeSelect('cash')"
                                class="cursor-pointer font-medium
                                text-indigo-600
                                hover:text-indigo-500
                                transition
                                duration-150
                                ease-in-out">
                                {{ currentOrder.payment_method=='cash'?'Seleccionado':'Elegir' }}
                              </div>
                            </div>
                          </li>
                        </ul>
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>
          <ViewsMessages :view-name="viewName"/>
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
            <stripe-checkout
              ref="checkoutRef"
              :pk="publishableKey"
              :sessionId="sessionId"
            >
              <template slot="checkout-button">
                <button @click="nextStep(currentOrder.payment_method)"
                  :disabled="loading"
                  :class="loading?'opacity-50 cursor-not-allowed':''"
                  class="bg-green-500
                  hover:bg-green-700
                  text-white
                  py-2
                  px-4
                  rounded
                  focus:outline-none
                  focus:border-blue-400">
                  {{ currentOrder.payment_method=='cash'?'Agendar vehículo':'Proceder al pago' }}
                </button>
              </template>
            </stripe-checkout>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {
  mapState, mapActions, mapMutations, mapGetters,
} from 'vuex';
import 'moment/locale/es';
import { StripeCheckout } from 'vue-stripe-checkout';
import Tracker from '@/components/Tracker.vue';
import ViewsMessages from '@/components/ViewsMessages.vue';
import chalan from '../../api/chalan';

export default {
  name: 'step-four',
  data() {
    return {
      viewName: 'step-four',
      isMobilePhoneFieldActive: false,
      publishableKey: process.env.VUE_APP_STRIPE,
      sessionId: null,
      orderStatusId: {
        pending: 1,
        'in progress': 2,
      },
    };
  },
  components: {
    Tracker,
    StripeCheckout,
    ViewsMessages,
  },
  mounted() {
    this.$moment.locale('es');
    this.setLoader(false);
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
      'setCustomerData',
      'setViewsMessages',
      'setFormValidationMessages',
      'setLoader',
    ]),
    nextStep(paymentMethod) {
      this.validateRequiredFields(this.viewName);
      if (this.steps[this.viewName].isComplete && this.isUserLogged && this.phoneNumber) {
        if (paymentMethod === 'card') {
          this.createCardPayment();
        } else {
          this.createCashPayment();
        }
      }
    },
    paymentTypeSelect(payment) {
      this.setOrder({ section: 'currentOrder', field: 'payment_method', value: payment });
    },
    editMobilePhone() {
      this.isMobilePhoneFieldActive = !this.isMobilePhoneFieldActive;
    },
    createCardPayment() {
      this.setLoader(true);
      const payload = {
        orderId: this.currentOrder.order_id,
        token: this.customer.token,
        email: this.customer.email,
        customer_id: this.customer.customer_id,
        name: this.productName,
        description: this.currentOrder.vehicle_description,
        paymentMethod: this.currentOrder.payment_method,
        amount: this.currentOrder.amount * 100,
      };
      chalan.checkoutSession(payload)
        .then((response) => {
          if (response.status === 200) {
            this.sessionId = response.data.session_id;
            const customerPayload = {
              mobilePhone: this.customer.mobile_phone,
              customerId: this.customer.customer_id,
              token: this.customer.token,
            };
            chalan.updateCustomerProfile(customerPayload)
              .then((res) => {
                if (res.status === 204) {
                  const orderPayload = {
                    order: this.currentOrder,
                    customer: this.customer,
                    orderDetailsOrigin: this.orderDetailsOrigin,
                    orderDetailsDestination: this.orderDetailsDestination,
                    services: this.services,
                  };
                  chalan.updateOrder(orderPayload)
                    .then((orderResponse) => {
                      if (orderResponse.status === 200) {
                        this.$refs.checkoutRef.redirectToCheckout();
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
          }
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
    createCashPayment() {
      this.setLoader(true);
      chalan.checkoutCash({
        orderId: this.currentOrder.order_id,
        token: this.customer.token,
      })
        .then((response) => {
          if (response.status === 200) {
            const customerPayload = {
              mobilePhone: this.customer.mobile_phone,
              customerId: this.customer.customer_id,
              token: this.customer.token,
            };
            chalan.updateCustomerProfile(customerPayload)
              .then((res) => {
                if (res.status === 204) {
                  this.setOrder({ section: 'currentOrder', field: 'order_status_id', value: this.orderStatusId['in progress'] });
                  const orderPayload = {
                    order: this.currentOrder,
                    customer: this.customer,
                    orderDetailsOrigin: this.orderDetailsOrigin,
                    orderDetailsDestination: this.orderDetailsDestination,
                    services: this.services,
                  };
                  chalan.updateOrder(orderPayload)
                    .then((orderResponse) => {
                      if (orderResponse.status === 200) {
                        this.setViewsMessages({
                          view: 'dashboard',
                          message: {
                            text: 'Muy bien, tu vehículo ha sido agendado!',
                            type: 'success',
                          },
                        });
                        this.$router.push({ name: 'dashboard' });
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
  },
  computed: {
    ...mapState([
      'formValidationMessages',
      'steps',
      'viewsMessages',
      'currentOrder',
      'customer',
      'orderDetailsOrigin',
      'orderDetailsDestination',
      'services',
      'loading',
    ]),
    ...mapGetters([
      'isUserLogged',
    ]),
    itemsToMoveList() {
      return this.currentOrder.comments;
    },
    completeFromAddress() {
      const fromInteriorNumber = this.orderDetailsOrigin.from_interior_number
        ? `interior ${this.orderDetailsOrigin.from_interior_number},` : '';
      const fromFloor = this.orderDetailsOrigin.from_floor_number === '0'
        ? '- Planta baja' : `- Piso ${this.orderDetailsOrigin.from_floor_number}`;
      return `${this.orderDetailsOrigin.from_street},
        ${fromInteriorNumber}
        ${fromFloor}`;
    },
    completeToAddress() {
      const toInteriorNumber = this.orderDetailsDestination.to_interior_number
        ? `interior ${this.orderDetailsDestination.to_interior_number},` : '';
      const toFloor = this.orderDetailsDestination.to_floor_number === 0
        ? '- Planta baja' : `- Piso ${this.orderDetailsDestination.to_floor_number}`;
      return `${this.orderDetailsDestination.to_street},
        ${toInteriorNumber}
        ${toFloor}`;
    },
    phoneNumber: {
      get() {
        return this.customer.mobile_phone;
      },
      set(value) {
        this.setCustomerData({ field: 'mobile_phone', value });
      },
    },
    productName() {
      return `${this.currentOrder.vehicle_brand} ${this.currentOrder.vehicle_model} ${this.currentOrder.vehicle_weight} kg.`;
    },
  },
};
</script>
