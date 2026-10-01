<script setup lang="ts">
import { mdiAccountKey } from "@mdi/js";
import { ref } from "vue";
import { useRouter } from "vue-router";
import InfoHint from "@/shared/components/InfoHint.vue";
import { useSession } from "@/modules/auth/session";
import ViewContent from "@/shared/components/layout/ViewContent.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import ChangePasswordCard from "./components/ChangePasswordCard.vue";
import EmailCard from "./components/EmailCard.vue";
import PasskeysCard from "./components/PasskeysCard.vue";
import SessionsCard from "./components/SessionsCard.vue";

const session = useSession();
const router = useRouter();
const sessionsCard = ref<InstanceType<typeof SessionsCard> | null>(null);
const completingSetup = ref(session.state.principal?.hasPassword === false);

async function passwordChanged(): Promise<void> {
  if (completingSetup.value) {
    completingSetup.value = false;
    await router.replace({ name: "home" });
    return;
  }
  await sessionsCard.value?.reload();
}
</script>

<template>
  <ViewContent>
    <ViewHeader
      :title="completingSetup ? 'Complete account setup' : 'Account security'"
      :subtitle="completingSetup ? 'Choose the login you will use after this access link closes.' : 'How you sign in to OpenMeshTak.'"
    />
    <div class="d-flex flex-column ga-4" style="max-width: 720px">
      <ChangePasswordCard v-if="completingSetup" @changed="passwordChanged" />
      <v-card v-if="!completingSetup" class="pa-5">
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
      <template v-if="!completingSetup">
        <EmailCard />
        <ChangePasswordCard @changed="passwordChanged" />
        <PasskeysCard />
        <SessionsCard ref="sessionsCard" />
      </template>
    </div>
  </ViewContent>
</template>
