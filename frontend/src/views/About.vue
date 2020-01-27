<template>
  <div class="about">
    <h1>This is an about page</h1>
    <Footer></Footer>
  </div>
</template>

<script>
// @ is an alias to /src
import Footer from '@/components/Footer.vue';

export default {
  name: 'about',
  components: {
    Footer,
  },
};
</script>
