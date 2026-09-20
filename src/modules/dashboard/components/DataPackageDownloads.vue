<script setup lang="ts">
import { mdiDownload, mdiMapOutline } from "@mdi/js";
import { onMounted, ref, watch } from "vue";
import type { Schemas } from "@/shared/api/types";
import { describeError } from "@/shared/errors/api-problem";
import { fetchMemberDataPackages, memberDataPackageUrl } from "../dashboard.api";

/** The published Data Packages this member receives, each as an ATAK Data Package download. */
const props = defineProps<{ eventId: string; memberId: string }>();

const packages = ref<Schemas["MemberDataPackageDto"][]>([]);
const state = ref<"loading" | "ready" | "error">("loading");
const error = ref("");
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

async function load(): Promise<void> {
  state.value = "loading";
  try {
    packages.value = await fetchMemberDataPackages(props.eventId, props.memberId);
    state.value = "ready";
  } catch (caught: unknown) {
    error.value = describeError(caught);
    state.value = "error";
  }
}

watch(() => [props.eventId, props.memberId], load);
onMounted(load);
</script>

<template>
  <v-card>
    <div class="pa-5 pb-2">
      <div class="text-subtitle-1 font-weight-medium">Data packages</div>
      <p class="text-body-2 text-medium-emphasis mb-0">Map content for ATAK and iTAK.</p>
    </div>

    <v-skeleton-loader v-if="state === 'loading'" type="list-item-two-line@2" />
    <v-alert v-else-if="state === 'error'" type="error" density="compact" class="ma-4">
      {{ error }}
      <v-btn size="small" variant="text" class="ml-2" @click="load">Retry</v-btn>
    </v-alert>
    <p v-else-if="packages.length === 0" class="text-body-2 text-medium-emphasis px-5 pb-5 mb-0">
      No data packages for you yet.
    </p>
    <v-list v-else lines="two" class="pt-0">
      <v-list-item
        v-for="dataPackage in packages"
        :key="dataPackage.id"
        :prepend-icon="mdiMapOutline"
        :title="dataPackage.name"
        :subtitle="`Revision ${dataPackage.revision} · ${dateFormat.format(new Date(dataPackage.publishedAt))}`"
      >
        <template #append>
          <v-btn
            :href="memberDataPackageUrl(eventId, memberId, dataPackage.id)"
            download
            variant="tonal"
            size="small"
            :prepend-icon="mdiDownload"
          >
            Download .zip
          </v-btn>
        </template>
      </v-list-item>
    </v-list>
  </v-card>
</template>
