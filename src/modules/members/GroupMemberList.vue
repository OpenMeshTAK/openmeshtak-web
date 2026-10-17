<script setup lang="ts">
import { mdiArrowDown, mdiArrowUp, mdiCheckCircle, mdiDotsVertical, mdiDragVertical, mdiSwapHorizontal } from "@mdi/js";
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
    <!-- Looks like the "All members" table; a plain table because the rows must be draggable. -->
    <v-table class="app-table" density="comfortable">
      <thead>
        <tr>
          <th v-if="canManage" class="handle-column"><span class="d-sr-only">Drag to reorder</span></th>
          <th>Short name</th>
          <th>Callsign</th>
          <th>Role</th>
          <th>TAK app</th>
          <th class="text-right">Actions</th>
        </tr>
      </thead>
      <!-- Only rows may be children here: Sortable counts every child element, so anything else
           between rows would shift the drop index and save the wrong order. -->
      <VueDraggable
        v-model="ordered"
        tag="tbody"
        :animation="180"
        handle=".member-handle"
        :disabled="!canManage"
        ghost-class="drag-ghost"
        chosen-class="drag-chosen"
        @end="dropped"
      >
        <tr v-for="(member, index) in ordered" :key="member.id">
          <td v-if="canManage" class="handle-column">
            <v-icon :icon="mdiDragVertical" class="member-handle" aria-hidden="true" />
          </td>
          <td class="font-weight-medium">{{ member.shortName ?? "—" }}</td>
          <td>
            <div class="font-weight-medium">{{ member.callsign }}</div>
            <div v-if="member.callsignOverride" class="text-body-small text-medium-emphasis">Callsign override</div>
          </td>
          <td>{{ member.eventRole.name }}</td>
          <td>
            <span v-if="member.enrolledTakApps > 0" class="d-inline-flex align-center ga-1 text-no-wrap">
              <v-icon :icon="mdiCheckCircle" size="16" color="success" aria-hidden="true" />
              {{ member.enrolledTakApps === 1 ? "Enrolled" : `${member.enrolledTakApps} apps enrolled` }}
            </span>
            <span v-else class="text-medium-emphasis text-no-wrap">Not enrolled</span>
          </td>
          <td class="text-right text-no-wrap">
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
          </td>
        </tr>
      </VueDraggable>
    </v-table>
    <p v-if="ordered.length === 0" class="text-body-medium text-medium-emphasis pa-5 my-0">No members in this group yet.</p>
  </v-card>
</template>

<style scoped>
.handle-column {
  width: 44px;
  padding-right: 0 !important;
}

.member-handle {
  cursor: grab;
}
</style>
