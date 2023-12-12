<template>
  <div>
    <ViewsMessages :view-name="viewName" class="lg:w-4/5 mx-auto mt-8"/>
    <CarrierCompany
      :carrier-id="carrierId"
      :view-name="viewName"
      :country-data="countryData"
    />
  </div>
</template>
<script>
import ViewsMessages from '@/components/ViewsMessages.vue';
import CarrierCompany from '@/components/carrierCompany/CarrierCompany';

export default {
  name: 'carrier-company',
  props: {
    carrierId: Number,
    countryData: Object,
  },
  data() {
    return {
      viewName: 'carrier-company',
    };
  },
  components: {
    CarrierCompany,
    ViewsMessages,
  },
  methods: {},
};
</script>
