<script setup lang="ts">
import { computed } from "vue";
import type { EditorPresence } from "../usePackageChangeSync";

/**
 * Who else has this event's map open: one round badge per person in their color, with what they
 * have selected in the tooltip. Several tabs of the same person count once.
 */
const props = defineProps<{
  editors: EditorPresence[];
  /** Name of a selected object, if this view knows it. */
  objectName: (objectId: string) => string | null;
}>();

const MAX_SHOWN = 4;

const people = computed(() => {
  const byUser = new Map<string, EditorPresence>();
  for (const editor of props.editors) {
    // Prefer the tab that has something selected.
    if (!byUser.has(editor.userId) || editor.objectId !== null) {
      byUser.set(editor.userId, editor);
    }
  }
  return [...byUser.values()].sort((a, b) => a.name.localeCompare(b.name));
});

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase() || "?";
}

function activity(editor: EditorPresence): string {
  const selected = editor.objectId === null ? null : props.objectName(editor.objectId);
  return selected === null ? `${editor.name} is viewing the map` : `${editor.name} is editing ${selected}`;
}
</script>

<template>
  <div v-if="people.length > 0" class="presence" :aria-label="`${people.length} other ${people.length === 1 ? 'person' : 'people'} editing`">
    <v-tooltip v-for="editor in people.slice(0, MAX_SHOWN)" :key="editor.userId" :text="activity(editor)" location="bottom">
      <template #activator="{ props: tooltip }">
        <span v-bind="tooltip" class="presence__badge" :style="{ backgroundColor: editor.color }">{{ initials(editor.name) }}</span>
      </template>
    </v-tooltip>
    <v-tooltip v-if="people.length > MAX_SHOWN" location="bottom">
      <template #activator="{ props: tooltip }">
        <span v-bind="tooltip" class="presence__badge presence__badge--more">+{{ people.length - MAX_SHOWN }}</span>
      </template>
      <div v-for="editor in people.slice(MAX_SHOWN)" :key="editor.userId">{{ activity(editor) }}</div>
    </v-tooltip>
  </div>
</template>

<style scoped>
.presence {
  display: flex;
  align-items: center;
}

.presence__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  margin-left: -6px;
  border-radius: 50%;
  border: 2px solid rgb(var(--v-theme-surface));
  color: #fff;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: default;
}

.presence__badge:first-child {
  margin-left: 0;
}

.presence__badge--more {
  color: rgb(var(--v-theme-on-surface));
  background: rgba(var(--v-theme-on-surface), 0.12);
}
</style>
