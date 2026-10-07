import assert from "node:assert/strict";

export function verifyHomeMotion({ HomeMotion, motionLine }) {
  const nodes = [{ page: "a", x: 250, y: 300 }, { page: "b", x: 550, y: 300 }];
  const edges = [{ from: "a", to: "b" }];
  const run = rate => {
    const motion = new HomeMotion(nodes, edges);
    for (let i = 0; i < rate * 5; i++) motion.advance(1 / rate);
    return motion;
  };
  const slow = run(30), fast = run(120);
  for (const key of ["a", "b"]) {
    assert.ok(Math.abs(slow.bodies.get(key).x - fast.bodies.get(key).x) < .1, "表示更新頻度で配置が変わらない");
  }
  const motion = new HomeMotion(nodes, edges, { a: { x: 350, y: 312 }, b: { x: 650, y: 312 } });
  assert.equal(motion.active, false, "保持した配置は再配置しない");
  motion.hold("a"); motion.release(); motion.advance(.05);
  assert.equal(motion.bodies.get("a").x, 350, "クリックだけでは配置を動かさない");
  motion.hold("a"); motion.move(100, 200);
  motion.advance(.05);
  assert.equal(motion.bodies.get("a").x, 100, "ドラッグ位置を固定する");
  assert.equal(motion.bodies.get("a").y, 200);
  motion.release();
  for (let i = 0; i < 60; i++) motion.advance(1 / 60);
  assert.notEqual(motion.bodies.get("a").x, 100, "離した項目はカーソルに依存せず動く");
  assert.notEqual(motion.bodies.get("b").x, 650, "つながる項目が追従する");
  for (let i = 0; i < 1800; i++) motion.advance(1 / 60);
  assert.equal(motion.active, false, "配置が収束して停止する");
  for (const body of motion.bodies.values()) assert.ok(Number.isFinite(body.x + body.y));
  const crowded = new HomeMotion(Array.from({ length: 12 }, (_, i) => ({ page: String(i), x: 500, y: 300 })), []);
  for (let i = 0; i < 1200; i++) crowded.advance(1 / 60);
  assert.ok([...crowded.bodies.values()].every(body => Number.isFinite(body.x + body.y)));
  assert.ok(new Set([...crowded.bodies.values()].map(body => body.x)).size > 1, "同じ位置からでも押し離す");
  const hub = new HomeMotion([{ page: "hub", x: 500, y: 308 }, ...Array.from({ length: 10 }, (_, i) => ({ page: String(i), x: 800, y: 308 }))], Array.from({ length: 10 }, (_, i) => ({ from: "hub", to: String(i) })));
  hub.advance(1 / 60);
  assert.ok(Math.abs(hub.bodies.get("hub").vx) < Math.abs(hub.bodies.get("0").vx), "接続の多い項目への引力の集中を抑える");
  const a = { x: 0, y: 0, width: 120, height: 32, sub: true };
  const b = { ...a, x: 10 };
  const values = motionLine(a, b).match(/-?\d+(?:\.\d+)?/g).map(Number);
  assert.ok(values[0] <= values[2], "近接した線を反転させない");
  assert.ok(!motionLine(a, a).includes("NaN"));
  console.log("PASS: home graph pointer response, settling, degree balance, refresh rate and line endpoints");
}
