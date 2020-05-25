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
          <p class="text-center font-bold mb-10">
            Elije la día y la hora que quires mudarte
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
                placeholder="17 de Marzo de 2020 18:00"
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
                    Algún comentario o indicación que nos quieras dar? (opcional)
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
                v-model="userComments"
                id="address-from-street"
                type="text">
              </textarea>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <router-link :to="{name: 'step-two'}" class="bg-green-500
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
import chalan from '../../api/chalan';

Settings.defaultLocale = 'es';

export default {
  name: 'step-three',
  data() {
    return {
      viewName: 'step-three',
    };
  },
  components: {
    Tracker,
    Datetime,
  },
  mounted() {
    this.setLoader(false);
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
              this.$router.push({ name: 'step-four' });
            }
          })
          .catch(() => {
            this.setViewsMessages({ view: this.viewName, message: 'Hubo un error, intenta después de recargar la página' });
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
