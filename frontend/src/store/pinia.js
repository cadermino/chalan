import { createPinia } from 'pinia';
import { sessionTagsPlugin } from '../utils/sessionTags';

// Una sola instancia, compartida por la app (main.js) y por lo que corre fuera
// de un componente, como los guards del router.
const pinia = createPinia();
pinia.use(sessionTagsPlugin);

export default pinia;
