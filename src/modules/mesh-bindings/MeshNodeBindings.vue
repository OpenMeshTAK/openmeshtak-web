<script setup lang="ts">
import { mdiDotsVertical, mdiLinkVariantPlus, mdiRefresh } from "@mdi/js";
import { computed, onMounted, ref } from "vue";
import ConfirmDialog from "@/shared/components/ConfirmDialog.vue";
import DataTable from "@/shared/components/DataTable.vue";
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

/** The order before a column is sorted. */
const ranked = computed(() =>
  [...nodes.value].sort((a, b) => rank(a) - rank(b) || (b.lastHeardAt ?? "").localeCompare(a.lastHeardAt ?? "")),
);

function nodeSearchText(node: MeshtasticNodeDto): (string | null | undefined)[] {
  return [node.nodeId, node.shortName, node.longName, node.binding?.member.callsign, node.binding?.member.displayName];
}

const headers = computed(() => [
  { title: "Node", key: "node", value: nodeName },
  { title: "Last heard", key: "lastHeardAt" },
  { title: "Member", key: "member", value: (node: MeshtasticNodeDto) => (node.binding === null ? "" : memberName(node.binding.member)) },
  ...(canManage.value ? [{ title: "Actions", key: "actions", sortable: false, align: "end" as const }] : []),
]);

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
      <v-btn variant="text" :prepend-icon="mdiRefresh" :disabled="state === 'loading'" @click="load">Refresh</v-btn>
      <v-btn v-if="canPickMember" color="primary" :prepend-icon="mdiLinkVariantPlus" @click="openBind(null)">Bind a node</v-btn>
    </SettingsHeaderActions>

    <v-skeleton-loader v-if="state === 'loading'" type="table-row@4" />
    <ErrorState v-else-if="state === 'error'" :message="loadError" @retry="load" />
    <EmptyState
      v-else-if="nodes.length === 0"
      title="No mesh nodes yet"
      text="Nodes appear here once an HQ with the uplink switched on hears them. You can also bind a radio to a member in advance by its node ID."
    />
    <v-card v-else>
      <DataTable
        :headers="headers"
        :items="ranked"
        item-value="nodeNum"
        :searchable="true"
        :search-text="nodeSearchText"
        search-label="Search mesh nodes"
        storage-key="mesh-nodes"
        no-data-text="No node matches the search."
      >
        <template #toolbar>
          <span class="text-body-small text-medium-emphasis">
            {{ nodes.length === 1 ? "1 node" : `${nodes.length} nodes` }} · {{ unknownCount }} unknown
            <InfoHint
              label="About node bindings"
              text="A bound node's positions join the member's track under the member's TAK identity. Unknown nodes appear in the live view and history under their own name. Changing a binding never rewrites positions that were already recorded."
            />
          </span>
        </template>
        <template #[`item.node`]="{ item }">
          <div class="font-weight-medium">{{ nodeName(item) }}</div>
          <div class="text-body-small text-medium-emphasis">
            {{ item.nodeId }}<template v-if="item.shortName !== null && item.longName !== null"> · {{ item.shortName }}</template>
          </div>
        </template>
        <template #[`item.lastHeardAt`]="{ item }"><span class="text-no-wrap">{{ heardText(item) }}</span></template>
        <template #[`item.member`]="{ item }">
          <template v-if="item.binding !== null">
            <div>{{ memberName(item.binding.member) }}</div>
            <div v-if="item.binding.member.shortName !== null" class="text-body-small text-medium-emphasis">{{ item.binding.member.shortName }}</div>
          </template>
          <template v-else>
            <v-chip size="small" variant="tonal">Unknown</v-chip>
            <div v-if="item.suggestion !== null" class="d-flex align-center flex-wrap ga-2 mt-1">
              <span class="text-body-small">Suggested: {{ memberName(item.suggestion) }}</span>
              <v-btn v-if="canManage" size="x-small" variant="tonal" color="primary" :loading="busyNode === item.nodeNum" @click="confirmSuggestion(item)">
                Confirm
              </v-btn>
            </div>
          </template>
        </template>
        <template #[`item.actions`]="{ item }">
          <v-menu location="bottom end">
            <template #activator="{ props: menu }">
              <v-btn
                v-bind="menu"
                :icon="mdiDotsVertical"
                variant="text"
                size="small"
                :aria-label="`Actions for ${nodeName(item)}`"
                :disabled="busyNode === item.nodeNum"
              />
            </template>
            <v-list density="compact">
              <v-list-item
                :disabled="!canPickMember"
                :title="item.binding === null ? 'Bind to a member…' : 'Bind to another member…'"
                @click="openBind(item)"
              />
              <v-list-item v-if="item.binding !== null" title="Unbind" @click="askUnbind(item)" />
            </v-list>
          </v-menu>
        </template>
      </DataTable>
    </v-card>

    <BindNodeDialog v-if="members !== null" v-model="bindOpen" :node="bindingNode" :members="members" :bound-nodes="boundNodes" :bind="bind" />
    <ConfirmDialog v-model="unbindOpen" title="Unbind this node?" confirm-label="Unbind" confirm-color="error" :loading="busyNode !== null" @confirm="unbind">
      Positions {{ unbinding === null ? "this node" : nodeName(unbinding) }} sends from now on appear as an unknown node. Positions already recorded
      for the member stay with the member.
    </ConfirmDialog>
  </div>
</template>
