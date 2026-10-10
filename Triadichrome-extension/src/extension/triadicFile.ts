/** close() commits the write; abort on failure so an incomplete file is not kept. */
export async function writeTriadicFile(
  handle: Pick<FileSystemFileHandle, "createWritable">,
  data: Uint8Array,
  checkCurrent: () => Promise<Uint8Array | void> = async () => undefined,
): Promise<void> {
  // Copy only this view, including when it refers to part of a larger buffer.
  let writable: FileSystemWritableFileStream;
  try {
    writable = await handle.createWritable({ mode: "exclusive" } as FileSystemCreateWritableOptions);
  } catch (error) {
    if (error instanceof DOMException && error.name === "NoModificationAllowedError") throw new Error("同じファイルへの保存が進行中です。入力は保持しています。「保存を再試行」で再度保存できます。");
    throw error;
  }
  try {
    // Hold the writer lock through the comparison and commit.
    const checked = await checkCurrent();
    await writable.write(Uint8Array.from(checked ?? data).buffer);
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => undefined);
    throw error;
  }
}
