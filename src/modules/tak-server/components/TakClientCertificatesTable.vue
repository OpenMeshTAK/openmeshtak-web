<script setup lang="ts">
import { ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import type { TakClientCertificateDto } from "../tak-server.api";

/** Issued client certificates with revocation; used for all certificates and for a user's own. */
const props = defineProps<{ certificates: TakClientCertificateDto[]; showUser: boolean }>();
const emit = defineEmits<{ revoke: [certificate: TakClientCertificateDto] }>();

const revoking = ref<TakClientCertificateDto | null>(null);
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const statusColor = { valid: "success", expired: undefined, revoked: "error" } as const;

function confirm(): void {
  if (revoking.value !== null) {
    emit("revoke", revoking.value);
  }
  revoking.value = null;
}
</script>

<template>
  <div>
    <v-table density="comfortable">
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
