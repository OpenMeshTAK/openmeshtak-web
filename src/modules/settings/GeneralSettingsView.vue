<script setup lang="ts">
import { computed, type Component } from "vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import type { Permission } from "@/shared/api/types";
import { useSession } from "@/modules/auth/session";
import EmailSettingsPanel from "@/modules/email/EmailSettingsPanel.vue";
import InstanceSettingsPanel from "@/modules/instance-settings/InstanceSettingsPanel.vue";
import MapSettingsPanel from "@/modules/map-settings/MapSettingsPanel.vue";
import IconSettingsPanel from "@/modules/icon-settings/IconSettingsPanel.vue";
import FirmwareReleaseSettingsPanel from "@/modules/meshtastic-configuration/FirmwareReleaseSettingsPanel.vue";
import RegistrationSettingsPanel from "@/modules/registration/RegistrationSettingsPanel.vue";

/**
 * The small instance-wide settings on one page. Each section needs its own permission, so an
 * account sees only the sections it may change; the navigation shows the page to any of them.
 */
const session = useSession();

interface Section {
  key: string;
  permission: Permission;
  component: Component;
}

/** Installation and map on the left, account-related settings on the right. */
const COLUMNS: Section[][] = [
  [
    { key: "instance", permission: "settings.manage", component: InstanceSettingsPanel },
    { key: "base-map", permission: "settings.manage", component: MapSettingsPanel },
    { key: "icon-sets", permission: "settings.manage", component: IconSettingsPanel },
    { key: "firmware-releases", permission: "settings.manage", component: FirmwareReleaseSettingsPanel },
  ],
  [
    { key: "registration", permission: "registration.manage", component: RegistrationSettingsPanel },
    { key: "email", permission: "email.manage", component: EmailSettingsPanel },
  ],
];

const columns = computed(() =>
  COLUMNS.map((sections) => sections.filter((section) => session.can(section.permission))).filter((sections) => sections.length > 0),
);
</script>

<template>
  <div>
    <ViewHeader title="General" subtitle="Name, sign-up, email delivery, base map, icon sets and firmware release lookup of this installation." />
    <!-- Several small forms on one page: compact fields keep them all within a screen or two. -->
    <v-defaults-provider :defaults="{ VTextField: { density: 'compact' }, VSelect: { density: 'compact' } }">
      <v-row>
        <v-col v-for="(sections, index) in columns" :key="index" cols="12" :lg="columns.length > 1 ? 6 : 12" class="d-flex flex-column ga-6">
          <component :is="section.component" v-for="section in sections" :key="section.key" />
        </v-col>
      </v-row>
    </v-defaults-provider>
  </div>
</template>
