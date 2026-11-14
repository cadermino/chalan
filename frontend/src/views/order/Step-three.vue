<template>
  <div>
    <div class="flex flex-wrap">
      <div class="w-full mb-4">
        <Tracker :current-view="viewName"></Tracker>
        <div class="w-full max-w-xl mx-auto sm:p-0 p-5 sm:pb-8">
          <ViewsMessages :view-name="viewName"/>
          <p class="text-center font-bold mb-6" id="text-header" v-if="quotationsList.length > 0">
            Elige la cotización adecuada para tu mudanza <span class="text-red-500">*</span>
          </p>
          <!-- Una columna, de la más barata a la más cara: en dos columnas el
               comentario del transportista desalineaba las tarjetas. -->
          <div class="mb-4" v-if="quotationsList.length > 0">
            <!-- En el celular solo entra la primera tarjeta: así se sabe que hay más abajo. -->
            <p class="text-sm text-gray-600 px-3 mb-1" id="quotations-count">
              <span class="font-bold">{{ quotationsCountLabel }}</span>
              <span v-if="quotationsList.length > 1"> · de la más barata a la más cara</span>
            </p>
            <div v-for="(quotation, index) in sortedQuotations"
              v-bind:value="index"
              v-bind:key="quotation.id"
              :class="index === 0 ? 'mb-5' : 'my-5'"
              class="w-full px-3">
              <div :class="[
                  (selectedQuotation.id == quotation.id) ? 'bg-gray-200' : '',
                  isBestOption(index) ? 'border-green-500 border-2' : 'border border-gray-400',
                ]"
                class="w-full rounded relative overflow-hidden">
                <!-- "Mejor precio" y no "Mejor opción": solo marca la más barata. -->
                <div v-if="isBestOption(index)" id="best-price"
                  class="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-xs font-bold
                    px-3 py-1 rounded-bl-lg shadow flex items-center">
                  <svg class="w-4 h-4 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24"
                    stroke-width="1.8" stroke="currentColor" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" :d="icons.trophy"/>
                  </svg>
                  Mejor precio
                </div>
                <div v-if="isBestOption(index)" class="h-6"></div>
                <div class="w-full
                  p-4
                  flex
                  flex-col
                  justify-between
                  leading-normal">
                  <div class="mb-4">
                    <!-- Sin reseñas no se inventan estrellas (ni se muestran cinco
                         vacías con "0 Evaluaciones"): "Nuevo en Chalán", y lo que
                         sí sabemos de la empresa. -->
                    <div class="flex flex-wrap items-center">
                      <span v-if="ratingState(quotation.carrier_company_id) === 'rated'"
                        id="stars" class="flex items-center mr-3 mb-1">
                        <svg
                          v-for="star in 5"
                          :key="star"
                          :fill="starFill(
                            quotation.carrier_company_id,
                            star
                          )"
                          stroke="currentColor"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          class="w-4 h-4 text-blue-500"
                          viewBox="0 0 24 24"
                        >
                          <path
                            d="M12 2l3.09 6.26L22 9.27l-5
                            4.87 1.18 6.88L12 17.77l-6.18
                            3.25L7 14.14 2 9.27l6.91-1.01L12
                            2z"
                          ></path>
                        </svg>
                        <a
                          href="#"
                          @click.prevent="goToCarrierCompanyView(quotation)"
                          class="text-blue-600 ml-3 hover:underline"
                        >
                          {{ reviewCountLabel(quotation.carrier_company_id) }}
                        </a>
                      </span>
                      <a v-else-if="ratingState(quotation.carrier_company_id) === 'new'"
                        href="#"
                        @click.prevent="goToCarrierCompanyView(quotation)"
                        id="new-company"
                        class="bg-blue-100 text-blue-800 text-sm font-bold rounded px-2 py-0.5 mr-2 mb-1
                          inline-flex items-center"
                      >
                        <svg class="w-4 h-4 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24"
                          stroke-width="1.8" stroke="currentColor" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" :d="icons.sparkle"/>
                        </svg>
                        Nuevo en Chalán
                      </a>
                      <!-- "Documentos verificados" entero: que subió DNI, licencia y
                           tarjeta; nada registra que Chalán los revisó, así que
                           "Verificado" a secas prometería más. -->
                      <span v-if="quotation.documents_verified" id="documents-verified"
                        class="bg-green-200 text-green-800 text-sm font-bold rounded px-2 py-0.5 mr-2 mb-1
                          inline-flex items-center">
                        <svg class="w-4 h-4 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24"
                          stroke-width="1.8" stroke="currentColor" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" :d="icons.shield"/>
                        </svg>
                        Documentos verificados
                      </span>
                      <span v-if="quotation.completed_moves" id="completed-moves"
                        class="bg-orange-200 text-orange-800 text-sm font-bold rounded px-2 py-0.5 mb-1
                          inline-flex items-center">
                        <svg class="w-4 h-4 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24"
                          stroke-width="1.8" stroke="currentColor" aria-hidden="true">
                          <path stroke-linecap="round" stroke-linejoin="round" :d="icons.truck"/>
                        </svg>
                        {{ completedMovesLabel(quotation.completed_moves) }}
                      </span>
                    </div>
                    <div class="text-gray-900 font-bold text-xl mb-2">
                      {{  quotation.total_amount
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
                      <li v-if="cargoCoverLabel(quotation.cargo_cover)"><span>Carga:</span>
                        <span class="font-bold"> {{ cargoCoverLabel(quotation.cargo_cover) }}</span>
                      </li>
                      <li v-if="quotation.manufacture_year"><span>Año:</span>
                        <span class="font-bold"> {{ quotation.manufacture_year }}</span>
                      </li>
                      <li v-if="payloadLabel(quotation)"><span>Capacidad de carga:</span>
                        <span class="font-bold"> {{ payloadLabel(quotation) }}</span>
                      </li>
                      <li v-if="quotation.note" class="mt-3 bg-gray-50 rounded p-2
                        text-gray-700 whitespace-pre-line break-words">
                        <span class="font-bold">Comentario del transportista:</span>
                        {{ quotation.note }}
                      </li>
                      <li v-if="quotation.description" class="mt-3">
                        {{ quotation.description }}
                      </li>
                    </ul>
                  </div>
                  <div class="flex items-center">
                    <button @click="(selectedQuotation.id == quotation.id) ?
                        openPaymentModal() : selectQuotation({quotation})"
                      type="button"
                      :class="(selectedQuotation.id == quotation.id) ?
                        'bg-gray-600 hover:bg-gray-700' :
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
                items-start
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
                <svg class="fill-current w-4 h-4 mr-2 mt-0.5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M12.432 0c1.34 0 2.01.912 2.01 1.957 0 1.305-1.164 2.512-2.679 2.512-1.269 0-2.009-.75-1.974-1.99C9.789 1.436 10.67 0 12.432 0zM8.309 20c-1.058 0-1.833-.652-1.093-3.524l1.214-5.092c.211-.814.246-1.141 0-1.141-.317 0-1.689.562-2.502 1.117l-.528-.88c2.572-2.186 5.531-3.467 6.801-3.467 1.057 0 1.233 1.273.705 3.23l-1.391 5.352c-.246.945-.141 1.271.106 1.271.317 0 1.357-.392 2.379-1.207l.6.814C12.098 19.02 9.365 20 8.309 20z"/></svg>
                <span class="block sm:inline">
                  <span class="font-bold block mb-1">
                    Todavía no hay cotizaciones para tu mudanza
                  </span>
                  Ya avisamos a los transportistas disponibles.
                  <template v-if="isSundayInLima">
                    Como hoy es domingo, lo más probable es que te respondan
                    mañana.
                  </template>
                  Apenas alguno responda te escribimos por WhatsApp y correo
                  con el enlace para verlas, así que puedes cerrar esta página.
                </span>
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
              @click="openPaymentModal">
              Siguiente
              </button>
          </div>
          <PaymentConfirmationModal
            :visible="showPaymentModal"
            :quotation="selectedQuotation"
            :currency="countryData.currency"
            show-yape-qr
            @close="closePaymentModal" />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapState, mapActions } from 'pinia';
import { useStore } from '@/store';
import Tracker from '@/components/Tracker.vue';
import ViewsMessages from '@/components/ViewsMessages.vue';
import PaymentConfirmationModal from '@/components/PaymentConfirmationModal.vue';
import axios from 'axios';
import chalan from '../../api/chalan';
import { track } from '../../utils/analytics';
import { reminderChannel } from '../../utils/reminderVisit';

// Íconos de las insignias de la tarjeta (Heroicons, de línea). Dibujados aquí y
// no con emojis, que en celulares viejos salen distintos o como cuadritos.
const ICONS = {
  trophy: 'M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0',
  shield: 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z',
  truck: 'M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12',
  sparkle: 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z',
};

export default {
  name: 'step-three',
  data() {
    return {
      viewName: 'step-three',
      icons: ICONS,
      getQuotationsDelayInMilliseconds: 5000,
      intervalId: null,
      quotationsList: [],
      companyRatings: {},
      quotationFields: {
        quotation_id: 'id',
        amount: 'total_amount',
        vehicle_brand: 'brand',
        vehicle_model: 'model',
        vehicle_weight: 'weight',
        vehicle_description: 'description',
        vehicle_picture: 'picture',
      },
      selectedQuotation: {},
      quotationSelectionPending: false,
      showPaymentModal: false,
    };
  },
  components: {
    Tracker,
    ViewsMessages,
    PaymentConfirmationModal,
  },
  mounted() {
    this.triggerQuotationRequest();
    this.getQuotations();
    this.getQuotationsInLoop();
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  },
  beforeUnmount() {
    clearInterval(this.intervalId);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  },
  props: {
    countryData: Object,
  },
  methods: {
    // La más barata, solo cuando hay con qué compararla.
    isBestOption(index) {
      return index === 0 && this.sortedQuotations.length > 1;
    },
    // Cómo viaja la carga según fotos del camión. No la carrocería de la
    // tarjeta SUNARP: un furgón inscrito puede tener barandas hoy.
    cargoCoverLabel(cargoCover) {
      return {
        cerrada: 'Cerrada (protegida de la lluvia)',
        toldo: 'Con toldo de lona',
        abierta: 'Abierta (sin techo)',
      }[cargoCover];
    },
    payloadLabel(quotation) {
      if (quotation.payload_tons) {
        return `${Math.round(quotation.payload_tons * 1000).toLocaleString('es-PE')} kg`;
      }
      // Vehículos que aún no tienen los datos de la tarjeta: weight es texto
      // libre ("2TN", "3.4"), así que va tal cual, sin inventarle unidad.
      return quotation.weight;
    },
    ...mapActions(useStore, [
      'setOrder',
      'setViewsMessages',
      'setLoader',
    ]),
    triggerQuotationRequest() {
      if (!this.currentOrder.order_id) return;
      const payload = {
        order: this.currentOrder,
        orderDetailsOrigin: this.orderDetailsOrigin,
        orderDetailsDestination: this.orderDetailsDestination,
        services: this.services,
        customer: this.customer,
        requestQuotationFromCarrierCompany: true,
      };
      chalan.updateOrder(payload).catch(() => {});
    },
    getQuotationsInLoop() {
      this.intervalId = setInterval(() => this.getQuotations(),
        this.getQuotationsDelayInMilliseconds);
    },
    handleVisibilityChange() {
      // Tab hidden (or device asleep) lets ticks pile up; a stale interval
      // then fires several requests at once on resume, each timing out.
      // Stop while hidden and do a single fresh fetch on return instead.
      if (document.hidden) {
        clearInterval(this.intervalId);
      } else {
        this.getQuotations();
        this.getQuotationsInLoop();
      }
    },
    goToCarrierCompanyView(quotation) {
      this.$router.push({
        name: 'carrier-company',
        params: { id: quotation.carrier_company_id },
        query: { quotation_id: quotation.id },
      }).catch(() => {});
    },
    getCompanyRating(carrierCompanyId) {
      const data = this.companyRatings[carrierCompanyId];
      return data ? data.average_rating : 0;
    },
    starFill(carrierCompanyId, star) {
      const rating = this.getCompanyRating(carrierCompanyId);
      return star <= Math.round(rating)
        ? 'currentColor' : 'none';
    },
    // loading mientras no llegan; unknown si falló la consulta (no decimos
    // "Nuevo" de una empresa que quizá tiene reseñas).
    ratingState(carrierCompanyId) {
      const data = this.companyRatings[carrierCompanyId];
      if (!data) return 'loading';
      if (data.failed) return 'unknown';
      return data.total_reviews > 0 ? 'rated' : 'new';
    },
    reviewCountLabel(carrierCompanyId) {
      const count = this.getCompanyReviewCount(carrierCompanyId);
      return count === 1 ? '1 Evaluación' : `${count} Evaluaciones`;
    },
    completedMovesLabel(count) {
      return count === 1 ? '1 mudanza con Chalán' : `${count} mudanzas con Chalán`;
    },
    getCompanyReviewCount(carrierCompanyId) {
      const data = this.companyRatings[carrierCompanyId];
      return data ? data.total_reviews : 0;
    },
    async fetchCompanyRatings(companyIds) {
      const uniqueIds = [...new Set(companyIds)]
        .filter(id => this.companyRatings[id] === undefined);
      const url = import.meta.env.VUE_APP_API_URL;
      const requests = uniqueIds.map(id => axios
        .get(`${url}reviews/company/${id}`)
        .then((response) => {
          this.companyRatings[id] = {
            average_rating: response.data.average_rating || 0,
            total_reviews: response.data.total_reviews || 0,
          };
        })
        .catch(() => {
          this.companyRatings[id] = {
            average_rating: 0,
            total_reviews: 0,
            failed: true,
          };
        }));
      await Promise.all(requests);
    },
    openPaymentModal() {
      this.showPaymentModal = true;
    },
    closePaymentModal() {
      this.showPaymentModal = false;
    },
    getQuotations() {
      // Solo el id, para que el botón ya diga "Seleccionado" mientras llega la
      // lista; el objeto completo lo arma la reconciliación de abajo. Se
      // reemplaza el objeto entero en vez de mutarle la propiedad: `id` no
      // existe en el `{}` inicial, así que asignarla no sería reactiva.
      //
      // El guard de total_amount es lo que evita pisar una cotización que ya
      // está completa. Sin él esto corría en cada tick del poll —cada 5s— y
      // dejaba el objeto pelado durante todo el viaje de red: con el modal
      // abierto, monto y QR desaparecían ~20ms y volvían, un parpadeo
      // constante. Si la selección cambió en el servidor, la reconciliación
      // de abajo la reemplaza igual.
      if (!this.quotationSelectionPending && !this.selectedQuotation.total_amount) {
        this.selectedQuotation = { id: this.currentOrder.quotation_id || null };
      }
      const payload = {
        orderId: this.currentOrder.order_id,
        token: this.customer.token,
      };
      chalan.getQuotations(payload)
        .then((response) => {
          this.quotationsList = response.data;
          // Skip reconciling "which quotation is selected" while a pick is
          // unconfirmed server-side, so a poll tick doesn't wipe it out from
          // under the modal. The list itself still refreshes either way, so
          // quotations from other carriers keep showing up.
          if (!this.quotationSelectionPending) {
            // Hay que leerlo antes: unSelectQuotation pone en null todos los
            // campos de cotización del store, `quotation_id` incluido.
            const pickedId = this.currentOrder.quotation_id;
            this.unSelectQuotation();
            this.quotationsList.forEach((quotation) => {
              // `selected` solo se marca en el server al confirmar el pago, así
              // que una cotización elegida pero aún sin confirmar (el usuario
              // salió a "Ver más" y volvió) solo se reconoce por el id
              // guardado. Sin esto selectedQuotation se queda en {id} pelado y
              // el modal abre sin monto ni QR.
              if (quotation.selected || quotation.id === pickedId) {
                this.selectQuotation({ quotation, jumpToNextStep: false });
              }
            });
          }
          const companyIds = this.quotationsList.map(q => q.carrier_company_id);
          if (companyIds.length > 0) {
            this.fetchCompanyRatings(companyIds);
          }
          this.setLoader(false);
        })
        .catch(() => {
          // Don't rethrow here: this runs on an unawaited setInterval tick,
          // so a throw becomes an unhandled promise rejection on every
          // transient network hiccup instead of just showing the message below.
          this.setViewsMessages({
            view: this.viewName,
            message: {
              text: 'Hubo un error, intenta después de recargar la página',
              type: 'error',
            },
          });
          this.setLoader(false);
        });
    },
    selectQuotation({ quotation, jumpToNextStep = true }) {
      this.selectedQuotation = quotation;
      Object.keys(this.quotationFields).forEach((field) => {
        this.setOrder({ section: 'currentOrder', field, value: this.selectedQuotation[this.quotationFields[field]] });
      });
      if (jumpToNextStep) {
        // Solo aquí: con jumpToNextStep en false esto es la reconciliación al
        // cargar la vista, no una elección del usuario.
        track('quotation_selected', {
          order_id: this.currentOrder.order_id,
          quotation_id: quotation.id,
          value: quotation.total_amount,
          currency: this.countryData.currency,
          reminder: reminderChannel(this.currentOrder.order_id),
        });
        this.quotationSelectionPending = true;
        this.openPaymentModal();
      }
    },
    unSelectQuotation() {
      Object.keys(this.quotationFields).forEach((field) => {
        this.setOrder({ section: 'currentOrder', field, value: null });
      });
    },
  },
  computed: {
    // De menor a mayor precio. En empate gana la mejor puntuada, después la
    // de más evaluaciones, y si no, la que llegó primero. Las puntuaciones
    // llegan después que las cotizaciones: el orden se rehace cuando cargan.
    quotationsCountLabel() {
      const count = this.quotationsList.length;
      return count === 1 ? 'Tienes 1 cotización' : `Tienes ${count} cotizaciones`;
    },
    sortedQuotations() {
      return [...this.quotationsList].sort((a, b) => (
        a.total_amount - b.total_amount
        || this.getCompanyRating(b.carrier_company_id) - this.getCompanyRating(a.carrier_company_id)
        || this.getCompanyReviewCount(b.carrier_company_id) - this.getCompanyReviewCount(a.carrier_company_id)
        || a.id - b.id
      ));
    },
    ...mapState(useStore, [
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
    // Los domingos casi ningún transportista cotiza: sin esto el cliente espera
    // una respuesta que llega recién el lunes. Domingo en Lima, no en el
    // reloj del teléfono.
    isSundayInLima() {
      return new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', weekday: 'short' })
        .format(new Date()) === 'Sun';
    },
  },
};
</script>
