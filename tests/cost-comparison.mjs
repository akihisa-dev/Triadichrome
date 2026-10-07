import assert from "node:assert/strict";

export async function verifyCostComparison(api) {
  const contents = await api.readPlanContents(await api.createSamplePlan(2026));
  const values = (table, name, month) => table.rows.find(row => row.name === name).values.map(value => value[month]);
  const filtered = api.buildCostComparison(api.filterPlan(contents, { industries: [1, 2], departments: [1] }), [1, 2]);
  assert.equal(values(filtered, "売上高", 4)[0], 2100);
  const primary = api.buildCostComparison(contents, [1]);
  assert.deepEqual(primary.labels, ["前年", "一次予算", "前年差"]);
  assert.deepEqual(values(primary, "売上高", 4), [25290, 25640, 350]);
  const confirmed = api.buildCostComparison(contents, [2]);
  assert.deepEqual(confirmed.labels, ["前年", "確定予算", "前年差"]);
  assert.deepEqual(values(confirmed, "売上高", 4), [25290, 25670, 380]);
  const both = api.buildCostComparison(contents, [1, 2]);
  assert.deepEqual(both.labels, ["前年", "一次予算", "確定予算", "前年差", "一次予算差"]);
  assert.deepEqual(values(both, "売上高", 4), [25290, 25640, 25670, 380, 30]);
  assert.deepEqual(values(both, "売上高", 5), [25290, 25646, 25546, 256, -100]);
  assert.deepEqual(api.buildCostComparison(contents, [2, 1]), both, "選択順を入れ替えても列と差の基準を維持する");
  assert.deepEqual(values(both, "通信運搬費", 4), [0, -2.5, -2.5, -2.5, 0]);
  assert.equal(values(both, "消耗品費", 3)[3], -1.251, "丸める前の1円精度で差を計算する");
  for (const row of both.rows) {
    for (const month of api.initiativeMonths) {
      const [prior, first, final, yearDifference, primaryDifference] = row.values.map(value => value[month]);
      if (prior === undefined || final === undefined) assert.equal(yearDifference, undefined);
      else if (row.kind === "ratio") assert.equal(yearDifference, final - prior);
      else assert.equal(yearDifference, api.addAmounts(final, -prior));
      if (first === undefined || final === undefined) assert.equal(primaryDifference, undefined);
      else if (row.kind === "ratio") assert.equal(primaryDifference, final - first);
      else assert.equal(primaryDifference, api.addAmounts(final, -first));
    }
  }
  const unconfigured = both.rows.find(row => !row.configured);
  assert.ok(unconfigured);
  assert.deepEqual(unconfigured.values.slice(-2), [{}, {}], "未設定集計の差は空欄");
  const zero = api.buildCostComparison(await api.readPlanContents(await api.createTriadicDatabase(2026)), [1, 2]);
  assert.deepEqual(values(zero, "売上高", 4), [0, 0, 0, 0, 0]);
  assert.deepEqual(values(zero, "利益率", 4), [undefined, undefined, undefined, undefined, undefined], "分母0の利益率の差を0にしない");
  assert.equal(api.formatRate(1.25, true), "1.3pt");
  for (const amount of [0, -0, 0.001, -0.499, "0", "-0.001", undefined]) {
    assert.equal(api.formatTableAmount(amount), "", "表示上0の金額・差額は空白");
  }
  for (const [amount, expected] of [[0.5, "1"], [-0.5, "-1"], [1234.5, "1,235"], ["-1234.5", "-1,235"]]) {
    assert.equal(api.formatTableAmount(amount), expected, "非0は従来の千円表示を保つ");
  }
  for (const amount of [0, -0.001, 0.049, undefined]) {
    assert.equal(api.formatTableRate(amount), "");
    assert.equal(api.formatTableRate(amount, true), "");
  }
  assert.equal(api.formatTableRate(-0.05, true), "-0.1pt");
  assert.equal(api.formatTableRate(1.25), "1.3%");
  assert.equal(api.formatAmount(0), "0", "他の画面の0表示は維持");
  assert.deepEqual(values(zero, "売上高", 4), [0, 0, 0, 0, 0], "表示で計算値は変更しない");
}
