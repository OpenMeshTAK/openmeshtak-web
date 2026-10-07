<script setup lang="ts">
import { computed, ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import { isApiProblem, type ProblemFieldError } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
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
const toast = useToast();

const pending = ref<EventTransition | null>(null);
const running = ref(false);
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

const TRANSITION_DONE: Record<EventTransition, string> = {
  activate: "Event activated. Participants can now see it.",
  archive: "Event archived. It is now read-only.",
  reactivate: "Event reactivated.",
};

/** Group and role changes reach participants only after they are published as a new revision. */
async function publish(): Promise<void> {
  publishing.value = true;
  try {
    const result = await publishConfiguration(props.event.id);
    if (result.created) {
      toast.success(`Published configuration revision ${String(result.revision.number)}.`);
    } else {
      toast.info(`No changes since revision ${String(result.revision.number)}.`);
    }
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    publishing.value = false;
  }
}

async function run(): Promise<void> {
  const transition = pending.value;
  if (transition === null) {
    return;
  }
  running.value = true;
  requirements.value = [];
  try {
    emit("changed", await transitionEvent(props.event.id, transition, props.event.version));
    toast.success(TRANSITION_DONE[transition]);
    pending.value = null;
  } catch (caught: unknown) {
    // Unmet activation requirements stay listed in the card until they are fixed.
    if (isApiProblem(caught, "EVENT_NOT_READY")) {
      requirements.value = caught.errors;
    } else {
      toast.error(
        isApiProblem(caught, "VERSION_CONFLICT") ? "The event was changed elsewhere. Reload the page and try again." : caught,
      );
    }
    pending.value = null;
  } finally {
    running.value = false;
  }
}
</script>

<template>
  <v-card class="pa-5">
    <div class="text-title-medium font-weight-medium mb-2">Lifecycle</div>

    <template v-if="event.status === 'draft'">
      <p class="text-body-medium mt-0 mb-4">
        This draft is invisible to participants. Activation checks that the event has roles, groups
        and short-name prefixes and publishes the first configuration revision.
      </p>
      <v-btn v-if="canManage" color="primary" @click="pending = 'activate'">Activate event…</v-btn>
    </template>

    <template v-else-if="event.status === 'active'">
      <p class="text-body-medium mt-0 mb-4">
        Participants can see this event and their profiles. Archiving makes it read-only, revokes
        open access links and deletes the event's event accounts.
      </p>
      <div class="d-flex flex-wrap ga-3">
        <v-btn v-if="canManage" color="primary" :loading="publishing" @click="publish">Publish configuration</v-btn>
        <v-btn v-if="canManage" color="error" variant="outlined" @click="pending = 'archive'">Archive event…</v-btn>
      </div>
      <p class="text-body-small text-medium-emphasis mt-2 mb-0">
        Changes to roles and groups reach participants once you publish them.
      </p>
    </template>

    <template v-else>
      <p class="text-body-medium mt-0 mb-4">
        This event is archived and read-only. It is hidden from participants and cannot provision
        devices.
      </p>
      <v-btn v-if="canReactivate" color="primary" variant="outlined" @click="pending = 'reactivate'">
        Reactivate event…
      </v-btn>
    </template>

    <v-alert v-if="requirements.length > 0" type="warning" class="mt-4">
      The event is not ready yet:
      <ul class="mt-2 ml-4">
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
        and no devices can be provisioned until it is reactivated. Event accounts created for this
        event are deleted with their logins and TAK certificates; reactivating does not bring them
        back. Accounts that are still members of another event stay until that event ends.
      </template>
      <template v-else>
        The event becomes visible to participants again after the same checks as activation.
        Revoked or expired access links, credentials and downloads are not restored; issue new ones
        where needed.
      </template>
    </ConfirmDialog>
  </v-card>
</template>
