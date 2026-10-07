<script setup lang="ts">
import { mdiArrowDown, mdiArrowUp, mdiDotsVertical, mdiDragVertical, mdiSwapHorizontal } from "@mdi/js";
import { ref, watch } from "vue";
import { VueDraggable } from "vue-draggable-plus";
import { shortNameNumber, type EventMemberDto } from "./members.api";

/**
 * One event group's members in short-name order. Dragging or the Move up/down actions send the
 * complete new order; Core assigns the numbers, so the Web never computes short names itself.
 */
const props = defineProps<{
  members: EventMemberDto[];
  groups: { id: string; name: string }[];
  groupId: string;
  canManage: boolean;
}>();
const emit = defineEmits<{
  reorder: [memberIds: string[]];
  move: [member: EventMemberDto, groupId: string];
}>();
defineSlots<{ actions(props: { member: EventMemberDto }): unknown }>();

const ordered = ref<EventMemberDto[]>([]);

watch(
  () => props.members,
  (members) => {
    ordered.value = [...members].sort((a, b) => shortNameNumber(a) - shortNameNumber(b));
  },
  { immediate: true },
);

function dropped(): void {
  emit("reorder", ordered.value.map(({ id }) => id));
}

function shift(index: number, direction: -1 | 1): void {
  const ids = ordered.value.map(({ id }) => id);
  const target = index + direction;
  if (target < 0 || target >= ids.length) {
    return;
  }
  [ids[index], ids[target]] = [ids[target] as string, ids[index] as string];
  emit("reorder", ids);
}
</script>

<template>
  <v-card>
    <v-list lines="two" class="py-0">
      <VueDraggable
        v-model="ordered"
        :animation="180"
        handle=".member-handle"
        :disabled="!canManage"
        ghost-class="drag-ghost"
        chosen-class="drag-chosen"
        @end="dropped"
      >
        <!-- Only list items may be children here: Sortable counts every child element, so a divider
             between items would shift the drop index and save the wrong order. -->
        <v-list-item v-for="(member, index) in ordered" :key="member.id" class="member-row">
          <template #prepend>
            <v-icon v-if="canManage" :icon="mdiDragVertical" class="member-handle mr-1" aria-hidden="true" />
            <v-avatar color="primary" variant="tonal" size="36" class="mr-3 font-weight-medium">{{ member.shortName ?? "—" }}</v-avatar>
          </template>
          <v-list-item-title>{{ member.callsign }}</v-list-item-title>
          <v-list-item-subtitle>{{ member.displayName }} · {{ member.eventRole.name }}</v-list-item-subtitle>
          <template #append>
            <slot name="actions" :member="member" />
            <v-menu v-if="canManage">
              <template #activator="{ props: menu }">
                <v-btn v-bind="menu" :icon="mdiDotsVertical" variant="text" size="small" :aria-label="`Order of ${member.callsign}`" />
              </template>
              <v-list density="compact">
                <v-list-item title="Move up" :prepend-icon="mdiArrowUp" :disabled="index === 0" @click="shift(index, -1)" />
                <v-list-item title="Move down" :prepend-icon="mdiArrowDown" :disabled="index === ordered.length - 1" @click="shift(index, 1)" />
                <v-divider class="my-1" />
                <v-list-subheader>Move to group</v-list-subheader>
                <v-list-item
                  v-for="group in groups.filter(({ id }) => id !== groupId)"
                  :key="group.id"
                  :title="group.name"
                  :prepend-icon="mdiSwapHorizontal"
                  @click="emit('move', member, group.id)"
                />
              </v-list>
            </v-menu>
          </template>
        </v-list-item>
      </VueDraggable>
      <p v-if="ordered.length === 0" class="text-body-2 text-medium-emphasis pa-5 mb-0">No members in this group yet.</p>
    </v-list>
  </v-card>
</template>

<style scoped>
.member-handle {
  cursor: grab;
}

.member-row + .member-row {
  border-top: thin solid rgba(var(--v-border-color), var(--v-border-opacity));
}
</style>
