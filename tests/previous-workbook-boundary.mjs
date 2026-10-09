import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { withNodeBundle } from '../scripts/node-bundle.mjs';
export async function verifyPreviousWorkbookBoundary(api, plan) {
  const normal = await api.serializeWorkbook(api.createPreviousWorkbook(plan, [{ industryId: plan.industries[0].id, departmentId: plan.departments[0].id }]));
  const before = structuredClone(plan);
  const prototype = Object.getPrototypeOf(new ExcelJS.Workbook().xlsx), load = prototype.load;
  let loads = 0;
  prototype.load = function (...args) { loads++; return load.apply(this, args); };
  try {
    const refuse = async bytes => {
      const initial = loads;
      await assert.rejects(api.parsePreviousWorkbook(bytes, plan), /処理量|結合/);
      assert.equal(loads, initial, '危険な範囲をExcelJSのモデル展開前に拒否');
    };
    const mutate = async transform => {
      const zip = await JSZip.loadAsync(normal), name = 'xl/worksheets/sheet1.xml';
      zip.file(name, transform(await zip.file(name).async('string')));
      return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    };
    for (const range of ['A100:IV355', 'A1:XFD1048576']) {
      await refuse(await mutate(xml => xml.replace('</worksheet>', `<mergeCells count="1"><mergeCell ref="${range}"/></mergeCells></worksheet>`)));
    }
    for (const coordinate of ['A100001', 'U4']) await refuse(await mutate(xml => xml.replace('r="C4"', `r="${coordinate}"`)));
    await refuse(await mutate(xml => xml.replace('<sheetData>', '<cols><col min="1" max="16384" width="10"/></cols><sheetData>')));
    const replaceColumn = (xml, attributes) => xml.replace('<sheetData>', `<cols><col ${attributes} width="10"/></cols><sheetData>`);
    for (const attributes of [
      'min="1" data-max="20" max="21"',
      'min="1" max="21" data-max="20"',
      "min='1' data-max='20' max='21'",
      'min="1" other:max="20" max="21"',
      'min="1" data-note="max=\'20\'" max="21"',
      'min="1" data-note=\'max="20">\' max="21"',
      'data-min="1" min="21" max="20"',
      'min="1" data-max="20" max="&#50;&#49;"',
    ]) await refuse(await mutate(xml => replaceColumn(xml, attributes)));
    for (const attributes of [
      'min="1" data-max="21" max="1"',
      'min="1" max="1" data-max="21"',
      "min='1' data-max='21' max='1'",
      'min="1" other:max="21" max="1"',
      'min="1" data-note="max=\'21\'" max="1"',
      'min="1" max="&#49;"',
    ]) assert.deepEqual(await api.parsePreviousWorkbook(await mutate(xml => replaceColumn(xml, attributes)), plan), []);
    await refuse(await mutate(xml => xml.replace('r="C4"', 'data-r="C4" r="U4"')));
    await refuse(await mutate(xml => xml.replace('<row r="4"', '<row data-r="4" r="100001"')));
    await refuse(await mutate(xml => xml.replace(/<dimension\s[^>]*>/, '<dimension data-ref="A1" ref="U1"/>')));
    await refuse(await mutate(xml => xml.replace('</sheetData>', '<row r="4">' + '<c r="A4"/>'.repeat(200001) + '</row></sheetData>')));
    const inflated = await JSZip.loadAsync(normal); inflated.file('oversized.xml', ' '.repeat(9 * 1024 * 1024));
    const bomb = await inflated.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    await refuse(bomb);
    const total = new JSZip(); for (let i = 0; i < 5; i++) total.file(`size${i}`, 'x');
    const totalBytes = await total.generateAsync({ type: 'uint8array' }), totalView = new DataView(totalBytes.buffer);
    for (let i = 0; i < totalBytes.length - 46; i++) if (totalView.getUint32(i, true) === 0x02014b50) totalView.setUint32(i + 24, 7 * 1024 * 1024, true);
    await refuse(totalBytes);

    const forged = bomb.slice(), view = new DataView(forged.buffer);
    for (let i = 0; i < forged.length - 46; i++) if (view.getUint32(i, true) === 0x02014b50) {
      const name = new TextDecoder().decode(forged.subarray(i + 46, i + 46 + view.getUint16(i + 28, true)));
      if (name === 'oversized.xml') view.setUint32(i + 24, 1, true);
    }
    await refuse(forged); // Actual streamed size must also be bounded when declared sizes lie.
    const many = new JSZip(); for (let i = 0; i < 2049; i++) many.file(`entry${i}`, '');
    await refuse(await many.generateAsync({ type: 'uint8array' }));
    await refuse(await mutate(xml => '<!DOCTYPE worksheet [<!ENTITY x "text">]>' + xml));
    assert.deepEqual(plan, before, '拒否で計画を変更しない');
    const initial = loads;
    assert.deepEqual(await api.parsePreviousWorkbook(normal, plan), []);
    assert.equal(loads, initial + 1, '拒否後の正常な再取り込みはExcelJSへ進む');
  } finally { prototype.load = load; }
  console.log('previous workbook boundary ok: merges, coordinates, cells, ZIP entries, expansion and retry');
}

export async function verifyPreviousWorkbookProcessing() {
  await withNodeBundle('Triadichrome-extension/src/extension/previousWorkbookProcessing.ts', async ({ processPreviousWorkbook }) => {
    const original = { Worker: globalThis.Worker, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
    let active, timeout, terminated = 0;
    class FakeWorker { constructor() { active = this; } postMessage() {} terminate() { terminated++; } }
    globalThis.Worker = FakeWorker;
    globalThis.setTimeout = (callback, ms) => { assert.equal(ms, 30000); timeout = callback; return 1; };
    globalThis.clearTimeout = () => {};
    try {
      let result = processPreviousWorkbook(new Uint8Array(), {}); timeout();
      await assert.rejects(result, /30秒/); assert.equal(terminated, 1);
      result = processPreviousWorkbook(new Uint8Array(), {}); active.onerror();
      await assert.rejects(result, /入力は保持/); assert.equal(terminated, 2);
      result = processPreviousWorkbook(new Uint8Array(), {}); active.onmessage({ data: { patches: [] } });
      assert.deepEqual(await result, []); assert.equal(terminated, 3);
    } finally { Object.assign(globalThis, original); }
  });
}
