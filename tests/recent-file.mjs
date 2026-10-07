import assert from "node:assert/strict";

export async function verifyRecentFile({ readRecentFile }) {
  let reads = 0;
  let requests = 0;
  let permission = "granted";
  let answer = "granted";
  const handle = {
    async queryPermission(options) { assert.deepEqual(options, { mode: "readwrite" }); return permission; },
    async requestPermission(options) { assert.deepEqual(options, { mode: "readwrite" }); requests++; return answer; },
    async getFile() { reads++; return new File([`current contents ${reads}`], "plan.triadic"); },
  };
  assert.equal(await (await readRecentFile(handle)).text(), "current contents 1");
  assert.equal(requests, 0, "既に許可済みなら再度許可を求めない");
  permission = "prompt";
  assert.equal(await (await readRecentFile(handle)).text(), "current contents 2", "以前の内容をキャッシュしない");
  assert.equal(requests, 1);
  answer = "denied";
  await assert.rejects(readRecentFile(handle), /読み書きが許可されません/);
  assert.equal(reads, 2, "書き込み許可の拒否後はファイルに触れず編集を開始しない");
  await assert.rejects(readRecentFile({ ...handle, requestPermission: undefined }), /読み書きが許可されません/);
  permission = "granted";
  for (const [name, message] of [["NotFoundError", /前回のファイルが見つかりません/], ["NotAllowedError", /読み書きが許可されません/], ["SecurityError", /読み書きが許可されません/]]) {
    await assert.rejects(readRecentFile({ ...handle, async getFile() { throw new DOMException("unavailable", name); } }), message);
  }
  await assert.rejects(readRecentFile({ ...handle, async getFile() { throw new DOMException("cancel", "AbortError"); } }), { name: "AbortError" });
  console.log("PASS: recent file reads, permission requests, denial, missing file and cancellation");
}
