const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
};
const server = http.createServer(async (req, res) => {
  let route = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  if (!route.startsWith("/elowen/")) {
    res.writeHead(404);
    res.end();
    return;
  }
  let file = path.join(root, route.slice(8) || "index.html");
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const body = await fs.readFile(file);
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file).toLowerCase()] || "text/plain",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/html" });
    res.end(await fs.readFile(path.join(root, "404.html")));
  }
});
(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/elowen/`;
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.ELOWEN_BROWSER_PATH
        ? {
            executablePath: process.env.ELOWEN_BROWSER_PATH,
            args: ["--no-sandbox", "--disable-dev-shm-usage"],
          }
        : {}),
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      acceptDownloads: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto(base);
    assert.equal(
      await page
        .locator(".brand img")
        .evaluate((img) => img.complete && img.naturalWidth > 0),
      true,
    );
    assert.equal((await page.request.get(base + "elowen.PNG")).status(), 200);
    await page.locator("#tool-search").fill("CALCULATOR");
    assert.equal(await page.locator(".tool-card:visible").count(), 1);
    await page.locator("#tool-search").fill("unknown");
    assert.equal(await page.locator("#no-tools").isVisible(), true);
    await page.locator("#tool-search").press("Escape");
    assert.equal(await page.locator(".tool-card:visible").count(), 1);
    await fs.mkdir(path.join(root, "test-results"), { recursive: true });
    await page.screenshot({
      path: path.join(root, "test-results/home-desktop.png"),
      fullPage: true,
    });
    await page.locator(".tool-card").click();
    const exp = page.locator("#expression");
    async function calc(source, expected) {
      await exp.fill(source);
      await exp.press("Enter");
      assert.equal(await page.locator("#result").textContent(), expected);
    }
    await calc("0.1+0.2", "0.3");
    await calc("(2+3)*4", "20");
    await page.locator('[data-memory="MS"]').click();
    await calc("5", "5");
    await page.locator('[data-memory="M+"]').click();
    await page.locator('[data-memory="M-"]').click();
    assert.match(await page.locator("#memory-status").textContent(), /20/);
    await page.locator('[data-key="clear"]').click();
    await page.locator('[data-memory="MR"]').click();
    await page.locator('[data-key="equals"]').click();
    assert.equal(await page.locator("#result").textContent(), "20");
    await page.locator("#scientific summary").click();
    await page.locator('[data-key="sqrt("]').click();
    await page.locator('[data-key="equals"]').click();
    assert.equal(await page.locator("#result").textContent(), "4.472135955");
    await calc("sin(30)", "0.5");
    await page.locator("#angle").selectOption("rad");
    await calc("sin(pi/2)", "1");
    await exp.fill("1/0");
    await exp.press("Enter");
    assert.match(
      await page.locator("#calc-error").textContent(),
      /divide by zero/,
    );
    await calc("7*6", "42");
    await page.reload();
    assert.equal(await exp.inputValue(), "7*6");
    assert.equal(await page.locator("#result").textContent(), "42");
    assert.equal(await page.locator("#angle").inputValue(), "rad");
    assert.equal(await page.locator("#scientific").getAttribute("open"), "");
    await page.locator("#history-list button").first().click();
    assert.equal(await exp.inputValue(), "42");
    await page.locator('[data-memory="MC"]').click();
    assert.equal(await page.locator('[data-memory="MR"]').isDisabled(), true);
    await page.locator('[data-key="clear"]').click();
    await page.locator("h1").click();
    await page.keyboard.type("12+3");
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#result").textContent(), "15");
    await page.screenshot({
      path: path.join(root, "test-results/calculator-desktop.png"),
      fullPage: true,
    });
    await page.goto(base + "data.html");
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#export-data").click();
    const download = await downloadPromise;
    const backup = JSON.parse(await fs.readFile(await download.path(), "utf8"));
    assert.equal(backup.format, "elowen-backup");
    assert.equal(backup.data.calculator.result, 15);
    await page
      .locator("#import-file")
      .setInputFiles({
        name: "bad.json",
        mimeType: "application/json",
        buffer: Buffer.from("{bad"),
      });
    await page.locator("#import-data").click();
    await page.waitForFunction(() =>
      document.querySelector("#notice").textContent.includes("valid JSON"),
    );
    await page.locator("#clear-data").click();
    await page.locator('dialog [value="cancel"]').click();
    assert.ok(
      (await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("elowen.data.v1")).calculator.history
            .length,
      )) > 0,
    );
    await page.locator("#clear-data").click();
    await page.locator('dialog [value="confirm"]').click();
    await page.waitForFunction(
      () => localStorage.getItem("elowen.data.v1") === null,
    );
    await page
      .locator("#import-file")
      .setInputFiles({
        name: "backup.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(backup)),
      });
    await page.locator("#import-data").click();
    await page.locator('dialog [value="confirm"]').click();
    await page.waitForFunction(() =>
      document.querySelector("#notice").textContent.includes("Backup restored"),
    );
    await page.goto(base + "calculator.html");
    assert.equal(await page.locator("#result").textContent(), "15");
    await page.locator("#clear-history").click();
    await page.locator('dialog [value="confirm"]').click();
    await page.locator("#history-empty").waitFor({ state: "visible" });
    // Imported expression strings must never become executable HTML.
    await page.evaluate(() => {
      const data = ElowenStore.defaults();
      data.calculator.history = [
        {
          expression: '<img src=x onerror="window.pwned=true">',
          result: 1,
          angle: "deg",
        },
      ];
      ElowenStore.replace(data);
    });
    assert.equal(await page.locator("#history-list img").count(), 0);
    assert.equal(await page.evaluate(() => window.pwned), undefined);
    await page.evaluate(() => ElowenStore.replace(ElowenStore.defaults()));
    // Check every page in desktop, portrait, landscape, and narrow layouts.
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
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${file} overflow at ${viewport.width}`,
        );
        for (const url of await page
          .locator('[src],link[rel="stylesheet"],link[rel="icon"]')
          .evaluateAll((nodes) => nodes.map((n) => n.src || n.href)))
          assert.equal((await page.request.get(url)).status(), 200, url);
      }
      if (viewport.width === 390) {
        await page.goto(base + "calculator.html");
        await page.screenshot({
          path: path.join(root, "test-results/calculator-mobile.png"),
          fullPage: true,
        });
        await page.goto(base);
        await page.screenshot({
          path: path.join(root, "test-results/home-mobile.png"),
          fullPage: true,
        });
      }
    }
    await page.goto(base);
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .locator(".skip-link")
        .evaluate((e) => e === document.activeElement),
      true,
    );
    assert.equal(
      await page
        .locator(".skip-link")
        .evaluate((e) => getComputedStyle(e).outlineStyle),
      "solid",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await page
        .locator(".tool-card")
        .evaluate((e) => getComputedStyle(e).transitionDuration),
      "0s",
    );
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await context.setOffline(true);
    await page.goto(base + "calculator.html");
    await calc("6*7", "42");
    await context.setOffline(false);
    assert.deepEqual(errors, []);
    const missing = await context.newPage();
    assert.equal(
      (await missing.goto(base + "missing/nested/page")).status(),
      404,
    );
    assert.equal(
      await missing
        .locator(".brand img")
        .evaluate((img) => img.complete && img.naturalWidth > 0),
      true,
    );
    await missing
      .getByRole("link", { name: "Back to Elowen", exact: true })
      .click();
    assert.equal(missing.url(), base + "index.html");
    await missing.close();
    const blocked = await browser.newContext();
    await blocked.addInitScript(() =>
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("Blocked", "SecurityError");
        },
      }),
    );
    const privatePage = await blocked.newPage();
    await privatePage.goto(base + "calculator.html");
    await privatePage.locator("#expression").fill("2+2");
    await privatePage.locator("#expression").press("Enter");
    assert.equal(await privatePage.locator("#result").textContent(), "4");
    assert.equal(
      await privatePage.locator("#storage-warning").isVisible(),
      true,
    );
    await blocked.close();
    console.log(
      "Browser checks passed: calculations, keyboard, memory, persistence, history, safe backups, clear confirmations, six pages at four sizes, focus, reduced motion, assets, and offline mode.",
    );
    await context.close();
  } finally {
    await browser?.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
