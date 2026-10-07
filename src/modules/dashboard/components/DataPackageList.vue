<script setup lang="ts">
import { mdiDownload, mdiMapOutline } from "@mdi/js";
import { onMounted, ref, watch } from "vue";
import { useDisplay } from "vuetify";
import type { Schemas } from "@/shared/api/types";
import DownloadQrButton from "@/shared/components/DownloadQrButton.vue";
import { describeError } from "@/shared/errors/api-problem";
import { fetchMemberDataPackages, memberDataPackageUrl } from "../dashboard.api";

/**
 * The published Data Packages this member receives, each as a manual ATAK Data Package download or
 * as a QR code that downloads it straight on the phone.
 */
const props = defineProps<{ eventId: string; memberId: string }>();

const { xs } = useDisplay();
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
  <v-skeleton-loader v-if="state === 'loading'" type="list-item-two-line@2" />
  <v-alert v-else-if="state === 'error'" type="error" density="compact" class="ma-4">
    {{ error }}
    <v-btn size="small" variant="text" class="ml-2" @click="load">Retry</v-btn>
  </v-alert>
  <p v-else-if="packages.length === 0" class="text-body-medium text-medium-emphasis px-5 pb-5 my-0">
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
      <!-- On phones the button sits below the name so long package names keep their width. -->
      <template v-if="!xs" #append>
        <div class="d-flex ga-2">
          <DownloadQrButton
            size="small"
            :request="{ kind: 'member-data-package', eventId, memberId, packageId: dataPackage.id }"
            :file-label="dataPackage.name"
          />
          <v-btn
            :href="memberDataPackageUrl(eventId, memberId, dataPackage.id)"
            download
            variant="tonal"
            size="small"
            :prepend-icon="mdiDownload"
          >
            Download .zip
          </v-btn>
        </div>
      </template>
      <v-btn
        v-if="xs"
        :href="memberDataPackageUrl(eventId, memberId, dataPackage.id)"
        download
        variant="tonal"
        block
        class="mt-2"
        :prepend-icon="mdiDownload"
      >
        Download .zip
      </v-btn>
      <DownloadQrButton
        v-if="xs"
        block
        class="mt-2"
        :request="{ kind: 'member-data-package', eventId, memberId, packageId: dataPackage.id }"
        :file-label="dataPackage.name"
      />
    </v-list-item>
  </v-list>
</template>
