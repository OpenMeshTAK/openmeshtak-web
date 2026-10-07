<script setup lang="ts">
import { onMounted } from "vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { useToast } from "@/shared/feedback/toast";
import TakCertificateAuthoritiesCard from "./components/TakCertificateAuthoritiesCard.vue";
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
    <ViewHeader
      title="TAK server"
      subtitle="The built-in TAK server for ATAK and iTAK: enrollment, Data Packages and live CoT within each event."
    />

    <v-skeleton-loader v-if="page.state.value === 'loading'" type="article, card" />
    <ErrorState
      v-else-if="page.state.value === 'error' || page.data.value.settings === null || page.data.value.acme === null"
      :message="page.error.value"
      @retry="page.load"
    />

    <template v-else>
      <!-- Two balanced columns: what devices connect to, and how the server proves who it is. -->
      <v-row>
        <v-col cols="12" lg="6" class="d-flex flex-column ga-4">
          <TakServerSettingsCard :settings="page.data.value.settings" @saved="showSettings" />
          <v-card>
            <div class="d-flex align-center ga-1 pa-5 pb-2">
              <span class="text-title-medium font-weight-medium">Client certificates</span>
              <InfoHint label="About client certificates">
                <p class="mb-2">
                  Members connect their ATAK or iTAK app themselves from their dashboard while one of their events is
                  active. TAK server administrators can connect theirs at any time.
                </p>
                <p class="mb-0">Each connected app gets one certificate here. Revoking it disconnects the app immediately.</p>
              </InfoHint>
            </div>
            <p v-if="page.data.value.certificates.length === 0" class="text-body-medium text-medium-emphasis px-5 pb-5 my-0">
              No TAK app has enrolled yet.
            </p>
            <TakClientCertificatesTable v-else :certificates="page.data.value.certificates" show-user @revoke="revoke" />
          </v-card>
        </v-col>
        <v-col cols="12" lg="6" class="d-flex flex-column ga-4">
          <TakServerCertificateCard
            :settings="page.data.value.settings"
            :acme="page.data.value.acme"
            @changed="page.load"
            @acme-changed="showAcme"
          />
          <TakCertificateAuthoritiesCard :authorities="page.data.value.authorities" @changed="page.load" />
        </v-col>
      </v-row>
    </template>
  </div>
</template>
