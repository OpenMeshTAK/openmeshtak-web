<script setup lang="ts">
import { computed, ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import { describeError, isApiProblem, type ProblemFieldError } from "@/shared/errors/api-problem";
import { useSession } from "@/modules/auth/session";
import {
  publishConfiguration,
  transitionEvent,
  type EventDto,
  type EventTransition,
} from "../events.api";

const props = defineProps<{ event: EventDto }>();
const emit = defineEmits<{ changed: [event: EventDto] }>();
const session = useSession();

const pending = ref<EventTransition | null>(null);
const running = ref(false);
const error = ref<string | null>(null);
const requirements = ref<ProblemFieldError[]>([]);

const dialogOpen = computed({
  get: () => pending.value !== null,
  set: (open: boolean) => {
    if (!open) {
      pending.value = null;
    }
  },
});

const canManage = computed(() => session.can("events.manage", props.event.id));
const canReactivate = computed(() => session.can("events.reactivate", props.event.id));

const dialog = computed(() => {
  switch (pending.value) {
    case "activate":
      return { title: "Activate this event?", confirm: "Activate", color: "primary" };
    case "archive":
      return { title: "Archive this event?", confirm: "Archive", color: "error" };
    default:
      return { title: "Reactivate this event?", confirm: "Reactivate", color: "primary" };
  }
});

const publishing = ref(false);
const published = ref<string | null>(null);

/** Group and role changes reach participants only after they are published as a new revision. */
async function publish(): Promise<void> {
  publishing.value = true;
  error.value = null;
  published.value = null;
  try {
    const result = await publishConfiguration(props.event.id);
    published.value = result.created
      ? `Published configuration revision ${String(result.revision.number)}.`
      : `No changes since revision ${String(result.revision.number)}.`;
  } catch (caught: unknown) {
    error.value = describeError(caught);
  } finally {
    publishing.value = false;
  }
}

async function run(): Promise<void> {
  if (pending.value === null) {
    return;
  }
  running.value = true;
  error.value = null;
  requirements.value = [];
  try {
    emit("changed", await transitionEvent(props.event.id, pending.value, props.event.version));
    pending.value = null;
  } catch (caught: unknown) {
    if (isApiProblem(caught, "EVENT_NOT_READY")) {
      requirements.value = caught.errors;
    }
    error.value = isApiProblem(caught, "VERSION_CONFLICT")
      ? "The event was changed elsewhere. Reload the page and try again."
      : describeError(caught);
    pending.value = null;
  } finally {
    running.value = false;
  }
}
</script>

<template>
  <v-card class="pa-5">
    <div class="text-subtitle-1 font-weight-medium mb-2">Lifecycle</div>

    <template v-if="event.status === 'draft'">
      <p class="text-body-2 mb-4">
        This draft is invisible to participants. Activation checks that the event has roles, groups
        and short-name prefixes and publishes the first configuration revision.
      </p>
      <v-btn v-if="canManage" color="primary" @click="pending = 'activate'">Activate event…</v-btn>
    </template>

    <template v-else-if="event.status === 'active'">
      <p class="text-body-2 mb-4">
        Participants can see this event and their profiles. Archiving makes it read-only and revokes
        open access links.
      </p>
      <div class="d-flex flex-wrap ga-3">
        <v-btn v-if="canManage" color="primary" :loading="publishing" @click="publish">Publish configuration</v-btn>
        <v-btn v-if="canManage" color="error" variant="outlined" @click="pending = 'archive'">Archive event…</v-btn>
      </div>
      <p class="text-caption text-medium-emphasis mt-2 mb-0">
        Changes to roles and groups reach participants once you publish them.
      </p>
      <v-alert v-if="published" type="success" class="mt-4">{{ published }}</v-alert>
    </template>

    <template v-else>
      <p class="text-body-2 mb-4">
        This event is archived and read-only. It is hidden from participants and cannot provision
        devices.
      </p>
      <v-btn v-if="canReactivate" color="primary" variant="outlined" @click="pending = 'reactivate'">
        Reactivate event…
      </v-btn>
    </template>

    <v-alert v-if="error" type="error" class="mt-4">
      {{ error }}
      <ul v-if="requirements.length > 0" class="mt-2 ml-4">
        <li v-for="requirement in requirements" :key="requirement.field">{{ requirement.message }}</li>
      </ul>
    </v-alert>

    <ConfirmDialog
      v-model="dialogOpen"
      :title="dialog.title"
      :confirm-label="dialog.confirm"
      :confirm-color="dialog.color"
      :loading="running"
      @confirm="run"
    >
      <template v-if="pending === 'activate'">
        Participants of this event will see their resolved profiles, and the current roles and
        groups become the first published configuration.
      </template>
      <template v-else-if="pending === 'archive'">
        The event becomes read-only and disappears for participants. Open access links are revoked
        and no devices can be provisioned until it is reactivated.
      </template>
      <template v-else>
        The event becomes visible to participants again after the same checks as activation.
        Revoked or expired access links, credentials and downloads are not restored; issue new ones
        where needed.
      </template>
    </ConfirmDialog>
  </v-card>
</template>
