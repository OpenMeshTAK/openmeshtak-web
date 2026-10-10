<script setup lang="ts">
import { onMounted, ref } from "vue";
import { checkCoreVersion, coreVersion, WEB_VERSION } from "./core-version";
import { reloadWebApp } from "./reload-web-app";

const reloading = ref(false);

async function reload(): Promise<void> {
  reloading.value = true;
  try {
    await reloadWebApp();
  } finally {
    reloading.value = false;
  }
}

onMounted(checkCoreVersion);
</script>

<template>
  <!-- A server update during the session is announced as a lasting toast (see core-version.ts). -->
  <v-system-bar v-if="coreVersion.incompatible !== null && coreVersion.updatedTo === null" color="warning" height="auto" class="py-1 px-4 text-body-medium flex-wrap ga-2">
    <span>
      This browser is running Web app {{ WEB_VERSION }}; the server is {{ coreVersion.incompatible }}. Save your changes, then reload to
      load the latest Web app. If this warning remains, ask the operator to check the deployed release.
    </span>
    <v-btn size="small" variant="text" :loading="reloading" @click="reload">Reload</v-btn>
  </v-system-bar>
</template>
