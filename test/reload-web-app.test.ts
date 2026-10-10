import { afterEach, describe, expect, it, vi } from "vitest";
import { reloadWebApp } from "@/shared/version/reload-web-app";

describe("reloadWebApp", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function browser(registration?: { update: () => Promise<void>; installing: EventTarget | null; waiting: EventTarget | null }) {
    const reload = vi.fn();
    vi.stubGlobal("window", { location: { reload } });
    const getRegistration = vi.fn().mockResolvedValue(registration);
    vi.stubGlobal("navigator", { serviceWorker: { getRegistration } });
    return { reload, getRegistration };
  }

  it("reloads without service worker support", async () => {
    const { reload } = browser();
    vi.stubGlobal("navigator", {});
    await reloadWebApp();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("reloads when no app shell is registered", async () => {
    const { reload } = browser();
    await reloadWebApp();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("checks for a new shell before reloading", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const { reload } = browser({ update, installing: null, waiting: null });
    await reloadWebApp();
    expect(update).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(reload.mock.invocationCallOrder[0]!);
  });

  it("waits for the new shell to activate so navigation cannot return the old shell", async () => {
    const worker = Object.assign(new EventTarget(), { state: "installing" });
    const addListener = vi.spyOn(worker, "addEventListener");
    const { reload } = browser({ update: vi.fn().mockResolvedValue(undefined), installing: worker, waiting: null });
    const pending = reloadWebApp();
    await vi.waitFor(() => expect(addListener).toHaveBeenCalledWith("statechange", expect.any(Function)));
    worker.state = "installed";
    worker.dispatchEvent(new Event("statechange"));
    expect(reload).not.toHaveBeenCalled();
    worker.state = "activated";
    worker.dispatchEvent(new Event("statechange"));
    await pending;
    expect(reload).toHaveBeenCalledOnce();
  });

  it("still reloads when an update fails", async () => {
    const { reload } = browser({ update: vi.fn().mockRejectedValue(new Error("offline")), installing: null, waiting: null });
    await reloadWebApp();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("bounds the wait if a worker never activates", async () => {
    vi.useFakeTimers();
    const worker = Object.assign(new EventTarget(), { state: "installing" });
    const removeListener = vi.spyOn(worker, "removeEventListener");
    const { reload } = browser({ update: vi.fn().mockResolvedValue(undefined), installing: worker, waiting: null });
    const pending = reloadWebApp();
    await vi.advanceTimersByTimeAsync(10_000);
    await pending;
    expect(reload).toHaveBeenCalledOnce();
    expect(removeListener).toHaveBeenCalledWith("statechange", expect.any(Function));
  });
});
