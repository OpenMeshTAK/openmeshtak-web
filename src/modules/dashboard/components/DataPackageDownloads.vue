<script setup lang="ts">
import DataPackageList from "./DataPackageList.vue";

/** Card with the member's manual Data Package downloads, e.g. for an operator acting on behalf of a member. */
defineProps<{ eventId: string; memberId: string }>();
</script>

<template>
  <v-card>
    <div class="pa-5 pb-2">
      <div class="text-subtitle-1 font-weight-medium">Data packages</div>
      <p class="text-body-2 text-medium-emphasis mb-0">Map content for ATAK and iTAK. Import each package in your TAK app.</p>
    </div>
    <DataPackageList :event-id="eventId" :member-id="memberId" />
  </v-card>
</template>
