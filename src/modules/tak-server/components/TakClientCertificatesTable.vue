<script setup lang="ts">
import { mdiLinkVariantOff } from "@mdi/js";
import { ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import type { TakClientCertificateDto } from "../tak-server.api";

/** Issued client certificates with revocation; used for all certificates and for a user's own. */
const props = withDefaults(
  defineProps<{ certificates: TakClientCertificateDto[]; showUser: boolean; compact?: boolean }>(),
  { compact: false },
);
const emit = defineEmits<{ revoke: [certificate: TakClientCertificateDto] }>();

const revoking = ref<TakClientCertificateDto | null>(null);
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const statusColor = { valid: "success", expired: undefined, revoked: "error" } as const;

function deviceName(certificate: TakClientCertificateDto): string {
  if (certificate.clientUid === null) {
    return "Unknown TAK app";
  }
  const uid = certificate.clientUid.toUpperCase();
  if (uid.startsWith("ITAK-PACKAGE-")) return "iTAK (connection package)";
  if (uid.startsWith("ANDROID-")) return "Android TAK app";
  // iOS apps send a bare UUID as their device UID.
  return /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/.test(uid) ? "iOS TAK app" : "TAK app";
}

function certificateDates(certificate: TakClientCertificateDto): string {
  if (certificate.status === "revoked" && certificate.revokedAt !== null) {
    return `Revoked ${dateFormat.format(new Date(certificate.revokedAt))}`;
  }
  if (certificate.status === "expired") {
    return `Expired ${dateFormat.format(new Date(certificate.notAfter))}`;
  }
  return `Valid until ${dateFormat.format(new Date(certificate.notAfter))}`;
}

/** The end of the device UID tells two phones of the same kind apart; the full UID is in the tooltip. */
function shortUid(clientUid: string): string {
  return clientUid.length > 8 ? `…${clientUid.slice(-7)}` : clientUid;
}

function confirm(): void {
  if (revoking.value !== null) {
    emit("revoke", revoking.value);
  }
  revoking.value = null;
}
</script>

<template>
  <div class="certificate-layout">
    <div v-if="props.compact" class="certificate-list" role="list">
      <div v-for="certificate in props.certificates" :key="certificate.id" class="certificate-row" role="listitem">
        <div class="certificate-identity">
          <div class="d-flex align-center ga-1 text-body-medium font-weight-medium">
            <span class="text-truncate">{{ deviceName(certificate) }}</span>
            <InfoHint
              v-if="certificate.status === 'valid' && certificate.issuedForOldEndpoint"
              tone="warning"
              label="Old TAK server address"
              text="This app was set up before the TAK server address or ports changed. Connect it again."
            />
          </div>
          <div v-if="props.showUser" class="text-body-small">{{ certificate.userDisplayName }}</div>
          <div class="text-body-small text-medium-emphasis text-truncate">
            <span v-if="certificate.clientUid" class="certificate-uid" :title="certificate.clientUid">
              {{ shortUid(certificate.clientUid) }} ·
            </span>
            {{ certificateDates(certificate) }}
          </div>
        </div>
        <v-btn
          v-if="certificate.status === 'valid'"
          :icon="mdiLinkVariantOff"
          variant="text"
          size="small"
          color="error"
          title="Revoke"
          aria-label="Revoke"
          @click="revoking = certificate"
        />
      </div>
    </div>
    <v-table v-else density="comfortable">
      <thead>
        <tr>
          <th v-if="props.showUser">User</th>
          <th>Device</th>
          <th>Status</th>
          <th class="d-none d-md-table-cell">Valid until</th>
          <th class="text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="certificate in props.certificates" :key="certificate.id">
          <td v-if="props.showUser">{{ certificate.userDisplayName }}</td>
          <td class="text-truncate" style="max-width: 220px">{{ certificate.clientUid ?? "Unknown device" }}</td>
          <td>
            <v-chip size="small" variant="tonal" :color="statusColor[certificate.status]" class="text-capitalize">
              {{ certificate.status }}
            </v-chip>
            <v-chip
              v-if="certificate.status === 'valid' && certificate.issuedForOldEndpoint"
              size="small"
              variant="tonal"
              color="warning"
              class="ml-1"
              title="Set up before the TAK server address or ports changed; connect the app again."
            >
              Old address
            </v-chip>
          </td>
          <td class="d-none d-md-table-cell">{{ dateFormat.format(new Date(certificate.notAfter)) }}</td>
          <td class="text-right">
            <v-btn v-if="certificate.status === 'valid'" variant="text" size="small" color="error" @click="revoking = certificate">
              Revoke
            </v-btn>
          </td>
        </tr>
      </tbody>
    </v-table>
    <ConfirmDialog
      :model-value="revoking !== null"
      title="Revoke this certificate?"
      confirm-label="Revoke"
      confirm-color="error"
      @update:model-value="revoking = null"
      @confirm="confirm"
    >
      The TAK app using it is disconnected right away and cannot reconnect. It needs a new
      enrollment to connect again.
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.certificate-list {
  padding: 0 20px 8px;
}

.certificate-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 12px 0;
  border-top: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.certificate-identity {
  min-width: 0;
}

.certificate-uid {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}
</style>
