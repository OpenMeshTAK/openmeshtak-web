<script setup lang="ts">
import { ref } from "vue";
import ViewContent from "@/shared/components/layout/ViewContent.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import ChangePasswordCard from "./components/ChangePasswordCard.vue";
import PasskeysCard from "./components/PasskeysCard.vue";
import SessionsCard from "./components/SessionsCard.vue";

const sessionsCard = ref<InstanceType<typeof SessionsCard> | null>(null);
</script>

<template>
  <ViewContent>
    <ViewHeader title="Account security" subtitle="How you sign in to OpenMeshTak." />
    <div class="d-flex flex-column ga-4" style="max-width: 720px">
      <ChangePasswordCard @changed="sessionsCard?.reload()" />
      <PasskeysCard />
      <SessionsCard ref="sessionsCard" />
    </div>
  </ViewContent>
</template>
