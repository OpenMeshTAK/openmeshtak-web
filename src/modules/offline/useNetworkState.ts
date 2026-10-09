import { onBeforeUnmount, onMounted, ref } from "vue";

/**
 * Whether the browser reports a network connection. It cannot tell whether Core is reachable;
 * the offline views only use it to show the current state, never to decide anything.
 */
export function useNetworkState() {
  const online = ref(navigator.onLine);
  const update = (): void => {
    online.value = navigator.onLine;
  };
  onMounted(() => {
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
  });
  onBeforeUnmount(() => {
    window.removeEventListener("online", update);
    window.removeEventListener("offline", update);
  });
  return { online };
}
