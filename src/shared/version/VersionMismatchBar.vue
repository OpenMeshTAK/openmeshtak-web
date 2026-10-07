<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "@/shared/api/client";
import { logger } from "@/shared/logging/logger";
import { isCompatibleCoreVersion } from "./version-compatibility";

const webVersion = __APP_VERSION__;
const coreVersion = ref<string | null>(null);

onMounted(async () => {
  try {
    const { data } = await api.GET("/health");
    if (data !== undefined && !isCompatibleCoreVersion(webVersion, data.version)) {
      coreVersion.value = data.version;
    }
  } catch (error: unknown) {
    // An unreachable Core shows up in every other request; the version check stays quiet.
    logger.debug("Could not read the Core version", { error });
  }
});
</script>

<template>
  <v-system-bar v-if="coreVersion !== null" color="warning" height="auto" class="py-1 px-4 text-body-medium">
    This Web app ({{ webVersion }}) does not match the server ({{ coreVersion }}). Ask the operator to update both to
    the same release.
  </v-system-bar>
</template>
