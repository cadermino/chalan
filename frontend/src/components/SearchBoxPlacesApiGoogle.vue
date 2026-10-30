<template>
  <div>
    <div :id="mapId" style="height: 400px"></div>
    <p v-if="notice === 'typed'"
      class="mt-2 rounded border border-yellow-400 bg-yellow-200 p-2 text-sm text-gray-800">
      Lo ubicamos con lo que escribiste. ¿Es aquí? Si no, toca el mapa en el lugar exacto. Luego aprieta
      "Guardar y continuar".
    </p>
    <p v-else-if="notice === 'pin'" class="mt-2 text-sm text-gray-700">
      Pusimos la dirección del pin en el campo de la dirección. Si el número no es exacto, corrígelo ahí
      (también Mz. y Lt.).
    </p>
    <p v-else class="mt-2 text-sm text-gray-600">
      Toca el mapa para marcar el lugar exacto.
    </p>
  </div>
</template>

<script>
import { markRaw } from 'vue';

// Más lejos que esto un toque cae a cuadras de la casa: el primer toque acerca
// el mapa ahí y el siguiente pone el pin.
const PIN_ZOOM = 16;
const ZOOM_TO_PIN = 18;

const coordinatesUrl = location => 'https://www.google.com/maps/search/?api=1&query='
  + `${location.lat().toFixed(6)},${location.lng().toFixed(6)}`;

