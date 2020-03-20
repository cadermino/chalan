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
            Datos de tu mudanza
          </p>
          <div class="flex flex-wrap mb-4">
            <div class="w-full px-3 mb-4">
              <div class="bg-white shadow overflow-hidden sm:rounded-lg">
                <div class="px-4 py-5 border-b border-gray-200 sm:px-6">
                  <h3 class="text-lg leading-6 font-medium text-gray-900">
                    Applicant Information
                  </h3>
                  <p class="mt-1 max-w-2xl text-sm leading-5 text-gray-500">
                    Personal details and application.
                  </p>
                </div>
                <div>
                  <dl>
                    <div class="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt class="text-sm leading-5 font-medium text-gray-500">
                        Full name
                      </dt>
                      <dd class="mt-1 text-sm leading-5 text-gray-900 sm:mt-0 sm:col-span-2">
                        Margot Foster
                      </dd>
                    </div>
                    <div class="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt class="text-sm leading-5 font-medium text-gray-500">
                        Application for
                      </dt>
                      <dd class="mt-1 text-sm leading-5 text-gray-900 sm:mt-0 sm:col-span-2">
                        Backend Developer
                      </dd>
                    </div>
                    <div class="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt class="text-sm leading-5 font-medium text-gray-500">
                        Email address
                      </dt>
                      <dd class="mt-1 text-sm leading-5 text-gray-900 sm:mt-0 sm:col-span-2">
                        margotfoster@example.com
                      </dd>
                    </div>
                    <div class="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt class="text-sm leading-5 font-medium text-gray-500">
                        Salary expectation
                      </dt>
                      <dd class="mt-1 text-sm leading-5 text-gray-900 sm:mt-0 sm:col-span-2">
                        $120,000
                      </dd>
                    </div>
                    <div class="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt class="text-sm leading-5 font-medium text-gray-500">
                        About
                      </dt>
                      <dd class="mt-1 text-sm leading-5 text-gray-900 sm:mt-0 sm:col-span-2">
                        Fugiat ipsum ipsum deserunt culpa aute sint do nostrud anim incididunt
                        cillum culpa consequat. Excepteur qui ipsum aliquip consequat sint.
                        Sit id mollit nulla mollit nostrud in ea officia proident.
                        Irure nostrud pariatur mollit ad adipisicing reprehenderit deserunt qui eu.
                      </dd>
                    </div>
                    <div class="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                      <dt class="text-sm leading-5 font-medium text-gray-500">
                        Attachments
                      </dt>
                      <dd class="mt-1 text-sm leading-5 text-gray-900 sm:mt-0 sm:col-span-2">
                        <ul class="border border-gray-200 rounded-md">
                          <li class="pl-3
                          pr-4
                          py-3
                          flex
                          items-center
                          justify-between
                          text-sm
                          leading-5">
                            <div class="w-0 flex-1 flex items-center">
                              <svg class="flex-shrink-0 h-5 w-5 text-gray-400"
                                fill="currentColor"
                                viewBox="0 0 20 20">
                                <path fill-rule="evenodd"
                                  d="M8
                                  4a3
                                  3
                                  0
                                  00-3
                                  3v4a5
                                  5
                                  0
                                  0010
                                  0V7a1
                                  1
                                  0
                                  112
                                  0v4a7
                                  7
                                  0
                                  11-14
                                  0V7a5
                                  5
                                  0
                                  0110
                                  0v4a3
                                  3
                                  0
                                  11-6
                                  0V7a1
                                  1
                                  0
                                  012
                                  0v4a1
                                  1
                                  0
                                  102
                                  0V7a3
                                  3
                                  0
                                  00-3-3z" clip-rule="evenodd"/>
                              </svg>
                              <span class="ml-2 flex-1 w-0 truncate">
                                resume_back_end_developer.pdf
                              </span>
                            </div>
                            <div class="ml-4 flex-shrink-0">
                              <a href="#" class="font-medium
                              text-indigo-600
                              hover:text-indigo-500
                              transition
                              duration-150
                              ease-in-out">
                                Download
                              </a>
                            </div>
                          </li>
                          <li class="border-t
                          border-gray-200
                          pl-3
                          pr-4
                          py-3
                          flex
                          items-center
                          justify-between
                          text-sm
                          leading-5">
                            <div class="w-0 flex-1 flex items-center">
                              <svg class="flex-shrink-0
                              h-5
                              w-5
                              text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M8
                                4a3
                                3
                                0
                                00-3
                                3v4a5
                                5
                                0
                                0010
                                0V7a1
                                1
                                0
                                112
                                0v4a7
                                7
                                0
                                11-14
                                0V7a5
                                5
                                0
                                0110
                                0v4a3
                                3
                                0
                                11-6
                                0V7a1
                                1
                                0
                                012
                                0v4a1
                                1
                                0
                                102
                                0V7a3
                                3
                                0
                                00-3-3z" clip-rule="evenodd"/>
                              </svg>
                              <span class="ml-2 flex-1 w-0 truncate">
                                coverletter_back_end_developer.pdf
                              </span>
                            </div>
                            <div class="ml-4 flex-shrink-0">
                              <a href="#" class="font-medium
                              text-indigo-600
                              hover:text-indigo-500
                              transition
                              duration-150
                              ease-in-out">
                                Download
                              </a>
                            </div>
                          </li>
                        </ul>
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <router-link to="/order/step-two" class="bg-green-500
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
              focus:border-blue-400">
              Proceder al pago
              </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {
  mapState, mapActions, mapMutations, mapGetters,
} from 'vuex';
import Tracker from '@/components/Tracker.vue';

export default {
  name: 'step-four',
  data() {
    return {
      viewName: 'step-four',
    };
  },
  components: {
    Tracker,
  },
  mounted() {
    this.getDataFromLocalStorage();
  },
  props: [
  ],
  methods: {
    ...mapActions([
      'getDataFromLocalStorage',
      'validateRequiredFields',
      'addDataToLocalStorage',
    ]),
    ...mapMutations([
      'setOrder',
      'setViewsMessages',
    ]),
    confirmPayment() {
    },
  },
  computed: {
    ...mapState([
      'formValidationMessages',
      'steps',
      'viewsMessages',
      'currentOrder',
    ]),
    ...mapGetters([
      'isUserLogged',
    ]),
  },
};
</script>
