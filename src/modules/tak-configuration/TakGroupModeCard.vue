<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { describeError } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import { getTakConfiguration, updateTakConfiguration, type TakConfigurationDto } from "./tak-configuration.api";
import TakGroupsSection from "./TakGroupsSection.vue";

/**
 * Whether the event separates its event groups on the TAK server. It applies to connected apps
 * within seconds, without publishing; roles choose separately whether they see every group.
 */
const props = defineProps<{ eventId: string; editable: boolean }>();
const toast = useToast();

const modes = [
  { value: "off", title: "Everyone sees the whole event" },
  { value: "simple", title: "Members see only their own group" },
  { value: "advanced", title: "TAK groups with receive and send per member" },
];

const configuration = ref<TakConfigurationDto | null>(null);
const groupMode = ref<TakConfigurationDto["groupMode"]>("off");
const groupsInApp = ref(false);
const dirty = computed(
  () => configuration.value !== null && (groupMode.value !== configuration.value.groupMode || groupsInApp.value !== configuration.value.groupsInApp),
);
const state = ref<"loading" | "ready" | "error">("loading");
const loadError = ref("");
const saving = ref(false);

function show(loaded: TakConfigurationDto): void {
  configuration.value = loaded;
  groupMode.value = loaded.groupMode;
  groupsInApp.value = loaded.groupsInApp;
}

async function load(): Promise<void> {
  state.value = "loading";
  try {
    show(await getTakConfiguration(props.eventId));
    state.value = "ready";
  } catch (caught: unknown) {
    loadError.value = describeError(caught);
    state.value = "error";
  }
}

async function save(): Promise<void> {
  if (configuration.value === null) {
    return;
  }
  saving.value = true;
  try {
    show(
      await updateTakConfiguration(props.eventId, {
        version: configuration.value.version,
        meshChannelId: configuration.value.meshChannelId,
        groupMode: groupMode.value,
        groupsInApp: groupsInApp.value,
      }),
    );
    toast.success("TAK groups saved. Connected apps follow within seconds.");
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <v-card class="pa-5">
    <div class="d-flex align-center mb-2">
      <div class="text-title-medium font-weight-medium">TAK groups</div>
      <InfoHint label="About TAK groups" class="ml-2">
        <p class="mb-2">
          When members see only their own group, the positions, markers and chats of event group Alpha stay within Alpha.
          Roles marked "Sees all TAK groups", such as platoon leaders, see everyone and are seen by everyone.
        </p>
        <p class="mb-2">
          With TAK groups, each member receives what is sent into the groups it receives from, e.g. a medic receives
          Alpha and Bravo but sends only to Medics. Members without any group see nothing but the leaders.
        </p>
        <p class="mb-2">Direct messages and items sent to a person always arrive, also in another group.</p>
        <p>Teams that must not know about each other at all, such as red and blue, still belong in separate events.</p>
      </InfoHint>
    </div>
    <v-skeleton-loader v-if="state === 'loading'" type="list-item" />
    <ErrorState v-else-if="state === 'error'" :message="loadError" @retry="load" />
    <template v-else-if="configuration !== null">
      <v-select v-model="groupMode" :items="modes" label="Who sees whom" :disabled="!editable" max-width="420" />
      <div v-if="groupMode === 'advanced'" class="d-flex align-center">
        <v-switch v-model="groupsInApp" label="Show groups in TAK apps" color="primary" inset hide-details :disabled="!editable" />
        <InfoHint
          label="About groups in TAK apps"
          text="ATAK lists each member's groups and lets the member switch single groups off on the device. Switching off only hides traffic, it never adds a group."
          class="ml-2"
        />
      </div>
      <v-btn v-if="editable" color="primary" class="mt-2" :disabled="!dirty" :loading="saving" @click="save">Save</v-btn>
      <TakGroupsSection v-if="configuration.groupMode === 'advanced'" :event-id="eventId" :editable="editable" class="mt-6" />
    </template>
  </v-card>
</template>
