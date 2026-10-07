export type MotionNode = { page: string; x: number; y: number; width?: number; height?: number; sub?: boolean };
export type MotionEdge = { from: string; to: string };
type Body = { x: number; y: number; vx: number; vy: number; width: number; height: number; sub: boolean };

/** Fixed simulation steps keep pointer response and settling independent of display refresh rate. */
export class HomeMotion {
  readonly bodies: Map<string, Body>;
  private readonly links: { a: string; b: string; bias: number; strength: number }[];
  private heat: number;
  private remainder = 0;
  held: string | null = null;
  constructor(nodes: readonly MotionNode[], edges: readonly MotionEdge[], saved?: Record<string, { x: number; y: number }>) {
    this.bodies = new Map(nodes.map(node => [node.page, {
      x: saved?.[node.page]?.x ?? node.x + 100, y: saved?.[node.page]?.y ?? node.y + 12,
      vx: 0, vy: 0, width: node.width ?? 140, height: node.height ?? 72, sub: !!node.sub,
    }]));
    const degree = new Map(nodes.map(node => [node.page, 0]));
    for (const edge of edges) {
      degree.set(edge.from, degree.get(edge.from)! + 1);
      degree.set(edge.to, degree.get(edge.to)! + 1);
    }
    this.links = edges.map(edge => {
      const a = degree.get(edge.from)!, b = degree.get(edge.to)!;
      return { a: edge.from, b: edge.to, bias: b / (a + b), strength: 12 / Math.min(a, b) };
    });
    this.heat = saved ? 0 : 1;
  }
  get active() { return this.held !== null || this.heat > .002 || [...this.bodies.values()].some(body => Math.hypot(body.vx, body.vy) > .05); }
  hold(page: string) {
    this.held = page;
    const body = this.bodies.get(page)!;
    body.vx = body.vy = 0;
  }
  move(x: number, y: number) {
    if (!this.held) return;
    const body = this.bodies.get(this.held)!;
    body.x = x; body.y = y;
    this.heat = Math.max(this.heat, .65);
  }
  release() { this.held = null; }
  advance(seconds: number, reduced = false) {
    this.remainder += Math.min(.05, Math.max(0, seconds));
    while (this.remainder >= 1 / 120) {
      this.step(1 / 120, reduced);
      this.remainder -= 1 / 120;
    }
  }
  private step(dt: number, reduced: boolean) {
    const entries = [...this.bodies];
    const forces = new Map(entries.map(([page, body]) => [page, { x: (620 - body.x) * .22, y: (320 - body.y) * .22 }]));
    for (const link of this.links) {
      const a = this.bodies.get(link.a)!, b = this.bodies.get(link.b)!;
      const dx = b.x - a.x, dy = b.y - a.y, distance = Math.max(1, Math.hypot(dx, dy));
      const force = (distance - 165) * link.strength;
      const fa = forces.get(link.a)!, fb = forces.get(link.b)!;
      fa.x += dx / distance * force * link.bias; fa.y += dy / distance * force * link.bias;
      fb.x -= dx / distance * force * (1 - link.bias); fb.y -= dy / distance * force * (1 - link.bias);
    }
    for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
      const [aId, a] = entries[i]!, [bId, b] = entries[j]!;
      // A deterministic separation also handles exactly coincident nodes.
      const dx = a.x - b.x || .01, dy = a.y - b.y || .01;
      const distance = Math.max(32, Math.hypot(dx, dy));
      const repel = 6000 / distance;
      let fx = dx / distance * repel, fy = dy / distance * repel;
      const cy = dy + (a.sub ? 0 : 24) - (b.sub ? 0 : 24);
      const ox = (a.width + b.width) / 2 + 10 - Math.abs(dx);
      const oy = (a.height + b.height) / 2 + 10 - Math.abs(cy);
      if (ox > 0 && oy > 0) {
        if (ox < oy) fx += Math.sign(dx) * ox * 24;
        else fy += Math.sign(cy || dy) * oy * 24;
      }
      const fa = forces.get(aId)!, fb = forces.get(bId)!;
      fa.x += fx; fa.y += fy; fb.x -= fx; fb.y -= fy;
    }
    for (const [page, body] of entries) {
      if (page === this.held) { body.vx = body.vy = 0; continue; }
      const force = forces.get(page)!;
      const decay = Math.exp(-(reduced ? 18 : 6) * dt);
      body.vx = (body.vx + force.x * this.heat * dt) * decay;
      body.vy = (body.vy + force.y * this.heat * dt) * decay;
      body.x += body.vx * dt; body.y += body.vy * dt;
    }
    this.heat *= Math.exp(-dt * (reduced ? 2.5 : .85));
    if (!this.active) for (const body of this.bodies.values()) body.vx = body.vy = 0;
  }
  positions() { return Object.fromEntries([...this.bodies].map(([page, body]) => [page, { x: body.x, y: body.y }])); }
}

/** Clip both ends together so close nodes never produce a reversed line. */
export function motionLine(a: Body, b: Body) {
  const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
  if (distance < .001) return `M${a.x} ${a.y} L${a.x} ${a.y}`;
  const ux = dx / distance, uy = dy / distance;
  const inset = (body: Body) => body.sub
    ? Math.min(body.width / 2 / Math.max(.001, Math.abs(ux)), body.height / 2 / Math.max(.001, Math.abs(uy))) : 16;
  const start = inset(a), end = inset(b), ratio = Math.min(1, distance / (start + end));
  return `M${a.x + ux * start * ratio} ${a.y + uy * start * ratio} L${b.x - ux * end * ratio} ${b.y - uy * end * ratio}`;
}
