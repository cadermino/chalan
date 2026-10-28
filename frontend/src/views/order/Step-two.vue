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
                  Elige la fecha <span class="text-red-500">*</span>
              </label>
              <VueDatePicker v-model="pickerDay"
                :ui="{ input: datePickerClasses }"
                :input-attrs="{ id: 'datetime', clearable: false }"
                :locale="datePickerLocale"
                :formats="{ input: DATE_INPUT_FORMAT }"
                :time-config="{ enableTimePicker: false }"
                auto-apply
                class="theme-chalan"
                :min-date="minDay"
                :max-date="maxDay"
                placeholder="17 de diciembre de 2026"
              />
              <p class="block
              text-gray-700
              text-sm
              font-bold mt-4 mb-2">
                  Elige la hora <span class="text-red-500">*</span>
              </p>
              <div id="appointment-hour" class="grid grid-cols-4 sm:grid-cols-6 gap-2">
                <button v-for="slot in hourSlots"
                  :key="slot.hour"
                  type="button"
                  :data-hour="slot.hour"
                  :aria-pressed="slot.selected"
                  :disabled="slot.disabled"
                  @click="selectHour(slot.hour)"
                  class="border-2 rounded-lg px-2 py-2 text-sm font-bold
                    focus:outline-none focus:shadow-outline"
                  :class="slot.disabled
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                    : slot.selected
                      ? 'border-green-500 bg-green-100 text-gray-700'
                      : 'border-gray-300 text-gray-700 hover:border-gray-400'">
                  {{ slot.label }}
                </button>
              </div>
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
                    {{ inventoryCopy.label }} <span class="text-red-500">*</span>
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
                  <img v-if="!thumb.loadError"
                    :src="thumb.url"
                    @error="handleThumbnailError(index)"
                    class="w-16 h-16 object-cover rounded border" />
                  <div v-else
                    class="w-16 h-16 rounded border bg-gray-100
                      flex items-center justify-center text-xs text-gray-400
                      text-center px-1">
                    Vista previa no disponible
                  </div>
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
                    @blur="handleManualItemBlur"
                    :placeholder="inventoryCopy.placeholder"
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

              <div v-if="needsWeight" class="mb-3">
                <label class="block text-gray-700 text-sm font-bold mb-1"
                  for="cargo-weight">
                  Peso aproximado de la carga <span class="text-red-500">*</span>
                </label>
                <div class="relative">
                  <select id="cargo-weight"
                    v-model="cargoWeight"
                    :class="formValidationMessages['cargo_weight_kg'] ? 'border-red-300' : ''"
                    class="appearance-none border bg-white rounded w-full py-2 px-3
                      text-gray-700 leading-tight focus:outline-none focus:border-blue-400">
                    <option disabled :value="null">Elige un rango</option>
                    <option v-for="option in cargoWeightOptions"
                      :key="option.value"
                      :value="option.value">{{ option.label }}</option>
                  </select>
                  <!-- Misma flecha que los selects del paso 1: appearance-none
                       le quita la del navegador. -->
                  <div class="pointer-events-none absolute inset-y-0 right-0
                    flex items-center px-2 text-gray-700">
                    <!-- eslint-disable max-len -->
                    <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    <!-- eslint-enable max-len -->
                  </div>
                </div>
                <p v-if="formValidationMessages['cargo_weight_kg']"
                  class="text-red-500 text-xs italic">
                  {{ formValidationMessages['cargo_weight_kg'] }}.
                </p>
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
              <span v-if="formValidationMessages['cargo']"
                      class="text-red-500
                      text-xs
                      italic block mb-1"> {{ formValidationMessages['cargo'] }}.</span>
              <div>
                <input type="checkbox"
                  id="cargo-service"
                  v-model="cargoServiceChecked" />
                <label class="ml-2 text-gray-700 text-sm font-bold" for="cargo-service">
                  ¿Necesitas cargadores?
                </label>
              </div>
              <div v-if="cargoServiceChecked" class="mt-2 pl-6">
                <label class="block
                  text-gray-700
                  text-sm
                  font-bold mb-1" for="loaders-quantity">
                    Número de cargadores
                </label>
                <input class="appearance-none
                    border rounded
                    py-2
                    px-3
                    text-gray-700
                    leading-tight
                    focus:outline-none
                    focus:border-blue-400"
                    id="loaders-quantity"
                    @wheel="$event.target.blur()"
                    min="1"
                    v-model="loadersQuantity"
                    type="number">
              </div>
            </div>
            <div class="w-full px-3 mb-4">
              <span v-if="formValidationMessages['packaging']"
                      class="text-red-500
                      text-xs
                      italic block mb-1"> {{ formValidationMessages['packaging'] }}.</span>
              <div>
                <input type="checkbox"
                  id="packaging-service"
                  v-model="packagingServiceChecked" />
                <label class="ml-2 text-gray-700 text-sm font-bold" for="packaging-service">
                  ¿Requiere servicio de embalaje?
                </label>
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
            <router-link
              ref="previousStepLink"
              :to="{ name: steps[viewName].previous }"
              class="bg-green-500
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
              ref="nextStepButton"
              :disabled="loading || analyzingPhotos"
              :class="loading || analyzingPhotos ?'opacity-50 cursor-not-allowed':''"
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
              {{ analyzingPhotos ? 'Analizando tu foto…' : 'Siguiente' }}
              </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { reactive } from 'vue';
