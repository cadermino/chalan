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
          <div class="flex flex-wrap mb-4" v-if="productList.length">
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
                      <li><span>Peso de carga:</span>
                        <span class="font-bold"> {{ product.weight }} kg</span>
                      </li>
                      <li class="mt-3">
                        {{ product.description }}
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
          <div class="" v-else>
            <p v-if="customer.mobile_phone">
              {{ customer.customer_name }}, te escribiremos un
              mensaje al <span class="font-bold">{{ customer.mobile_phone }}</span> para coordinar
              los siguientes pasos de tu mudanza.
            </p>
            <p v-else>
              {{ customer.customer_name }}, te enviamos un
              correo a <span class="font-bold">{{ customer.email }}</span> para coordinar
              los siguientes pasos de tu mudanza.
            </p>
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
              :disabled="loading"
              :class="loading?'opacity-50 cursor-not-allowed':''"
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
  name: 'step-three',
  data() {
    return {
      viewName: 'step-three',
      selectedSize: 'small',
      productList: [],
      productFields: {
        product_id: 'id',
        price: 'price',
        product_size: 'size',
        vehicle_brand: 'brand',
        vehicle_model: 'model',
        vehicle_weight: 'weight',
        vehicle_picture: 'picture',
        vehicle_description: 'description',
      },
      vehicleSizes: {
        small: 'pequeños',
        medium: 'medianos',
        large: 'grandes',
      },
    };
  },
  components: {
    Tracker,
  },
  mounted() {
    this.getProducts();
  },
  props: [
  ],
  methods: {
    ...mapActions([
      'validateRequiredFields',
      'addDataToLocalStorage',
    ]),
    ...mapMutations([
      'setOrder',
      'setViewsMessages',
      'setLoader',
    ]),
    nextStep() {
      this.validateRequiredFields(this.viewName);
      if (this.steps[this.viewName].isComplete) {
        this.setLoader(true);
        const payload = {
          order: this.currentOrder,
          customer: this.customer,
        };
        chalan.updateOrder(payload)
          .then((response) => {
            if (response.status === 200) {
              this.addDataToLocalStorage(['currentOrder', 'customer']);
              this.$router.push({ name: this.steps[this.viewName].next });
            }
          })
          .catch(() => {
            this.setViewsMessages({ view: this.viewName, message: 'Hubo un error, intenta después de recargar la página' });
          });
      }
    },
    selectSize(size) {
      this.selectedSize = size;
    },
    getProducts() {
      this.setViewsMessages({ view: this.viewName, message: '' });
      const payload = {
        order_id: this.currentOrder.order_id,
        token: this.customer.token,
        from_floor: this.currentOrder.from_floor_number,
        to_floor: this.currentOrder.to_floor_number,
        from_neighborhood: this.currentOrder.from_neighborhood,
        to_neighborhood: this.currentOrder.to_neighborhood,
        from_city: this.currentOrder.from_city,
        to_city: this.currentOrder.to_city,
        from_state: this.currentOrder.from_state,
        to_state: this.currentOrder.to_state,
        from_zip_code: this.currentOrder.from_zip_code,
        to_zip_code: this.currentOrder.to_zip_code,
      };
      chalan.getProducts(payload)
        .then((response) => {
          this.productList = response.data;
          this.selectedSize = this.currentOrder.product_size
            ? this.currentOrder.product_size : 'small';
          if (response.data[0] && this.productListFiltered.length === 0) {
            this.selectedSize = response.data[0].size;
          }
          this.setLoader(false);
        })
        .catch(() => {
          this.setViewsMessages({
            view: this.viewName,
            message: 'Hubo un error, intenta después de recargar la página',
          });
          this.setLoader(false);
        });
    },
    selectProduct(product) {
      Object.keys(this.productFields).forEach((field) => {
        this.setOrder({ field, value: product[this.productFields[field]] });
      });
    },
  },
  computed: {
    ...mapState([
      'currentOrder',
      'customer',
      'formValidationMessages',
      'steps',
      'viewsMessages',
      'loading',
    ]),
    productListFiltered() {
      return this.productList.filter(item => item.size === this.selectedSize);
    },
  },
};
</script>
