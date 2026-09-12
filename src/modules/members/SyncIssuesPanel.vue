<script setup lang="ts">
import { mdiCheckCircleOutline } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import type { Schemas } from "@/shared/api/types";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import { describeError } from "@/shared/errors/api-problem";
import { useSession } from "@/modules/auth/session";
import { listOpenSyncIssues, retrySyncIssue, type SyncIssueDto } from "./members.api";

const props = defineProps<{ event: Schemas["EventDto"] }>();
const emit = defineEmits<{ resolved: [] }>();
const session = useSession();

const issues = ref<SyncIssueDto[]>([]);
const state = ref<"loading" | "ready" | "error">("loading");
const loadError = ref("");
const overrides = ref<Record<string, string>>({});
const retrying = ref<string | null>(null);
const notice = ref<{ type: "success" | "warning" | "error"; text: string } | null>(null);

const canRetry = computed(() => props.event.status !== "archived" && session.can("members.manage", props.event.id));

async function load(): Promise<void> {
  state.value = "loading";
  try {
    issues.value = await listOpenSyncIssues(props.event.id);
    state.value = "ready";
  } catch (caught: unknown) {
    loadError.value = describeError(caught);
    state.value = "error";
  }
}

function hasCallsignConflict(issue: SyncIssueDto): boolean {
  return issue.reasons.some(({ field, code }) => field === "callsign" && code === "CONFLICT");
}

async function retry(issue: SyncIssueDto): Promise<void> {
  retrying.value = issue.id;
  notice.value = null;
  try {
    const result = await retrySyncIssue(props.event.id, issue.id, overrides.value[issue.id]?.trim() || undefined);
    notice.value =
      result.outcome === "member"
        ? { type: "success", text: `${issue.username} is now a member.` }
        : { type: "warning", text: `${issue.username} still cannot be resolved; see the reasons below.` };
    emit("resolved");
    await load();
  } catch (caught: unknown) {
    notice.value = { type: "error", text: describeError(caught) };
  } finally {
    retrying.value = null;
  }
}

onMounted(load);
defineExpose({ load });
</script>

<template>
  <div>
    <p class="text-body-2 text-medium-emphasis mb-4">
      Synchronizations that could not be resolved create no membership. Fix the role, group or
      callsign, then retry. A retry uses the event's current configuration.
    </p>

    <v-alert v-if="notice" :type="notice.type" closable class="mb-4" @click:close="notice = null">
      {{ notice.text }}
    </v-alert>

    <v-skeleton-loader v-if="state === 'loading'" type="list-item-three-line" />
    <ErrorState v-else-if="state === 'error'" :message="loadError" @retry="load" />
    <EmptyState v-else-if="issues.length === 0" :icon="mdiCheckCircleOutline" title="No open sync issues" />

    <div v-else class="d-flex flex-column ga-4">
      <v-card v-for="issue in issues" :key="issue.id" class="pa-4">
        <div class="d-flex flex-wrap align-center ga-2 mb-2">
          <span class="text-subtitle-1 font-weight-medium">{{ issue.username }}</span>
          <span class="text-caption text-medium-emphasis">{{ issue.provider }} · {{ issue.externalId }}</span>
          <v-spacer />
          <span class="text-caption text-medium-emphasis">Reported {{ issue.occurrences }}×</span>
        </div>
        <div class="text-body-2 mb-2">Requested role <code>{{ issue.requestedRole }}</code>, group <code>{{ issue.requestedGroup }}</code></div>
        <ul class="text-body-2 ml-4 mb-3">
          <li v-for="reason in issue.reasons" :key="`${reason.field}-${reason.code}`">{{ reason.message }}</li>
        </ul>
        <div v-if="canRetry" class="d-flex flex-wrap align-center ga-3">
          <v-text-field
            v-if="hasCallsignConflict(issue)"
            v-model="overrides[issue.id]"
            label="Callsign override"
            hint="A unique callsign for this member, e.g. Peter M. [Bravo]"
            persistent-hint
            style="min-width: 260px"
          />
          <v-btn color="primary" variant="outlined" :loading="retrying === issue.id" @click="retry(issue)">Retry</v-btn>
        </div>
      </v-card>
    </div>
  </div>
</template>
