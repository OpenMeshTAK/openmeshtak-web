<script setup lang="ts">
import {
  mdiArrowDown,
  mdiArrowUp,
  mdiKeyVariant,
  mdiLock,
  mdiLockOpenVariant,
  mdiPlus,
} from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import { describeError, isApiProblem } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import { useSession } from "@/modules/auth/session";
import { listGroups } from "@/modules/event-groups/event-groups.api";
import { listRoles } from "@/modules/event-roles/event-roles.api";
import { listMembers, type EventMemberDto } from "@/modules/members/members.api";
import { channelKeyHolders, channelRecipients, moveInDeviceOrder } from "./channel-recipients";
import ChannelDialog from "./components/ChannelDialog.vue";
import ChannelKeyDialog from "./components/ChannelKeyDialog.vue";
import {
  deleteChannel,
  inDeviceOrder,
  listChannels,
  releaseChannel,
  toUpdateRequest,
  updateChannel,
  type MeshtasticChannelDto,
} from "./meshtastic-channels.api";
import { positionPrecisionLabel } from "./position-precision";

const props = defineProps<{ eventId: string; editable: boolean; active: boolean }>();
const session = useSession();
const toast = useToast();

const channels = ref<MeshtasticChannelDto[]>([]);
const groups = ref<Array<{ id: string; title: string }>>([]);
const roles = ref<Array<{ id: string; title: string }>>([]);
const members = ref<EventMemberDto[] | null>(null);
const state = ref<"loading" | "ready" | "error">("loading");
const loadError = ref("");
const busy = ref(false);

const editing = ref<MeshtasticChannelDto | null>(null);
const channelDialogOpen = ref(false);
const keyChannel = ref<MeshtasticChannelDto | null>(null);
const keyDialogOpen = ref(false);
const deleting = ref<MeshtasticChannelDto | null>(null);
const releasing = ref<MeshtasticChannelDto | null>(null);

const memberOptions = computed(() =>
  members.value?.map((member) => ({ id: member.id, title: `${member.callsign} · ${member.displayName}` })) ?? null,
);
const canReveal = computed(() => session.can("channel-keys.reveal", props.eventId));

async function load(): Promise<void> {
  state.value = "loading";
  try {
    const canReadMembers = session.can("members.read", props.eventId);
    const [loadedChannels, loadedGroups, loadedRoles, loadedMembers] = await Promise.all([
      listChannels(props.eventId),
      listGroups(props.eventId),
      listRoles(props.eventId),
      canReadMembers ? listMembers(props.eventId) : Promise.resolve(null),
    ]);
    channels.value = loadedChannels;
    groups.value = loadedGroups.map((group) => ({ id: group.id, title: group.name }));
    roles.value = loadedRoles.map((role) => ({ id: role.id, title: role.name }));
    members.value = loadedMembers;
    state.value = "ready";
  } catch (caught: unknown) {
    loadError.value = describeError(caught);
    state.value = "error";
  }
}

function openChannel(channel: MeshtasticChannelDto | null): void {
  editing.value = channel;
  channelDialogOpen.value = true;
}

function openKey(channel: MeshtasticChannelDto): void {
  keyChannel.value = channel;
  keyDialogOpen.value = true;
}

function replaceChannel(saved: MeshtasticChannelDto): void {
  const index = channels.value.findIndex((channel) => channel.id === saved.id);
  if (index < 0) {
    channels.value = inDeviceOrder([...channels.value, saved]);
  } else {
    channels.value[index] = saved;
    channels.value = inDeviceOrder(channels.value);
  }
}

async function saved(channel: MeshtasticChannelDto): Promise<void> {
  replaceChannel(channel);
  toast.success(`Channel ${channel.name} was saved.`);
  await load();
}

async function channelRotated(channel: MeshtasticChannelDto): Promise<void> {
  replaceChannel(channel);
  keyChannel.value = channel;
  await load();
  keyChannel.value = channels.value.find((item) => item.id === channel.id) ?? channel;
}

