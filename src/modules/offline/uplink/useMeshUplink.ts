import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from "vue";
import { useSession } from "@/modules/auth/session";
import type { MeshNode } from "../meshtastic/mesh-nodes";
import type { RadioEvent } from "../meshtastic/radio-messages";
import { readHqIdentity, readUplinkEnabled, storeHqName, storeUplinkEnabled } from "./hq-identity";
import { observationOf } from "./mesh-observation";
import { emptyStatus, MeshUplink, type UplinkStatus } from "./mesh-uplink";
import { sendMeshObservations } from "./mesh-uplink.api";
import { indexedDbOutbox } from "./uplink-outbox";

/** What the signed-in session allows here; `unknown` while offline or before Core answered. */
export type UplinkAccess = "unknown" | "signed-out" | "denied" | "allowed";

/**
 * The mesh uplink of the Offline HQ view: forwards what the USB radio hears to Core while the
 * operator has switched it on for this event. The switch can only be turned on online and with
 * the `mesh-uplink.send` grant; once on, it stays on across reloads and keeps queuing while the
 * network is gone. Core authorizes every upload; the session check only decides what to offer.
 */
export function useMeshUplink(eventId: string, online: Readonly<Ref<boolean>>) {
  const session = useSession();
  const outbox = indexedDbOutbox(eventId);
  const status = shallowRef<UplinkStatus>(emptyStatus());
  const enabled = ref(readUplinkEnabled(eventId));
  const access = ref<UplinkAccess>("unknown");
  const hq = ref(readHqIdentity());
  const outboxError = ref<string | null>(null);

  const uplink = new MeshUplink(outbox, (observations) => sendMeshObservations(eventId, hq.value, observations), (next) => {
    status.value = next;
  });

  const canEnable = computed(() => online.value && access.value === "allowed");
  const canManageBindings = computed(() => online.value && session.state.status === "authenticated" && session.can("mesh-bindings.manage", eventId));

  async function checkAccess(): Promise<void> {
    if (!online.value) return;
    try {
      await session.refresh();
      access.value = session.state.status !== "authenticated" ? "signed-out" : session.can("mesh-uplink.send", eventId) ? "allowed" : "denied";
    } catch {
      // Core is unreachable although the browser reports a network; offer nothing yet.
      access.value = "unknown";
    }
  }

  async function enable(): Promise<void> {
    if (!canEnable.value) return;
    enabled.value = true;
    storeUplinkEnabled(eventId, true);
    await uplink.start();
  }

  /** Switching off deletes what is still queued: the outbox only exists while the uplink is on. */
  async function disable(): Promise<void> {
    enabled.value = false;
    storeUplinkEnabled(eventId, false);
    uplink.stop();
    await clear();
  }

  async function clear(): Promise<void> {
    try {
      await uplink.clear();
      outboxError.value = null;
    } catch (caught: unknown) {
      outboxError.value = caught instanceof Error ? caught.message : "The outbox could not be cleared.";
    }
  }

  function renameHq(name: string): void {
    hq.value = storeHqName(hq.value, name);
  }

  function observe(event: Extract<RadioEvent, { type: "packet" }>, node: MeshNode, receivedAt: Date): void {
    if (!enabled.value) return;
    const observation = observationOf(event, node, receivedAt);
    if (observation !== null) uplink.observe(observation);
  }

  watch(online, (isOnline) => {
    if (!isOnline) return;
    void checkAccess();
    uplink.wake();
  });

  onMounted(async () => {
    void checkAccess();
    if (enabled.value) {
      await uplink.start();
    } else {
      // An outbox left behind while the uplink is off (e.g. storage was reset) must not linger.
      await clear();
    }
  });
  onBeforeUnmount(() => uplink.stop());

  return { status, enabled, access, hq, canEnable, canManageBindings, outboxError, enable, disable, clear, renameHq, observe, checkAccess };
}
