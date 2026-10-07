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
            Cotización orden {{orderData.id}}
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
              <p v-if="distanceBetweenAddress">
                <span class="font-bold
                  mr-1">Distancia entre las dos direcciones: </span>
                <a :href="distanceBetweenAddress"
                  class="underline"
                  target="_blank">Link a la dirección</a>
              </p>
              <p>
                <span class="font-bold
                  mr-1">Servicio de embalaje: </span>
                {{ packagingService }}
              </p>
              <p>
                <span class="font-bold
                  mr-1">Requiere cargadores: </span>
                {{ cargoService }}
                <span v-if="loadersQuantity">({{ loadersQuantity }})</span>
              </p>
              <!-- El catálogo tiene cinco servicios y solo dos se piden en el
                   flujo del cliente. Los demás llegan asignados desde el
                   backoffice, y sin esta línea el transportista cotizaría sin
                   saber que también hay que armar o desarmar muebles. -->
              <p v-if="otherServices.length > 0">
                <span class="font-bold
                  mr-1">Otros servicios: </span>
                {{ otherServices.join(', ') }}
              </p>
              <p>
                <span class="font-bold
                  mr-1">Presupuesto aproximado: </span>
                {{
                  approximateBudget.toLocaleString('en-US', {
                    style: 'currency',
                    currency: countryData.currency,
                    maximumSignificantDigits: 5,
                  }) }}
              </p>

              <div v-if="routeMapUrl" class="mt-5">
                <p class="font-bold mr-1 mb-2">Ruta origen → destino:</p>
                <div class="overflow-hidden rounded-lg border border-gray-200">
                  <iframe
                    :src="routeMapUrl"
                    class="w-full h-64"
                    loading="lazy"
                    referrerpolicy="no-referrer-when-downgrade"
                    title="Mapa de ruta de mudanza"
                    allowfullscreen
                  ></iframe>
                </div>
                <p class="text-xs text-gray-500 mt-2">
                  Vista de referencia para ubicar mejor la ruta de la mudanza.
                </p>
              </div>
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
                {{ formatFloor(fromAddress.floor_number) }}
              </p>
              <p>
                <span class="font-bold
                  mr-1">Elevador: </span>
                {{ fromAddress.has_elevator === 1 ? 'Sí' : 'No' }}
              </p>
              <p>
                <span class="font-bold
                  mr-1">Distancia del estacionamiento a la puerta: </span>
                {{ fromAddress.approximate_distance_from_parking }} mts.
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
                {{ formatFloor(toAddress.floor_number) }}
              </p>
              <p>
                <span class="font-bold
                  mr-1">Elevador: </span>
                {{ toAddress.has_elevator === 1 ? 'Sí' : 'No' }}
              </p>
              <p>
                <span class="font-bold
                  mr-1">Distancia del estacionamiento a la puerta: </span>
                {{ toAddress.approximate_distance_from_parking }} mts.
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
            <div
              id="answer3"
              class="px-4 pb-5 sm:px-6 sm:pb-6">
              <p v-if="itemsToMoveList">
                <pre>{{ itemsToMoveList }}</pre>
              </p>
              <div v-if="orderImages.length" class="mt-4">
                <p class="font-bold mb-2">
                  Fotos de la carga:
                </p>
                <div class="flex flex-wrap gap-3">
                  <a v-for="(img, index) in orderImages"
                    :key="index"
                    :href="img.url"
                    target="_blank"
                    class="block">
                    <img :src="img.url"
                      class="w-32 h-32 object-cover rounded
                        border hover:opacity-80
                        transition-opacity"
                      :alt="'Foto ' + (index + 1)" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="hasQuotation" class="max-w-3xl mx-auto mt-8 space-y-4">
          <p>
            <span class="font-bold
              mr-1">Cotización actual:
            </span>
            {{
              amountFromDatabase.toLocaleString('en-US', {
                style: 'currency',
                currency: countryData.currency,
                maximumSignificantDigits: 5,
              }) }}
          </p>
        </div>
        <div v-if="!hasQuotation && !decline" class="max-w-3xl mx-auto mt-8 space-y-4">
          <div class="
            rounded-lg
            flex
            flex-col
            md:ml-auto
            w-full
            mt-10">
            <h2 class="text-gray-800 text-lg font-semibold mb-5">Ingresar cotización</h2>
            <div class="relative mb-4">
              <label for="email"
                class="leading-7
                  text-sm
                  text-gray-600">S/.</label>
              <p v-if="formValidationMessages['quotation_amount']"
                  class="text-red-500
                  text-xs
                  italic">{{ formValidationMessages['quotation_amount'] }}.</p>
              <input
                type="text"
                id="amount"
                name="amount"
                placeholder="Ej. 1450"
                v-model="amount"
                :class="formValidationMessages['quotation_amount']
                    ?'border-red-300':''"
                class="w-full
                  bg-white
                  rounded
                  border
                  border-gray-300
                  focus:border-indigo-500
                  focus:ring-2
                  focus:ring-indigo-200
                  text-base
                  outline-none
                  text-gray-700
                  py-1
                  px-3
                  leading-8
                  transition-colors
                  duration-500
                  ease-in-out">
            </div>
            <button @click="sendQuotation"
              class="text-white
              bg-blue-500
            hover:bg-blue-700
              border-0
              py-2
              px-8
              focus:outline-none
              rounded
              text-lg">Enviar cotización</button>
          </div>
        </div>

        <!-- Rechazar: el transportista avisa que no puede hacer la mudanza.
             Retira su cotización viva, y se deshace mientras la orden siga
             pendiente. Con la cotización ya elegida no aparece. -->
        <div v-if="decline"
          class="max-w-3xl mx-auto mt-8 p-5 bg-white border border-gray-200 shadow-lg">
          <h2 class="text-gray-800 text-lg font-semibold">Rechazaste esta mudanza</h2>
          <p class="text-gray-600 mt-1">
            {{ declineReasonLabel(decline.reason) }}
            <span v-if="decline.note">— “{{ decline.note }}”</span>
          </p>
          <p v-if="declineError" class="text-red-500 text-sm mt-3">{{ declineError }}</p>
          <button v-if="canDecline"
            @click="undoDecline"
            :disabled="declineSaving"
            class="mt-4 border border-blue-500 text-blue-600 hover:bg-blue-50
              py-2 px-6 rounded disabled:opacity-50">
            Cambié de opinión, quiero cotizar
          </button>
        </div>
        <div v-else-if="canDecline" class="max-w-3xl mx-auto mt-6">
          <p v-if="!declineOpen" class="text-center">
            <button @click="declineOpen = true"
              class="text-gray-500 underline hover:text-gray-700">
              No puedo hacer esta mudanza
            </button>
          </p>
          <div v-else class="p-5 bg-white border border-gray-200 shadow-lg">
            <h2 class="text-gray-800 text-lg font-semibold">¿Por qué no puedes hacerla?</h2>
            <p class="text-gray-500 text-sm mt-1">
              Así sabemos qué mudanzas mandarte.
              <span v-if="hasQuotation">Tu cotización actual se retirará.</span>
            </p>
            <div class="mt-4 space-y-2">
              <label v-for="option in declineReasons"
                :key="option.code"
                class="flex items-center text-gray-700">
                <input type="radio"
                  name="decline-reason"
                  :value="option.code"
                  v-model="declineReason"
                  @change="declineError = ''"
                  class="mr-2">
                {{ option.label }}
              </label>
            </div>
            <label for="decline-note" class="block text-sm text-gray-600 mt-4">
              Nota {{ declineReason === 'other' ? '(obligatoria)' : '(opcional)' }}
            </label>
            <textarea id="decline-note"
              v-model="declineNote"
              rows="2"
              maxlength="500"
              class="w-full bg-white rounded border border-gray-300
                focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200
                text-gray-700 py-1 px-3 outline-none"></textarea>
            <p v-if="declineError" class="text-red-500 text-sm mt-2">{{ declineError }}</p>
            <div class="mt-4 flex gap-2">
              <button @click="sendDecline"
                :disabled="declineSaving"
                class="text-white bg-red-600 hover:bg-red-700
                  py-2 px-6 rounded disabled:opacity-50">
                Confirmar rechazo
              </button>
              <button @click="declineOpen = false; declineError = ''"
                :disabled="declineSaving"
                class="text-gray-600 hover:bg-gray-100 py-2 px-6 rounded">
                Volver
              </button>
            </div>
          </div>
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
import formatFloor from '../../utils/floor';

