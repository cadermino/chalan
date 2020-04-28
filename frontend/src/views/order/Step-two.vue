<template>
  <div>
    <div class="flex flex-wrap">
      <div class="w-full mb-4">
        <Tracker :current-view="viewName"></Tracker>
        <div class="w-full max-w-xl mx-auto sm:p-0 p-5 sm:pb-8">
          <div class="flex items-center mb-8">
            <div v-if="viewsMessages[viewName]"
              class="bg-red-100
              w-full
              border
              border-red-400
              text-red-700
              px-4
              py-3
              rounded
              relative"
              role="alert">
              <strong class="font-bold">Oops! </strong>
              <span class="block sm:inline">
                {{ viewsMessages[viewName] }}
              </span>
            </div>
          </div>
          <p class="text-center font-bold mb-10" id="text-header">
            Elige el tamaño de tu mudanza <span class="text-red-500">*</span>
          </p>
          <div class="flex flex-wrap mb-4">
            <div class="inline-flex w-full">
              <button
                @click="selectSize('small')"
                :class="selectedSize === 'small'?
                  'bg-green-400 text-white hover:bg-green-500':'bg-gray-400'"
                class="w-full
                focus:outline-none
                hover:bg-gray-500
                text-gray
                py-2
                px-4
                rounded-l">
                Pequeño
              </button>
              <button
                @click="selectSize('medium')"
                :class="selectedSize === 'medium'?
                  'bg-green-400 text-white hover:bg-green-500':'bg-gray-400'"
                class="w-full
                focus:outline-none
                hover:bg-gray-500
                text-gray
                py-2
                px-4">
                Mediano
              </button>
              <button
                @click="selectSize('large')"
                :class="selectedSize === 'large'?
                  'bg-green-400 text-white hover:bg-green-500':'bg-gray-400'"
                class="w-full
                focus:outline-none
                hover:bg-gray-500
                text-gray
                py-2
                px-4
                rounded-r">
                Grande
              </button>
            </div>
          </div>
          <div class="flex flex-wrap mb-4" v-if="productListFiltered.length">
            <div v-for="(product, index) in productListFiltered"
              v-bind:value="index"
              v-bind:key="index"
              class="w-full my-5 md:w-1/2 px-3">
              <div @click="(currentOrder.product_id == product.id) ?
                        '' : selectProduct(product)"
                :class="(currentOrder.product_id == product.id) ? 'bg-gray-200' : ''"
                class="w-full cursor-pointer">
                <img class="h-auto
                  w-full
                  flex-none
                  bg-cover
                  border-l border-r border-b-0 border-t border-gray-400
                  rounded-t
                  text-center
                  overflow-hidden"
                  :src="require(`@/assets/${product.picture}`)"
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
                    <div class="text-gray-900 font-bold text-xl mb-2">
                      {{  product.price
                            .toLocaleString('en-US', {
                              style: 'currency',
                              currency: 'MXN',
                              maximumSignificantDigits: 3,
                            }
                          )
                      }}
                    </div>
                    <ul>
                      <li><span>Marca:</span>
                        <span class="font-bold"> {{ product.brand }}</span>
                      </li>
                      <li><span>Modelo:</span>
                        <span class="font-bold"> {{ product.model }}</span>
                      </li>
                      <li><span>Límite de peso:</span>
                        <span class="font-bold"> {{ product.weight }} kg</span>
                      </li>
                      <li class="mt-3">
                        {{ product.description }} kg
                      </li>
                    </ul>
                  </div>
                  <div class="flex items-center">
                    <button
                      type="button"
                      :class="(currentOrder.product_id == product.id) ?
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
                      {{ (currentOrder.product_id == product.id) ?
                        'Seleccionado' : 'Elegir' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="flex flex-wrap mb-4" v-else>
            lo sentimos, no tenemos vehículos para los criterios seleccionados
          </div>
          <div class="flex items-center mb-8">
            <div v-if="viewsMessages[viewName]"
              class="bg-red-100
              w-full
              border
              border-red-400
              text-red-700
              px-4
              py-3
              rounded
              relative"
              role="alert">
              <strong class="font-bold">Oops! </strong>
              <span class="block sm:inline">
                {{ viewsMessages[viewName] }}
              </span>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <router-link to="/order/step-one" class="bg-green-500
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
import chalan from '../../api/chalan';

export default {
  name: 'step-two',
  data() {
    return {
      viewName: 'step-two',
      selectedSize: null,
      productList: [],
    };
  },
  components: {
    Tracker,
  },
  mounted() {
    this.getDataFromLocalStorage();
    this.getProducts();
  },
  props: [
  ],
  methods: {
    ...mapActions([
      'validateRequiredFields',
      'getDataFromLocalStorage',
      'addDataToLocalStorage',
    ]),
    ...mapMutations([
      'setOrder',
      'setViewsMessages',
    ]),
    nextStep() {
      this.validateRequiredFields(this.viewName);
      if (this.steps[this.viewName].isComplete) {
        this.addDataToLocalStorage(['currentOrder']);
        this.$router.push({ name: 'step-three' });
      }
    },
    selectSize(size) {
      this.selectedSize = size;
    },
    getProducts() {
      const payload = {
        from_floor: this.currentOrder.from_floor_number,
        to_floor: this.currentOrder.to_floor_number,
        from_state: this.currentOrder.from_state,
        to_state: this.currentOrder.to_state,
      };
      chalan.getProducts(payload)
        .then((response) => {
          this.selectedSize = this.currentOrder.product_size ? this.currentOrder.product_size : 'small';
          this.productList = response.data;
        })
        .catch(() => {
          this.setViewsMessages({
            view: 'step-two',
            message: 'Hubo un error, intenta después de recargar la página',
          });
        });
    },
    selectProduct(product) {
      this.setOrder({ field: 'product_id', value: product.id });
      this.setOrder({ field: 'price', value: product.price });
      this.setOrder({ field: 'product_size', value: product.size });
      this.setOrder({ field: 'vehicle_brand', value: product.brand });
      this.setOrder({ field: 'vehicle_model', value: product.model });
      this.setOrder({ field: 'vehicle_weight', value: product.weight });
      this.setOrder({ field: 'vehicle_picture', value: product.picture });
      this.setOrder({ field: 'vehicle_description', value: product.description });
    },
  },
  computed: {
    ...mapState([
      'currentOrder',
      'formValidationMessages',
      'steps',
      'viewsMessages',
    ]),
    productListFiltered() {
      return this.productList.filter(item => item.size === this.selectedSize);
    },
  },
};
</script>
