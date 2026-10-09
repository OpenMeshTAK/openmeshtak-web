import type { InjectionKey, Ref } from "vue";

/** The place in the settings header, next to the title, where a section shows its actions. */
export const SETTINGS_HEADER_ACTIONS: InjectionKey<Readonly<Ref<HTMLElement | null>>> = Symbol("settings-header-actions");
