<template>
  <div>
    <form v-if="activeForm == 'register'"
      class="bg-white pb-8 sm:p-0 p-5 sm:pb-8">
      <p class="text-center font-bold mb-10">
        Registro
      </p>
      <div class="flex flex-wrap -mx-3">
        <div class="w-full px-3 mb-4">
          <label class="block
            text-gray-700
            text-sm
            font-bold mb-2" for="email">
              Correo electrónico <span class="text-red-500">*</span>
          </label>
          <input :class="registerFormValidationMessages['email']
            ?'border-red-300':''"
            class="appearance-none
            border rounded
            w-full
            py-2
            px-3
            text-gray-700
            leading-tight
            focus:outline-none
            focus:border-blue-400"
            placeholder="juan.pedro@email.com"
            v-model="requiredFieldsRegister.email"
            id="email"
            type="text">
          <p v-if="registerFormValidationMessages['email']"
            class="text-red-500
            text-xs
            italic">{{ registerFormValidationMessages['email'] }}.</p>
        </div>
        <div class="w-full px-3 mb-4">
          <label class="block
            text-gray-700
            text-sm
            font-bold mb-2" for="mobilePhone">
              Teléfono móvil <span class="text-red-500">*</span>
          </label>
          <input :class="registerFormValidationMessages['mobilePhone']
            ?'border-red-300':''"
            class="appearance-none
            border rounded
            w-full
            py-2
            px-3
            text-gray-700
            leading-tight
            focus:outline-none
            focus:border-blue-400"
            v-model="requiredFieldsRegister.mobilePhone"
            id="mobilePhone"
            type="number">
          <p v-if="registerFormValidationMessages['mobilePhone']"
            class="text-red-500
            text-xs
            italic">{{ registerFormValidationMessages['mobilePhone'] }}.</p>
        </div>
        <div class="w-full px-3 mb-4">
          <label class="block
            text-gray-700
            text-sm
            font-bold mb-2" for="name">
                Nombre <span class="text-red-500">*</span>
          </label>
          <input :class="registerFormValidationMessages['name']
            ?'border-red-300':''"
            class="appearance-none
            border rounded
            w-full
            py-2
            px-3
            text-gray-700
            leading-tight
            focus:outline-none
            focus:border-blue-400"
            v-model="requiredFieldsRegister.name"
            id="name"
            placeholder="Juan Pedro"
            type="text">
          <p v-if="registerFormValidationMessages['name']"
            class="text-red-500
            text-xs
            italic">{{ registerFormValidationMessages['name'] }}.</p>
        </div>
        <div class="w-full px-3 mb-4">
          <label class="block
          text-gray-700
          text-sm
          font-bold mb-2" for="password">
              Password <span class="text-red-500">*</span>
          </label>
          <input :class="registerFormValidationMessages['password']
            ?'border-red-300':''"
            class="appearance-none
            border rounded
            w-full
            py-2
            px-3
            text-gray-700
            leading-tight
            focus:outline-none
            focus:border-blue-400"
            v-model="requiredFieldsRegister.password"
            id="password"
            type="password">
          <p v-if="registerFormValidationMessages['password']"
            class="text-red-500
            text-xs
            italic">{{ registerFormValidationMessages['password'] }}.</p>
        </div>
        <div class="w-full px-3 mb-4">
          <div class="flex items-center justify-end">
            <button
              type="button"
              class="
              text-red-400
              py-2
              px-4
              rounded
              focus:outline-none
              focus:border-blue-400"
              @click="cancel">
              Cancelar
            </button>
            <button
              type="button"
              :disabled="loading"
              :class="loading?'opacity-50 cursor-not-allowed':''"
              class="bg-green-500
              hover:bg-green-700
              text-white
              py-2
              px-4
              rounded
              focus:outline-none
              focus:border-blue-400"
              @click="register">
              Registrame
            </button>
          </div>
          <div class="w-full text-left mt-4">Si ya tienes una cuenta puedes <span
            @click="switchForm('login')"
            class="font-bold
              cursor-pointer
              text-blue-700
              focus:outline-none
              focus:border-blue-400">iniciar sesión.</span>
          </div>
        </div>
      </div>
    </form>
    <form v-if="activeForm == 'login'"
      class="bg-white pb-8 sm:p-0 p-5 sm:pb-8">
      <p class="text-center font-bold mb-10">
        inicio de sesión
      </p>
      <div class="flex flex-wrap -mx-3">
        <div class="w-full px-3 mb-4">
          <label class="block
            text-gray-700
            text-sm
            font-bold mb-2" for="email">
                Correo electrónico <span class="text-red-500">*</span>
          </label>
          <input :class="loginFormValidationMessages['email']
            ?'border-red-300':''"
            class="appearance-none
            border rounded
            w-full
            py-2
            px-3
            text-gray-700
            leading-tight
            focus:outline-none
            focus:border-blue-400"
            v-model="requiredFieldsLogin.email"
            id="email"
            type="text">
          <p v-if="loginFormValidationMessages['email']"
            class="text-red-500
            text-xs
            italic">{{ loginFormValidationMessages['email'] }}.</p>
        </div>
        <div class="w-full px-3 mb-4">
          <label class="block
          text-gray-700
          text-sm
          font-bold mb-2" for="password">
              Password <span class="text-red-500">*</span>
          </label>
          <input :class="loginFormValidationMessages['password']
            ?'border-red-300':''"
            class="appearance-none
            border rounded
            w-full
            py-2
            px-3
            text-gray-700
            leading-tight
            focus:outline-none
            focus:border-blue-400"
            v-model="requiredFieldsLogin.password"
            id="password"
            type="password">
          <p v-if="loginFormValidationMessages['password']"
            class="text-red-500
            text-xs
            italic">{{ loginFormValidationMessages['password'] }}.</p>
        </div>
        <div class="w-full px-3 mb-4">
          <div class="flex items-center justify-end">
            <button
              type="button"
              class="
              text-red-400
              py-2
              px-4
              rounded
              focus:outline-none
              focus:border-blue-400"
              @click="cancel">
              Cancelar
            </button>
            <button
              type="button"
              :disabled="loading"
              :class="loading?'opacity-50 cursor-not-allowed':''"
              class="bg-green-500
              hover:bg-green-700
              text-white
              py-2
              px-2
              rounded
              focus:outline-none
              focus:border-blue-400"
              @click="login"
              >
              Iniciar sesión
            </button>
          </div>
          <div class="w-full text-left mt-4">Si no tienes una cuenta puedes <span
            @click="switchForm('register')"
            class="font-bold
              cursor-pointer
              text-blue-700
              focus:outline-none
              focus:border-blue-400">Registrate.</span>
          </div>
        </div>
      </div>
    </form>
  </div>
