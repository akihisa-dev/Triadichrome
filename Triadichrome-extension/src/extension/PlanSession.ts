import { emptyDataHistory, type DataHistoryStatus, type HistoryDeletion } from "../core/storage/dataHistory";
import { createBusinessSnapshot, deleteDataHistory, readDataHistory, readHistorySnapshot, recordDataHistory, restoreDataHistory, applyOperationSnapshot, readPlanContents, readSnapshotContents, applyPlanCommand } from "./planProcessing";
import type { PlanContents } from "../core/domain/plan";
import { writePlanChange, type OpenPlan } from "./planFile";
import { isAutomatic, validatePlanCommand, type PlanCommand } from "./planCommands";
export const OPERATION_HISTORY_LIMIT = 100;
type SavedOperation = { before: Uint8Array; after: Uint8Array };
export type SessionSnapshot = { contents: PlanContents | null; name: string; history: DataHistoryStatus; busy: boolean; historyError: string; canUndo: boolean; canRedo: boolean; operationRevision: number };
type Destination = () => Promise<FileSystemFileHandle>;
function operationContents(contents: PlanContents): string {
  // Conflict counters describe write sequencing, not a user-visible change.
  return JSON.stringify(contents, (key, value: unknown) =>
    ["details", "revision", "initiativeRevision", "rowRevision", "amountRevisions", "overrideRevisions"].includes(key) ? undefined : value);
}
/** Owns the saved document. Drafts and navigation never enter this store. */
export class PlanSession {
  private plan: OpenPlan | null = null;
  private snapshot: SessionSnapshot = { contents: null, name: "", history: emptyDataHistory, busy: false, historyError: "", canUndo: false, canRedo: false, operationRevision: 0 };
  private undoStack: SavedOperation[] = [];
  private redoStack: SavedOperation[] = [];
  private operationRevision = 0;
  private listeners = new Set<() => void>();
  private tail: Promise<void> = Promise.resolve();
  private pending = 0;
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(patch: Partial<SessionSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch, canUndo: this.undoStack.length > 0, canRedo: this.redoStack.length > 0, operationRevision: this.operationRevision };
    this.listeners.forEach(listener => listener());
  }
  private resetOperations() { this.undoStack = []; this.redoStack = []; this.operationRevision++; }
  private current(): OpenPlan { if (!this.plan) throw new Error("ファイルを開いてください。"); return this.plan; }
  async open(plan: OpenPlan): Promise<void> {
    if (this.pending) throw new Error("ファイルの処理が終わるまでお待ちください。");
    const history = await readDataHistory(plan.bytes);
    this.plan = plan;
    this.resetOperations();
    this.publish({ contents: this.contents(plan), name: plan.name, history, historyError: "" });
  }
  private contents(plan: OpenPlan): PlanContents {
    const { bytes, handle, name, destinationBytes, savedHistory, ...contents } = plan;
    void bytes; void handle; void name; void destinationBytes; void savedHistory;
    return contents;
  }
  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    this.pending++;
    this.publish({ busy: true });
    const task = this.tail.then(operation);
    const completion = task.then(() => {}, () => {}).then(() => { this.pending--; this.publish({ busy: this.pending > 0 }); });
    this.tail = completion;
    return completion.then(() => task);
  }
  /** Permission preparation stays in the user's click, before queued data work. */
  prepareSave(destination: Destination): Promise<void> {
    if (this.pending) return Promise.reject(new Error("ファイルの処理が終わるまでお待ちください。"));
    const current = this.current();
    const prepare = async () => {
      const handle = current.handle ?? await destination();
      if (!handle.name.toLowerCase().endsWith(".triadic")) throw new Error("拡張子は.triadicにしてください。");
      const permission = handle as FileSystemFileHandle & { requestPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState> };
      if (permission.requestPermission && await permission.requestPermission({ mode: "readwrite" }) !== "granted") throw new Error("ファイルへの保存を許可してください。");
      return { handle, ...(!current.handle ? { destinationBytes: new Uint8Array(await (await handle.getFile()).arrayBuffer()) } : {}) };
    };
    const prepared = prepare();
    void prepared.catch(() => {});
    return this.serialize(async () => { this.plan = { ...this.current(), ...await prepared }; });
  }
  getHandle(): FileSystemFileHandle | undefined { return this.plan?.handle; }
  async dispatch(command: PlanCommand, destination: Destination): Promise<PlanContents> {
    const current = this.current();
    validatePlanCommand(current, command);
    // Start the picker in the click, and reserve the queue before it resolves.
    const selected = !current.handle && !isAutomatic(command) ? destination().then(async handle => ({
      handle, destinationBytes: new Uint8Array(await (await handle.getFile()).arrayBuffer()),
    })) : Promise.resolve(null);
    void selected.catch(() => {});
    let entry: SavedOperation | undefined;
    return this.save(async plan => {
      const destinationPlan = await selected;
      const target = destinationPlan && !plan.handle ? { ...plan, ...destinationPlan } : plan;
      validatePlanCommand(target, command);
      const bytes = await applyPlanCommand(target.bytes, command, target.fiscalYear);
      if (operationContents(this.contents(plan)) !== operationContents(await readPlanContents(bytes))) {
        entry = { before: await createBusinessSnapshot(plan.bytes), after: await createBusinessSnapshot(bytes) };
      }
      return writePlanChange(target, target.handle!, bytes);
    }, destination, isAutomatic(command), () => {
      if (!entry) return;
      this.undoStack.push(entry);
      if (this.undoStack.length > OPERATION_HISTORY_LIMIT) this.undoStack.shift();
      this.redoStack = [];
    });
  }
  private save(operation: (current: OpenPlan, destination: Destination) => Promise<OpenPlan>, destination: Destination, automatic = false, committed?: () => void): Promise<PlanContents> {
    return this.serialize(async () => {
      const current = this.current();
      if (automatic) {
        const handle = current.handle as (FileSystemFileHandle & { queryPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState> }) | undefined;
        if (!handle) throw new Error("「保存を再試行」から保存先を選択してください。");
        if (handle.queryPermission && await handle.queryPermission({ mode: "readwrite" }) !== "granted") throw new Error("「保存を再試行」からファイルへの保存を許可してください。");
      }
      const saved = await operation(current, destination);
      const history = saved.savedHistory ?? this.snapshot.history;
      this.plan = saved;
      committed?.();
      const contents = this.contents(saved);
      this.publish({ contents, name: saved.name, history, historyError: "" });
      return contents;
    });
  }
  travelOperation(direction: -1 | 1, destination: Destination): Promise<PlanContents> {
    if (this.pending) return Promise.reject(new Error("保存が終わるまでお待ちください。"));
    const source = direction === -1 ? this.undoStack : this.redoStack;
    const target = direction === -1 ? this.redoStack : this.undoStack;
    const entry = source.at(-1);
    if (!entry) return Promise.reject(new Error(direction === -1 ? "取り消せる操作はありません。" : "やり直せる操作はありません。"));
    return this.save(async current => {
      const bytes = await applyOperationSnapshot(current.bytes, direction === -1 ? entry.before : entry.after);
      return writePlanChange(current, current.handle!, bytes);
    }, destination, true, () => {
      source.pop(); target.push(entry); this.operationRevision++;
    });
  }
  private historyChange(operation: (bytes: Uint8Array) => Promise<Uint8Array>, destination: Destination, committed?: () => void): Promise<PlanContents> {
    return this.save(async current => {
      const bytes = await operation(current.bytes);
      return bytes === current.bytes ? current : writePlanChange(current, current.handle!, bytes, { historyPrepared: true });
    }, destination, true, committed);
  }
  async checkpoint(force: boolean, destination: Destination): Promise<void> {
    try { await this.historyChange(bytes => recordDataHistory(bytes, new Date().toISOString(), force), destination); }
    catch (failure) { this.publish({ historyError: failure instanceof Error ? failure.message : "履歴を記録できませんでした。" }); throw failure; }
  }
  preview(id: number, _destination: Destination): Promise<PlanContents> {
    return this.serialize(async () => {
      const current = await this.recordCurrent();
      return readSnapshotContents(await readHistorySnapshot(current.bytes, id));
    });
  }
  private async recordCurrent(): Promise<OpenPlan> {
    const current = this.current();
    const status = await readDataHistory(current.bytes);
    if (!status.dirtySince) return current;
    const handle = current.handle as (FileSystemFileHandle & { queryPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState> }) | undefined;
    if (!handle || (handle.queryPermission && await handle.queryPermission({ mode: "readwrite" }) !== "granted")) throw new Error("「保存を再試行」からファイルへの保存を許可してください。");
    const bytes = await recordDataHistory(current.bytes, new Date().toISOString(), true);
    const saved = await writePlanChange(current, handle, bytes, { historyPrepared: true });
    const history = saved.savedHistory ?? this.snapshot.history;
    this.plan = saved;
    this.publish({ contents: this.contents(saved), history, historyError: "" });
    return saved;
  }
  restore(id: number, destination: Destination) { return this.historyChange(bytes => restoreDataHistory(bytes, id), destination, () => this.resetOperations()); }
  async deleteHistory(deletion: HistoryDeletion, destination: Destination): Promise<void> { await this.historyChange(bytes => deleteDataHistory(bytes, deletion), destination); }
  close(_destination: Destination): Promise<void> {
    return this.serialize(async () => {
      // A preceding save may create dirty state after close was clicked.
      await this.recordCurrent();
      this.plan = null;
      this.resetOperations();
      this.publish({ contents: null, name: "", history: emptyDataHistory, historyError: "" });
    });
  }
}
