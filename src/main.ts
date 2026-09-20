import { createApp } from "vue";
import App from "./app/App.vue";
import { vuetify } from "./app/providers/vuetify";
import { router } from "./app/router";
import "./app/styles/transitions.css";

createApp(App).use(vuetify).use(router).mount("#app");