async function move(channel: MeshtasticChannelDto, offset: -1 | 1): Promise<void> {
  const desired = moveInDeviceOrder(channels.value, channel.id, offset);
  if (desired === null) {
    toast.warning("A secret channel cannot become the primary channel.");
    return;
  }

  busy.value = true;
  try {
    // Core currently exposes optimistic single-channel updates. Normalize all eight-or-fewer
    // positions after a move so equal sort values cannot make device order ambiguous.
    for (const [sortOrder, item] of desired.entries()) {
      if (item.sortOrder !== sortOrder) {
        const updated = await updateChannel(props.eventId, item.id, {
          ...toUpdateRequest(item),
          sortOrder,
        });
        item.version = updated.version;
        item.sortOrder = updated.sortOrder;
      }
    }
    toast.success(`Channel ${channel.name} was moved.`);
  } catch (caught: unknown) {
    toast.error(
      isApiProblem(caught, "VERSION_CONFLICT")
        ? "The channel list changed elsewhere. It was reloaded; move the channel again."
        : caught,
    );
  } finally {
    await load();
    busy.value = false;
  }
}

async function confirmDelete(): Promise<void> {
  const target = deleting.value;
  deleting.value = null;
  if (target === null) return;
  try {
    await deleteChannel(props.eventId, target.id);
    toast.success(`Channel ${target.name} was deleted.`);
    await load();
  } catch (caught: unknown) {
    toast.error(caught);
  }
}

async function confirmRelease(): Promise<void> {
  const target = releasing.value;
  releasing.value = null;
  if (target === null) return;
  try {
    const released = await releaseChannel(props.eventId, target);
    replaceChannel(released);
    toast.success(`Channel ${target.name} was released to its audience.`);
  } catch (caught: unknown) {
    toast.error(caught);
    await load();
  }
}

function recipientList(channel: MeshtasticChannelDto): EventMemberDto[] {
  return members.value === null ? [] : channelRecipients(channel, members.value);
}

function keyHolderList(channel: MeshtasticChannelDto): EventMemberDto[] {
  return members.value === null ? [] : channelKeyHolders(channel, members.value);
}

onMounted(load);
</script>

