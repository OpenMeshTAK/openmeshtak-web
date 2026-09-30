<script setup lang="ts">
import { onBeforeUnmount } from "vue";
import { setStepUpHandler } from "@/shared/api/step-up";
import ReauthenticateDialog from "./ReauthenticateDialog.vue";
import { requestStepUp, useStepUpDialog } from "./step-up";

/** Mounted once in `App.vue`: sensitive API calls ask for a fresh sign-in through this dialog. */
const dialog = useStepUpDialog();

setStepUpHandler(requestStepUp);
onBeforeUnmount(() => setStepUpHandler(null));

function onOpenChange(isOpen: boolean): void {
  if (!isOpen) {
    dialog.finish(false);
  }
}
</script>

<template>
  <ReauthenticateDialog
    :model-value="dialog.open.value"
    @update:model-value="onOpenChange"
    @confirmed="dialog.finish(true)"
  />
</template>
