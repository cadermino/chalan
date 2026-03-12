<template>
  <div>
    <div class="flex flex-wrap">
      <div class="w-full mb-4">
        <Tracker :current-view="viewName"></Tracker>
        <div class="w-full max-w-xl mx-auto sm:p-0 p-5 sm:pb-8">
          <ViewsMessages :view-name="viewName"/>
          <p class="text-center font-bold mb-10">
            Elije el día y la hora de tu mudanza
          </p>
          <div class="flex flex-wrap mb-4">
            <div class="w-full px-3 mb-4">
              <label class="block
              text-gray-700
              text-sm
              font-bold mb-2" for="datetime">
                  Elige la fecha y hora <span class="text-red-500">*</span>
              </label>
              <Datetime v-model="selectedDate"
                :input-class="datePickerClasses"
                type="datetime"
                input-id="datetime"
                :phrases="{ok: 'Aceptar', cancel: 'Salir'}"
                value-zone="America/Mexico_City"
                :format="{ year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit' }"
                use12-hour
                :minute-step="5"
                class="theme-chalan"
                :min-datetime="minDatetime"
                :max-datetime="maxDatetime"
                placeholder="17 de diciembre de 2024 18:00"
              >
              </Datetime>
              <p v-if="formValidationMessages['appointment_date']"
                class="text-red-500
                text-xs
                italic">
                {{ formValidationMessages['appointment_date'] }}.
              </p>
            </div>
            <div class="w-full px-3 mb-4">
              <label class="text-gray-700
                text-sm
                font-bold"
                for="list-of-belongings">
                    Lista las cosas que vamos a mover <span class="text-red-500">*</span>
              </label>
              <span v-if="formValidationMessages['comments']"
                      class="text-red-500
                      text-xs
                      italic">{{ formValidationMessages['comments'] }}.</span>

              <div
                class="mt-2 mb-3 p-4 border-2 border-dashed
                  border-gray-300 rounded-lg text-center
                  cursor-pointer hover:border-green-400
                  transition-colors"
                @click="$refs.photoInput.click()"
                @dragover.prevent="dragOver = true"
                @dragleave.prevent="dragOver = false"
                @drop.prevent="handleDrop"
                :class="{ 'border-green-400 bg-green-50': dragOver }">
                <input type="file"
                  ref="photoInput"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  class="hidden"
                  @change="handlePhotoSelect" />
                <!-- eslint-disable max-len -->
                <svg
                  class="mx-auto h-10 w-10 text-gray-400 mb-2"
                  fill="none" stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                <!-- eslint-enable max-len -->
                <p class="text-sm text-gray-600">
                  <span class="text-green-500 font-semibold">
                    Sube fotos
                  </span> de tus cosas y la IA las identificará
                </p>
                <p class="text-xs text-gray-400 mt-1">JPG, PNG, WebP o GIF (máx. 10MB)</p>
              </div>

              <div v-if="photoThumbnails.length" class="flex flex-wrap gap-2 mb-3">
                <div v-for="(thumb, index) in photoThumbnails" :key="index" class="relative">
                  <img :src="thumb.url" class="w-16 h-16 object-cover rounded border" />
                  <button type="button"
                    @click="removePhoto(index)"
                    class="absolute -top-2 -right-2 bg-red-500
                      text-white rounded-full w-5 h-5 text-xs
                      flex items-center justify-center
                      hover:bg-red-700">
                    ×
                  </button>
                  <div v-if="thumb.processing"
                    class="absolute inset-0 bg-white bg-opacity-70
                      flex items-center justify-center rounded">
                    <!-- eslint-disable max-len -->
                    <svg
                      class="animate-spin h-5 w-5 text-green-500"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    <!-- eslint-enable max-len -->
                  </div>
                </div>
              </div>

              <div class="mb-3 border rounded p-3"
                :class="recognizedItems.length
                  ? 'bg-gray-50' : ''">
                <div v-if="recognizedItems.length">
                  <p class="text-sm font-bold text-gray-700 mb-2">
                    Cosas a mover (edita o elimina):
                  </p>
                  <div v-for="(item, index) in recognizedItems"
                    :key="'item-'+index"
                    class="flex items-center mb-1">
                    <input type="text"
                      v-model="recognizedItems[index]"
                      class="flex-1 appearance-none border
                        rounded py-1 px-2 text-sm text-gray-700
                        focus:outline-none
                        focus:border-blue-400" />
                    <button type="button"
                      @click="removeRecognizedItem(index)"
                      class="ml-2 text-red-500
                        hover:text-red-700 text-sm font-bold">
                      ✕
                    </button>
                  </div>
                </div>
                <p v-else class="text-sm text-gray-400
                  text-center py-2">
                  Sube una foto o agrega items manualmente
                </p>
                <div class="flex mt-2">
                  <input type="text"
                    v-model="manualItem"
                    @keyup.enter="addManualItem"
                    placeholder="Ej: 1 cama matrimonial"
                    class="flex-1 appearance-none border
                      rounded py-1 px-2 text-sm text-gray-700
                      focus:outline-none
                      focus:border-blue-400" />
                  <button type="button"
                    @click="addManualItem"
                    class="ml-2 bg-green-500
                      hover:bg-green-700 text-white text-sm
                      py-1 px-3 rounded">
                    + Agregar
                  </button>
                </div>
              </div>

              <div class="flex
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
                <!-- eslint-disable max-len -->
                <svg class="fill-current w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M12.432 0c1.34 0 2.01.912 2.01 1.957 0 1.305-1.164 2.512-2.679 2.512-1.269 0-2.009-.75-1.974-1.99C9.789 1.436 10.67 0 12.432 0zM8.309 20c-1.058 0-1.833-.652-1.093-3.524l1.214-5.092c.211-.814.246-1.141 0-1.141-.317 0-1.689.562-2.502 1.117l-.528-.88c2.572-2.186 5.531-3.467 6.801-3.467 1.057 0 1.233 1.273.705 3.23l-1.391 5.352c-.246.945-.141 1.271.106 1.271.317 0 1.357-.392 2.379-1.207l.6.814C12.098 19.02 9.365 20 8.309 20z"/></svg>
                <!-- eslint-enable max-len -->
                <span class="block sm:inline">
                  Ten en cuenta que las cosas que no estén en la lista tendrán un costo extra.
                </span>
              </div>
            </div>
            <div class="w-full px-3 mb-4"
              :class="formValidationMessages['cargo']
                    ?'border-red-300':''">
              <label class="text-gray-700
                text-sm
                font-bold">
                    Requiere cargadores? <span class="text-red-500">*</span>
              </label>
              <span v-if="formValidationMessages['cargo']"
                      class="text-red-500
                      text-xs
                      italic"> {{ formValidationMessages['cargo'] }}.</span>
              <div class="mt-2">
                <input type="radio"
                  id="cargo-service-1"
                  name="cargo-service-1"
                  v-model="cargoService"
                  :value="'1'" />
                <label class="ml-2" for="cargo-service-1">Sí</label>
              </div>
              <div>
                <input type="radio"
                  id="cargo-service-0"
                  name="cargo-service-0"
                  v-model="cargoService"
                  :value="'0'" />
                <label class="ml-2" for="cargo-service-0">No</label>
              </div>
            </div>
            <div class="w-full px-3 mb-4">
              <label class="text-gray-700
                text-sm
                font-bold">
                    Requiere servicio de embalaje? <span class="text-red-500">*</span>
              </label>
              <span v-if="formValidationMessages['packaging']"
                      class="text-red-500
                      text-xs
                      italic"> {{ formValidationMessages['packaging'] }}.</span>
              <div class="mt-2">
                <input type="radio"
                  id="packaging-service-1"
                  name="packaging-service-1"
                  v-model="packagingService"
                  :value="'1'" />
                <label class="ml-2" for="packaging-service-1">Sí</label>
              </div>
              <div>
                <input type="radio"
                  id="packaging-service-0"
                  name="packaging-service-0"
                  v-model="packagingService"
                  :value="'0'" />
                <label class="ml-2" for="packaging-service-0">No</label>
              </div>
            </div>
            <div class="w-full px-3 mb-4">
              <label class="text-gray-700
                text-sm
                font-bold"
                for="approximate-budget">
                    Presupuesto aproximado
              </label>
              <input class="appearance-none
                  border rounded
                  w-full
                  py-2
                  px-3
                  text-gray-700
                  leading-tight
                  focus:outline-none
                  focus:border-blue-400"
                  id="approximate-budget"
                  @wheel="$event.target.blur()"
                  min="0"
                  v-model="approximateBudget"
                  type="number"
                  placeholder="Ej. 300"
                  autocomplete="on">
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
import { Datetime } from 'vue-datetime';
import 'vue-datetime/dist/vue-datetime.css';
import { Settings } from 'luxon';
import Tracker from '@/components/Tracker.vue';
import ViewsMessages from '@/components/ViewsMessages.vue';
import chalan from '../../api/chalan';