export default {
  name: 'quotation',
  props: {
    token: String,
    countryData: Object,
  },
  data() {
    return {
      viewName: 'quotation',
      orderData: {},
      orderDetails: [],
      carrierCompanyId: null,
      amount: null,
      quotations: [],
      services: [],
      quotationStatus: {
        active: 1,
        selected: 2,
        cancelled: 3,
      },
      decline: null,
      declineOpen: false,
      declineReason: '',
      declineNote: '',
      declineError: '',
      declineSaving: false,
      // Los códigos los valida el API (app/api/carrier_declines.py).
      declineReasons: [
        { code: 'date_unavailable', label: 'No tengo disponibilidad en esa fecha' },
        { code: 'zone', label: 'No trabajo en esa zona' },
        { code: 'vehicle', label: 'No tengo el vehículo adecuado' },
        { code: 'budget', label: 'No me conviene por el presupuesto' },
        { code: 'other', label: 'Otro motivo' },
      ],
      googleDistanceUrl: process.env.VUE_APP_GOOGLE_DISTANCE_URL,
      googleMapsApiKey: process.env.VUE_APP_PLACES_API_KEY,
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
      'orderDetailsOrigin',
      'orderDetailsDestination',
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
    orderImages() {
      return this.orderData?.images || [];
    },
    hasQuotation() {
      return Boolean(this.amountFromDatabase) || false;
    },
    amountFromDatabase() {
      if (!this.quotations || this.quotations.length === 0) {
        return null;
      }
      const currentQuotation = this.quotations
        .filter(quotation => quotation.carrier_company_id === this.carrierCompanyId
          && quotation.quotation_status_id !== this.quotationStatus.cancelled);
      if (currentQuotation.length === 0) {
        return null;
      }
      return currentQuotation[0].amount;
    },
    packagingService() {
      if (!this.services || this.services.length === 0) {
        return 'No';
      }
      return this.services.filter(item => item.name === 'packaging').length === 0 ? 'No' : 'Sí';
    },
    cargoService() {
      if (!this.services || this.services.length === 0) {
        return 'No';
      }
      return this.services.filter(item => item.name === 'cargo').length === 0 ? 'No' : 'Sí';
    },
    otherServices() {
      // Todo lo que no tiene su propia línea arriba. Se rotula con la
      // descripción del catálogo, que ya está en español, y se cae al nombre
      // solo si la orden viene de antes de que el API la mandara.
      const withOwnLine = ['packaging', 'cargo'];
      return (this.services || [])
        .filter(item => !withOwnLine.includes(item.name))
        .map(item => item.description || item.name);
    },
    distanceBetweenAddress() {
      if (!this.fromAddress || !this.toAddress) {
        return false;
      }
      return `${this.googleDistanceUrl}${this.fromAddress.street}/${this.toAddress.street}`;
    },
    routeMapUrl() {
      if (!this.fromAddress || !this.toAddress || !this.googleMapsApiKey) {
        return null;
      }

      const buildAddress = (address) => {
        const parts = [
          address.street,
          address.neighborhood,
          address.city,
          address.state,
        ].filter(Boolean);
        return parts.join(', ');
      };

      const origin = buildAddress(this.fromAddress);
      const destination = buildAddress(this.toAddress);
      if (!origin || !destination) {
        return null;
      }

      const base = 'https://www.google.com/maps/embed/v1/directions';
      return `${base}?key=${encodeURIComponent(this.googleMapsApiKey)}&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=driving&language=es`;
    },
    approximateBudget() {
      if (!this.orderData.approximate_budget) {
        return 0;
      }
      return Math.round(this.orderData.approximate_budget);
    },
    loadersQuantity() {
      return this.orderData?.loaders_quantity;
    },
    canDecline() {
      // Solo con la orden pendiente y si a este transportista no lo eligieron;
      // el API aplica la misma regla.
      const pending = this.orderData?.order_status_id === 1;
      const mineSelected = this.quotations.some(quotation => quotation.carrier_company_id
        === this.carrierCompanyId
        && quotation.quotation_status_id === this.quotationStatus.selected);
      return pending && !mineSelected;
    },
  },
  methods: {
    formatFloor,
    ...mapMutations([
      'setFormValidationMessages',
      'setViewsMessages',
      'setLoader',
    ]),
    accordionButton(contentTagElementId, arrowTagElementId) {
      const content = document.getElementById(contentTagElementId);
      const arrow = document.getElementById(arrowTagElementId);
      if (!content || !arrow) {
        return;
      }
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
            this.quotations = this.orderData.quotations || [];
            this.services = this.orderData.services;
            this.decline = response.data.decline || null;
          }
          this.setLoader(false);
        })
        .catch((error) => {
          let message = '';
          if (error.response && error.response.status === 400) {
            message = 'El token es inválido';
          } else if (error.response && error.response.status === 401) {
            message = 'Proporciona un token por favor';
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
          this.setLoader(false);
        });
    },
    declineReasonLabel(code) {
      const option = this.declineReasons.find(item => item.code === code);
      return option ? option.label : code;
    },
    declineErrorMessage(error) {
      const message = (error.response && error.response.data
        && error.response.data.message) || '';
      if (!error.response) {
        return 'No hay conexión. Revisa tu internet e inténtalo de nuevo.';
      }
      if (message.includes('already selected')) {
        return 'Tu cotización ya fue elegida: no se puede rechazar desde acá. Escríbenos para resolverlo.';
      }
      if (message.includes('not awaiting')) {
        return 'Esta orden ya no está esperando cotizaciones.';
      }
      if (message.includes('Invalid token')) {
        return 'El link no es válido. Pide uno nuevo a Chalán.';
      }
      return 'No pudimos guardar tu respuesta, intenta de nuevo.';
    },
    sendDecline() {
      if (!this.declineReason) {
        this.declineError = 'Elige un motivo.';
        return;
      }
      const note = this.declineNote.trim();
      if (this.declineReason === 'other' && !note) {
        this.declineError = 'Cuéntanos el motivo en la nota.';
        return;
      }
      this.declineSaving = true;
      this.declineError = '';
      chalan
        .declineOrder(this.token, this.orderData.id, {
          reason: this.declineReason,
          note: note || null,
        })
        .then(() => {
          this.declineOpen = false;
          this.declineReason = '';
          this.declineNote = '';
          // Se vuelve a leer: la cotización que tenía viva quedó retirada.
          this.getOrder();
        })
        .catch((error) => {
          this.declineError = this.declineErrorMessage(error);
          if (error.response && error.response.status === 409) {
            this.getOrder();
          }
        })
        .finally(() => {
          this.declineSaving = false;
        });
    },
    undoDecline() {
      this.declineSaving = true;
      this.declineError = '';
      chalan
        .undoDeclineOrder(this.token, this.orderData.id)
        .then(() => {
          this.decline = null;
        })
        .catch((error) => {
          this.declineError = this.declineErrorMessage(error);
        })
        .finally(() => {
          this.declineSaving = false;
        });
    },
    sendQuotation() {
      if (!this.amount) {
        this.setFormValidationMessages({
          field: 'quotation_amount',
          message: 'Ingresa la cotización',
        });
        return;
      }
      this.setLoader(true);
      const payload = {
        token: this.token,
        amount: this.amount,
      };
      chalan
        .createQuotation(payload)
        .then((response) => {
          if (response.status >= 200) {
            // Si esta empresa ya tenía cotización viva se reemplaza la que
            // está en pantalla; un push dejaría la vieja y la nueva juntas,
            // mostrando dos precios para el mismo transportista.
            const existing = this.quotations
              .find(quotation => quotation.carrier_company_id === this.carrierCompanyId
                && quotation.quotation_status_id !== this.quotationStatus.cancelled);
            if (existing) {
              existing.amount = response.data.amount;
              existing.quotation_status_id = response.data.quotation_status_id;
            } else {
              this.quotations.push({
                amount: response.data.amount,
                carrier_company_id: this.carrierCompanyId,
                quotation_status_id: response.data.quotation_status_id,
              });
            }
            this.setViewsMessages({
              view: this.viewName,
              message: {
                text: existing
                  ? 'Cotización actualizada exitosamente'
                  : 'Cotización enviada exitosamente',
                type: 'success',
              },
            });
          }
          this.setLoader(false);
        })
        .catch((error) => {
          let message = '';
          if (error.response && error.response.status === 400) {
            message = 'El token es inválido';
          } else if (error.response && error.response.status === 401) {
            message = 'Proporciona un token por favor';
          } else if (error.response && error.response.status === 409) {
            // El cliente ya aceptó esta cotización y su precio quedó cerrado.
            message = 'El cliente ya aceptó tu cotización, por eso no se puede '
              + 'cambiar el monto. Escríbenos si necesitas ajustarlo.';
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
          this.setLoader(false);
        });
    },
  },
};
</script>