<template>
  <div>
    <v-alert v-if="active" type="info" variant="tonal" class="mb-4">
      Channel changes stay in the event draft until you publish a new configuration revision from
      the Overview tab.
    </v-alert>
    <v-alert v-if="members === null && state === 'ready'" type="info" variant="tonal" density="compact" class="mb-4">
      You can manage group and role audiences, but member names and recipient previews require
      permission to view event members.
    </v-alert>

    <div class="d-flex align-center mb-4 ga-4 flex-wrap">
      <p class="text-body-2 text-medium-emphasis flex-grow-1 mb-0">
        The primary channel reaches everyone. Secondary channels can target any union of groups,
        roles and individual members. Meshtastic devices support at most eight channels.
      </p>
      <v-btn
        v-if="editable"
        color="primary"
        :prepend-icon="mdiPlus"
        :disabled="channels.length >= 8"
        @click="openChannel(null)"
      >
        Add channel
      </v-btn>
    </div>

    <v-skeleton-loader v-if="state === 'loading'" type="table" />
    <ErrorState v-else-if="state === 'error'" :message="loadError" @retry="load" />
    <EmptyState
      v-else-if="channels.length === 0"
      title="No Meshtastic channels yet"
      text="Add the primary event channel first."
    />

    <v-card v-else>
      <v-table hover>
        <thead>
          <tr>
            <th>Channel</th>
            <th>Audience</th>
            <th class="d-none d-lg-table-cell">Position</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(channel, index) in channels" :key="channel.id">
            <td>
              <div class="d-flex align-center ga-2 flex-wrap py-2">
                <span class="font-weight-medium">{{ channel.name }}</span>
                <v-chip v-if="channel.primary" size="x-small" color="primary" label>Primary</v-chip>
                <v-chip v-if="channel.secret" size="x-small" color="warning" label :prepend-icon="mdiLock">
                  {{ channel.releasedAt === null ? "Secret · withheld" : "Secret · released" }}
                </v-chip>
              </div>
              <div class="text-caption text-medium-emphasis">
                {{ channel.psk.kind.toUpperCase() }} · key version {{ channel.psk.version }}
                <template v-if="channel.uplinkEnabled"> · MQTT uplink</template>
                <template v-if="channel.downlinkEnabled"> · MQTT downlink</template>
              </div>
            </td>
            <td>
              <template v-if="members !== null">
                <v-menu>
                  <template #activator="{ props: activatorProps }">
                    <v-btn v-bind="activatorProps" variant="text" size="small">
                      {{ recipientList(channel).length }} recipients
                    </v-btn>
                  </template>
                  <v-list density="compact" max-height="320">
                    <v-list-item
                      v-for="member in recipientList(channel)"
                      :key="member.id"
                      :title="member.callsign"
                      :subtitle="member.displayName"
                    />
                    <v-list-item v-if="recipientList(channel).length === 0" title="Nobody receives this channel" />
                  </v-list>
                </v-menu>
                <div v-if="channel.secret" class="text-caption text-medium-emphasis">
                  {{ keyHolderList(channel).length }} key holders
                </div>
              </template>
              <span v-else class="text-medium-emphasis">Preview unavailable</span>
            </td>
            <td class="d-none d-lg-table-cell">{{ positionPrecisionLabel(channel.positionPrecision) }}</td>
            <td class="text-right text-no-wrap">
              <v-btn
                v-if="editable"
                :icon="mdiArrowUp"
                size="small"
                variant="text"
                aria-label="Move channel up"
                :disabled="busy || index === 0 || (index === 1 && channel.secret)"
                @click="move(channel, -1)"
              />
              <v-btn
                v-if="editable"
                :icon="mdiArrowDown"
                size="small"
                variant="text"
                aria-label="Move channel down"
                :disabled="busy || index === channels.length - 1 || (index === 0 && channels[1]?.secret === true)"
                @click="move(channel, 1)"
              />
              <v-btn :icon="mdiKeyVariant" size="small" variant="text" aria-label="Manage channel key" @click="openKey(channel)" />
              <v-btn
                v-if="editable && channel.secret && channel.releasedAt === null"
                :prepend-icon="mdiLockOpenVariant"
                size="small"
                variant="text"
                @click="releasing = channel"
              >
                Release
              </v-btn>
              <v-btn v-if="editable" variant="text" size="small" @click="openChannel(channel)">Edit</v-btn>
              <v-btn v-if="editable" variant="text" size="small" color="error" @click="deleting = channel">Delete</v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <ChannelDialog
      v-model="channelDialogOpen"
      :event-id="eventId"
      :channel="editing"
      :primary="editing?.primary ?? channels.length === 0"
      :groups="groups"
      :roles="roles"
      :members="memberOptions"
      @saved="saved"
    />
    <ChannelKeyDialog
      v-if="keyChannel"
      v-model="keyDialogOpen"
      :event-id="eventId"
      :channel="keyChannel"
      :can-reveal="canReveal"
      :can-rotate="editable"
      @rotated="channelRotated"
    />

    <ConfirmDialog
      :model-value="deleting !== null"
      title="Delete this channel?"
      confirm-label="Delete"
      confirm-color="error"
      @update:model-value="deleting = null"
      @confirm="confirmDelete"
    >
      {{ deleting?.name }} is removed from the event draft. Existing published revisions remain unchanged.
    </ConfirmDialog>
    <ConfirmDialog
      :model-value="releasing !== null"
      title="Release this secret channel?"
      confirm-label="Release channel"
      confirm-color="warning"
      @update:model-value="releasing = null"
      @confirm="confirmRelease"
    >
      The key of {{ releasing?.name }} becomes available to its whole audience after you publish a
      new event configuration. Existing profiles and artifacts are not changed.
    </ConfirmDialog>
  </div>
</template>
