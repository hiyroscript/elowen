const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { server, root } = require("./server.cjs");
(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/elowen/`;
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.ELOWEN_BROWSER_PATH
      ? {
          executablePath: process.env.ELOWEN_BROWSER_PATH,
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        }
      : {}),
  });
  try {
    const context = await browser.newContext({
      colorScheme: "dark",
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    const theme = () => page.locator("html").getAttribute("data-theme");
    await page.goto(base);
    assert.equal(await theme(), "dark");
    assert.equal(await page.locator(".moon-icon").isVisible(), true);
    await page.emulateMedia({ colorScheme: "light" });
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "light",
    );
    assert.equal(await page.locator(".sun-icon").isVisible(), true);
    await page
      .getByRole("button", { name: "Switch to dark mode" })
      .press("Enter");
    assert.equal(await theme(), "dark");
    assert.equal(
      await page
        .locator(".theme-toggle")
        .evaluate((e) => getComputedStyle(e).outlineStyle),
      "solid",
    );
    await page.reload();
    assert.equal(await theme(), "dark");
    await page.goto(base + "calculator.html");
    assert.equal(await theme(), "dark");
    // Explicit theme survives a fresh browser context with opposite system preference.
    const saved = await context.storageState();
    const reopened = await browser.newContext({
      storageState: saved,
      colorScheme: "light",
    });
    const second = await reopened.newPage();
    // Pause at the stylesheet: the head scripts must already have chosen dark mode.
    let reached;
    const atStyle = new Promise((resolve) => {
      reached = resolve;
    });
    let release;
    const hold = new Promise((resolve) => {
      release = resolve;
    });
    await second.route("**/css/styles.css", async (route) => {
      reached();
      await hold;
      await route.continue();
    });
    const navigation = second.goto(base).catch((error) => error);
    await atStyle;
    await second.waitForFunction(
      () => document.documentElement.dataset.theme === "dark",
    );
    assert.equal(
      await second.evaluate(() => document.documentElement.dataset.theme),
      "dark",
    );
    release();
    await navigation;
    await reopened.close();
    const backup = await page.evaluate(() => JSON.parse(ElowenStore.export()));
    assert.equal(backup.data.preferences.theme, "dark");
    await page.goto(base + "data.html");
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await page.locator("#import-file").setInputFiles({
      name: "theme.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await page.locator("#import-data").click();
    await page.locator('dialog [value="confirm"]').click();
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "dark",
    );
    delete backup.data.preferences.theme;
    await page.locator("#import-file").setInputFiles({
      name: "legacy.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
    await page.locator("#import-data").click();
    await page.locator('dialog [value="confirm"]').click();
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "light",
    );
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await page.locator("#clear-data").click();
    await page.locator('dialog [value="confirm"]').click();
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "light",
    );
    await fs.mkdir(path.join(root, "test-results"), { recursive: true });
    for (const mode of ["light", "dark"]) {
      if ((await theme()) !== mode) await page.locator(".theme-toggle").click();
      for (const viewport of [
        { width: 1440, height: 1000 },
        { width: 390, height: 844 },
        { width: 844, height: 390 },
        { width: 320, height: 568 },
      ]) {
        await page.setViewportSize(viewport);
        for (const file of [
          "index.html",
          "calculator.html",
          "data.html",
          "privacy.html",
          "terms.html",
          "404.html",
        ]) {
          await page.goto(base + file);
          assert.equal(await theme(), mode);
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            `${mode} ${file} at ${viewport.width}`,
          );
          assert.equal(await page.locator(".theme-toggle").count(), 1);
          assert.equal(
            await page
              .locator(".theme-toggle")
              .evaluate(
                (e) =>
                  e.getBoundingClientRect().width >= 44 &&
                  e.getBoundingClientRect().height >= 44,
              ),
            true,
          );
          assert.equal(
            await page
              .locator("html")
              .evaluate((e) => getComputedStyle(e).colorScheme),
            mode,
          );
          if (file === "calculator.html") {
            await page.locator("#expression").fill("sqrt(16)+2^3");
            await page.locator("#expression").press("Enter");
            assert.equal(await page.locator("#result").textContent(), "12");
            await page.locator("#expression").fill("1/0");
            await page.locator("#expression").press("Enter");
            assert.equal(await page.locator("#calc-error").isVisible(), true);
            await page.locator("#scientific").evaluate((e) => (e.open = true));
          }
          if (
            [1440, 390].includes(viewport.width) &&
            ["index.html", "calculator.html", "data.html"].includes(file)
          ) {
            await page.screenshot({
              path: path.join(
                root,
                `test-results/${mode}-${file}-${viewport.width}.png`,
              ),
              fullPage: true,
            });
          }
        }
      }
      await page.goto(base + "data.html");
      await page.locator("#clear-data").click();
      assert.equal(await page.locator("dialog").isVisible(), true);
      await page.screenshot({
        path: path.join(root, `test-results/${mode}-dialog.png`),
      });
      await page.locator('dialog [value="cancel"]').click();
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await page
        .locator(".theme-toggle")
        .evaluate((e) => getComputedStyle(e).transitionDuration),
      "0s",
    );
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await context.setOffline(true);
    await page.goto(base + "calculator.html");
    assert.equal(await theme(), "dark");
    await page.locator(".theme-toggle").click();
    assert.equal(await theme(), "light");
    await context.setOffline(false);
    assert.deepEqual(errors, []);
    const blocked = await browser.newContext({ colorScheme: "dark" });
    await blocked.addInitScript(() =>
      Object.defineProperty(window, "localStorage", {
        get() {
          throw Error("Blocked");
        },
      }),
    );
    const privatePage = await blocked.newPage();
    await privatePage.goto(base);
    await privatePage
      .getByRole("button", { name: "Switch to light mode" })
      .click();
    assert.equal(
      await privatePage.locator("html").getAttribute("data-theme"),
      "light",
    );
    await blocked.close();
    await context.close();
    console.log(
      "Theme checks passed: system preference, explicit choice, early application, navigation/reopen, old/new imports, clearing, both themes on six pages at four sizes, SVG icons, keyboard focus, reduced motion, offline and blocked storage.",
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
