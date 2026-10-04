import { test, expect, settleMotion, attachImage } from "./fixtures";

type MotionAction = { frame: number; selector: string; event?: "dragenter" | "dragleave" };

// Observe real rendered frames, without slowing, pausing or disabling animations.
async function sampleChange(body: HTMLElement, options: { observe: string; anchors?: string; actions: MotionAction[] }) {
  const samples: { opacity: number; positions: number[][]; text: string }[] = [];
  for (let frame = 0; frame < 48; frame++) {
    const node = body.querySelector<HTMLElement>(options.observe)!;
    samples.push({
      opacity: Number(getComputedStyle(node).opacity),
      positions: options.anchors ? Array.from(body.querySelectorAll(options.anchors), anchor => {
        const { x, y, width, height } = anchor.getBoundingClientRect();
        return [x, y, width, height];
      }) : [],
      text: node.textContent ?? "",
    });
    for (const action of options.actions.filter(action => action.frame === frame)) {
      const target = body.querySelector<HTMLElement>(action.selector)!;
      if (action.event) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(new File([""], "motion.triadic"));
        target.dispatchEvent(new DragEvent(action.event, { bubbles: true, cancelable: true, dataTransfer }));
      } else {
        target.click();
      }
    }
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  }
  return samples;
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test.describe(`連続アニメーション / ${reducedMotion}`, () => {
    test.use({ reducedMotion });

    test("開閉を途中で反転しても幅が飛ばず、本文がサイドバーに追従する", async ({ app }, testInfo) => {
      await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
      await expect(app.getByRole("main", { name: "ホーム", exact: true })).toBeVisible();
      await settleMotion(app.locator("body"));
      const result = await app.locator("body").evaluate(async body => {
        const trigger = body.querySelector<HTMLButtonElement>(".home-header button")!;
        const sidebar = body.querySelector<HTMLElement>(".sidebar-panel")!;
        const main = body.querySelector<HTMLElement>(".home-content")!;
        const targetWidth = body.querySelector<HTMLElement>(".sidebar-inner")!.getBoundingClientRect().width;
        const samples: { phase: number; width: number; gap: number; total: number }[] = [];
        const jumps: number[] = [];
        let phase = 0;
        let reversalWidth = 0;
        let closingInert = false;
        trigger.click();
        for (let frame = 0; frame < 90; frame++) {
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          const sideBox = sidebar.getBoundingClientRect();
          const mainBox = main.getBoundingClientRect();
          samples.push({ phase, width: sideBox.width, gap: mainBox.x - sideBox.right, total: sideBox.width + mainBox.width });
          if ((phase === 0 && sideBox.width > targetWidth * 0.4) || (phase === 1 && sideBox.width < reversalWidth * 0.7)) {
            reversalWidth = sideBox.width;
            trigger.click();
            await Promise.resolve();
            jumps.push(Math.abs(sidebar.getBoundingClientRect().width - sideBox.width));
            if (phase === 0) closingInert = sidebar.inert;
            phase++;
          }
          if (phase === 2 && Math.abs(sideBox.width - targetWidth) < 0.1) break;
        }
        return { samples, jumps, closingInert, targetWidth, phase };
      });
      await testInfo.attach("幅の推移", { body: JSON.stringify(result, null, 2), contentType: "application/json" });
      expect(result.phase).toBe(2);
      expect(result.jumps).toHaveLength(2);
      expect(result.jumps.every(jump => jump < 1)).toBe(true);
      expect(result.closingInert).toBe(true);
      for (const phase of [0, 1, 2]) {
        expect(result.samples.some(sample => sample.phase === phase && sample.width > 0 && sample.width < result.targetWidth)).toBe(true);
      }
      const total = result.samples[0]!.total;
      for (const sample of result.samples) {
        expect(Math.abs(sample.gap)).toBeLessThan(1);
        expect(sample.total).toBeCloseTo(total);
      }
      await settleMotion(app.locator("body"));
      await app.locator(".home-header button").click();
      await settleMotion(app.locator("body"));
      expect(await app.locator(".sidebar-panel").evaluate(node => node.getBoundingClientRect().width)).toBe(0);
      await expect(app.getByRole("navigation")).toHaveCount(0);
    });

    test("画面と案内はフェードを通り、連打した場合も最後の画面へ到達する", async ({ app }) => {
      const opening = await app.locator("body").evaluate(sampleChange, {
        observe: ".app-switch",
        actions: [{ frame: 0, selector: ".entry-open-button" }],
      });
      expect(opening.some(sample => sample.text.includes("ファイルを開く") && sample.opacity > 0 && sample.opacity < 0.9)).toBe(true);
      expect(opening.some(sample => sample.text.includes("画面テスト.triadic") && sample.opacity > 0 && sample.opacity < 0.9)).toBe(true);
      expect(opening.find(sample => sample.text.includes("画面テスト.triadic"))!.opacity).toBeLessThan(0.25);
      await settleMotion(app.locator("body"));
      await app.getByRole("button", { name: "サイドバーを開く" }).click();
      await settleMotion(app.locator("body"));

      const pages = await app.locator("body").evaluate(sampleChange, {
        observe: ".page-switch",
        actions: [
          { frame: 0, selector: ".sidebar-navigation button:nth-child(2)" },
          { frame: 2, selector: ".sidebar-navigation button:nth-child(1)" },
          { frame: 4, selector: ".sidebar-navigation button:nth-child(2)" },
          { frame: 5, selector: ".sidebar-navigation button:nth-child(1)" },
          { frame: 6, selector: ".sidebar-navigation button:nth-child(2)" },
        ],
      });
      expect(pages.some(sample => sample.text === "" && sample.opacity > 0 && sample.opacity < 0.9)).toBe(true);
      expect(pages.some(sample => sample.text.includes("施策入力") && sample.opacity > 0 && sample.opacity < 0.9)).toBe(true);
      expect(pages.find(sample => sample.text.includes("施策入力"))!.opacity).toBeLessThan(0.25);
      await expect(app.getByRole("main", { name: "施策入力", exact: true })).toBeVisible();
      await expect(app.getByRole("button", { name: "施策入力", exact: true })).toHaveAttribute("aria-current", "page");

      const closing = await app.locator("body").evaluate(sampleChange, {
        observe: ".app-switch",
        actions: [{ frame: 0, selector: ".sidebar-footer button" }],
      });
      expect(closing.some(sample => sample.text.includes("画面テスト.triadic") && sample.opacity > 0 && sample.opacity < 0.9)).toBe(true);
      expect(closing.find(sample => sample.text.includes("ファイルを開く"))!.opacity).toBeLessThan(0.25);
      await settleMotion(app.locator("body"));

      const drag = await app.locator("body").evaluate(sampleChange, {
        observe: ".entry-drop-title .fade-swap",
        actions: [{ frame: 0, selector: ".entry-page", event: "dragenter" as const }],
      });
      expect(drag.some(sample => sample.text.includes("ここにファイルをドロップ") && sample.opacity > 0 && sample.opacity < 0.9)).toBe(true);
      expect(drag.find(sample => sample.text.includes("ここで離して開く"))!.opacity).toBeLessThan(0.25);
      const dragEnd = await app.locator("body").evaluate(sampleChange, {
        observe: ".entry-drop-title .fade-swap",
        actions: [{ frame: 0, selector: ".entry-page", event: "dragleave" as const }],
      });
      expect(dragEnd.find(sample => sample.text.includes("ここにファイルをドロップ"))!.opacity).toBeLessThan(0.25);
    });

    test("エラーはフェードし、表示・消去で入口の位置が動かない", async ({ page, app }) => {
      await page.getByLabel("ファイル操作", { exact: true }).selectOption("invalid");
      await expect(page.getByRole("status")).toHaveText("操作できます");
      await expect(app.getByRole("button", { name: "ファイルを開く", exact: true })).toBeVisible();
      await settleMotion(app.locator("body"));
      const samples = await app.locator("body").evaluate(sampleChange, {
        observe: ".status-notice-layer .fade-swap",
        anchors: ".entry-logo, .entry-title, .entry-drop-zone",
        actions: [{ frame: 0, selector: ".entry-open-button" }],
      });
      await expect(app.getByRole("alert")).toHaveText("Triadicファイルを読み込めませんでした。");
      expect(samples[0]!.positions).toHaveLength(3);
      for (const sample of samples) expect(sample.positions).toEqual(samples[0]!.positions);
      expect(samples.some(sample => sample.text.length > 0 && sample.opacity > 0 && sample.opacity < 0.9)).toBe(true);
      const dismissal = await app.locator("body").evaluate(sampleChange, {
        observe: ".status-notice-layer .fade-swap",
        anchors: ".entry-logo, .entry-title, .entry-drop-zone",
        actions: [{ frame: 0, selector: ".status-notice button" }],
      });
      await expect(app.getByRole("alert")).toHaveCount(0);
      for (const sample of dismissal) expect(sample.positions).toEqual(samples[0]!.positions);
    });

    test("表内保存の成功・エラーと通知の消去で入力欄や表が動かない", async ({ page, app }, testInfo) => {
      await app.getByRole("button", { name: "ファイルを開く", exact: true }).click();
      await app.getByRole("button", { name: "サイドバーを開く" }).click();
      await app.getByRole("button", { name: "マスタ", exact: true }).click();
      await app.getByRole("button", { name: /^勘定科目マスタ/ }).click();
      await app.locator(".home-header button").click();
      for (const [code, name] of [["100", "売上高"], ["501", "消耗品費"]]) {
        await app.getByRole("textbox", { name: "科目コード", exact: true }).fill(code!);
        await app.getByRole("textbox", { name: "科目名", exact: true }).fill(name!);
        await app.getByRole("combobox", { name: "科目属性", exact: true }).selectOption("expense");
        await app.getByRole("button", { name: "登録", exact: true }).click();
        await expect(app.getByRole("button", { name: `${name}を編集` })).toBeVisible();
      }
      await app.getByRole("button", { name: "売上高を編集" }).click();
      const code = app.getByRole("textbox", { name: "売上高の科目コード", exact: true });
      await code.fill("501");
      await settleMotion(app.locator("body"));
      const options = {
        observe: ".status-notice-layer .fade-swap",
        anchors: ".account-master-form, .account-master-table thead, .account-master-table tbody",
        actions: [{ frame: 0, selector: ".account-master-table button[type=submit]" }],
      };
      const failure = await app.locator("body").evaluate(sampleChange, options);
      await expect(app.getByRole("alert")).toHaveText("同じ科目コードが登録されています。");
      const positions = failure[0]!.positions;
      expect(positions).toHaveLength(4);
      for (const sample of failure) expect(sample.positions).toEqual(positions);
      await code.fill("100");
      await app.getByRole("textbox", { name: "売上高の科目名", exact: true }).fill("売上");
      const saved = await app.locator("body").evaluate(sampleChange, options);
      await expect(app.getByRole("status")).toHaveText("勘定科目を保存しました。");
      await expect(app.getByRole("button", { name: "売上を編集" })).toBeFocused();
      for (const sample of saved) expect(sample.positions).toEqual(positions);
      await attachImage(testInfo, "位置が変わらない保存通知", await page.locator("#app-preview").screenshot());
      const dismissal = await app.locator("body").evaluate(sampleChange, {
        ...options, actions: [{ frame: 0, selector: ".status-notice button" }],
      });
      await expect(app.getByRole("status")).toHaveCount(0);
      for (const sample of dismissal) expect(sample.positions).toEqual(positions);
    });
  });
}
