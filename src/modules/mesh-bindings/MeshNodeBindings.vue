<script setup lang="ts">
import { mdiDotsVertical, mdiLinkVariantPlus, mdiMagnify, mdiRefresh } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import EmptyState from "@/shared/components/EmptyState.vue";
import ErrorState from "@/shared/components/ErrorState.vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { describeError, isApiProblem } from "@/shared/errors/api-problem";
import { useToast } from "@/shared/feedback/toast";
import SettingsHeaderActions from "@/shared/settings/SettingsHeaderActions.vue";
import { useSession } from "@/modules/auth/session";
import { listMembers, type EventMemberDto } from "@/modules/members/members.api";
import BindNodeDialog from "./BindNodeDialog.vue";
import { bindMeshtasticNode, listMeshtasticNodes, unbindMeshtasticNode, type MeshtasticNodeDto, type MeshtasticNodeMemberDto } from "./mesh-bindings.api";

/**
 * Which member each Meshtastic node of the event belongs to. A bound node's uplinked positions
 * join the member's track; unbound nodes appear as unknown. Core suggests a member when the
 * node's names match a member's provisioned short name and callsign, but only an operator binds.
 * Bindings apply at once and are not part of the published configuration.
 */
const props = defineProps<{ eventId: string; editable: boolean }>();
const session = useSession();
const toast = useToast();

const nodes = ref<MeshtasticNodeDto[]>([]);
const members = ref<EventMemberDto[] | null>(null);
const state = ref<"loading" | "ready" | "error">("loading");
const loadError = ref("");
const search = ref("");
const busyNode = ref<number | null>(null);
const bindOpen = ref(false);
const bindingNode = ref<MeshtasticNodeDto | null>(null);
const unbindOpen = ref(false);
const unbinding = ref<MeshtasticNodeDto | null>(null);
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" });

const canManage = computed(() => props.editable && session.can("mesh-bindings.manage", props.eventId));
/** Binding to any member needs the member list; confirming a suggestion and unbinding do not. */
const canPickMember = computed(() => canManage.value && members.value !== null);
const boundNodes = computed(
  () => new Map(nodes.value.flatMap((node) => (node.binding === null ? [] : [[node.binding.member.memberId, node.nodeId] as const]))),
);
const unknownCount = computed(() => nodes.value.filter((node) => node.binding === null).length);

/** Unbound nodes with a suggestion first, then other unbound nodes, then bound ones; newest heard first. */
function rank(node: MeshtasticNodeDto): number {
  return node.binding !== null ? 2 : node.suggestion !== null ? 0 : 1;
}

const shown = computed(() => {
  const term = search.value.trim().toLowerCase();
  return nodes.value
    .filter(
      (node) =>
        term === "" ||
        [node.nodeId, node.shortName, node.longName, node.binding?.member.callsign, node.binding?.member.displayName].some((text) =>
          text?.toLowerCase().includes(term),
        ),
    )
    .sort((a, b) => rank(a) - rank(b) || (b.lastHeardAt ?? "").localeCompare(a.lastHeardAt ?? ""));
});

function nodeName(node: MeshtasticNodeDto): string {
  return node.longName ?? node.shortName ?? node.nodeId;
}

function memberName(member: MeshtasticNodeMemberDto): string {
  return `${member.callsign} · ${member.displayName}`;
}

function heardText(node: MeshtasticNodeDto): string {
  return node.lastHeardAt === null ? "Not heard yet" : dateFormat.format(new Date(node.lastHeardAt));
}

async function load(): Promise<void> {
  state.value = "loading";
  try {
    const [loadedNodes, loadedMembers] = await Promise.all([
      listMeshtasticNodes(props.eventId),
      canManage.value && session.can("members.read", props.eventId) ? listMembers(props.eventId) : Promise.resolve(null),
    ]);
    nodes.value = loadedNodes;
    members.value = loadedMembers;
    state.value = "ready";
  } catch (caught: unknown) {
    loadError.value = describeError(caught);
    state.value = "error";
  }
}

function replace(updated: MeshtasticNodeDto): void {
  const index = nodes.value.findIndex(({ nodeNum }) => nodeNum === updated.nodeNum);
  nodes.value = index < 0 ? [...nodes.value, updated] : nodes.value.map((node, at) => (at === index ? updated : node));
}

/** A version conflict means someone else changed the node meanwhile: show its current state. */
async function afterConflict(caught: unknown): Promise<boolean> {
  if (!isApiProblem(caught) || caught.status !== 409 || caught.code === "MESHTASTIC_MEMBER_BOUND") return false;
  toast.warning("The node was changed meanwhile. The list now shows its current binding.");
  await load();
  return true;
}

async function bind(nodeNum: number, memberId: string, version: number): Promise<void> {
  try {
    const updated = await bindMeshtasticNode(props.eventId, nodeNum, memberId, version);
    replace(updated);
    toast.success(`${nodeName(updated)} is bound to ${updated.binding?.member.callsign ?? "the member"}.`);
  } catch (caught: unknown) {
    if (await afterConflict(caught)) return;
    throw caught;
  }
}

async function confirmSuggestion(node: MeshtasticNodeDto): Promise<void> {
  if (node.suggestion === null) return;
  busyNode.value = node.nodeNum;
  try {
    await bind(node.nodeNum, node.suggestion.memberId, node.version);
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    busyNode.value = null;
  }
}

