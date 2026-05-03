<template>
  <div>
    <div :id="mapId" style="height: 400px"></div>
  </div>
</template>

<script>
export default {
  name: 'SearchBoxPlacesApiGoogle',
  props: {
    inputId: String,
    mapId: String,
    apiKey: String,
    initialAddress: String,
  },
  data() {
    return {
      map: null,
      markers: [],
    };
  },
  mounted() {
    this.loadGoogle();
  },
  watch: {
    initialAddress(newVal) {
      if (newVal && this.map) {
        this.geocodeAddress(newVal);
      }
    },
  },
  methods: {
    geocodeAddress(address) {
      const service = new window.google.maps.places.PlacesService(this.map);
      service.findPlaceFromQuery({
        query: address,
        fields: ['geometry', 'name', 'formatted_address'],
      }, (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results?.[0]) {
          this.showPlace(results[0], false);
        }
      });
    },
    loadGoogle() {
      if (window.google?.maps?.places) {
        this.initMap();
        return;
      }
      if (!window.gmQueue) window.gmQueue = [];
      window.gmQueue.push(() => this.initMap());

      if (!document.getElementById('gm-script')) {
        window.gmReady = () => {
          (window.gmQueue || []).forEach(fn => fn());
          window.gmQueue = [];
        };
        const script = document.createElement('script');
        script.id = 'gm-script';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=places&callback=gmReady`;
        script.async = true;
        document.head.appendChild(script);
      }
    },
    initMap() {
      const mapEl = document.getElementById(this.mapId);
      if (!mapEl) return;

      this.map = new window.google.maps.Map(mapEl, {
        center: { lat: -10, lng: -76 },
        zoom: 5,
        mapTypeId: 'roadmap',
      });

      const input = document.getElementById(this.inputId);
      const searchBox = new window.google.maps.places.SearchBox(input);

      this.map.addListener('bounds_changed', () => {
        searchBox.setBounds(this.map.getBounds());
      });

      searchBox.addListener('places_changed', () => {
        const places = searchBox.getPlaces();
        if (!places.length) return;
        this.showPlace(places[0]);
      });

      if (this.initialAddress) {
        this.geocodeAddress(this.initialAddress);
      }
    },
    showPlace(place, shouldEmit = true) {
      if (!place.geometry?.location) return;

      if (shouldEmit) {
        this.$emit('google-address', { mapId: this.mapId, place });
      }

      this.markers.forEach(m => m.setMap(null));
      this.markers = [];

      const markerOptions = {
        map: this.map,
        position: place.geometry.location,
        title: place.name || place.formatted_address || '',
      };
      if (place.icon) {
        markerOptions.icon = {
          url: place.icon,
          size: new window.google.maps.Size(71, 71),
          origin: new window.google.maps.Point(0, 0),
          anchor: new window.google.maps.Point(17, 34),
          scaledSize: new window.google.maps.Size(45, 45),
        };
      }
      this.markers.push(new window.google.maps.Marker(markerOptions));

      const bounds = new window.google.maps.LatLngBounds();
      if (place.geometry.viewport) {
        bounds.union(place.geometry.viewport);
      } else {
        bounds.extend(place.geometry.location);
      }
      this.map.fitBounds(bounds);
    },
  },
};
</script>
