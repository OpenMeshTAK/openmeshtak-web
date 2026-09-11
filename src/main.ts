import { createApp } from "vue";
import App from "./app/App.vue";
import { vuetify } from "./app/providers/vuetify";
import { router } from "./app/router";

createApp(App).use(vuetify).use(router).mount("#app");