function openBind(node: MeshtasticNodeDto | null): void {
  bindingNode.value = node;
  bindOpen.value = true;
}

function askUnbind(node: MeshtasticNodeDto): void {
  unbinding.value = node;
  unbindOpen.value = true;
}

async function unbind(): Promise<void> {
  const node = unbinding.value;
  if (node === null) return;
  busyNode.value = node.nodeNum;
  try {
    await unbindMeshtasticNode(props.eventId, node.nodeNum);
    toast.success(`${nodeName(node)} is no longer bound.`);
    unbindOpen.value = false;
    await load();
  } catch (caught: unknown) {
    toast.error(caught);
  } finally {
    busyNode.value = null;
  }
}

onMounted(load);
</script>

<template>
  <div>
    <SettingsHeaderActions>
      <v-btn variant="text" size="small" :prepend-icon="mdiRefresh" :disabled="state === 'loading'" @click="load">Refresh</v-btn>
      <v-btn v-if="canPickMember" color="primary" size="small" :prepend-icon="mdiLinkVariantPlus" @click="openBind(null)">Bind a node</v-btn>
    </SettingsHeaderActions>

    <v-skeleton-loader v-if="state === 'loading'" type="table-row@4" />
    <ErrorState v-else-if="state === 'error'" :message="loadError" @retry="load" />
    <EmptyState
      v-else-if="nodes.length === 0"
      title="No mesh nodes yet"
      text="Nodes appear here once an HQ with the uplink switched on hears them. You can also bind a radio to a member in advance by its node ID."
    />
    <template v-else>
      <div class="d-flex align-center flex-wrap ga-3 mb-3">
        <v-text-field
          v-model="search"
          :prepend-inner-icon="mdiMagnify"
          placeholder="Search node, callsign or name"
          aria-label="Search mesh nodes"
          density="compact"
          variant="outlined"
          hide-details
          clearable
          class="bindings-search"
        />
        <span class="text-body-small text-medium-emphasis">
          {{ nodes.length === 1 ? "1 node" : `${nodes.length} nodes` }} · {{ unknownCount }} unknown
          <InfoHint
            label="About node bindings"
            text="A bound node's positions join the member's track under the member's TAK identity. Unknown nodes appear in the live view and history under their own name. Changing a binding never rewrites positions that were already recorded."
          />
        </span>
      </div>
      <v-table density="compact">
        <thead>
          <tr>
            <th>Node</th>
            <th>Last heard</th>
            <th>Member</th>
            <th v-if="canManage" class="text-end" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="node in shown" :key="node.nodeNum">
            <td>
              <div class="text-body-medium">{{ nodeName(node) }}</div>
              <div class="text-body-small text-medium-emphasis">
                {{ node.nodeId }}<template v-if="node.shortName !== null && node.longName !== null"> · {{ node.shortName }}</template>
              </div>
            </td>
            <td class="text-body-small">{{ heardText(node) }}</td>
            <td>
              <template v-if="node.binding !== null">
                <div class="text-body-medium">{{ memberName(node.binding.member) }}</div>
                <div v-if="node.binding.member.shortName !== null" class="text-body-small text-medium-emphasis">{{ node.binding.member.shortName }}</div>
              </template>
              <template v-else>
                <v-chip size="small" variant="outlined">Unknown</v-chip>
                <div v-if="node.suggestion !== null" class="d-flex align-center flex-wrap ga-2 mt-1">
                  <span class="text-body-small">Suggested: {{ memberName(node.suggestion) }}</span>
                  <v-btn v-if="canManage" size="x-small" variant="tonal" color="primary" :loading="busyNode === node.nodeNum" @click="confirmSuggestion(node)">
                    Confirm
                  </v-btn>
                </div>
              </template>
            </td>
            <td v-if="canManage" class="text-end">
              <v-menu location="bottom end">
                <template #activator="{ props: menu }">
                  <v-btn
                    v-bind="menu"
                    :icon="mdiDotsVertical"
                    variant="text"
                    size="small"
                    :aria-label="`Actions for ${nodeName(node)}`"
                    :disabled="busyNode === node.nodeNum"
                  />
                </template>
                <v-list density="compact">
                  <v-list-item
                    :disabled="!canPickMember"
                    :title="node.binding === null ? 'Bind to a member…' : 'Bind to another member…'"
                    @click="openBind(node)"
                  />
                  <v-list-item v-if="node.binding !== null" title="Unbind" @click="askUnbind(node)" />
                </v-list>
              </v-menu>
            </td>
          </tr>
        </tbody>
      </v-table>
      <p v-if="shown.length === 0" class="text-body-medium text-medium-emphasis text-center my-6">No node matches the search.</p>
    </template>

    <BindNodeDialog v-if="members !== null" v-model="bindOpen" :node="bindingNode" :members="members" :bound-nodes="boundNodes" :bind="bind" />
    <ConfirmDialog v-model="unbindOpen" title="Unbind this node?" confirm-label="Unbind" confirm-color="error" :loading="busyNode !== null" @confirm="unbind">
      Positions {{ unbinding === null ? "this node" : nodeName(unbinding) }} sends from now on appear as an unknown node. Positions already recorded
      for the member stay with the member.
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.bindings-search {
  max-width: 360px;
}
</style>
