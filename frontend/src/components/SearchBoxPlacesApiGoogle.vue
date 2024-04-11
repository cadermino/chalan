<template>
  <div class="">
    <div :id="mapId" style="height: 400px"></div>
  </div>
</template>

<script>
export default {
  name: 'SearchBoxPlacesApiGoogle',
  data() {
    return {};
  },
  props: {
    inputId: String,
    mapId: String,
    apiKey: String,
  },
  mounted() {
    this.addScriptToDocumentHeader();
  },
  components: {},
  watch: {},
  methods: {
    addScriptToDocumentHeader() {
      const scriptElement = document.getElementById('scriptId');
      window.initAutocomplete = this.initAutocomplete;
      if (!scriptElement) {
        const placesApi = document.createElement('script');
        placesApi.setAttribute('id', 'scriptId');
        placesApi.setAttribute('src', `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&callback=initAutocomplete&libraries=places`);
        document.head.appendChild(placesApi);
        window.autocompleteMapsList = {
          mapIds: [this.mapId],
          inputIds: [this.inputId],
        };
      } else {
        window.initAutocomplete();
        if (!window.autocompleteMapsList.mapIds.includes(this.mapId)) {
          window.autocompleteMapsList.mapIds.push(this.mapId);
        }
        if (!window.autocompleteMapsList.inputIds.includes(this.inputId)) {
          window.autocompleteMapsList.inputIds.push(this.inputId);
        }
      }
    },
    initAutocomplete() {
      window.autocompleteMapsList.mapIds.forEach((mapId, index) => {
        if (window.google) {
          const map = new window.google.maps.Map(document.getElementById(mapId), {
            center: { lat: -10.0000000, lng: -76.0000000 },
            zoom: 5,
            mapTypeId: 'roadmap',
          });
          // Create the search box and link it to the UI element.
          const input = document.getElementById(window.autocompleteMapsList.inputIds[index]);
          const searchBox = new window.google.maps.places.SearchBox(input);

          // Bias the SearchBox results towards current map's viewport.
          map.addListener('bounds_changed', () => {
            searchBox.setBounds(map.getBounds());
          });

          let markers = [];

          // Listen for the event fired when the user selects a prediction and retrieve
          // more details for that place.
          searchBox.addListener('places_changed', () => {
            const places = searchBox.getPlaces();
            if (places.length === 0) {
              return;
            }

            // Clear out the old markers.
            markers.forEach((marker) => {
              marker.setMap(null);
            });
            markers = [];

            // For each place, get the icon, name and location.
            const bounds = new window.google.maps.LatLngBounds();

            places.forEach((place) => {
              if (!place.geometry || !place.geometry.location) {
                // eslint-disable-next-line no-console
                console.log('Returned place contains no geometry');
                return;
              }
              const mapAddress = {
                mapId,
                place,
              };
              this.$emit('google-address', mapAddress);
              const icon = {
                url: place.icon,
                size: new window.google.maps.Size(71, 71),
                origin: new window.google.maps.Point(0, 0),
                anchor: new window.google.maps.Point(17, 34),
                scaledSize: new window.google.maps.Size(45, 45),
              };

              const mark = new window.google.maps.Marker({
                map,
                icon,
                title: place.name,
                position: place.geometry.location,
              });
              // Create a marker for each place.
              markers.push(
                mark,
              );
              if (place.geometry.viewport) {
                // Only geocodes have viewport.
                bounds.union(place.geometry.viewport);
              } else {
                bounds.extend(place.geometry.location);
              }
            });
            map.fitBounds(bounds);
          });
        }
      });
    },
  },
  computed: {},
};
</script>
