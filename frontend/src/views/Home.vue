<template>
  <div class="home">
    <!--Hero-->
    <div
      class="lg:pt-48 lg:pb-64 py-20 bg-cover"
      :style="{ backgroundImage: 'url(' + require('@/assets/shipping-boxes-resized.jpg') + ')'}"
    >
      <div class="container mx-auto px-6 text-left">
        <h2 class="text-4xl font-bold mb-2 text-white">
          Con Chalán agenda movilidad para tu <span class="">mudanza</span>
        </h2>
        <h3 class="text-2xl mb-8 text-gray-200">
          Agenda tu vehículo de mudanza en linea!
        </h3>
        <router-link to="/order/step-one" class="bg-blue-500
                 hover:bg-blue-700
                 text-white
                 font-bold
                 rounded-full
                 py-4 px-8 shadow-lg tracking-wider">
                 Quiero agendar
        </router-link>
      </div>
    </div>
    <!-- Features -->
    <section class="container mx-auto px-6 p-10">
      <h2 class="text-4xl font-bold text-center text-gray-800 mb-8">
        Múdate en solo 3 pasos
      </h2>
      <div class="flex items-center flex-wrap mb-20">
        <div class="w-full md:w-1/2">
          <h4 class="text-3xl text-gray-800 font-bold mb-3">
            Ingresa tus datos
          </h4>
          <p class="text-gray-600 mb-8">
            Our Smart Health Monitoring Wristwatch is able to capture you vitals
            while you exercise. You can create different category of exercises
            and can track your vitals on the go.
          </p>
        </div>
        <div class="w-full md:w-1/2">
          <img src="../assets/health.svg" alt="Monitoring" />
        </div>
      </div>
      <div class="flex items-center flex-wrap mb-20">
        <div class="w-full md:w-1/2">
          <img src="../assets/report.svg" alt="Reporting" />
        </div>
        <div class="w-full md:w-1/2 pl-10">
          <h4 class="text-3xl text-gray-800 font-bold mb-3">
            Indica la dirección
          </h4>
          <p class="text-gray-600 mb-8">
            Our Smart Health Monitoring Wristwatch can generate a comprehensive
            report on your vitals depending on your settings either daily,
            weekly, monthly, quarterly or yearly.
          </p>
        </div>
      </div>
      <div class="flex items-center flex-wrap mb-20">
        <div class="w-full md:w-1/2">
          <h4 class="text-3xl text-gray-800 font-bold mb-3">
            Realiza el pago
          </h4>
          <p class="text-gray-600 mb-8">
            Our Smart Health Monitoring Wristwatch allows you to sync data
            across all your mobile devices whether iOS, Android or Windows OS
            and also to your laptop whether MacOS, GNU/LInux or Windows OS.
          </p>
        </div>
        <div class="w-full md:w-1/2">
          <img src="../assets/sync.svg" alt="Syncing" />
        </div>
      </div>
    </section>
    <!-- Testimonials -->
    <section class="bg-gray-100">
      <div class="container mx-auto px-6 py-20">
        <h2 class="text-4xl font-bold text-center text-gray-800 mb-8">
          Testimonials
        </h2>
        <div class="flex flex-wrap">
          <div class="w-full md:w-1/3 px-2 mb-4">
            <div class="bg-white rounded shadow py-2">
              <p class="text-gray-800 text-base px-6 mb-5">
                Monitoring and tracking my health vitals anywhere I go and on
                any platform I use has never been easier.
              </p>
              <p class="text-gray-500 text-xs md:text-sm px-6">
                John Doe
              </p>
            </div>
          </div>
          <div class="w-full md:w-1/3 px-2 mb-4">
            <div class="bg-white rounded shadow py-2">
              <p class="text-gray-800 text-base px-6 mb-5">
                As an Athlete, this is the perfect product for me. I wear my
                Smart Health Monitoring Wristwatch everywhere i go, even in the
                bathroom since it's waterproof.
              </p>
              <p class="text-gray-500 text-xs md:text-sm px-6">
                Jane Doe
              </p>
            </div>
          </div>
          <div class="w-full md:w-1/3 px-2 mb-4">
            <div class="bg-white rounded shadow py-2">
              <p class="text-gray-800 text-base px-6 mb-5">
                I don't regret buying this wearble gadget. One of the best
                gadgets I own!.
              </p>
              <p class="text-gray-500 text-xs md:text-sm px-6">
                James Doe
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
    <!--Call to Action-->
    <section class="bg-blue-500">
      <div class="container mx-auto px-6 text-center py-20">
        <h2 class="mb-6 text-4xl font-bold text-center text-white">
          Elige el vehículo que más te acomode
        </h2>
        <h3 class="my-4 text-2xl text-white">
          Get yourself the Smart Health Monitoring Wristwatch!
        </h3>
        <button
          class="bg-white font-bold rounded-full mt-6 py-4 px-8 shadow-lg uppercase tracking-wider"
        >
          Agendar ahora
        </button>
      </div>
    </section>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex';

export default {
  props: [
  ],
  computed: {
    ...mapState({}),
  },
  methods: {
    ...mapActions([]),
  },
};
</script>