Settings.defaultLocale = 'es';

export default {
  name: 'step-two',
  data() {
    return {
      viewName: 'step-two',
      dragOver: false,
      photoThumbnails: [],
      recognizedItems: [],
      manualItem: '',
    };
  },
  components: {
    Tracker,
    Datetime,
    ViewsMessages,
  },
  mounted() {
    this.setLoader(false);
    if (this.currentOrder.comments) {
      this.recognizedItems = this.currentOrder.comments.split('\n').filter(item => item.trim());
    }
  },
  props: [
  ],
  methods: {
    ...mapActions([
      'validateRequiredFields',
    ]),
    ...mapMutations([
      'setOrder',
      'setViewsMessages',
      'setLoader',
    ]),
    handlePhotoSelect(event) {
      const files = Array.from(event.target.files);
      this.processPhotos(files);
      this.$refs.photoInput.value = '';
    },
    handleDrop(event) {
      this.dragOver = false;
      const files = Array.from(event.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      this.processPhotos(files);
    },
    processPhotos(files) {
      files.forEach((file) => {
        const url = URL.createObjectURL(file);
        const thumbIndex = this.photoThumbnails.length;
        this.photoThumbnails.push({ url, file, processing: true });

        const payload = {
          image: file,
          token: this.customer.token,
          orderId: this.currentOrder.order_id,
        };
        chalan.recognizeItems(payload)
          .then((response) => {
            if (response.data.items) {
              this.mergeItems(response.data.items);
              this.syncComments();
            }
            this.photoThumbnails[thumbIndex].processing = false;
          })
          .catch(() => {
            this.photoThumbnails[thumbIndex].processing = false;
            this.setViewsMessages({
              view: this.viewName,
              message: {
                text: 'No se pudo analizar la imagen, intenta con otra foto',
                type: 'error',
              },
            });
          });
      });
    },
    parseItem(item) {
      const match = item.match(/^(\d+)\s+(.+)$/);
      if (match) {
        return { qty: parseInt(match[1], 10), name: match[2].toLowerCase().trim() };
      }
      return { qty: 1, name: item.toLowerCase().trim() };
    },
    mergeItems(newItems) {
      newItems.forEach((newItem) => {
        const parsed = this.parseItem(newItem);
        const existingIndex = this.recognizedItems.findIndex((existing) => {
          const existingParsed = this.parseItem(existing);
          return existingParsed.name === parsed.name;
        });
        if (existingIndex !== -1) {
          const existingParsed = this.parseItem(this.recognizedItems[existingIndex]);
          const totalQty = existingParsed.qty + parsed.qty;
          this.$set(this.recognizedItems, existingIndex, `${totalQty} ${existingParsed.name}`);
        } else {
          this.recognizedItems.push(newItem);
        }
      });
    },
    removePhoto(index) {
      URL.revokeObjectURL(this.photoThumbnails[index].url);
      this.photoThumbnails.splice(index, 1);
    },
    removeRecognizedItem(index) {
      this.recognizedItems.splice(index, 1);
      this.syncComments();
    },
    addManualItem() {
      if (this.manualItem.trim()) {
        this.mergeItems([this.manualItem.trim()]);
        this.manualItem = '';
        this.syncComments();
      }
    },
    syncComments() {
      const comments = this.recognizedItems.join('\n');
      this.setOrder({ section: 'currentOrder', field: 'comments', value: comments || null });
    },
    nextStep() {
      this.syncComments();
      this.validateRequiredFields(this.viewName);
      if (this.steps[this.viewName].isComplete) {
        this.setLoader(true);
        const payload = {
          order: this.currentOrder,
          orderDetailsOrigin: this.orderDetailsOrigin,
          orderDetailsDestination: this.orderDetailsDestination,
          services: this.services,
          customer: this.customer,
          requestQuotationFromCarrierCompany: true,
        };
        chalan.updateOrder(payload)
          .then((response) => {
            if (response.status === 200) {
              this.$router.push({
                name: this.steps[this.viewName].next,
              }).catch(() => {});
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
    },
  },
  computed: {
    ...mapState([
      'currentOrder',
      'customer',
      'formValidationMessages',
      'loading',
      'orderDetailsOrigin',
      'orderDetailsDestination',
      'services',
      'steps',
      'viewsMessages',
    ]),
    selectedDate: {
      get() {
        return this.$moment(this.currentOrder.appointment_date).toISOString();
      },
      set(value) {
        if (value) {
          const appointmentDate = this.$moment(value)
            .format('YYYY-MM-DD HH:mm:ss');
          this.setOrder({
            section: 'currentOrder',
            field: 'appointment_date',
            value: appointmentDate,
          });
        }
      },
    },
    minDatetime() {
      return new Date(Date.now()).toISOString();
    },
    maxDatetime() {
      const date = new Date();
      return new Date(date.setDate(date.getDate() + 60)).toISOString();
    },
    datePickerClasses() {
      const classes = [
        'appearance-none',
        'border rounded',
        'w-full',
        'py-2',
        'px-3',
        'text-gray-700',
        'leading-tight',
        'focus:outline-none',
        'focus:border-blue-400',
      ];
      if (this.formValidationMessages.appointment_date) {
        classes.push('border-red-300');
      }
      return classes;
    },
    packagingService: {
      get() {
        return this.services.packaging;
      },
      set(value) {
        this.setOrder({ section: 'services', field: 'packaging', value });
      },
    },
    cargoService: {
      get() {
        return this.services.cargo;
      },
      set(value) {
        this.setOrder({ section: 'services', field: 'cargo', value });
      },
    },
    approximateBudget: {
      get() {
        return this.currentOrder.approximate_budget;
      },
      set(value) {
        const defaultValue = value === '' ? null : value;
        this.setOrder({
          section: 'currentOrder',
          field: 'approximate_budget',
          value: defaultValue,
        });
      },
    },
  },
};
</script>
<style>
  .theme-chalan .vdatetime-popup__header,
  .theme-chalan .vdatetime-calendar__month__day--selected > span > span,
  .theme-chalan .vdatetime-calendar__month__day--selected:hover > span > span {
    background: #4299e1;
  }

  .theme-chalan .vdatetime-year-picker__item--selected,
  .theme-chalan .vdatetime-time-picker__item--selected,
  .theme-chalan .vdatetime-popup__actions__button {
    color: #4299e1;
  }
</style>
