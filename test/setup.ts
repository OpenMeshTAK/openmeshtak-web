/** jsdom lacks ResizeObserver, which Vuetify layout components use. Tests never need real sizes. */
class ResizeObserverStub {
  public observe(): void {}
  public unobserve(): void {}
  public disconnect(): void {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
