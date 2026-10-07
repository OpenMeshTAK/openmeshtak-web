<script setup lang="ts">
import { onMounted } from "vue";
import { checkCoreVersion, coreVersion, WEB_VERSION } from "./core-version";

onMounted(checkCoreVersion);
</script>

<template>
  <!-- A server update during the session is announced as a lasting toast (see core-version.ts). -->
  <v-system-bar v-if="coreVersion.incompatible !== null && coreVersion.updatedTo === null" color="warning" height="auto" class="py-1 px-4 text-body-medium">
    This Web app ({{ WEB_VERSION }}) does not match the server ({{ coreVersion.incompatible }}). Ask the operator to update both to
    the same release.
  </v-system-bar>
</template>
