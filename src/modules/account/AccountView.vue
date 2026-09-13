<script setup lang="ts">
import ViewContent from "@/shared/components/layout/ViewContent.vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import PasskeysCard from "./components/PasskeysCard.vue";
</script>

<template>
  <ViewContent>
    <ViewHeader title="Account security" subtitle="How you sign in to OpenMeshTak." />
    <div style="max-width: 720px">
      <PasskeysCard />
    </div>
  </ViewContent>
</template>