export default {
  name: 'SearchBoxPlacesApiGoogle',
  // `google-address` lleva { mapId, place, source }: `search` es una sugerencia
  // del buscador, `pin` un toque en el mapa y `typed` lo que el cliente
  // escribió sin elegir sugerencia (findTyped). En los dos últimos el lugar
  // viene del geocoder: address_components es null si no respondió.
  emits: ['google-address'],
  props: {
    inputId: String,
    mapId: String,
    apiKey: String,
    initialAddress: String,
    initialLatitude: [Number, String],
    initialLongitude: [Number, String],
  },
  data() {
    return {
      map: null,
      markers: [],
      notice: null,
    };
  },
  mounted() {
    this.loadGoogle();
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
    // Lo que el cliente escribió sin elegir una sugerencia: si Google lo
    // encuentra, pone el pin ahí para que confirme. Resuelve true si lo puso.
    findTyped(text) {
      if (!this.map || !text) return Promise.resolve(false);
      return new Promise((resolve) => {
        const service = new window.google.maps.places.PlacesService(this.map);
        service.findPlaceFromQuery({
          query: text,
          fields: ['geometry', 'place_id'],
          locationBias: this.map.getBounds() || undefined,
        }, (results, status) => {
          const found = status === window.google.maps.places.PlacesServiceStatus.OK && results?.[0];
          const location = found && found.geometry?.location;
          if (!location) {
            resolve(false);
            return;
          }
          this.map.setCenter(location);
          this.map.setZoom(ZOOM_TO_PIN);
          this.pinAt(location, 'typed', found.place_id);
          resolve(true);
        });
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

      // markRaw: los objetos de Google Maps no tienen que volverse reactivos
      // (el Proxy de Vue 3 rompe sus campos privados).
      this.map = markRaw(new window.google.maps.Map(mapEl, {
        center: { lat: -10, lng: -76 },
        zoom: 5,
        mapTypeId: 'roadmap',
      }));

      const input = document.getElementById(this.inputId);
      const searchBox = new window.google.maps.places.SearchBox(input);

      this.map.addListener('bounds_changed', () => {
        searchBox.setBounds(this.map.getBounds());
      });

      searchBox.addListener('places_changed', () => {
        const places = searchBox.getPlaces();
        if (!places.length) return;
        this.notice = null;
        this.showPlace(places[0]);
      });

      // Para la casa que Google no encuentra: el cliente busca algo cercano y
      // toca el mapa donde es. Se escucha el mapa y no un marcador arrastrable
      // (ver showPlace: el puntero de los marcadores revienta en marker.js).
      this.map.addListener('click', (event) => {
        if (!event.latLng) return;
        // Tocar un lugar de Google abre su ficha; aquí solo marca el punto.
        if (event.placeId && typeof event.stop === 'function') event.stop();
        if (this.map.getZoom() < PIN_ZOOM) {
          this.map.setCenter(event.latLng);
          this.map.setZoom(ZOOM_TO_PIN);
          return;
        }
        this.pinAt(event.latLng, 'pin');
      });

      // Con coordenadas guardadas se vuelve al pin exacto: la dirección escrita
      // puede no ser lo que Google encuentra (el cliente marcó el mapa).
      const latitude = Number(this.initialLatitude);
      const longitude = Number(this.initialLongitude);
      if (this.initialLatitude != null && this.initialLongitude != null
        && Number.isFinite(latitude) && Number.isFinite(longitude)) {
        const location = new window.google.maps.LatLng(latitude, longitude);
        this.setMarker(location, this.initialAddress);
        this.map.setCenter(location);
        this.map.setZoom(ZOOM_TO_PIN - 1);
      } else if (this.initialAddress) {
        this.geocodeAddress(this.initialAddress);
      }
    },
    pinAt(location, source, placeId) {
      this.setMarker(location, '');
      this.notice = source;
      this.describe(location, placeId).then((result) => {
        this.$emit('google-address', {
          mapId: this.mapId,
          source,
          place: {
            formatted_address: result ? result.formatted_address : '',
            address_components: result ? result.address_components : null,
            url: coordinatesUrl(location),
            geometry: { location },
          },
        });
      });
    },
    // La dirección de un punto, o null. El geocoder es lo exacto, pero la key
    // necesita la Geocoding API habilitada (la de local no la tiene). Si no
    // responde, salen de Places los datos del lugar encontrado o, para un pin,
    // los del lugar de Google más cercano (la calle y el número pueden no ser
    // los de la casa: el aviso le pide corregirlos).
    describe(location, placeId) {
      const { places } = window.google.maps;
      const service = new places.PlacesService(this.map);
      const details = id => new Promise((resolve) => {
        service.getDetails({ placeId: id, fields: ['address_components', 'formatted_address'] }, (place, status) => {
          resolve(status === places.PlacesServiceStatus.OK && place ? place : null);
        });
      });
      const nearest = () => new Promise((resolve) => {
        service.nearbySearch({ location, radius: 300 }, (results, status) => {
          if (status !== places.PlacesServiceStatus.OK || !results?.length) {
            resolve(null);
            return;
          }
          const distance = place => (place.geometry?.location
            ? (place.geometry.location.lat() - location.lat()) ** 2
              + (place.geometry.location.lng() - location.lng()) ** 2
            : Infinity);
          // Un distrito o la ciudad también son "lugares", pero su dirección no
          // tiene calle.
          const spots = results.filter(place => !(place.types || []).includes('political'));
          const [closest] = (spots.length ? spots : results).sort((a, b) => distance(a) - distance(b));
          resolve(details(closest.place_id));
        });
      });
      return new Promise((resolve) => {
        new window.google.maps.Geocoder().geocode({ location }, (results, status) => {
          if (status === 'OK' && results?.[0]) resolve(results[0]);
          else resolve(placeId ? details(placeId) : nearest());
        });
      });
    },
    showPlace(place, shouldEmit = true) {
      if (!place.geometry?.location) return;

      if (shouldEmit) {
        this.$emit('google-address', { mapId: this.mapId, place, source: 'search' });
      }

      this.setMarker(place.geometry.location, place.name || place.formatted_address || '', place.icon);

      const bounds = new window.google.maps.LatLngBounds();
      if (place.geometry.viewport) {
        bounds.union(place.geometry.viewport);
      } else {
        bounds.extend(place.geometry.location);
      }
      this.map.fitBounds(bounds);
    },
    setMarker(position, title, icon) {
      this.markers.forEach(m => m.setMap(null));
      this.markers = [];

      const markerOptions = {
        map: this.map,
        position,
        title: title || '',
        // El marcador solo señala el lugar elegido. Si es clickable, el
        // manejador de puntero de marker.js de Google a veces recibe un evento
        // sin coordenadas y revienta leyendo clientX de null (Sentry).
        clickable: false,
      };
      if (icon) {
        markerOptions.icon = {
          url: icon,
          size: new window.google.maps.Size(71, 71),
          origin: new window.google.maps.Point(0, 0),
          anchor: new window.google.maps.Point(17, 34),
          scaledSize: new window.google.maps.Size(45, 45),
        };
      }
      this.markers.push(markRaw(new window.google.maps.Marker(markerOptions)));
    },
  },
};
</script>
