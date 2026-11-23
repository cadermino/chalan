<template>
  <div v-if="state !== 'hidden'">
    <div v-if="state === 'ask' || state === 'working'"
      id="push-opt-in"
      class="p-4 sm:p-5 bg-white border border-blue-200 shadow-lg flex items-start">
      <svg class="h-6 w-6 text-blue-600 flex-shrink-0 mr-3 mt-1" fill="none" viewBox="0 0 24 24"
        stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" :d="BELL" />
      </svg>
      <div class="flex-1">
        <p class="font-semibold text-gray-800">Recibe las órdenes nuevas al instante</p>
        <p class="text-sm text-gray-600 mt-1">
          Te avisamos en este celular apenas entre una orden para cotizar, aunque tengas el
          navegador cerrado. El WhatsApp te sigue llegando igual.
        </p>
        <div class="mt-3 flex flex-wrap items-center">
          <button id="push-enable" @click="enable" :disabled="state === 'working'"
            class="text-white bg-blue-500 hover:bg-blue-700 border-0 py-2 px-5 rounded mr-4
              focus:outline-none disabled:opacity-50">
            {{ state === 'working' ? 'Activando…' : 'Activar avisos' }}
          </button>
          <button @click="dismiss" :disabled="state === 'working'"
            class="text-sm text-gray-500 underline hover:text-gray-700 py-2">Ahora no</button>
        </div>
      </div>
    </div>

    <div v-else-if="state === 'ios_install'"
      id="push-ios-install"
      class="p-4 sm:p-5 bg-white border border-blue-200 shadow-lg flex items-start">
      <svg class="h-6 w-6 text-blue-600 flex-shrink-0 mr-3 mt-1" fill="none" viewBox="0 0 24 24"
        stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" :d="BELL" />
      </svg>
      <div class="flex-1">
        <p class="font-semibold text-gray-800">Recibe las órdenes nuevas al instante en tu iPhone</p>
        <ol class="text-sm text-gray-600 mt-1 list-decimal pl-5 space-y-1">
          <li>Toca <strong>Compartir</strong> en Safari (el cuadrado con la flecha).</li>
          <li>Elige <strong>"Agregar a pantalla de inicio"</strong>.</li>
          <li>Abre Chalán desde ese ícono y toca <strong>"Activar avisos"</strong>.</li>
        </ol>
        <button @click="dismiss"
          class="mt-2 text-sm text-gray-500 underline hover:text-gray-700 py-2">Ahora no</button>
      </div>
    </div>

    <p v-else-if="state === 'on'" id="push-on" class="text-sm text-green-700 flex items-center">
      <svg class="h-5 w-5 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"
        stroke-width="1.5" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" :d="CHECK" />
      </svg>
      Avisos activados en este celular.
    </p>

    <div v-else-if="state === 'denied' || state === 'no_prompt'"
      id="push-help"
      class="p-4 sm:p-5 bg-white border border-yellow-300 shadow-lg flex items-start">
      <svg class="h-6 w-6 text-yellow-600 flex-shrink-0 mr-3 mt-1" fill="none" viewBox="0 0 24 24"
        stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" :d="BELL" />
      </svg>
      <div class="flex-1">
        <p class="font-semibold text-gray-800">
          {{ state === 'denied'
            ? 'Los avisos de Chalán están bloqueados en este celular'
            : 'Tu navegador no mostró la pregunta para permitir avisos' }}
        </p>
        <ol v-if="ios" class="text-sm text-gray-600 mt-1 list-decimal pl-5 space-y-1">
          <li>Abre <strong>Ajustes</strong> del iPhone → <strong>Notificaciones</strong> → <strong>Chalán</strong>.</li>
          <li>Activa <strong>Permitir notificaciones</strong>.</li>
          <li>Vuelve aquí y toca <strong>"Ya lo permití"</strong>.</li>
        </ol>
        <ol v-else class="text-sm text-gray-600 mt-1 list-decimal pl-5 space-y-1">
          <li>Toca <strong>⋮</strong> (arriba a la derecha) → <strong>Controles de sitio</strong>.
            También está en el ícono a la izquierda de chalan.pe.</li>
          <li><strong>Permisos</strong> → <strong>Notificaciones</strong> → <strong>Permitir</strong>.</li>
          <li>Vuelve aquí y toca <strong>"Ya lo permití"</strong>.</li>
        </ol>
        <div class="mt-3 flex flex-wrap items-center">
          <button id="push-retry" @click="enable"
            class="text-white bg-blue-500 hover:bg-blue-700 border-0 py-2 px-5 rounded mr-4
              focus:outline-none">Ya lo permití</button>
          <button @click="dismiss"
            class="text-sm text-gray-500 underline hover:text-gray-700 py-2">Ahora no</button>
        </div>
      </div>
    </div>

    <p v-else-if="state === 'failed'" id="push-failed" class="text-sm text-gray-600">
      Tu celular no puede recibir avisos de Chalán. Te seguimos escribiendo por WhatsApp.
    </p>
  </div>
</template>

<script>
// Pide el permiso de avisos en el link de cotizar y guarda el buzón de este
// navegador para su empresa (app/api/carrier_push.py). El service worker es
// public/quotation/push-sw.js: su alcance es solo /quotation/.
import chalan from '../../api/chalan';
import storage from '../../utils/safeStorage';
import { track } from '../../utils/analytics';
import { tagSessionLabel } from '../../utils/sessionTags';

