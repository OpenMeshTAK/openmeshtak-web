<script setup lang="ts">
import { mdiCellphoneLink, mdiChevronDown, mdiChevronUp } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { describeError } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import { listMyTakCertificates, revokeMyTakCertificate, type TakClientCertificateDto } from "../tak-server.api";
import TakClientCertificatesTable from "./TakClientCertificatesTable.vue";
import TakEnrollmentAction from "./TakEnrollmentAction.vue";

/** Connects a TAK app to the built-in TAK server and lists the apps already connected with it. */
const toast = useToast();
const certificates = ref<TakClientCertificateDto[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");
const error = ref("");
const showPrevious = ref(false);

/** A device enrolls again after expiry or a reinstall, so its certificates are grouped by device UID. */
function deviceKey(certificate: TakClientCertificateDto): string {
  return certificate.clientUid ?? certificate.id;
}

/** One certificate per device, newest first: its valid one if any, otherwise its latest. */
const devices = computed(() => {
  const byDevice = new Map<string, TakClientCertificateDto>();
  for (const certificate of certificates.value) {
    const shown = byDevice.get(deviceKey(certificate));
    if (shown === undefined || (shown.status !== "valid" && certificate.status === "valid")) {
      byDevice.set(deviceKey(certificate), certificate);
    }
  }
  return [...byDevice.values()];
});
const activeCertificates = computed(() => devices.value.filter(({ status }) => status === "valid"));
const previousCertificates = computed(() => devices.value.filter(({ status }) => status !== "valid"));

async function loadCertificates(): Promise<void> {
  try {
    certificates.value = await listMyTakCertificates();
    state.value = "ready";
  } catch (caught: unknown) {
    error.value = describeError(caught);
    state.value = "error";
  }
}

/** Revokes every valid certificate of the device, including ones enrolled before Core kept one per device. */
async function revoke(certificate: TakClientCertificateDto): Promise<void> {
  const deviceCertificates = certificates.value.filter(
    (candidate) => deviceKey(candidate) === deviceKey(certificate) && candidate.status === "valid",
  );
  try {
    for (const { id } of deviceCertificates) {
      await revokeMyTakCertificate(id);
    }
    toast.success("The certificate was revoked and its app disconnected.");
    await loadCertificates();
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

onMounted(loadCertificates);
</script>

<template>
  <v-card>
    <div class="pa-5 pb-3">
      <div class="d-flex align-center ga-2 mb-2">
        <v-icon :icon="mdiCellphoneLink" size="small" />
        <div class="text-title-medium font-weight-medium">TAK server</div>
        <InfoHint
          label="About the TAK server"
          text="Connect ATAK or iTAK to share positions and markers with your event and receive its Data Packages."
        />
      </div>
      <TakEnrollmentAction @closed="loadCertificates" />
    </div>
    <v-skeleton-loader v-if="state === 'loading'" type="list-item-two-line@2" />
    <ErrorState v-else-if="state === 'error'" :message="error" class="mx-5" @retry="loadCertificates" />
    <template v-else>
      <div class="d-flex align-center ga-2 px-5 pb-1">
        <div class="text-body-small text-medium-emphasis flex-grow-1">Enrolled TAK apps</div>
        <v-chip v-if="activeCertificates.length > 0" size="x-small" variant="tonal">
          {{ activeCertificates.length }}
        </v-chip>
      </div>
      <p v-if="activeCertificates.length === 0" class="text-body-medium text-medium-emphasis px-5 pb-4 my-0">
        No TAK app is enrolled yet.
      </p>
      <TakClientCertificatesTable
        v-else
        compact
        :certificates="activeCertificates"
        :show-user="false"
        @revoke="revoke"
      />

      <template v-if="previousCertificates.length > 0">
        <v-divider />
        <v-btn
          block
          variant="text"
          color="secondary"
          class="history-button"
          :append-icon="showPrevious ? mdiChevronUp : mdiChevronDown"
          :aria-expanded="showPrevious"
          @click="showPrevious = !showPrevious"
        >
          Earlier apps ({{ previousCertificates.length }})
        </v-btn>
        <v-expand-transition>
          <TakClientCertificatesTable
            v-if="showPrevious"
            compact
            :certificates="previousCertificates"
            :show-user="false"
            @revoke="revoke"
          />
        </v-expand-transition>
      </template>
    </template>
  </v-card>
</template>

<style scoped>
.history-button {
  justify-content: space-between;
  min-height: 44px;
  padding-inline: 20px;
}
</style>
