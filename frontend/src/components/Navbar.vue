<template>
  <header id="nav" class="topbar">
    <div class="topbar-inner wrap">

      <router-link :to="{ name: 'home' }" class="brand" aria-label="Chalán">
        <img src="@/assets/logo_chalan.png" alt="Chalán" />
        <span class="brand-tld">.pe</span>
      </router-link>

      <nav class="nav nav-links" aria-label="Navegación principal">
        <a href="/como-funciona">Cómo funciona</a>
        <a href="/#flota">Flota</a>
        <a href="/fletes-peru">Rutas</a>
        <a href="/blog">Blog</a>
        <a href="/preguntas-frecuentes">Preguntas</a>
        <span class="sep" aria-hidden="true" />
        <router-link v-if="!isUserLogged" :to="{ name: 'register-login' }" @click.native="isOpen = false" class="login-link">Ingresar</router-link>
        <AccountDropdown v-if="isUserLogged" />
        <a href="https://wa.me/51972643007" target="_blank" rel="noopener" aria-label="Contáctanos por WhatsApp" class="wa-link">WhatsApp</a>
        <router-link :to="{ name: 'step-one' }" @click.native="isOpen = false" class="btn btn-primary">
          Cotizar
          <svg class="arrow" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </router-link>
      </nav>

      <button class="hamburger" @click="isOpen = !isOpen" :aria-expanded="String(isOpen)" aria-label="Menú">
        <svg v-if="!isOpen" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        <svg v-else viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div v-if="isOpen" class="mobile-menu">
      <a href="/como-funciona" @click="isOpen = false">Cómo funciona</a>
      <a href="/#flota" @click="isOpen = false">Flota</a>
      <a href="/fletes-peru" @click="isOpen = false">Rutas</a>
      <a href="/blog" @click="isOpen = false">Blog</a>
      <a href="/preguntas-frecuentes" @click="isOpen = false">Preguntas</a>
      <div class="mobile-sep" />
      <router-link v-if="!isUserLogged" :to="{ name: 'register-login' }" @click.native="isOpen = false">Ingresar</router-link>
      <AccountDropdown v-if="isUserLogged" />
      <a href="https://wa.me/51972643007" target="_blank" rel="noopener">WhatsApp</a>
      <router-link :to="{ name: 'step-one' }" @click.native="isOpen = false" class="btn btn-primary mobile-cta">Cotizar</router-link>
    </div>
  </header>
</template>

<script>
import { mapState, mapActions, mapGetters } from 'vuex';
import AccountDropdown from '@/components/AccountDropdown.vue';

export default {
  name: 'Navbar',
  data() {
    return { isOpen: false };
  },
  components: { AccountDropdown },
  methods: { ...mapActions(['logout']) },
  computed: {
    ...mapGetters(['isUserLogged']),
    ...mapState(['customer']),
  },
};
</script>

<style scoped>
.topbar {
  --ink:         #c8c0b4;
  --ink-strong:  #f3ede2;
  --mute:        #7a8899;
  --paper:       #1f2632;
  --line:        #3a4558;
  --line-strong: #4a5568;
  --ch-accent:   #2fa55f;
  --mono:        "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --sans:        "Inter Tight", "Helvetica Neue", Helvetica, Arial, sans-serif;

  background: var(--paper);
  border-bottom: 1px solid var(--line);
  font-family: var(--sans);
}

.wrap {
  width: 100%;
  max-width: 1320px;
  margin: 0 auto;
  padding: 0 32px;
}

.topbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 72px;
}

/* ── Brand ── */
.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--ink);
}
.brand img {
  height: 32px;
  width: auto;
  filter: brightness(0) invert(1) sepia(0.15) saturate(0.4);
}
.brand-tld {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--mute);
  letter-spacing: 0.08em;
  border: 1px solid var(--line-strong);
  padding: 2px 6px;
  border-radius: 3px;
}

/* ── Desktop nav ── */
.nav {
  display: flex;
  align-items: center;
  gap: 28px;
}
.nav a,
.nav .login-link,
.nav .wa-link {
  font-size: 14px;
  color: var(--ink);
  opacity: 0.78;
  text-decoration: none;
  transition: opacity 0.15s;
}
.nav a:hover,
.nav .login-link:hover,
.nav .wa-link:hover { opacity: 1; }
.nav .login-link { opacity: 0.65; }
.nav .wa-link    { opacity: 0.85; }
.sep {
  width: 1px;
  height: 16px;
  background: var(--line-strong);
  flex-shrink: 0;
}

/* ── Button ── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid transparent;
  white-space: nowrap;
  text-decoration: none;
  transition: filter 0.15s;
  opacity: 1 !important;
}
.btn-primary {
  background: var(--ch-accent);
  color: #fff;
}
.btn-primary:hover { filter: brightness(1.1); }
.arrow { display: inline-block; transition: transform 0.18s; }
.btn:hover .arrow { transform: translateX(3px); }

/* ── Hamburger ── */
.hamburger {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--ink);
  padding: 4px;
}

/* ── Mobile menu ── */
.mobile-menu {
  display: flex;
  flex-direction: column;
  gap: 0;
  background: var(--paper);
  border-top: 1px solid var(--line);
  padding: 8px 0 16px;
}
.mobile-menu a,
.mobile-menu .router-link-active {
  display: block;
  padding: 12px 24px;
  font-size: 15px;
  color: var(--ink);
  text-decoration: none;
  opacity: 0.85;
  transition: opacity 0.15s;
}
.mobile-menu a:hover { opacity: 1; }
.mobile-sep {
  height: 1px;
  background: var(--line);
  margin: 8px 24px;
}
.mobile-cta {
  margin: 8px 24px 0;
  justify-content: center;
}

/* ── Responsive ── */
@media (max-width: 720px) {
  .wrap { padding: 0 20px; }
  .nav-links { display: none; }
  .hamburger { display: block; }
}
</style>