import { mapState, mapActions } from 'pinia';
import { useStore } from '@/store';
import { VueDatePicker } from '@vuepic/vue-datepicker';
import '@vuepic/vue-datepicker/dist/main.css';
import { es } from 'date-fns/locale';
import moment from 'moment';
import Tracker from '@/components/Tracker.vue';
import ViewsMessages from '@/components/ViewsMessages.vue';
import chalan from '../../api/chalan';
import { track } from '../../utils/analytics';
import { tagBlockedStep } from '../../utils/sessionTags';
import {
  CARGO_WEIGHT_OPTIONS, DEFAULT_LOAD_TYPE, INVENTORY_COPY, needsCargoWeight,
} from '../../utils/loadTypes';

const DATE_INPUT_FORMAT = "d 'de' MMMM 'de' yyyy";

// Horas en punto, de 7 am a 6 pm: botones en vez de un selector de hora, que
// pedía un clic más y un AM/PM. La hora exacta se coordina por WhatsApp.
const FIRST_HOUR = 7;
const LAST_HOUR = 18;

function hourLabel(hour) {
  if (hour === 12) return '12 m';
  return hour < 12 ? `${hour} am` : `${hour - 12} pm`;
}

function isToday(day) {
  return day === moment().format('YYYY-MM-DD');
}

// Hoy solo valen las horas que todavía no llegaron.
function isHourAvailable(day, hour) {
  return !isToday(day) || hour > new Date().getHours();
}

