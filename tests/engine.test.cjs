const { test } = require("node:test");
const assert = require("node:assert/strict");
const { calculate, format } = require("../js/engine.js");
const store = require("../js/storage.js");
const cases = [
  ["2+3*4", 14],
  ["(2+3)*4", 20],
  ["-2^2", -4],
  ["(-2)^2", 4],
  ["2^-3", 0.125],
  ["2^3^2", 512],
  ["12/3/2", 2],
  ["2(3+4)", 14],
  ["2pi", 2 * Math.PI],
  ["2e", 2 * Math.E],
  ["1e-7 * 1e7", 1],
  ["150*20%", 30],
  ["150*(1+20%)", 180],
  ["0!", 1],
  ["5!", 120],
  ["sqrt(81)", 9],
  ["abs(-4)", 4],
  ["ln(e)", 1],
  ["log(100)", 2],
  ["exp(0)", 1],
  ["sin(30)", 0.5],
  ["cos(60)", 0.5],
  ["tan(45)", 1],
  ["asin(0.5)", 30],
  ["acos(0.5)", 60],
  ["atan(1)", 45],
  ["1/(4)", 0.25],
  [".5+.25", 0.75],
  ["2×3−1", 5],
];
for (const [source, expected] of cases)
  test(source, () => assert.ok(Math.abs(calculate(source) - expected) < 1e-10));
test("radian functions", () => {
  assert.equal(calculate("sin(pi/2)", "rad"), 1);
  assert.equal(calculate("acos(0)", "rad"), Math.PI / 2);
});
test("floating point display", () => {
  assert.equal(format(calculate("0.1+0.2")), "0.3");
  assert.equal(format(1e-20), "1e-20");
});
for (const source of [
  "1/0",
  "sqrt(-1)",
  "(-2)!",
  "2.5!",
  "171!",
  "ln(0)",
  "log(-1)",
  "asin(2)",
  "tan(90)",
  "1e309",
  "10^1000",
  "exp(1000)",
  "1+",
  "(2+3",
  "2 3",
  "unknown(3)",
  "globalThis.process.exit()",
  "",
  "(".repeat(120) + "1" + ")".repeat(120),
  "-".repeat(120) + "1",
])
  test(`reject ${source.slice(0, 35)}`, () =>
    assert.throws(() => calculate(source), Error));
test("backup round trip", () =>
  assert.deepEqual(store.parseBackup(store.export()), store.defaults()));
test("backup schema whitelist", () => {
  const data = store.defaults();
  data.untrusted = "discard";
  data.calculator.history = [
    {
      expression: "<img src=x onerror=alert(1)>",
      result: 4,
      angle: "deg",
      extra: "discard",
    },
  ];
  const clean = store.validate(data);
  assert.equal(clean.untrusted, undefined);
  assert.equal(clean.calculator.history[0].extra, undefined);
});
for (const mutate of [
  (x) => (x.version = 2),
  (x) => (x.data.calculator.memory = "5"),
  (x) => (x.data.preferences.angle = "gradians"),
  (x) =>
    (x.data.calculator.history = [
      { expression: "2+2", result: "4", angle: "deg" },
    ]),
  (x) => (x.data.calculator.expression = "x".repeat(2001)),
  (x) =>
    (x.data.calculator.history = Array(501).fill({
      expression: "1",
      result: 1,
      angle: "deg",
    })),
])
  test("reject malformed backup", () => {
    const b = JSON.parse(store.export());
    mutate(b);
    assert.throws(() => store.parseBackup(JSON.stringify(b)));
  });
test("reject invalid JSON and oversized file", () => {
  assert.throws(() => store.parseBackup("{"));
  assert.throws(() => store.parseBackup("x".repeat(2 * 1024 * 1024 + 1)));
});

test("reject nonfinite numeric input", () =>
  assert.throws(() =>
    store.parseBackup(
      store.export().replace('"result": null', '"result": 1e999'),
    ),
  ));

test("old backups migrate without an explicit theme", () => {
  const backup = JSON.parse(store.export());
  delete backup.data.preferences.theme;
  assert.equal(
    store.parseBackup(JSON.stringify(backup)).preferences.theme,
    null,
  );
});
test("explicit themes survive backup validation", () => {
  for (const theme of ["light", "dark", null]) {
    const backup = JSON.parse(store.export());
    backup.data.preferences.theme = theme;
    assert.equal(
      store.parseBackup(JSON.stringify(backup)).preferences.theme,
      theme,
    );
  }
});
test("invalid theme fields are rejected", () => {
  for (const theme of ["blue", "system", 1, {}, false]) {
    const backup = JSON.parse(store.export());
    backup.data.preferences.theme = theme;
    assert.throws(() => store.parseBackup(JSON.stringify(backup)));
  }
});
