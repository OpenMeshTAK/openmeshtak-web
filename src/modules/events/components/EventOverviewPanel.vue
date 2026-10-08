<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import { describeError } from "@/shared/errors/api-problem";
import { useSession } from "@/modules/auth/session";
import { listDataPackages } from "@/modules/data-packages/data-packages.api";
import { listGroups } from "@/modules/event-groups/event-groups.api";
import { listRoles } from "@/modules/event-roles/event-roles.api";
import { listMembers, listOpenSyncIssues, type EventMemberDto } from "@/modules/members/members.api";
import { scheduleHint } from "../event-schedule";
import type { EventDto } from "../events.api";
import EventLifecycleCard from "./EventLifecycleCard.vue";

const props = defineProps<{ event: EventDto; visible: boolean }>();
const emit = defineEmits<{ changed: [event: EventDto]; open: [tab: string] }>();
const session = useSession();

interface GroupRow {
  name: string;
  slug: string;
  members: number;
}

const state = ref<"loading" | "ready" | "error">("loading");
const loadError = ref("");
const members = ref<EventMemberDto[]>([]);
const groups = ref<GroupRow[]>([]);
const roleCount = ref(0);
const openSyncIssues = ref(0);
const packageCount = ref<number | null>(null);

const canReadPackages = computed(() => session.can("data-packages.read", props.event.id));

const stats = computed(() => [
  { label: "Members", value: members.value.length, tab: "members" },
  { label: "Groups", value: groups.value.length, tab: "groups" },
  { label: "Roles", value: roleCount.value, tab: "roles" },
  { label: "Open sync issues", value: openSyncIssues.value, tab: "sync-issues", warn: openSyncIssues.value > 0 },
  ...(packageCount.value === null ? [] : [{ label: "Data packages", value: packageCount.value, tab: "data-packages" }]),
]);

const dateFormat = computed(
  () => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: props.event.timeZone }),
);

const schedule = computed(() => [
  { label: "Starts", value: props.event.startsAt === null ? "Not set" : dateFormat.value.format(new Date(props.event.startsAt)) },
  { label: "Ends", value: props.event.endsAt === null ? "Not set" : dateFormat.value.format(new Date(props.event.endsAt)) },
  { label: "Time zone", value: props.event.timeZone },
  {
    label: "ATAK QR login",
    value:
      props.event.takLoginTokenDays !== 0
        ? `Valid for ${String(props.event.takLoginTokenDays)} days`
        : props.event.endsAt === null
          ? "Never expires"
          : "Valid until the event ends",
  },
]);

const hint = computed(() => scheduleHint(props.event));

async function load(): Promise<void> {
  state.value = "loading";
  try {
    const [loadedMembers, loadedGroups, loadedRoles, issues, packages] = await Promise.all([
      listMembers(props.event.id),
      listGroups(props.event.id),
      listRoles(props.event.id),
      listOpenSyncIssues(props.event.id),
      canReadPackages.value ? listDataPackages(props.event.id) : Promise.resolve(null),
    ]);
    members.value = loadedMembers;
    groups.value = loadedGroups.map((group) => ({
      name: group.name,
      slug: group.slug,
      members: loadedMembers.filter((member) => member.eventGroup.id === group.id).length,
    }));
    roleCount.value = loadedRoles.length;
    openSyncIssues.value = issues.length;
    packageCount.value = packages === null ? null : packages.length;
    state.value = "ready";
  } catch (caught: unknown) {
    loadError.value = describeError(caught);
    state.value = "error";
  }
}

onMounted(load);
</script>

<template>
  <v-row>
    <v-col cols="12" md="8">
      <v-skeleton-loader v-if="state === 'loading'" type="card, table" />
      <ErrorState v-else-if="state === 'error'" :message="loadError" @retry="load" />

      <template v-else>
        <div class="overview-stats mb-4">
          <v-card v-for="stat in stats" :key="stat.tab" class="pa-4" @click="emit('open', stat.tab)">
            <div class="text-headline-small" :class="{ 'text-error': stat.warn }">{{ stat.value }}</div>
            <div class="text-body-medium text-medium-emphasis">{{ stat.label }}</div>
          </v-card>
        </div>

        <v-card>
          <v-table density="comfortable">
            <thead>
              <tr>
                <th>Group</th>
                <th>Slug</th>
                <th class="text-right">Members</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="groups.length === 0">
                <td colspan="3" class="text-medium-emphasis">No groups yet.</td>
              </tr>
              <tr v-for="group in groups" :key="group.slug">
                <td>{{ group.name }}</td>
                <td><code>{{ group.slug }}</code></td>
                <td class="text-right">{{ group.members }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </template>
    </v-col>

    <v-col cols="12" md="4">
      <v-card class="pa-5 mb-4">
        <div class="d-flex align-center mb-2">
          <div class="text-title-medium font-weight-medium flex-grow-1">Schedule</div>
          <span v-if="hint" class="text-body-medium text-medium-emphasis">{{ hint }}</span>
        </div>
        <dl class="schedule">
          <template v-for="row in schedule" :key="row.label">
            <dt class="text-medium-emphasis">{{ row.label }}</dt>
            <dd>{{ row.value }}</dd>
          </template>
        </dl>
      </v-card>
      <EventLifecycleCard :event="event" :visible="visible" @changed="emit('changed', $event)" />
    </v-col>
  </v-row>
</template>

<style scoped>
.overview-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}

.schedule {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 16px;
  margin: 0;
}

.schedule dd {
  margin: 0;
}
</style>
