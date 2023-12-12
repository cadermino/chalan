<template>
  <section class="text-gray-600 body-font overflow-hidden"
    v-if="name">
    <div class="container px-5 mx-auto">
      <div class="lg:w-4/5 mx-auto flex flex-wrap">
        <img
          alt="ecommerce"
          class="lg:w-1/2 w-full lg:h-auto h-64 object-cover object-center rounded"
          :src="coverImage"
        />
        <div class="lg:w-1/2 w-full lg:pl-10 lg:py-6 mt-6 lg:mt-0">
          <h2 class="text-sm title-font text-gray-500 tracking-widest">
            MUDANZAS
          </h2>
          <h1 class="text-gray-900 text-3xl title-font font-medium mb-1">
            {{name}}
          </h1>
          <div class="flex mb-4">
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
            <span id="social"
              class="flex ml-3 pl-3 py-2 border-l-2 border-gray-200 space-x-2s"
            >
              <a v-if="facebook" class="text-gray-500 mr-3"
                :href="facebook"
                target="_blank">
                <svg
                  fill="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  class="w-5 h-5"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"
                  ></path>
                </svg>
              </a>
              <a v-if="twitter" class="text-gray-500 mr-3">
                <svg
                  fill="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  class="w-5 h-5"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M23
                    3a10.9
                    10.9
                    0
                    01-3.14
                    1.53
                    4.48
                    4.48
                    0
                    00-7.86
                    3v1A10.66
                    10.66
                    0
                    013
                    4s-4
                    9
                    5
                    13a11.64
                    11.64
                    0
                    01-7
                    2c9
                    5
                    20
                    0
                    20-11.5a4.5
                    4.5
                    0
                    00-.08-.83A7.72
                    7.72
                    0
                    0023
                    3z"
                  ></path>
                </svg>
              </a>
              <a v-if="youtube" class="text-gray-500 mr-3"
                :href="youtube"
                target="_blank">
                <svg xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 256 180">
                  <path fill="#A0AFC0" d="M250.346
                    28.075A32.18
                    32.18
                    0
                    0
                    0
                    227.69
                    5.418C207.824
                    0
                    127.87
                    0
                    127.87
                    0S47.912.164
                    28.046
                    5.582A32.18
                    32.18
                    0
                    0
                    0
                    5.39
                    28.24c-6.009
                    35.298-8.34
                    89.084.165
                    122.97a32.18
                    32.18
                    0
                    0
                    0
                    22.656
                    22.657c19.866
                    5.418
                    99.822
                    5.418
                    99.822
                    5.418s79.955
                    0
                    99.82-5.418a32.18
                    32.18
                    0
                    0
                    0
                    22.657-22.657c6.338-35.348
                    8.291-89.1-.164-123.134Z"/>
                  <path fill="#FFF" d="m102.421 128.06l66.328-38.418l-66.328-38.418z"/>
                </svg>
              </a>
              <a v-if="phone" class="text-gray-500 mr-3"
                :href="`https://api.whatsapp.com/send?phone=${phone}`"
                target="_blank">
                <svg fill="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  class="w-5 h-5 ml-1"
                  viewBox="0 0 24 24">
                  <path d="M20.5129
                    3.4866C18.2882
                    1.24722
                    15.2597
                    -0.00837473
                    12.1032
                    4.20445e-05C5.54964
                    4.20445e-05
                    0.216056
                    5.33306
                    0.213776
                    11.8883C0.210977
                    13.9746
                    0.75841
                    16.0247
                    1.80085
                    17.8319L0.114014
                    23.9932L6.41672
                    22.34C8.15975
                    23.2898
                    10.1131
                    23.7874
                    12.0981
                    23.7874H12.1032C18.6556
                    23.7874
                    23.9897
                    18.4538
                    23.992
                    11.8986C24.0022
                    8.74248
                    22.7494
                    5.71347
                    20.5129
                    3.4866ZM17.5234
                    14.3755C17.2264
                    14.2267
                    15.7659
                    13.5085
                    15.4934
                    13.4064C15.2209
                    13.3044
                    15.0231
                    13.2576
                    14.8253
                    13.5552C14.6275
                    13.8528
                    14.058
                    14.5215
                    13.8847
                    14.7199C13.7114
                    14.9182
                    13.5381
                    14.9427
                    13.241
                    14.794C12.944
                    14.6452
                    11.9869
                    14.3316
                    10.8519
                    13.3198C9.96884
                    12.5319
                    9.36969
                    11.5594
                    9.19867
                    11.2618C9.02765
                    10.9642
                    9.18043
                    10.8057
                    9.32922
                    10.6552C9.46261
                    10.5224
                    9.62622
                    10.3086
                    9.77444
                    10.1348C9.92266
                    9.9609
                    9.97283
                    9.83776
                    10.0714
                    9.63938C10.1701
                    9.44099
                    10.121
                    9.26769
                    10.0469
                    9.1189C9.97283
                    8.97011
                    9.37824
                    7.50788
                    9.13083
                    6.9133C8.88969
                    6.3341
                    8.64513
                    6.4122
                    8.46271
                    6.40023C8.29169
                    6.39168
                    8.09102
                    6.38997
                    7.89264
                    6.38997C7.58822
                    6.39793
                    7.30097
                    6.53267
                    7.10024
                    6.76166C6.82831
                    7.05923
                    6.061
                    7.77752
                    6.061
                    9.23976C6.061
                    10.702
                    7.12532
                    12.1146
                    7.27354
                    12.313C7.42176
                    12.5114
                    9.36855
                    15.5117
                    12.3472
                    16.7989C12.9004
                    17.0375
                    13.4657
                    17.2468
                    14.0409
                    17.426C14.7523
                    17.654
                    15.3999
                    17.6204
                    15.9118
                    17.544C16.4819
                    17.4585
                    17.6694
                    16.8251
                    17.9173
                    16.1313C18.1653
                    15.4376
                    18.1648
                    14.8424
                    18.0884
                    14.7187C18.012
                    14.595
                    17.8204
                    14.5266
                    17.5234
                    14.3778V14.3755Z"
                    fill-rule="evenodd">
                  </path>
                </svg>
              </a>
            </span>
          </div>
          <p class="leading-relaxed">
            {{description}}
          </p>
          <div class="flex">
            <span class="title-font font-medium text-2xl text-gray-900"
              >{{formattedAmount}}</span
            >
            <button @click="$router.go(-1)"
              class="flex
              text-bg-blue-500
              underline
              ml-auto
              border-0
              py-2
              px-6
              rounded">Regresar</button>
            <button @click="goToOrderSteps"
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
              {{currentOrder.amount ? 'Agendar' : 'Cotizar'}}
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import { mapState, mapMutations, mapGetters } from 'vuex';
import chalan from '../../api/chalan';

export default {
  name: 'CarrierCompany',
  data() {
    return {
      name: null,
      address: null,
      description: null,
      phone: this.countryData.phone,
      coverImage: null,
      facebook: null,
      youtube: null,
      twitter: null,
      vehicles: null,
    };
  },
  mounted() {
    this.getCarrierCompanyData();
    this.setOrder({ field: 'carrier_company_id', value: this.carrierId });
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
      if (!this.currentOrder.amount) {
        return null;
      }
      return this.currentOrder.amount.toLocaleString('en-US', {
        style: 'currency',
        currency: this.countryData.currency,
        maximumSignificantDigits: 5,
      });
    },
    firstIncompleteStepName() {
      return this.getFirstIncompleteStep.viewName || 'dashboard';
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
      this.$router.push({ name: this.firstIncompleteStepName, query: { 'carrier-id': this.carrierId } });
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
      this.facebook = data.facebook;
      this.youtube = data.youtube;
      this.twitter = data.twitter;
      this.vehicles = data.vehicles;
    },
    getCarrierCompanyData() {
      const payload = {
        carrierId: this.carrierId,
      };
      chalan.getCarrierCompany(payload)
        .then((response) => {
          this.mapCarrierCompanyData(response.data);
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
  },
};
</script>
