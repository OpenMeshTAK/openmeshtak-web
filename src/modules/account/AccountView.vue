<script setup lang="ts">
import { mdiAccountCircleOutline } from "@mdi/js";
import { ref } from "vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { useSession } from "@/modules/auth/session";
import ViewContent from "@/shared/components/layout/ViewContent.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import ChangePasswordCard from "./components/ChangePasswordCard.vue";
import EmailCard from "./components/EmailCard.vue";
import PasskeysCard from "./components/PasskeysCard.vue";
import SessionsCard from "./components/SessionsCard.vue";

/** The signed-in person's login: username, email and password on the left, devices on the right. */
const session = useSession();
const sessionsCard = ref<InstanceType<typeof SessionsCard> | null>(null);
</script>

<template>
  <ViewContent>
    <ViewHeader title="Account" subtitle="How you sign in to OpenMeshTak and your TAK apps." />

    <div class="account-grid">
      <div class="account-column">
        <v-card class="pa-5">
          <div class="d-flex align-center ga-3">
            <v-icon :icon="mdiAccountCircleOutline" size="40" class="text-medium-emphasis" />
            <div class="flex-grow-1" style="min-width: 0">
              <div class="text-h6 text-truncate">{{ session.state.principal?.name }}</div>
              <div class="d-flex align-center ga-1 text-body-2 text-medium-emphasis">
                Username <code class="text-high-emphasis">{{ session.state.principal?.username ?? "—" }}</code>
                <InfoHint
                  label="About the username"
                  text="Sign in with it instead of your email, and use it with your password as login in ATAK or iTAK. Ask an administrator to change it."
                />
              </div>
            </div>
          </div>
        </v-card>
        <EmailCard />
        <ChangePasswordCard @changed="sessionsCard?.reload()" />
      </div>
      <div class="account-column">
        <PasskeysCard />
        <SessionsCard ref="sessionsCard" />
      </div>
    </div>
  </ViewContent>
</template>

<style scoped>
.account-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.account-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

@media (min-width: 1280px) {
  .account-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
