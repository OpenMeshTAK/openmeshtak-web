<script setup lang="ts">
import { mdiAccountKey } from "@mdi/js";
import { ref } from "vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { useSession } from "@/modules/auth/session";
import ViewContent from "@/shared/components/layout/ViewContent.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import ChangePasswordCard from "./components/ChangePasswordCard.vue";
import EmailCard from "./components/EmailCard.vue";
import PasskeysCard from "./components/PasskeysCard.vue";
import SessionsCard from "./components/SessionsCard.vue";

const session = useSession();
const sessionsCard = ref<InstanceType<typeof SessionsCard> | null>(null);
</script>

<template>
  <ViewContent>
    <ViewHeader title="Account security" subtitle="How you sign in to OpenMeshTak." />
    <div class="d-flex flex-column ga-4" style="max-width: 720px">
      <v-card class="pa-5">
        <div class="d-flex align-center ga-2">
          <v-icon :icon="mdiAccountKey" size="small" />
          <div class="text-subtitle-1 font-weight-medium">Username</div>
          <InfoHint
            label="About the username"
            text="Sign in with it instead of your email, and use it with your password as login in ATAK or iTAK. Ask an administrator to change it."
          />
          <v-spacer />
          <code class="text-body-1">{{ session.state.principal?.username ?? "—" }}</code>
        </div>
      </v-card>
      <EmailCard />
      <ChangePasswordCard @changed="sessionsCard?.reload()" />
      <PasskeysCard />
      <SessionsCard ref="sessionsCard" />
    </div>
  </ViewContent>
</template>