export default {
  name: 'step-two',
  data() {
    return {
      viewName: 'step-two',
      dragOver: false,
      photoThumbnails: [],
      recognizedItems: [],
      manualItem: '',
      cargoWeightOptions: CARGO_WEIGHT_OPTIONS,
      DATE_INPUT_FORMAT,
      // El día o la hora que eligió y todavía no se guardaron: la fecha de la
      // orden se escribe recién cuando están los dos.
      pickedDay: null,
      pickedHour: null,
    };
  },
  components: {
    Tracker,
    VueDatePicker,
    ViewsMessages,
  },
  mounted() {
    this.setLoader(false);
    if (this.currentOrder.comments) {
      this.recognizedItems = this.currentOrder.comments.split('\n').filter(item => item.trim());
    }
    // Radios required an explicit click before either value was set. Checkboxes
    // need "unchecked" to already be a complete, valid "No" answer, so default
    // to it here rather than in the global Vuex state (which stays null for
    // orders that never reach step-two).
    if (this.services.cargo === null) {
      this.setOrder({ section: 'services', field: 'cargo', value: '0' });
    }
    if (this.services.packaging === null) {
      this.setOrder({ section: 'services', field: 'packaging', value: '0' });
    }
  },
  props: [
  ],
  methods: {
    ...mapActions(useStore, [
      'validateRequiredFields',
    ]),
    ...mapActions(useStore, [
      'setOrder',
      'setViewsMessages',
      'setLoader',
      'discardOrderDraft',
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
        // Por referencia y no por índice: si borra otra foto mientras esta se
        // analiza, el índice apunta a otra y una quedaba "analizando" para
        // siempre, con "Siguiente" bloqueado. reactive(): en Vue 3 el array
        // guarda un Proxy, y cambiar el objeto original no repinta nada.
        const thumb = reactive({ url, file, processing: true });
        this.photoThumbnails.push(thumb);

        const payload = {
          image: file,
          orderId: this.currentOrder.order_id,
        };
        chalan.recognizeItems(payload)
          .then((response) => {
            if (response.data.items && response.data.items.length) {
              this.mergeItems(response.data.items);
              this.syncComments();
            } else {
              this.setViewsMessages({
                view: this.viewName,
                message: {
                  text: 'No reconocimos objetos en esta foto: agrégalos a mano',
                  type: 'info',
                },
              });
            }
            thumb.processing = false;
          })
          .catch(() => {
            thumb.processing = false;
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
          this.recognizedItems[existingIndex] = `${totalQty} ${existingParsed.name}`;
        } else {
          this.recognizedItems.push(newItem);
        }
      });
    },
    handleThumbnailError(index) {
      // The browser reads the file behind the blob: URL lazily, off the
      // main thread, so a flaky local/network drive can fail here well
      // after createObjectURL succeeded (NotReadableError). Recognition
      // already ran on the original File, so just hide the broken preview.
      this.photoThumbnails[index].loadError = true;
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
    // Used on @blur instead of calling addManualItem() directly.
    // event.relatedTarget is the element about to receive focus. If
    // that's "Siguiente" (or "Atras"), skip committing here and leave
    // it to nextStep()'s own addManualItem() call: committing on blur
    // would grow the items list right as that click is landing, which
    // can shift the button out from under the cursor between mousedown
    // and mouseup and make the click miss it entirely - a real risk
    // since real clicks (not just automated ones) leave enough time
    // between press and release for that shift to happen. Blurring
    // toward anything else (a checkbox, another field, empty space)
    // still commits immediately, same as before.
    handleManualItemBlur(event) {
      const nextFocused = event.relatedTarget;
      const criticalTargets = [
        this.$refs.nextStepButton,
        this.$refs.previousStepLink && this.$refs.previousStepLink.$el,
      ];
      if (nextFocused && criticalTargets.includes(nextFocused)) {
        return;
      }
      this.addManualItem();
    },
    selectHour(hour) {
      this.pickedHour = hour;
      this.saveAppointment();
    },
    // Con día y hora, la fecha va a la orden y lo elegido deja de ser local.
    saveAppointment() {
      if (!this.appointmentDay || this.appointmentHour === null) return;
      const hour = String(this.appointmentHour).padStart(2, '0');
      this.setOrder({
        section: 'currentOrder',
        field: 'appointment_date',
        value: `${this.appointmentDay} ${hour}:00:00`,
      });
      this.pickedDay = null;
      this.pickedHour = null;
    },
    // Sin fecha, el paso pide elegir la hora otra vez en vez de guardar una que
    // ya no vale.
    clearAppointment() {
      if (this.currentOrder.appointment_date) {
        this.setOrder({ section: 'currentOrder', field: 'appointment_date', value: null });
      }
    },
    syncComments() {
      const comments = this.recognizedItems.join('\n');
      this.setOrder({ section: 'currentOrder', field: 'comments', value: comments || null });
    },
    nextStep() {
      // Las cosas de la foto llegan cuando termina el análisis. Seguir antes
      // dejaba la lista vacía y el paso decía "no olvides llenar este campo"
      // a quien acababa de subir la foto (step_two_blocked por comments).
      if (this.analyzingPhotos) return;
      this.addManualItem();
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
          // Marca el único caso en que el cliente cambió de verdad lo que
          // hay que mudar. Sin esto el backend cancelaba las cotizaciones
          // también cuando el PUT venía del login, que solo reenvía lo que
          // quedó guardado en el navegador.
          orderEditedByCustomer: true,
        };
        chalan.updateOrder(payload)
          .then((response) => {
            if (response.status === 200) {
              // El paso siguiente exige sesión, así que el usuario choca con
              // el registro justo después de esto: la distancia entre este
              // evento y sign_up/login es la caída del muro de auth, aislada
              // de la fricción del propio formulario.
              track('step_two_submitted', {
                order_id: this.currentOrder.order_id,
                items_count: this.recognizedItems.length,
                photos_used: this.photoThumbnails.length,
                days_ahead: this.$moment(this.currentOrder.appointment_date)
                  .startOf('day').diff(this.$moment().startOf('day'), 'days'),
                packaging: this.services.packaging === '1',
                cargo: this.services.cargo === '1',
                load_type: this.currentOrder.load_type || DEFAULT_LOAD_TYPE,
                cargo_weight_kg: this.currentOrder.cargo_weight_kg || undefined,
              });
              this.$router.push({
                name: this.steps[this.viewName].next,
              }).catch(() => {});
            }
          })
          .catch((error) => {
            this.setLoader(false);
            // La orden guardada ya estaba agendada (utils/orderDraft.js): no se
            // edita, se empieza una mudanza nueva desde el paso 1.
            if (error.response?.status === 409) {
              this.discardOrderDraft();
              this.setViewsMessages({
                view: 'step-one',
                message: {
                  text: 'Esa mudanza ya estaba agendada. Cuéntanos los datos de la nueva.',
                  type: 'info',
                },
              });
              this.$router.push({ name: 'step-one' }).catch(() => {});
              return;
            }
            this.setViewsMessages({
              view: this.viewName,
              message: {
                text: 'Hubo un error, intenta después de recargar la página',
                type: 'error',
              },
            });
          });
      } else {
        // Mismo punto ciego que en step-one: el clic en "siguiente" no hace
        // nada visible más allá de los mensajes inline. Solo el primer campo
        // que bloquea, que los parámetros de GA4 se cortan a 100 caracteres.
        // Nombres de campo, nunca sus valores.
        const missing = this.steps[this.viewName].requisites
          .filter(field => this.formValidationMessages[field]);
        track('step_two_blocked', {
          missing_field: missing[0],
          missing_count: missing.length,
          load_type: this.currentOrder.load_type || DEFAULT_LOAD_TYPE,
        });
        tagBlockedStep('step_two', missing[0]);
      }
    },
  },
  computed: {
    inventoryCopy() {
      return INVENTORY_COPY[this.currentOrder.load_type] || INVENTORY_COPY[DEFAULT_LOAD_TYPE];
    },
    needsWeight() {
      return needsCargoWeight(this.currentOrder.load_type);
    },
    cargoWeight: {
      get() {
        return this.currentOrder.cargo_weight_kg;
      },
      set(value) {
        this.setOrder({ section: 'currentOrder', field: 'cargo_weight_kg', value: Number(value) });
      },
    },
    analyzingPhotos() {
      return this.photoThumbnails.some(thumb => thumb.processing);
    },
    ...mapState(useStore, [
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
    storedAppointment() {
      const date = this.currentOrder.appointment_date;
      return date ? this.$moment(date) : null;
    },
    appointmentDay() {
      if (this.pickedDay) return this.pickedDay;
      return this.storedAppointment ? this.storedAppointment.format('YYYY-MM-DD') : null;
    },
    // Una orden de antes de los botones puede tener 10:35 o 20:00: se marca su
    // hora si cae en el rango, y si no, ninguna hasta que elija una.
    appointmentHour() {
      if (this.pickedHour !== null) return this.pickedHour;
      if (!this.storedAppointment) return null;
      const hour = this.storedAppointment.hours();
      return hour >= FIRST_HOUR && hour <= LAST_HOUR ? hour : null;
    },
    pickerDay: {
      get() {
        return this.appointmentDay ? this.$moment(this.appointmentDay, 'YYYY-MM-DD').toDate() : null;
      },
      set(value) {
        if (!value) return;
        this.pickedDay = this.$moment(value).format('YYYY-MM-DD');
        // Sin una hora que valga para el día nuevo, la fecha guardada se borra:
        // si quedara, la orden seguiría con el día anterior aunque se vea el nuevo.
        if (this.appointmentHour === null || !isHourAvailable(this.pickedDay, this.appointmentHour)) {
          this.pickedHour = null;
          this.clearAppointment();
          return;
        }
        this.saveAppointment();
      },
    },
    hourSlots() {
      const slots = [];
      for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour += 1) {
        slots.push({
          hour,
          label: hourLabel(hour),
          selected: hour === this.appointmentHour,
          disabled: Boolean(this.appointmentDay) && !isHourAvailable(this.appointmentDay, hour),
        });
      }
      return slots;
    },
    // Después de las 6 pm ya no queda hora para hoy: el calendario arranca mañana.
    minDay() {
      const day = new Date();
      if (day.getHours() >= LAST_HOUR) day.setDate(day.getDate() + 1);
      day.setHours(0, 0, 0, 0);
      return day;
    },
    maxDay() {
      const date = new Date();
      return new Date(date.setDate(date.getDate() + 60));
    },
    // Un computed y no data: el locale de date-fns no tiene que volverse reactivo.
    datePickerLocale() {
      return es;
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
    packagingServiceChecked: {
      get() {
        return this.services.packaging === '1';
      },
      set(value) {
        this.setOrder({ section: 'services', field: 'packaging', value: value ? '1' : '0' });
      },
    },
    cargoServiceChecked: {
      get() {
        return this.services.cargo === '1';
      },
      set(value) {
        this.setOrder({ section: 'services', field: 'cargo', value: value ? '1' : '0' });
        if (value) {
          if (!this.currentOrder.loaders_quantity) {
            this.setOrder({ section: 'currentOrder', field: 'loaders_quantity', value: 1 });
          }
        } else {
          this.setOrder({ section: 'currentOrder', field: 'loaders_quantity', value: null });
        }
      },
    },
    loadersQuantity: {
      get() {
        return this.currentOrder.loaders_quantity;
      },
      set(value) {
        // v-model sobre un input number devuelve '' cuando el campo queda
        // vacío, no null. La columna es Integer: ese '' llegaba crudo al PUT y
        // Postgres lo rechazaba con DataError, o sea un 500 en la cara del
        // cliente por borrar el número para escribir otro. Mismo guard que usa
        // approximate_budget acá abajo.
        this.setOrder({
          section: 'currentOrder',
          field: 'loaders_quantity',
          value: value === '' ? null : value,
        });
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
  /* El azul de los botones de la app (bg-blue-500 de Tailwind 1). */
  .theme-chalan .dp--theme-light {
    --dp-primary-color: #4299e1;
  }
</style>
