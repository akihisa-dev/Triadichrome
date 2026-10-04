export type AutoSaveState<T> = {
  draft: T | null;
  pending: boolean;
  saving: boolean;
  error: string;
};

/** Coalesce edits and serialize writes. A completed older write never replaces newer input. */
export class AutoSave<T> {
  private state: AutoSaveState<T> = { draft: null, pending: false, saving: false, error: "" };
  private saved: T | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  private composing = false;
  constructor(private save: (draft: T) => Promise<void>, private delay = 600) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(state: AutoSaveState<T>) { this.state = state; this.listeners.forEach(listener => listener()); }
  private equal(a: T | null, b: T | null) { return JSON.stringify(a) === JSON.stringify(b); }
  begin(draft: T) {
    if (this.state.pending) return;
    this.saved = draft;
    this.publish({ draft, pending: false, saving: false, error: "" });
  }
  change(draft: T) {
    clearTimeout(this.timer);
    this.publish({ ...this.state, draft, pending: this.state.saving || !this.equal(draft, this.saved), error: "" });
    if (this.state.pending && !this.composing) this.timer = setTimeout(() => { void this.flush(); }, this.delay);
  }
  async flush() {
    clearTimeout(this.timer);
    if (this.composing || this.state.saving || !this.state.pending || this.state.draft === null) return;
    const draft = this.state.draft;
    this.publish({ ...this.state, saving: true, error: "" });
    try {
      await this.save(draft);
      this.saved = draft;
      const pending = !this.equal(this.state.draft, draft);
      this.publish({ ...this.state, pending, saving: false, error: "" });
      if (pending && !this.composing) this.timer = setTimeout(() => { void this.flush(); }, this.delay);
    } catch (error) {
      clearTimeout(this.timer);
      this.publish({ ...this.state, pending: true, saving: false, error: error instanceof Error ? error.message : "自動保存できませんでした。" });
    }
  }
  fail(error: unknown) {
    this.publish({ ...this.state, error: error instanceof Error ? error.message : "保存を許可できませんでした。" });
  }
  discard() {
    if (this.state.saving) return;
    clearTimeout(this.timer);
    this.publish({ draft: this.saved, pending: false, saving: false, error: "" });
  }
  end() {
    if (this.state.pending) return;
    clearTimeout(this.timer);
    this.saved = null;
    this.publish({ draft: null, pending: false, saving: false, error: "" });
  }
  cancelTimer() { clearTimeout(this.timer); }
  pause() { this.composing = true; this.cancelTimer(); }
  resume() { this.composing = false; if (this.state.draft !== null) this.change(this.state.draft); }
}
