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
