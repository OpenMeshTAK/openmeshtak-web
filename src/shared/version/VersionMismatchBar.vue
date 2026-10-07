<script setup lang="ts">
import { onMounted } from "vue";
import { checkCoreVersion, coreVersion, WEB_VERSION } from "./core-version";

function reload(): void {
  window.location.reload();
}

onMounted(checkCoreVersion);
</script>

<template>
  <v-system-bar v-if="coreVersion.updatedTo !== null" color="info" height="auto" class="py-1 px-4 text-body-medium">
    OpenMeshTak was updated to {{ coreVersion.updatedTo }}. Reload to use the new version.
    <v-spacer />
    <v-btn size="small" variant="flat" class="ml-4" @click="reload">Reload</v-btn>
  </v-system-bar>
  <v-system-bar v-else-if="coreVersion.incompatible !== null" color="warning" height="auto" class="py-1 px-4 text-body-medium">
    This Web app ({{ WEB_VERSION }}) does not match the server ({{ coreVersion.incompatible }}). Ask the operator to update both to
    the same release.
  </v-system-bar>
</template>
