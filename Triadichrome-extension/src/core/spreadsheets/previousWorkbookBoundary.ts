import JSZip from "jszip";
const MiB = 1024 * 1024;
export const previousWorkbookLimits = { entries: 2048, entryBytes: 8 * MiB, expandedBytes: 32 * MiB, rows: 100000, columns: 20, cells: 200000, tags: 1000000 };
const refuse = () => { throw new Error("前年入力フォーマットの処理量が上限を超えているか、不要な結合・構成が含まれています。フォーマットを出力し直してください。"); };
/** Bound the central directory before JSZip creates one object per archive entry. */
function inspectDirectory(bytes: Uint8Array): void {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
    if (view.getUint32(offset, true) === 0x06054b50 && offset + 22 + view.getUint16(offset + 20, true) === bytes.length) { end = offset; break; }
  }
  if (end < 0) throw new Error("Excelファイルを読み込めません。前年入力フォーマットを選択してください。");
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) refuse();
  const count = view.getUint16(end + 10, true), size = view.getUint32(end + 12, true), start = view.getUint32(end + 16, true);
  if (count > previousWorkbookLimits.entries || count !== view.getUint16(end + 8, true) || start + size !== end) refuse();
  let position = start, total = 0;
  const names = new Set<string>();
  for (let entry = 0; entry < count; entry++) {
    if (position + 46 > end || view.getUint32(position, true) !== 0x02014b50) refuse();
    const expanded = view.getUint32(position + 24, true);
    total += expanded;
    if (expanded > previousWorkbookLimits.entryBytes || total > previousWorkbookLimits.expandedBytes) refuse();
    const nameLength = view.getUint16(position + 28, true), extraLength = view.getUint16(position + 30, true), commentLength = view.getUint16(position + 32, true);
    const next = position + 46 + nameLength + extraLength + commentLength;
    if (next > end) refuse();
    const name = new TextDecoder().decode(bytes.subarray(position + 46, position + 46 + nameLength));
    if (!name || names.has(name) || name.startsWith("/") || name.includes("\\") || name.split("/").some(part => part === ".." || part === ".")) refuse();
    names.add(name); position = next;
  }
  if (position !== end) refuse();
}
/** Stream and stop at the actual expanded size, including forged ZIP size headers. */
async function boundedEntry(entry: JSZip.JSZipObject, budget: { bytes: number }): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const stream = (entry as JSZip.JSZipObject & { internalStream(type: "uint8array"): JSZip.JSZipStreamHelper<Uint8Array> }).internalStream("uint8array");
    const chunks: Uint8Array[] = [];
    let length = 0, stopped = false;
    stream.on("data", (chunk: Uint8Array) => {
      if (stopped) return;
      length += chunk.length; budget.bytes += chunk.length;
      if (length > previousWorkbookLimits.entryBytes || budget.bytes > previousWorkbookLimits.expandedBytes) {
        stopped = true; stream.pause(); chunks.length = 0;
        try { refuse(); } catch (error) { reject(error); }
        return;
      }
      chunks.push(chunk);
    }).on("error", (error: Error) => { stopped = true; chunks.length = 0; reject(error); }).on("end", () => {
      if (stopped) return;
      const bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      resolve(bytes);
    }).resume();
  });
}
const attribute = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([^"']*)\\1`))?.[2];
function coordinate(value: string): void {
  const match = value.match(/^([A-Z]{1,2})([1-9]\d{0,5})$/);
  if (!match) refuse();
  const column = [...match![1]!].reduce((number, letter) => number * 26 + letter.charCodeAt(0) - 64, 0);
  if (column > previousWorkbookLimits.columns || Number(match![2]) > previousWorkbookLimits.rows) refuse();
}
export async function inspectPreviousWorkbook(bytes: Uint8Array): Promise<void> {
  inspectDirectory(bytes);
  const archive = await JSZip.loadAsync(bytes);
  const budget = { bytes: 0 }; let cells = 0, tags = 0;
  for (const entry of Object.values(archive.files)) {
    if (entry.dir) continue;
    const expanded = await boundedEntry(entry, budget);
    if (!/\.(?:xml|rels)$/.test(entry.name)) continue;
    const xml = new TextDecoder("utf-8", { fatal: true }).decode(expanded);
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) refuse();
    for (const _tag of xml.matchAll(/<(?![!?/])[\w:.-]+(?:\s|\/?>)/g)) if (++tags > previousWorkbookLimits.tags) refuse();
    if (!/^xl\/worksheets\/[^/]+\.xml$/.test(entry.name)) continue;
    // The exported previous format has no merged cells, including its metadata sheet.
    if (/<(?:[\w.-]+:)?mergeCell\b/.test(xml)) refuse();
    for (const match of xml.matchAll(/<(?:[\w.-]+:)?(?:c|row|col|dimension)\b[^>]*>/g)) {
      const tag = match[0], name = tag.match(/^<(?:[\w.-]+:)?(\w+)/)![1];
      if (name === "c") { if (++cells > previousWorkbookLimits.cells) refuse(); coordinate(attribute(tag, "r") ?? ""); }
      else if (name === "row") { const row = attribute(tag, "r"); if (!row || !/^[1-9]\d{0,5}$/.test(row) || Number(row) > previousWorkbookLimits.rows) refuse(); }
      else if (name === "col") {
        for (const key of ["min", "max"]) { const column = attribute(tag, key); if (!column || !/^[1-9]\d*$/.test(column) || Number(column) > previousWorkbookLimits.columns) refuse(); }
      } else { const range = attribute(tag, "ref"); if (range) range.split(":").forEach(coordinate); }
    }
  }
}
