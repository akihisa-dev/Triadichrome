/** close() commits the write; abort on failure so an incomplete file is not kept. */
export async function writeTriadicFile(
  handle: Pick<FileSystemFileHandle, "createWritable">,
  data: Uint8Array,
  checkCurrent: () => Promise<void> = async () => undefined,
): Promise<void> {
  // Copy only this view, including when it refers to part of a larger buffer.
  const buffer = Uint8Array.from(data).buffer;
  let writable: FileSystemWritableFileStream;
  try {
    writable = await handle.createWritable({ mode: "exclusive" } as FileSystemCreateWritableOptions);
  } catch (error) {
    if (error instanceof DOMException && error.name === "NoModificationAllowedError") throw new Error("別の操作がファイルを保存中です。入力を保持したまま、保存を再試行してください。");
    throw error;
  }
  try {
    // Hold the writer lock through the comparison and commit.
    await checkCurrent();
    await writable.write(buffer);
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => undefined);
    throw error;
  }
}
