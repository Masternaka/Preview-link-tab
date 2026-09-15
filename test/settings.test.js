const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadSettings() {
  const source = fs.readFileSync(path.join(__dirname, "..", "settings.js"), "utf8");
  const context = { URL };
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.exportsForTest = { cleanPeekSettings, parseDomainList, parseDomainRules, getDomainRule, isPeekAllowedForHost, peekOverlayViewportPosition };`, context);
  return context.exportsForTest;
}

const settings = loadSettings();

test("normalise les réglages importés", () => {
  const clean = settings.cleanPeekSettings({
    closeWithEsc: "false",
    hoverPreviewDelay: 99999,
    customAccent: "invalid"
  });

  assert.equal(clean.closeWithEsc, false);
  assert.equal(clean.hoverPreviewDelay, 3000);
  assert.equal(clean.customAccent, "#2563eb");
});

test("accepte les domaines sous forme de nom, joker ou URL", () => {
  assert.equal(
    JSON.stringify(settings.parseDomainList("*.example.com, https://docs.example.org/path\nBANQUE.FR")),
    JSON.stringify(["example.com", "docs.example.org", "banque.fr"])
  );
  assert.equal(settings.isPeekAllowedForHost("sub.example.com", {
    domainListMode: "blacklist",
    domainList: "example.com"
  }), false);
});

test("la règle de domaine la plus spécifique est retenue", () => {
  const rule = settings.getDomainRule("docs.example.com", {
    domainRules: "example.com = compact\ndocs.example.com = overlay"
  });
  assert.equal(JSON.stringify(rule), JSON.stringify({ domain: "docs.example.com", mode: "overlay" }));
});

test("positionne le panneau sans sortir du viewport", () => {
  assert.equal(
    JSON.stringify(settings.peekOverlayViewportPosition({ position: "bottomRight" }, 960, 540, 1000, 600)),
    JSON.stringify({ left: 24, top: 36 })
  );
});
