<script setup lang="ts">
import { computed } from "vue";
import type { AudienceOption, EventAudience } from "./audience-options";

/**
 * Selects any union of event groups, roles and individual members in one field; a badge names the
 * kind of each choice, so a group and a member with the same name stay apart.
 */
const audience = defineModel<EventAudience>({ required: true });

const props = defineProps<{
  groups: AudienceOption[];
  roles: AudienceOption[];
  /** `null` when the viewer may not list members; individual members are then not selectable. */
  members: AudienceOption[] | null;
  disabled?: boolean;
  errors?: string[];
  label?: string;
}>();

type Kind = "Group" | "Role" | "Member";
const KEYS = { Group: "groupIds", Role: "roleIds", Member: "memberIds" } as const;
const COLORS: Record<Kind, string> = { Group: "primary", Role: "secondary", Member: "info" };

const items = computed(() => [
  ...props.groups.map(({ id, title }) => ({ value: `Group:${id}`, title, kind: "Group" as Kind })),
  ...props.roles.map(({ id, title }) => ({ value: `Role:${id}`, title, kind: "Role" as Kind })),
  ...(props.members ?? []).map(({ id, title }) => ({ value: `Member:${id}`, title, kind: "Member" as Kind })),
]);

const selected = computed<string[]>({
  get: () => [
    ...audience.value.groupIds.map((id) => `Group:${id}`),
    ...audience.value.roleIds.map((id) => `Role:${id}`),
    ...audience.value.memberIds.map((id) => `Member:${id}`),
  ],
  set: (values) => {
    const next: EventAudience = { ...audience.value, groupIds: [], roleIds: [], memberIds: [] };
    for (const value of values) {
      const [kind, id] = value.split(":") as [Kind, string];
      next[KEYS[kind]].push(id);
    }
    audience.value = next;
  },
});

const fieldLabel = computed(() => props.label ?? (props.members === null ? "Groups or roles" : "Groups, roles or members"));
</script>

<template>
  <v-autocomplete
    v-model="selected"
    :items="items"
    :label="fieldLabel"
    multiple
    chips
    closable-chips
    :disabled="disabled ?? false"
    :error-messages="errors ?? []"
  >
    <template #item="{ props: itemProps, item }">
      <v-list-item v-bind="itemProps" title="">
        <span class="d-inline-flex align-center ga-2">
          <v-chip size="x-small" label variant="tonal" :color="COLORS[item.kind]" class="audience-kind">{{ item.kind }}</v-chip>
          {{ item.title }}
        </span>
      </v-list-item>
    </template>
    <template #chip="{ props: chipProps, item }">
      <v-chip v-bind="chipProps" size="small" :color="COLORS[item.kind]" variant="tonal" label>
        {{ item.kind }} · {{ item.title }}
      </v-chip>
    </template>
  </v-autocomplete>
</template>

<style scoped>
.audience-kind {
  min-width: 56px;
  justify-content: center;
}
</style>