</template>

<script>
import {
  mapMutations, mapState, mapGetters,
} from 'vuex';
import chalan from '../api/chalan';

export default {
  name: 'Login',
  data() {
    return {
      activeForm: 'register',
      requiredFieldsRegister: {
        email: null,
        password: null,
        mobilePhone: null,
        name: null,
      },
      requiredFieldsLogin: {
        email: null,
        password: null,
      },
      registerFormValidationMessages: {
        email: null,
        password: null,
        mobilePhone: null,
        name: null,
      },
      loginFormValidationMessages: {
        email: null,
        password: null,
      },
      canSubmitLoginForm: false,
      canSubmitRegisterForm: false,
    };
  },
  mounted() {
    this.setLoader(false);
  },
  methods: {
    ...mapMutations([
      'setCustomerData',
      'setLoader',
      'setViewsMessages',
    ]),
    emitUserLogged() {
      this.$emit('user-logged');
    },
    validateRequiredFields(form) {
      this.resetFormMessages();
      this.canSubmitRegisterForm = false;
      this.canSubmitLoginForm = false;
      const emptyFields = [];
      Object.keys(this[form]).forEach((field) => {
        if (!this[form][field]) {
          emptyFields.push(field);
        }
      });
      if (form === 'requiredFieldsRegister') {
        emptyFields.forEach((field) => {
          this.registerFormValidationMessages[field] = 'no olvides llenar este campo';
        });
        if (emptyFields.length === 0) {
          this.canSubmitRegisterForm = true;
        }
      }
      if (form === 'requiredFieldsLogin') {
        emptyFields.forEach((field) => {
          this.loginFormValidationMessages[field] = 'no olvides llenar este campo';
        });
        if (emptyFields.length === 0) {
          this.canSubmitLoginForm = true;
        }
      }
    },
    resetFormMessages() {
      this.registerFormValidationMessages = {
        email: null,
        password: null,
        mobilePhone: null,
        name: null,
      };
      this.loginFormValidationMessages = {
        email: null,
        password: null,
      };
    },
    switchForm(form) {
      this.activeForm = form;
      this.resetFormMessages();
      this.setViewsMessages({
        view: 'register-login',
        message: null,
      });
    },
    login() {
      this.validateRequiredFields('requiredFieldsLogin');
      if (this.canSubmitLoginForm) {
        this.setLoader(true);
        chalan.login({
          email: this.requiredFieldsLogin.email,
          password: this.requiredFieldsLogin.password,
        })
          .then((response) => {
            if (response.status === 200) {
              this.handleUserData(response.data);
              this.emitUserLogged();
            }
          })
          .catch((error) => {
            this.setLoader(false);
            let errorMessages;
            if (error.response && error.response.data.message === "user doesn't exist") {
              errorMessages = 'El usuario no existe o la contraseña es incorrecta';
            } else {
              errorMessages = 'Ocurrio un error, por favor intenta nuevamente o recarga la página';
            }
            this.setViewsMessages({
              view: 'register-login',
              message: {
                text: errorMessages,
                type: 'error',
              },
            });
          });
      }
    },
    register() {
      this.validateRequiredFields('requiredFieldsRegister');
      if (this.canSubmitRegisterForm) {
        this.setLoader(true);
        chalan.register({
          email: this.requiredFieldsRegister.email,
          password: this.requiredFieldsRegister.password,
          mobilePhone: this.requiredFieldsRegister.mobilePhone,
          name: this.requiredFieldsRegister.name,
        })
          .then((response) => {
            if (response.status === 201) {
              this.handleUserData(response.data);
              this.emitUserLogged();
            }
          })
          .catch((error) => {
            this.setLoader(false);
            if (error.response && error.response.data.message === 'duplicated email') {
              this.setViewsMessages({
                view: 'register-login',
                message: {
                  text: 'Ya existe un usuario con ese correo',
                  type: 'error',
                },
              });
            }
          });
      }
    },
    handleUserData(data) {
      this.setCustomerData({ field: 'token', value: data.token });
      this.setCustomerData({ field: 'customer_id', value: this.decodeToken.id });
      this.setCustomerData({ field: 'email', value: data.email });
      this.setCustomerData({ field: 'mobile_phone', value: data.mobile_phone });
      this.setCustomerData({ field: 'customer_name', value: data.name });
      this.setCustomerData({ field: 'picture', value: '' });
    },
    cancel() {
      this.$router.go(-1);
    },
  },
  computed: {
    ...mapState([
      'loading',
    ]),
    ...mapGetters([
      'decodeToken',
    ]),
  },
};
</script>
