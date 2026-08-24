<template>
  <section class="text-gray-600 body-font overflow-hidden"
    v-if="name">
    <div class="container px-5 mx-auto">
      <div class="lg:w-4/5 mx-auto flex flex-wrap">
        <img
          alt="vehicle-image"
          class="lg:w-1/2 w-full lg:h-auto h-64 object-cover object-center rounded"
          :src="require('../../assets/peterbilt-337.png')"
        />
        <div class="lg:w-1/2 w-full lg:pl-10 lg:py-6 mt-6 lg:mt-0">
          <h2 class="text-sm title-font text-gray-500 tracking-widest">
            MUDANZAS
          </h2>
          <div class="flex items-center gap-4 mb-4 flex-wrap">
            <h1 class="text-gray-900 text-3xl title-font font-medium">
              {{name}}
            </h1>
            <div class="flex items-center gap-2">
              <span class="text-2xl font-bold text-gray-900">
                {{ averageRating.toFixed(1) }}
              </span>
              <div>
                <span id="stars" class="flex items-center">
                  <svg
                    v-for="star in 5"
                    :key="star"
                    :fill="star <= Math.round(averageRating)
                      ? 'currentColor' : 'none'"
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
                </span>
                <p class="text-sm text-gray-500">{{ totalReviews }} reseñas</p>
              </div>
            </div>
          </div>
          <p class="leading-relaxed">
            {{description}}
          </p>
          <div class="flex">
            <span class="title-font font-medium text-2xl text-gray-900"
              >{{formattedAmount}}</span
            >
            <button @click="handleRegresar"
              class="flex
              text-bg-blue-500
              underline
              ml-auto
              border-0
              py-2
              px-6
              rounded">Regresar</button>
            <button @click="handleAgendarClick"
              class="flex
              ml-7
              text-white
              bg-blue-500
              border-0
              py-2
              px-6
              focus:outline-none
              hover:bg-blue-600
              rounded">
              {{(orderQuotation || currentOrder.amount) ? 'Agendar' : 'Cotizar'}}
            </button>
          </div>
        </div>
      </div>
    </div>
    <PaymentConfirmationModal
      :visible="showPaymentModal"
      :quotation="orderQuotation || {}"
      :currency="countryData.currency"
      @close="showPaymentModal = false" />
    <!-- Reviews Section -->
    <div class="container px-5 py-10 mx-auto"
      v-if="reviews.length > 0">
      <div class="lg:w-4/5 mx-auto">
        <h2 class="text-2xl font-bold mb-6 text-gray-900">
          Evaluaciones ({{ totalReviews }})
        </h2>
        <div class="space-y-4">
          <div v-for="review in reviews"
            :key="review.id"
            class="bg-white rounded-lg border
              border-gray-200 p-6">
            <div class="flex justify-between
              items-start mb-2">
              <p class="font-medium text-gray-900">
                {{ review.customer_name }}
              </p>
              <div class="flex items-center">
                <svg
                  v-for="s in 5"
                  :key="s"
                  :fill="s <= review.rating
                    ? 'currentColor' : 'none'"
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
                <span class="text-sm
                  text-gray-500 ml-2">
                  {{ formatDate(review.created_date) }}
                </span>
              </div>
            </div>
            <p class="text-gray-700">
              {{ review.comment }}
            </p>
          </div>
        </div>
        <div class="mt-6 text-center">
          <a
            :href="`/reviews/${carrierId}`"
            class="text-blue-600 hover:underline
              font-medium"
          >
            Ver todas las evaluaciones →
          </a>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import { mapState, mapMutations, mapGetters } from 'vuex';
import axios from 'axios';
import PaymentConfirmationModal from '@/components/PaymentConfirmationModal.vue';
import chalan from '../../api/chalan';

export default {
  name: 'CarrierCompany',
  components: {
    PaymentConfirmationModal,
  },
  data() {
    return {
      name: null,
      address: null,
      description: null,
      coverImage: null,
      vehicles: null,
      averageRating: 0,
      totalReviews: 0,
      reviews: [],
      orderQuotation: null,
      showPaymentModal: false,
    };
  },
  mounted() {
    this.getCarrierCompanyData();
    this.fetchOrderQuotation();
  },
  props: {
    carrierId: Number,
    viewName: String,
    countryData: Object,
    amount: Number,
    quotationId: Number,
  },
  computed: {
    ...mapState([
      'currentOrder',
      'customer',
    ]),
    ...mapGetters([
      'getFirstIncompleteStep',
    ]),
    formattedAmount() {
      const amount = this.orderQuotation
        ? this.orderQuotation.total_amount
        : this.currentOrder.amount;
      if (!amount) {
        return null;
      }
      return amount.toLocaleString('en-US', {
        style: 'currency',
        currency: this.countryData.currency,
        maximumSignificantDigits: 5,
      });
    },
    firstIncompleteStepName() {
      return this.getFirstIncompleteStep.viewName || 'dashboard';
    },
    quotationIdFromQuery() {
      const raw = this.$route.query.quotation_id;
      return raw ? Number(raw) : null;
    },
  },
  methods: {
    ...mapMutations([
      'setOrder',
      'setViewsMessages',
      'setLoader',
    ]),
    goToOrderSteps() {
      if (this.currentOrder.quotation_id) {
        this.pickQuotation();
      }
      this.$router.push({ name: this.firstIncompleteStepName, query: { 'carrier-id': this.carrierId } }).catch(() => {});
    },
    async fetchOrderQuotation() {
      if (!this.quotationIdFromQuery || !this.currentOrder.order_id) return;
      try {
        const response = await chalan.getQuotations({
          orderId: this.currentOrder.order_id,
          token: this.customer.token,
        });
        this.orderQuotation = response.data.find(
          quotation => quotation.id === this.quotationIdFromQuery,
        ) || null;
      } catch (error) {
        this.orderQuotation = null;
      }
    },
    handleAgendarClick() {
      if (this.orderQuotation) {
        this.showPaymentModal = true;
        return;
      }
      this.goToOrderSteps();
    },
    handleRegresar() {
      if (this.quotationIdFromQuery) {
        this.$router.push({ name: 'step-three' }).catch(() => {});
        return;
      }
      this.$router.go(-1);
    },
    async pickQuotation() {
      this.setLoader(true);
      const quotationPayload = {
        quotationId: this.currentOrder.quotation_id,
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
    mapCarrierCompanyData(data) {
      this.name = data.name;
      this.address = data.address;
      this.description = data.description;
      this.coverImage = data.cover_image;
      this.vehicles = data.vehicles;
    },
    getCarrierCompanyData() {
      const payload = {
        carrierId: this.carrierId,
      };
      chalan.getCarrierCompany(payload)
        .then((response) => {
          this.mapCarrierCompanyData(response.data);
          this.fetchReviews();
        })
        .catch((error) => {
          if (error.response && error.response.status === 404) {
            this.setViewsMessages({
              view: this.viewName,
              message: {
                type: 'error',
                text: 'No encontarmos el contenido',
              },
            });
          }
        });
    },
    fetchReviews() {
      const url = process.env.VUE_APP_API_URL;
      axios
        .get(`${url}reviews/company/${this.carrierId}`)
        .then((response) => {
          const { data } = response;
          this.averageRating = data.average_rating || 0;
          this.totalReviews = data.total_reviews || 0;
          this.reviews = data.reviews || [];
        })
        .catch(() => {
          this.averageRating = 0;
          this.totalReviews = 0;
          this.reviews = [];
        });
    },
    formatDate(dateStr) {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-PE');
    },
  },
};
</script>
