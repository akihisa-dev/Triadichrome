import fs from "node:fs/promises";
import path from "node:path";

/** Prepare on the target filesystem, then replace all outputs with rollback. */
export async function replaceBuildOutputs(entries, { io = fs, validatePrepared, validateInstalled } = {}) {
  const prepared = [];
  let preserveBackups = false;
  try {
    for (const entry of entries) {
      await io.mkdir(path.dirname(entry.target), { recursive: true });
      const temporary = await io.mkdtemp(path.join(path.dirname(entry.target), ".triadichrome-replace-"));
      const record = { ...entry, temporary, next: path.join(temporary, "next"), backup: path.join(temporary, "previous"), backedUp: false, installed: false };
      prepared.push(record);
      if (entry.source) await io.cp(entry.source, record.next, { recursive: true });
      else await io.writeFile(record.next, entry.bytes);
    }
    await validatePrepared?.(new Map(prepared.map(entry => [entry.target, entry.next])));
    for (const entry of prepared) {
      try { await io.lstat(entry.target); }
      catch (error) { if (error.code !== "ENOENT") throw error; entry.absent = true; }
      if (!entry.absent) { await io.rename(entry.target, entry.backup); entry.backedUp = true; }
      await io.rename(entry.next, entry.target); entry.installed = true;
    }
    await validateInstalled?.();
  } catch (failure) {
    const recoveryFailures = [];
    for (const entry of [...prepared].reverse()) {
      try {
        if (entry.installed) await io.rm(entry.target, { recursive: true, force: true });
        if (entry.backedUp) { await io.rename(entry.backup, entry.target); entry.backedUp = false; }
      } catch (error) {
        preserveBackups = true;
        recoveryFailures.push(new Error(`旧配布物の復元に失敗しました。退避先: ${entry.backup}`, { cause: error }));
      }
    }
    if (recoveryFailures.length) throw new AggregateError([failure, ...recoveryFailures], recoveryFailures.map(error => error.message).join("\n"));
    throw failure;
  } finally {
    for (const entry of prepared) {
      if (preserveBackups && entry.backedUp) continue;
      // Cleanup failure does not invalidate the already installed/restored outputs.
      try { await io.rm(entry.temporary, { recursive: true, force: true }); }
      catch (error) { console.warn(`一時配布物を削除できませんでした: ${entry.temporary}`, error.message); }
    }
  }
}