const SW_URL = '/quotation/push-sw.js';
const SW_SCOPE = '/quotation/';
const SW_TIMEOUT_MS = 10000;
const DISMISS_KEY = 'chalan_push_dismissed_at';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function base64UrlToBytes(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const raw = window.atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

function sameKey(buffer, key) {
  if (!buffer) return false;
  const a = new Uint8Array(buffer);
  const b = base64UrlToBytes(key);
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

// Web Push en iPhone existe desde iOS 16.4, y solo con el sitio en la pantalla de inicio.
function iosHasWebPush() {
  const match = navigator.userAgent.match(/OS (\d+)_(\d+)/);
  if (!match) return true;
  const [major, minor] = [Number(match[1]), Number(match[2])];
  return major > 16 || (major === 16 && minor >= 4);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function pushSupported() {
  return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window
    && 'Notification' in window;
}

function platform() {
  if (isIos()) return 'ios';
  return /Android/i.test(navigator.userAgent) ? 'android' : 'other';
}

// Al agregarlo a la pantalla de inicio, el iPhone lee el nombre y el ícono de
// aquí. Solo en esta página: el resto de la app de Vue no es para instalar.
function addHomeScreenLinks() {
  if (document.querySelector('link[rel="manifest"]')) return;
  [['manifest', '/quotation/manifest.json'], ['apple-touch-icon', '/quotation/icon-192.png']]
    .forEach(([rel, href]) => {
      const link = document.createElement('link');
      link.rel = rel;
      link.href = href;
      document.head.appendChild(link);
    });
}

function failureReason(error) {
  if (error && error.response) {
    const message = error.response.data && error.response.data.message;
    return message || `server_${error.response.status}`;
  }
  return (error && (error.name || error.message)) || 'unknown';
}

export default {
  name: 'PushOptIn',
  props: {
    token: { type: String, required: true },
    orderId: { type: Number, default: null },
    carrierCompanyId: { type: Number, default: null },
  },
  data() {
    return {
      state: 'hidden',
      publicKey: null,
      ios: isIos(),
      // Heroicons (outline): bell y check-circle.
      BELL: 'M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0',
      CHECK: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    };
  },
  async mounted() {
    try {
      this.publicKey = (await chalan.getWebPushKey()).data.public_key;
    } catch (error) {
      return;
    }
    if (!this.publicKey) return;

    if (isIos() && !isStandalone()) {
      if (!iosHasWebPush()) return;
      addHomeScreenLinks();
      if (!this.dismissedRecently()) this.show('ios_install');
      return;
    }
    // Otro navegador sin avisos (o un Huawei sin Google, que falla al activar):
    // nada que ofrecer, sigue por WhatsApp.
    if (!pushSupported()) return;
    if (Notification.permission === 'denied') {
      this.state = 'denied';
      return;
    }
    if (Notification.permission === 'granted') {
      try {
        const registration = await this.registration();
        const existing = await registration.pushManager.getSubscription();
        if (existing && sameKey(existing.options.applicationServerKey, this.publicKey)) {
          // Lo vuelve a guardar: puede ser el link de otra empresa, o el buzón cambió.
          await this.save(existing);
          this.state = 'on';
          return;
        }
      } catch (error) {
        // Se ofrece de nuevo.
      }
    }
    if (!this.dismissedRecently()) this.show('ask');
  },
  methods: {
    params(extra = {}) {
      return {
        order_id: this.orderId, carrier_company_id: this.carrierCompanyId, platform: platform(), ...extra,
      };
    },
    show(state) {
      this.state = state;
      track('push_prompt_shown', this.params({ variant: state }));
    },
    dismissedRecently() {
      const at = Number(storage.getItem(DISMISS_KEY));
      return Boolean(at) && Date.now() - at < DISMISS_MS;
    },
    dismiss() {
      storage.setItem(DISMISS_KEY, String(Date.now()));
      track('push_dismissed', this.params({ variant: this.state }));
      this.state = 'hidden';
    },
    async registration() {
      const registration = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
      if (registration.active) return registration;
      const worker = registration.installing || registration.waiting;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('sw_timeout')), SW_TIMEOUT_MS);
        const done = () => { clearTimeout(timer); resolve(registration); };
        if (!worker) {
          done();
          return;
        }
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated') done();
        });
      });
    },
    save(subscription) {
      return chalan.subscribeCarrierPush(this.token, subscription.toJSON());
    },
    async enable() {
      this.state = 'working';
      let permission;
      try {
        permission = await Notification.requestPermission();
      } catch (error) {
        permission = Notification.permission;
      }
      if (permission !== 'granted') {
        // 'default' sin haber visto la pregunta: Chrome con "mensajes discretos"
        // (o una ventana dentro de otra app) contesta solo. Se explica cómo
        // permitirlo a mano en vez de volver al botón sin decir nada.
        this.state = permission === 'denied' ? 'denied' : 'no_prompt';
        track('push_denied', this.params({ permission }));
        return;
      }
      try {
        const registration = await this.registration();
        let subscription = await registration.pushManager.getSubscription();
        if (subscription && !sameKey(subscription.options.applicationServerKey, this.publicKey)) {
          await subscription.unsubscribe();
          subscription = null;
        }
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64UrlToBytes(this.publicKey),
          });
        }
        await this.save(subscription);
        this.state = 'on';
        track('push_enabled', this.params());
        tagSessionLabel('push_enabled');
      } catch (error) {
        const reason = failureReason(error);
        this.state = 'failed';
        track('push_failed', this.params({ reason }));
        tagSessionLabel(`push_failed:${reason}`);
      }
    },
  },
};
</script>
