<template>
  <v-container class="py-6">
    <v-alert type="warning" variant="tonal" title="Access denied">
      Your account does not have permission to open this page.
    </v-alert>
    <v-btn class="mt-4" variant="tonal" :to="{ name: 'home' }">Back to dashboard</v-btn>
  </v-container>
</template>
