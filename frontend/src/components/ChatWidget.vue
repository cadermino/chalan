<template>
  <div>
    <!-- Floating button -->
    <button
      @click="open = !open"
      aria-label="Abrir chat de soporte"
      style="position:fixed;bottom:20px;right:20px;z-index:100;width:56px;
             height:56px;border-radius:50%;background:#2fa55f;color:#fff;
             box-shadow:0 4px 12px rgba(0,0,0,.25);border:none;cursor:pointer;
             display:flex;align-items:center;justify-content:center;"
    >
      <svg
        v-if="open"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        width="24"
        height="24"
      >
        <path
          fill-rule="evenodd"
          d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0
             111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12
             13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47
             6.53a.75.75 0 010-1.06z"
          clip-rule="evenodd"
        />
      </svg>
      <svg
        v-else
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        width="24"
        height="24"
      >
        <path
          fill-rule="evenodd"
          d="M4.804 21.644A6.707 6.707 0 006 21.75a6.721 6.721 0
             003.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97
             9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025
             4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 01-.814
             1.686.75.75 0 00.44 1.223zM8.25 10.875a1.125 1.125 0 100 2.25
             1.125 1.125 0 000-2.25zM10.875 12a1.125 1.125 0 112.25 0 1.125
             1.125 0 01-2.25 0zm4.875-1.125a1.125 1.125 0 100 2.25 1.125
             1.125 0 000-2.25z"
          clip-rule="evenodd"
        />
      </svg>
      <span
        v-if="!open"
        style="position:absolute;top:2px;right:2px;width:18px;height:18px;
               background:#ef4444;border-radius:50%;border:2px solid #fff;
               display:flex;align-items:center;justify-content:center;
               color:#fff;font-size:10px;font-weight:700;line-height:1;"
      >1</span>
    </button>

    <!-- Chat panel -->
    <div
      v-if="open"
      class="chat-panel"
      style="position:fixed;bottom:90px;right:20px;z-index:100;width:320px;
             max-height:70vh;background:#fff;border-radius:16px;
             box-shadow:0 8px 32px rgba(0,0,0,.18);display:flex;
             flex-direction:column;overflow:hidden;border:1px solid #e5e7eb;"
    >
      <!-- Header -->
      <div
        style="background:#2fa55f;padding:12px 16px;display:flex;
               align-items:center;gap:12px;flex-shrink:0;"
      >
        <div
          style="width:32px;height:32px;border-radius:50%;
                 background:rgba(255,255,255,.2);display:flex;
                 align-items:center;justify-content:center;
                 color:#fff;font-weight:700;font-size:14px;"
        >
          C
        </div>
        <div style="flex:1;">
          <p style="color:#fff;font-weight:600;font-size:14px;margin:0;">
            Chalán - Soporte
          </p>
          <p style="color:#99f6e4;font-size:12px;margin:0;">
            Te respondemos pronto
          </p>
        </div>
        <button
          @click="open = false"
          style="background:none;border:none;color:rgba(255,255,255,.7);
                 font-size:18px;cursor:pointer;padding:4px;line-height:1;"
        >✕</button>
      </div>

      <!-- Messages -->
      <div
        ref="messageList"
        style="flex:1;overflow-y:auto;padding:12px;
               display:flex;flex-direction:column;gap:8px;background:#f9fafb;"
      >
        <div
          v-for="m in displayMessages"
          :key="m.id"
          :style="{
            display: 'flex',
            justifyContent: m.direction === 'inbound' ? 'flex-end' : 'flex-start',
          }"
        >
          <div
            :style="{
              maxWidth: '80%',
              borderRadius: '16px',
              padding: '8px 12px',
              fontSize: '14px',
              background: m.direction === 'inbound' ? '#14b8a6' : '#fff',
              color: m.direction === 'inbound' ? '#fff' : '#111827',
              border: m.direction === 'inbound' ? 'none' : '1px solid #e5e7eb',
              boxShadow: m.direction === 'outbound' ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
              borderTopRightRadius: m.direction === 'inbound' ? '4px' : '16px',
              borderTopLeftRadius: m.direction === 'outbound' ? '4px' : '16px',
            }"
          >
            <p style="margin:0;white-space:pre-wrap;">{{ m.body }}</p>
            <p
              :style="{
                margin: '4px 0 0',
                fontSize: '11px',
                textAlign: 'right',
                color: m.direction === 'inbound' ? 'rgba(255,255,255,.7)' : '#9ca3af',
              }"
            >
              {{ formatTime(m.created_at) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Input -->
      <div style="border-top:1px solid #e5e7eb;background:#fff;padding:12px;flex-shrink:0;">
        <p v-if="error" style="font-size:12px;color:#ef4444;margin:0 0 8px;">
          {{ error }}
        </p>
        <form @submit.prevent="sendMessage" style="display:flex;gap:8px;">
          <textarea
            ref="textarea"
            v-model="body"
            @keydown.enter.exact.prevent="sendMessage"
            placeholder="Escribe tu mensaje..."
            rows="1"
            maxlength="1000"
            style="flex:1;border:1px solid #d1d5db;border-radius:12px;
                   padding:8px 12px;font-size:14px;resize:none;
                   font-family:inherit;outline:none;"
          />
          <button
            type="submit"
            :disabled="sending || !body.trim()"
            style="background:#2fa55f;color:#fff;border:none;border-radius:12px;
                   padding:8px 14px;font-size:16px;cursor:pointer;
                   align-self:flex-end;opacity:1;"
            :style="{ opacity: (sending || !body.trim()) ? 0.4 : 1 }"
          >
            {{ sending ? '…' : '→' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
const SESSION_KEY = 'chalan_chat_session';
const POLL_INTERVAL = 5000;

const PHANTOM_MESSAGE = {
  id: '__phantom__',
  direction: 'outbound',
  body: '¡Hola! 👋 ¿Tienes dudas sobre tu mudanza o flete? Escríbenos y te ayudamos.',
  created_at: new Date().toISOString(),
};

function getOrCreateSession() {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id || !/^[a-z0-9]{12}$/.test(id)) {
      id = Math.random().toString(36).slice(2, 14).padEnd(12, '0');
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch (e) {
    return Math.random().toString(36).slice(2, 14).padEnd(12, '0');
  }
}

export default {
  name: 'ChatWidget',
  data() {
    return {
      open: false,
      messages: [],
      body: '',
      sending: false,
      error: '',
      sessionId: null,
      pollTimer: null,
    };
  },
  mounted() {
    this.sessionId = getOrCreateSession();
  },
  beforeDestroy() {
    this.stopPolling();
  },
  watch: {
    open(val) {
      if (val) {
        this.fetchMessages();
        this.pollTimer = setInterval(this.fetchMessages, POLL_INTERVAL);
        this.$nextTick(() => {
          if (this.$refs.textarea) this.$refs.textarea.focus();
        });
      } else {
        this.stopPolling();
      }
    },
    messages() {
      this.$nextTick(() => {
        const el = this.$refs.messageList;
        if (el) el.scrollTop = el.scrollHeight;
      });
    },
  },
  computed: {
    displayMessages() {
      if (this.messages.length === 0) return [PHANTOM_MESSAGE];
      return this.messages;
    },
  },
  methods: {
    stopPolling() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    },
    async fetchMessages() {
      if (!this.sessionId) return;
      try {
        const res = await fetch(`/api/v1/chat/messages/${this.sessionId}`);
        const data = await res.json();
        if (Array.isArray(data.messages)) this.messages = data.messages;
      } catch (e) {
        // error de red, ignorar
      }
    },
    async sendMessage() {
      if (!this.body.trim() || !this.sessionId) return;
      this.error = '';
      this.sending = true;
      try {
        const res = await fetch('/api/v1/chat/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: this.sessionId,
            body: this.body.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          this.error = data.message || 'Error al enviar';
          return;
        }
        this.messages.push(data.message);
        this.body = '';
      } catch (e) {
        this.error = 'Error al enviar. Intenta de nuevo.';
      } finally {
        this.sending = false;
      }
    },
    formatTime(iso) {
      return new Date(iso).toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
      });
    },
  },
};
</script>

<style scoped>
@media (max-width: 639px) {
  .chat-panel {
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    max-height: 85vh !important;
    border-radius: 16px 16px 0 0 !important;
    border-left: none !important;
    border-right: none !important;
    border-bottom: none !important;
  }
}
</style>
