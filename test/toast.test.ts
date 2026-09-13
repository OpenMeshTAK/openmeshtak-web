import { beforeEach, describe, expect, it } from "vitest";
import { useToast, useToastQueue } from "@/shared/feedback/toast";

describe("toast service", () => {
  const queue = useToastQueue();
  const toast = useToast();

  beforeEach(() => {
    queue.value = [];
  });

  it("closes success toasts automatically and keeps errors until dismissed", () => {
    toast.success("Peter [Bravo] was updated.");
    toast.error("Saving failed.");

    expect(queue.value).toEqual([
      { text: "Peter [Bravo] was updated.", color: "success", timeout: 4000 },
      { text: "Saving failed.", color: "error", timeout: -1 },
    ]);
  });

  it("describes caught errors instead of showing raw values", () => {
    toast.error(new TypeError("Failed to fetch"));

    expect(queue.value[0]?.color).toBe("error");
    expect(queue.value[0]?.text).not.toContain("TypeError");
  });
});
