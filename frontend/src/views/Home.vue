<template>
  <div class="home">
    <!--Hero-->
    <div
      class="lg:pt-48 lg:pb-64 py-20 bg-cover"
      :style="{ backgroundImage:
      'url(' + require('@/assets/shipping-boxes-dark-resized.jpg') + ')'}"
    >
      <div class="container mx-auto px-6 text-left">
        <h2 class="text-4xl font-bold mb-2 text-white">
          En Chalán te ayudamos a encontrar el vehículo ideal para tu mudanza
        </h2>
        <h3 class="text-2xl mb-8 text-gray-200">
          Chalán te muestra una lista de
          vehículos según tamaño y precio. Escoge el que más te convenga.
        </h3>
        <router-link to="/order/step-one" class="bg-blue-500
          hover:bg-blue-700
          text-white
          font-bold
          rounded-full
          py-4 px-8 shadow-lg tracking-wider">
          Ver precios
        </router-link>
      </div>
    </div>
    <!-- Features -->
    <section class="container mx-auto px-6 p-10">
      <h2 class="text-4xl font-bold text-center text-gray-800 mb-8">
        Múdate en solo 4 pasos
      </h2>
      <div class="flex items-center flex-wrap mb-20">
        <div class="w-full md:w-1/2">
          <h4 class="text-3xl text-gray-800 font-bold mb-3">
            Indícanos las direcciones
          </h4>
          <p class="text-gray-600 mb-8 text-lg">
            Para cotizar con mayor precisión,
            necesitamos saber desde donde y a qué lugar te vamos a mover
          </p>
        </div>
        <div class="w-full md:w-1/2">
          <!-- <img src="../assets/health.svg" alt="Monitoring" /> -->
          <img src="../assets/address.png" alt="direcciones" />
        </div>
      </div>
      <div class="flex items-center flex-wrap mb-20">
        <div class="w-full md:w-1/2">
          <!-- <img src="../assets/roadmap.svg" alt="Reporting" /> -->
          <img src="../assets/date.png" alt="Fecha y hora" />
        </div>
        <div class="w-full md:w-1/2 pl-10">
          <h4 class="text-3xl text-gray-800 font-bold mb-3">
            Fecha y hora de tu mudanza
          </h4>
          <p class="text-gray-600 mb-8 text-lg">
            Ingresa la fecha y hora en la que vamos por tus cosas.
          </p>
        </div>
      </div>
      <div class="flex items-center flex-wrap mb-20">
        <div class="w-full md:w-1/2">
          <h4 class="text-3xl text-gray-800 font-bold mb-3">
            Escoge la movilidad
          </h4>
          <p class="text-gray-600 mb-8 text-lg">
            Tenemos vehículos de todos los tamaños clasificados
            en tres categorías, pequeño, mediano y grande
          </p>
        </div>
        <div class="w-full md:w-1/2">
          <img src="../assets/truck-list.png" alt="Syncing" />
        </div>
      </div>
      <div class="flex items-center flex-wrap mb-20">
        <div class="w-full md:w-1/2">
          <!-- <img src="../assets/roadmap.svg" alt="Reporting" /> -->
          <img src="../assets/payment.png" alt="Fecha y hora" />
        </div>
        <div class="w-full md:w-1/2 pl-10">
          <h4 class="text-3xl text-gray-800 font-bold mb-3">
            Opciones de pago
          </h4>
          <p class="text-gray-600 mb-8 text-lg">
            Contamos con dos opciones de pago, en efectivo y con tarjeta.
          </p>
        </div>
      </div>
    </section>
    <!-- Testimonials -->
    <section class="bg-gray-100 hidden">
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
        <!-- <h3 class="my-4 text-2xl text-white">
          Get yourself the Smart Health Monitoring Wristwatch!
        </h3> -->
        <router-link to="/order/step-one" class="bg-white
          font-bold
          rounded-full
          mt-6
          py-4
          px-8
          shadow-lg
          uppercase
          tracking-wider">
          Cotiza ahora
        </router-link>
      </div>
    </section>
  </div>
</template>

<script>
import { mapState, mapActions, mapMutations } from 'vuex';

export default {
  props: [
  ],
  mounted() {
    this.setLoader(false);
  },
  computed: {
    ...mapState({}),
  },
  methods: {
    ...mapActions([]),
    ...mapMutations([
      'setLoader',
    ]),
  },
};
</script>
