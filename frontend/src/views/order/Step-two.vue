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
              font-bold mb-2" for="address-from-interior">
                  Elige la fecha y hora <span class="text-red-500">*</span>
              </label>
              <Datetime v-model="selectedDate"
                :input-class="datePickerClasses"
                type="datetime"
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
                placeholder="17 de Marzo de 2023 18:00"
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
              <label class="block
                text-gray-700
                text-sm
                font-bold mb-2" for="address-from-street">
                    Lista las cosas que vamos a mover <span class="text-red-500">*</span>
              </label>
              <textarea class="appearance-none
                border rounded
                w-full
                py-2
                px-3
                text-gray-700
                leading-tight
                focus:outline-none
                focus:border-blue-400"
                rows="8"
                placeholder="Ejemplo:
                  1 cama matrimonial
                  1 comedor
                  6 sillas
                  1 escritorio
                  1 ropero grande
                  1 refri
                  8 cajas grandes"
                v-model="userComments"
                id="address-from-street"
                type="text">
              </textarea>
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
                <svg class="fill-current w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M12.432 0c1.34 0 2.01.912 2.01 1.957 0 1.305-1.164 2.512-2.679 2.512-1.269 0-2.009-.75-1.974-1.99C9.789 1.436 10.67 0 12.432 0zM8.309 20c-1.058 0-1.833-.652-1.093-3.524l1.214-5.092c.211-.814.246-1.141 0-1.141-.317 0-1.689.562-2.502 1.117l-.528-.88c2.572-2.186 5.531-3.467 6.801-3.467 1.057 0 1.233 1.273.705 3.23l-1.391 5.352c-.246.945-.141 1.271.106 1.271.317 0 1.357-.392 2.379-1.207l.6.814C12.098 19.02 9.365 20 8.309 20z"/></svg>
                <span class="block sm:inline">
                  Ten en cuenta que las cosas que no estén en la lista tendrán un costo extra.
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
    };
  },
  components: {
    Tracker,
    Datetime,
    ViewsMessages,
  },
  mounted() {
    this.setLoader(false);
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
    nextStep() {
      this.validateRequiredFields(this.viewName);
      if (this.steps[this.viewName].isComplete) {
        this.setLoader(true);
        const payload = {
          order: this.currentOrder,
          customer: this.customer,
          step: this.viewName,
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
      }
    },
  },
  computed: {
    ...mapState([
      'formValidationMessages',
      'steps',
      'viewsMessages',
      'currentOrder',
      'customer',
      'loading',
    ]),
    selectedDate: {
      get() {
        return this.$moment(this.currentOrder.appointment_date).toISOString();
      },
      set(value) {
        if (value) {
          const appointmentDate = this.$moment(value).format('YYYY-MM-DD HH:mm:ss');
          this.setOrder({ field: 'appointment_date', value: appointmentDate });
        }
      },
    },
    userComments: {
      get() {
        return this.currentOrder.comments;
      },
      set(value) {
        this.setOrder({ field: 'comments', value });
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
