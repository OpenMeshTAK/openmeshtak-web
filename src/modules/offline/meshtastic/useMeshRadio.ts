import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { applyRadioEvent, emptyMeshState, meshLiveItems, type MeshNode } from "./mesh-nodes";
import { WebSerialRadio, webSerialSupported, type RadioStatus } from "./web-serial-radio";

/** Clock tick for ages and staleness; positions themselves update as packets arrive. */
const TICK_MS = 10_000;

/**
 * The HQ radio connection for a view: connect/disconnect actions, the received nodes and their
 * map markers. Node state lives in memory only and is gone when the view closes.
 */
export function useMeshRadio() {
  const status = ref<RadioStatus>("idle");
  const message = ref<string | null>(null);
  const now = ref(new Date());
  const staleAfterMinutes = ref(30);
  const nodes = shallowRef<MeshNode[]>([]);
  const counters = ref({ undecodable: 0, invalid: 0 });
  const state = emptyMeshState();
  let timer: ReturnType<typeof setInterval> | undefined;

  const radio = new WebSerialRadio({
    onEvent(event) {
      if (applyRadioEvent(state, event, new Date())) {
        nodes.value = [...state.nodes.values()];
      }
      counters.value = { undecodable: radio.undecodableFrames, invalid: radio.invalidFrames };
    },
    onStatus(next, text) {
      status.value = next;
      message.value = text;
    },
  });

  const liveItems = computed(() => meshLiveItems(nodes.value, now.value, staleAfterMinutes.value * 60_000));

  onMounted(() => {
    timer = setInterval(() => {
      now.value = new Date();
    }, TICK_MS);
  });
  onBeforeUnmount(() => {
    clearInterval(timer);
    radio.dispose();
  });

  return {
    supported: webSerialSupported(),
    status,
    message,
    now,
    staleAfterMinutes,
    nodes,
    counters,
    liveItems,
    connect: () => radio.connect(),
    reconnect: () => radio.reconnect(),
    disconnect: () => radio.disconnect(),
  };
}
