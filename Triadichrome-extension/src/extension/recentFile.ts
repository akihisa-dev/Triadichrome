const DATABASE = "triadichrome-recent-file";
const STORE = "files";
const LAST_FILE = "last";

// IndexedDB can retain native file handles without copying the plan's contents.
async function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    let blocked = false;
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error("ファイルの記憶を読み込めませんでした。"));
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      if (blocked) database.close();
      else resolve(database);
    };
  });
}

async function accessStore(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest): Promise<unknown> {
  const database = await openStore();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE, mode);
      const request = operation(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error ?? new Error("ファイルの記憶を更新できませんでした。"));
      transaction.onerror = () => reject(transaction.error ?? request.error);
    });
  } finally {
    database.close();
  }
}

export async function loadRecentFile(): Promise<FileSystemFileHandle | null> {
  const handle = await accessStore("readonly", store => store.get(LAST_FILE)) as FileSystemFileHandle | undefined;
  if (!handle) return null;
  if (handle.kind !== "file" || typeof handle.name !== "string" || typeof handle.getFile !== "function") {
    throw new Error("記憶したファイルを読み込めませんでした。「ファイルを開く」から選び直してください。");
  }
  return handle;
}

export async function rememberRecentFile(handle: FileSystemFileHandle | null): Promise<void> {
  await accessStore("readwrite", store => handle ? store.put(handle, LAST_FILE) : store.delete(LAST_FILE));
}

type ReadableHandle = FileSystemFileHandle & {
  queryPermission?: (options: { mode: "read" }) => Promise<PermissionState>;
  requestPermission?: (options: { mode: "read" }) => Promise<PermissionState>;
};

// Call only from the user's click: checking startup history must not request access.
export async function readRecentFile(handle: ReadableHandle): Promise<File> {
  try {
    if (handle.queryPermission && await handle.queryPermission({ mode: "read" }) !== "granted") {
      if (!handle.requestPermission || await handle.requestPermission({ mode: "read" }) !== "granted") {
        throw new DOMException("読み取りが許可されていません。", "NotAllowedError");
      }
    }
    return await handle.getFile();
  } catch (failure) {
    if (failure instanceof DOMException) {
      if (failure.name === "NotAllowedError" || failure.name === "SecurityError") {
        throw new Error("ファイルの読み取りが許可されませんでした。「続きから」で許可するか、「ファイルを開く」から選び直してください。");
      }
      if (failure.name === "NotFoundError") {
        throw new Error("前回のファイルが見つかりません。移動・削除されている場合は「ファイルを開く」から選び直してください。");
      }
    }
    throw failure;
  }
}
