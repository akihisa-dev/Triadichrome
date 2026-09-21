/** close() commits the write; abort on failure so an incomplete file is not kept. */
export async function writeTriadicFile(
  handle: Pick<FileSystemFileHandle, "createWritable">,
  data: Uint8Array,
): Promise<void> {
  // Copy only this view, including when it refers to part of a larger buffer.
  const buffer = Uint8Array.from(data).buffer;
  const writable = await handle.createWritable();
  try {
    await writable.write(buffer);
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => undefined);
    throw error;
  }
}

export async function requestWritePermission(handle: FileSystemFileHandle): Promise<void> {
  const permissionHandle = handle as FileSystemFileHandle & {
    requestPermission?: (options: { mode: "readwrite" }) => Promise<PermissionState>;
  };
  if (permissionHandle.requestPermission &&
      await permissionHandle.requestPermission({ mode: "readwrite" }) !== "granted") {
    throw new Error("自動保存にはファイルへの書き込み許可が必要です。");
  }
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export async function persistTriadicFile(
  handle: FileSystemFileHandle,
  data: Uint8Array,
  previous?: Uint8Array,
): Promise<void> {
  // Serialize this app's tabs, including the compare-before-write check.
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(`triadichrome-save:${handle.name}`, () =>
      persistUnlocked(handle, data, previous));
  }
  return persistUnlocked(handle, data, previous);
}

async function persistUnlocked(
  handle: FileSystemFileHandle,
  data: Uint8Array,
  previous?: Uint8Array,
): Promise<void> {
  if (previous) {
    const current = new Uint8Array(await (await handle.getFile()).arrayBuffer());
    if (!equalBytes(current, previous)) {
      throw new Error("元ファイルが別の場所で変更されています。編集内容は「別名で保存」で残してください。");
    }
  }
  await writeTriadicFile(handle, data);
  const saved = new Uint8Array(await (await handle.getFile()).arrayBuffer());
  if (!equalBytes(saved, data)) {
    throw new Error("保存した内容を確認できませんでした。編集内容は保持しています。別名で保存してください。");
  }
}
