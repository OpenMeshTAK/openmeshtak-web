// Vuetify's base styles must load before any component styles: the first stylesheet fixes the order
// of Vuetify's CSS layers, and component styles first would let the reset override components,
// for example `font: inherit` on every button.
import "vuetify/styles";
import { createApp } from "vue";
import App from "./app/App.vue";
import { vuetify } from "./app/providers/vuetify";
import { router } from "./app/router";
import "./app/styles/transitions.css";

createApp(App).use(vuetify).use(router).mount("#app");
