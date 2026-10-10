<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import ViewHeader from "@/shared/components/layout/ViewHeader.vue";
import { useSession } from "@/modules/auth/session";
import { listAllEvents, type EventListItem } from "@/modules/events/events.api";
import type { AuditLogScope } from "./audit-log.api";
import AuditLog from "./AuditLog.vue";

/**
 * The audit log with a scope: instance-wide readers choose all entries, installation-only entries
 * or one event; readers whose `audit.read` covers single events choose among those events.
 */
const session = useSession();
const instanceWide = computed(() => session.can("audit.read", null));
const events = ref<EventListItem[]>([]);
const selected = ref<string>(instanceWide.value ? "all" : "");

const options = computed(() => [
  ...(instanceWide.value
    ? [
        { title: "All entries", value: "all" },
        { title: "Installation only", value: "instance" },
      ]
    : []),
  ...events.value.filter(({ id }) => session.can("audit.read", id)).map(({ id, name }) => ({ title: name, value: id })),
]);

const scope = computed<AuditLogScope>(() =>
  selected.value === "all" || selected.value === "instance" ? selected.value : { eventId: selected.value },
);

onMounted(async () => {
  try {
    events.value = await listAllEvents();
  } catch {
    // Without events.read the scope stays on the installation-wide choices.
  }
  if (selected.value === "") {
    selected.value = options.value[0]?.value ?? "";
  }
});
</script>

<template>
  <div>
    <ViewHeader title="Audit log" subtitle="Who changed what, signed in, downloaded or was refused, newest first." />
    <AuditLog v-if="selected !== ''" :scope="scope">
      <template #scope>
        <v-select v-model="selected" :items="options" label="Scope" density="compact" hide-details class="scope-select" />
      </template>
    </AuditLog>
  </div>
</template>

<style scoped>
.scope-select {
  max-width: 280px;
  min-width: 200px;
}
</style>
