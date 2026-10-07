import type { Socket } from "socket.io-client";
import { ref } from "vue";
import { connectRealtime, TAB_ID } from "@/shared/realtime/realtime";
import type { RemotePackageChange } from "./usePackageEditor";

/** A change Core announced for the event's Data Packages. */
export interface PackageChangeNotice extends RemotePackageChange {
  /** The changed package, or `null` when the package list changed. */
  packageId: string | null;
  tabId: string | null;
}

/** Another open editor tab of the same event. */
export interface EditorPresence {
  id: string;
  userId: string;
  name: string;
  color: string;
  packageId: string | null;
  objectId: string | null;
}

/**
 * Live collaboration for the map editors of one event. Calls `onRemoteChange` for every change
 * other tabs or people saved and `onReconnect` after an interruption, when notices may have been
 * missed. `others` lists who else is editing and what they selected; `reportSelection` shares
 * this tab's selection with them.
 */
export function usePackageChangeSync(
  eventId: string,
  onRemoteChange: (change: PackageChangeNotice) => void,
  onReconnect: () => void,
) {
  const others = ref<EditorPresence[]>([]);
  let socket: Socket | null = null;
  let selection: { packageId: string | null; objectId: string | null } = { packageId: null, objectId: null };

  function start(): void {
    let connectedBefore = false;
    socket = connectRealtime("/data-packages", { eventId });
    socket.on("changed", (change: PackageChangeNotice) => {
      if (change.tabId !== TAB_ID) {
        onRemoteChange(change);
      }
    });
    socket.on("presence", (editors: EditorPresence[]) => {
      others.value = editors.filter(({ id }) => id !== socket?.id);
    });
    socket.on("connect", () => {
      socket?.emit("presence", selection);
      if (connectedBefore) {
        onReconnect();
      }
      connectedBefore = true;
    });
    socket.on("disconnect", () => {
      others.value = [];
    });
  }

  function reportSelection(packageId: string | null, objectId: string | null): void {
    if (selection.packageId === packageId && selection.objectId === objectId) {
      return;
    }
    selection = { packageId, objectId };
    socket?.emit("presence", selection);
  }

  function stop(): void {
    socket?.disconnect();
    socket = null;
    others.value = [];
  }

  return { start, stop, others, reportSelection };
}
