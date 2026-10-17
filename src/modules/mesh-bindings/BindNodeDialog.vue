<script setup lang="ts">
import { computed, ref, watch } from "vue";
import InfoHint from "@/shared/components/InfoHint.vue";
import { describeError } from "@/shared/errors/api-problem";
import { fieldErrors, messagesFor } from "@/shared/errors/field-errors";
import type { EventMemberDto } from "@/modules/members/members.api";
import type { MeshtasticNodeDto } from "./mesh-bindings.api";
import { parseNodeNumber } from "./node-number";

/**
 * Binds a node to a member: a heard node from the list, or a node number typed in to bind a
 * radio before the HQ hears it. Core rejects a member who already has a node; the picker shows
 * those members with their node so the operator knows why.
 */
const props = defineProps<{
  /** The node to bind, or null to enter a node number. */
  node: MeshtasticNodeDto | null;
  members: EventMemberDto[];
  /** Node ID per member ID for members that already have a node. */
  boundNodes: ReadonlyMap<string, string>;
  bind: (nodeNum: number, memberId: string, version: number) => Promise<void>;
}>();
const open = defineModel<boolean>({ required: true });

const nodeInput = ref("");
const memberId = ref<string | null>(null);
const saving = ref(false);
const error = ref<string | null>(null);
const errors = ref<Record<string, string>>({});

watch(open, (isOpen) => {
  if (!isOpen) return;
  nodeInput.value = "";
  memberId.value = props.node?.binding?.member.memberId ?? props.node?.suggestion?.memberId ?? null;
  error.value = null;
  errors.value = {};
});

const nodeNum = computed(() => (props.node === null ? parseNodeNumber(nodeInput.value) : props.node.nodeNum));
const nodeError = computed(() => (props.node === null && nodeInput.value.trim() !== "" && nodeNum.value === null ? "Enter a node ID such as !a1b2c3d4." : null));
const memberOptions = computed(() =>
  [...props.members]
    .sort((a, b) => a.callsign.localeCompare(b.callsign, undefined, { numeric: true }))
    .map((member) => {
      const boundTo = props.boundNodes.get(member.id);
      const elsewhere = boundTo !== undefined && (props.node === null || boundTo !== props.node.nodeId);
      return {
        value: member.id,
        title: `${member.callsign} · ${member.displayName}`,
        // Vuetify passes `props` to the list item: the subtitle shows the short name and why a member is unavailable.
        props: { disabled: elsewhere, subtitle: [member.shortName, elsewhere ? `has node ${boundTo}` : null].filter(Boolean).join(" · ") },
      };
    }),
);
const title = computed(() => (props.node === null ? "Bind a node in advance" : `Bind ${props.node.longName ?? props.node.nodeId}`));

async function save(): Promise<void> {
  if (nodeNum.value === null || memberId.value === null) return;
  saving.value = true;
  error.value = null;
  try {
    // A node Core has not stored yet is bound with version 0.
    await props.bind(nodeNum.value, memberId.value, props.node?.version ?? 0);
    open.value = false;
  } catch (caught: unknown) {
    errors.value = fieldErrors(caught);
    error.value = describeError(caught);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="520">
    <v-card class="pa-2">
      <v-card-title class="text-title-large font-weight-medium text-wrap">{{ title }}</v-card-title>
      <v-card-text>
        <v-alert v-if="error !== null" type="error" density="compact" class="mb-4">{{ error }}</v-alert>
        <p v-if="node !== null" class="text-body-medium mb-4">
          {{ node.nodeId }}<template v-if="node.shortName !== null"> · {{ node.shortName }}</template>
        </p>
        <v-text-field
          v-else
          v-model="nodeInput"
          label="Node ID"
          placeholder="!a1b2c3d4"
          :error-messages="nodeError === null ? messagesFor(errors, 'nodeNum') : [nodeError]"
          autofocus
        >
          <template #append-inner>
            <InfoHint label="About the node ID" text="The Meshtastic apps show it in the node's details, for example !a1b2c3d4. A decimal node number works too." />
          </template>
        </v-text-field>
        <v-autocomplete
          v-model="memberId"
          :items="memberOptions"
          label="Member"
          :error-messages="messagesFor(errors, 'memberId')"
          no-data-text="No member matches."
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" :disabled="saving" @click="open = false">Cancel</v-btn>
        <v-btn color="primary" :loading="saving" :disabled="nodeNum === null || memberId === null" @click="save">Bind</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
