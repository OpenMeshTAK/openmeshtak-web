<script setup lang="ts">
import { onMounted } from "vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import SectionHeader from "@/shared/components/layout/SectionHeader.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { useToast } from "@/shared/feedback/toast";
import TakCertificateAuthoritiesCard from "./components/TakCertificateAuthoritiesCard.vue";
import TakAcmeSettingsCard from "./components/TakAcmeSettingsCard.vue";
import TakClientCertificatesTable from "./components/TakClientCertificatesTable.vue";
import TakServerCertificateCard from "./components/TakServerCertificateCard.vue";
import TakServerSettingsCard from "./components/TakServerSettingsCard.vue";
import {
  getTakServerSettings,
  getTakAcmeSettings,
  listCertificateAuthorities,
  listClientCertificates,
  revokeClientCertificate,
  type TakCertificateAuthorityDto,
  type TakAcmeSettingsDto,
  type TakClientCertificateDto,
  type TakServerSettingsDto,
} from "./tak-server.api";

/** The built-in TAK server: settings, certificates and issued client certificates. */
const toast = useToast();
const page = useAsyncData(
  async () => {
    const [settings, acme, authorities, certificates] = await Promise.all([
      getTakServerSettings(),
      getTakAcmeSettings(),
      listCertificateAuthorities(),
      listClientCertificates(),
    ]);
    return { settings, acme, authorities, certificates };
  },
  {
    settings: null as TakServerSettingsDto | null,
    acme: null as TakAcmeSettingsDto | null,
    authorities: [] as TakCertificateAuthorityDto[],
    certificates: [] as TakClientCertificateDto[],
  },
);

function showSettings(settings: TakServerSettingsDto): void {
  page.data.value = { ...page.data.value, settings };
}

async function showAcme(acme: TakAcmeSettingsDto): Promise<void> {
  page.data.value = { ...page.data.value, acme };
  if (!acme.running) {
    await page.load();
  }
}

async function revoke(certificate: TakClientCertificateDto): Promise<void> {
  try {
    await revokeClientCertificate(certificate.id);
    toast.success(`The certificate of ${certificate.userDisplayName} was revoked.`);
    await page.load();
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

onMounted(page.load);
</script>

<template>
  <div>
    <SectionHeader
      title="TAK server"
      description="The built-in TAK server for ATAK and iTAK: enrollment, Data Packages and live CoT within each event."
    />

    <v-skeleton-loader v-if="page.state.value === 'loading'" type="article, card" />
    <ErrorState
      v-else-if="page.state.value === 'error' || page.data.value.settings === null || page.data.value.acme === null"
      :message="page.error.value"
      @retry="page.load"
    />

    <template v-else>
      <v-alert type="info" variant="tonal" density="compact" class="mb-4">
        Not verified with ATAK and iTAK devices yet. Members of active events and holders of the
        TAK administrator permission can enroll from their dashboard.
      </v-alert>
      <v-row>
        <v-col cols="12" xl="6">
          <TakServerSettingsCard :settings="page.data.value.settings" @saved="showSettings" />
        </v-col>
        <v-col cols="12" xl="6" class="d-flex flex-column ga-4">
          <TakServerCertificateCard :settings="page.data.value.settings" @changed="page.load" />
          <TakCertificateAuthoritiesCard :authorities="page.data.value.authorities" @changed="page.load" />
        </v-col>
        <v-col cols="12">
          <TakAcmeSettingsCard
            :settings="page.data.value.acme"
            :host-name="page.data.value.settings.hostName"
            @changed="showAcme"
          />
        </v-col>
        <v-col cols="12">
          <v-card>
            <div class="pa-5 pb-2">
              <div class="text-subtitle-1 font-weight-medium">Client certificates</div>
              <div class="text-body-2 text-medium-emphasis">One per enrolled TAK app. Revoking disconnects it immediately.</div>
            </div>
            <p v-if="page.data.value.certificates.length === 0" class="text-body-2 text-medium-emphasis px-5 pb-5 mb-0">
              No TAK app has enrolled yet.
            </p>
            <TakClientCertificatesTable v-else :certificates="page.data.value.certificates" show-user @revoke="revoke" />
          </v-card>
        </v-col>
      </v-row>
    </template>
  </div>
</template>
