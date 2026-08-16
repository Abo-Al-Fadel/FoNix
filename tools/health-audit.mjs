/**
 * Live health audit for FoNix: public pages, roles, hide/unhide glitch,
 * mobile hero crop, console/network, and API headers.
 *
 * Requires both servers running. Writes screenshots to tools/_audit-shots/
 * and a JSON summary to stdout.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const API = "http://127.0.0.1:8000/api";
const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, "_audit-shots");

mkdirSync(SHOTS, { recursive: true });

const findings = [];
function note(severity, area, title, detail) {
  findings.push({ severity, area, title, detail });
  console.log(`[${severity}] ${area} :: ${title}${detail ? ` — ${detail}` : ""}`);
}

async function apiReq(method, path, { body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const headerDump = {};
  for (const [k, v] of res.headers.entries()) headerDump[k] = v;
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  return { status: res.status, data, headers: headerDump };
}

function attachWatch(page, bag) {
  page.on("console", (msg) => {
    const type = msg.type();
    if (type !== "error" && type !== "warning") return;
    const text = msg.text();
    if (/vite|react devtools|Download the React|willReadFrequently/i.test(text)) return;
    bag.push(`${type}: ${text}`);
  });
  page.on("pageerror", (err) => bag.push(`pageerror: ${err.message}`));
  page.on("response", (res) => {
    const status = res.status();
    const url = res.url();
    if (status >= 400 && !url.includes("/json/version") && !url.includes("favicon")) {
      bag.push(`http ${status} ${url}`);
    }
  });
}

async function skipIntro(page) {
  await page.addInitScript(() => {
    sessionStorage.setItem("fonix.hero.introSeen", "1");
  });
}

async function loginViaUi(page, username, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator("#id_username, input[name='username']").first().fill(username);
  await page.locator("input[name='password']").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 15000 });
}

const run = async () => {
  const browser = await chromium.launch({
    channel: "chrome",
    args: ["--autoplay-policy=no-user-gesture-required"],
  });

  // ------------------------------------------------------------------ API
  console.log("\n=== API headers & public catalogue ===");
  const carsRes = await apiReq("GET", "/cars/");
  const cars = carsRes.data?.results ?? [];
  note(
    "info",
    "API",
    `Public catalogue size`,
    `${cars.length} cars, status ${carsRes.status}`,
  );
  const headerKeys = Object.keys(carsRes.headers);
  const hasNosniff = /nosniff/i.test(carsRes.headers["x-content-type-options"] || "");
  const hasCsp = Boolean(carsRes.headers["content-security-policy"]);
  const hasXfo = Boolean(carsRes.headers["x-frame-options"]);
  if (!hasNosniff) note("medium", "Security", "Missing X-Content-Type-Options on API");
  else note("info", "Security", "X-Content-Type-Options nosniff present");
  if (!hasCsp) note("medium", "Security", "No Content-Security-Policy header (production gap)");
  if (!hasXfo) note("low", "Security", "No X-Frame-Options on API JSON responses");
  const leakedCost = cars.some((c) => Object.prototype.hasOwnProperty.call(c, "cost"));
  if (leakedCost) note("critical", "Security", "Public /api/cars/ leaks cost");
  else note("info", "Security", "Public catalogue does not include cost");

  const staffLogin = await apiReq("POST", "/auth/login/", {
    body: { username: "staff", password: "staff-demo-2049" },
  });
  const adminLogin = await apiReq("POST", "/auth/login/", {
    body: { username: "admin", password: "admin-demo-2049" },
  });
  const ownerLogin = await apiReq("POST", "/auth/login/", {
    body: { username: "owner", password: "owner-demo-2049" },
  });
  if (staffLogin.status !== 200) {
    note("high", "Setup", "Demo staff login failed — run python manage.py seed_team", `status=${staffLogin.status}`);
  }
  if (adminLogin.status !== 200) {
    note("high", "Setup", "Demo admin login failed — run python manage.py seed_team", `status=${adminLogin.status}`);
  }

  const customer = {
    username: `qa_${Date.now().toString(36)}`,
    password: "Qa-Pass-2049!",
    email: `qa_${Date.now()}@probe.test`,
  };
  const reg = await apiReq("POST", "/auth/register/", {
    body: { ...customer, password_confirm: customer.password },
  });
  const custLogin = await apiReq("POST", "/auth/login/", {
    body: { username: customer.username, password: customer.password },
  });
  const custToken = custLogin.data?.access;
  const staffToken = staffLogin.data?.access;
  const adminToken = adminLogin.data?.access;

  if (reg.status === 201 && custToken) {
    const escalate = await apiReq("PATCH", "/auth/me/", {
      token: custToken,
      body: { role: "admin", is_superuser: true },
    });
    if (escalate.data?.role === "admin") {
      note("critical", "Security", "Customer can PATCH /me/ to admin");
    } else {
      note("info", "Security", "Role escalation via /me/ is blocked", `role=${escalate.data?.role}`);
    }

    const dashCars = await apiReq("GET", "/admin/users/", { token: custToken });
    if (dashCars.status === 403 || dashCars.status === 401) {
      note("info", "Roles", "Customer cannot list admin users", `status=${dashCars.status}`);
    } else {
      note("critical", "Roles", "Customer reached /api/admin/users/", `status=${dashCars.status}`);
    }

    const hideAttempt = await apiReq("PATCH", "/cars/ignis/", {
      token: custToken,
      body: { is_published: false },
    });
    if (hideAttempt.status === 403) {
      note("info", "Roles", "Customer cannot hide a car");
    } else {
      note("critical", "Roles", "Customer hide-car not refused", `status=${hideAttempt.status}`);
    }
  }

  if (staffToken) {
    const usersAsStaff = await apiReq("GET", "/admin/users/", { token: staffToken });
    if (usersAsStaff.status === 403) {
      note("info", "Roles", "Staff cannot list users (admin-only)");
    } else {
      note("high", "Roles", "Staff reached user-management API", `status=${usersAsStaff.status}`);
    }

    const staffCars = await apiReq("GET", "/cars/", { token: staffToken });
    const staffList = staffCars.data?.results ?? [];
    const hasCost = staffList.some((c) => Object.prototype.hasOwnProperty.call(c, "cost"));
    const hasHidden = staffList.some((c) => c.is_published === false);
    note("info", "API", "Staff catalogue", `${staffList.length} cars, cost=${hasCost}, hidden=${hasHidden}`);
  }

  // brute-force: login is unthrottled
  const t0 = Date.now();
  const floods = await Promise.all(
    Array.from({ length: 8 }, () =>
      apiReq("POST", "/auth/login/", { body: { username: "nope", password: "wrong" } }),
    ),
  );
  const floodMs = Date.now() - t0;
  const throttled = floods.some((r) => r.status === 429);
  if (!throttled) {
    note(
      "high",
      "Security",
      "Login is unthrottled",
      `8 failed logins in ${floodMs}ms, statuses=${floods.map((r) => r.status).join(",")}`,
    );
  }

  // ------------------------------------------------------------------ Browser
  console.log("\n=== Browser walk ===");
  const viewports = [
    { name: "iphone-14", width: 390, height: 844, isMobile: true, hasTouch: true },
    { name: "pixel-7", width: 412, height: 915, isMobile: true, hasTouch: true },
    { name: "ipad", width: 768, height: 1024, isMobile: true, hasTouch: true },
    { name: "laptop", width: 1280, height: 800, isMobile: false },
    { name: "desktop", width: 1440, height: 900, isMobile: false },
  ];

  const publicPaths = ["/", "/store", "/store/ignis", "/about", "/contact", "/cart", "/login", "/register"];

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
      deviceScaleFactor: vp.isMobile ? 2 : 1,
    });
    const page = await context.newPage();
    const logs = [];
    attachWatch(page, logs);
    await skipIntro(page);

    await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: join(SHOTS, `home-${vp.name}.png`),
      fullPage: false,
    });

    // Hero crop: how much of the canvas is non-void vs empty
    const heroMetrics = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      const video = document.querySelector("video");
      const h1 = document.querySelector("h1");
      const nav = document.querySelector("nav[aria-label='Primary']");
      const main = document.querySelector("main");
      const overflowX = document.documentElement.scrollWidth - window.innerWidth;
      let canvasStats = null;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        const w = canvas.width;
        const h = canvas.height;
        const sample = ctx.getImageData(0, 0, w, Math.min(h, 8)).data;
        // Sample a centre band and edge bands to see if the car is cropped away
        const band = (x0, y0, bw, bh) => {
          const data = ctx.getImageData(x0, y0, bw, bh).data;
          let lit = 0;
          for (let i = 0; i < data.length; i += 16) {
            if (data[i] + data[i + 1] + data[i + 2] > 40) lit += 1;
          }
          return lit;
        };
        const cw = Math.max(8, Math.floor(w * 0.2));
        const ch = Math.max(8, Math.floor(h * 0.2));
        canvasStats = {
          css: { w: canvas.clientWidth, h: canvas.clientHeight },
          buffer: { w, h },
          centre: band(Math.floor(w * 0.4), Math.floor(h * 0.4), cw, ch),
          left: band(0, Math.floor(h * 0.4), cw, ch),
          right: band(w - cw, Math.floor(h * 0.4), cw, ch),
          top: band(Math.floor(w * 0.4), 0, cw, ch),
        };
      }
      return {
        overflowX,
        canvas: canvasStats,
        videoBox: video ? video.getBoundingClientRect() : null,
        h1Box: h1 ? h1.getBoundingClientRect() : null,
        navBox: nav ? nav.getBoundingClientRect() : null,
        mainPad: main ? getComputedStyle(main).paddingTop : null,
      };
    });

    if (heroMetrics.overflowX > 2) {
      note("medium", "Responsive", `Horizontal overflow on ${vp.name}`, `${heroMetrics.overflowX}px`);
    }

    if (vp.isMobile && vp.width <= 430 && heroMetrics.canvas) {
      const { centre, left, right } = heroMetrics.canvas;
      // On a badly cropped 16:9-into-portrait cover, centre may be a dark slice
      // of studio floor/door while the car lives in the cropped sides.
      writeFileSync(
        join(SHOTS, `hero-metrics-${vp.name}.json`),
        JSON.stringify(heroMetrics, null, 2),
      );
      note(
        "info",
        "Hero",
        `Canvas light samples ${vp.name}`,
        `centre=${centre} left=${left} right=${right} buffer=${heroMetrics.canvas.buffer.w}x${heroMetrics.canvas.buffer.h}`,
      );
    }

    if (vp.name === "iphone-14" || vp.name === "desktop") {
      for (const path of publicPaths.slice(1)) {
        await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForTimeout(250);
        const shotName = `${path.replaceAll("/", "_") || "home"}-${vp.name}.png`;
        await page.screenshot({ path: join(SHOTS, shotName), fullPage: false });
      }
    }

    if (logs.length) {
      note("medium", "Console", `${vp.name} console/network issues`, logs.slice(0, 8).join(" | "));
    }
    await context.close();
  }

  // ------------------------------------------------------------------ Hide/unhide glitch
  if (staffToken) {
    console.log("\n=== Hide/unhide glitch ===");
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const logs = [];
    attachWatch(page, logs);
    await skipIntro(page);
    await loginViaUi(page, "staff", "staff-demo-2049");
    await page.goto(`${BASE}/dashboard/cars`, { waitUntil: "networkidle" });
    await page.waitForSelector("table");
    const before = await page.locator("table").boundingBox();
    const hideBtn = page.getByRole("button", { name: /hide|unhide/i }).first();
    const labelBefore = await hideBtn.innerText();
    await hideBtn.click();
    // Capture layout while the refetch loading state is up
    await page.waitForTimeout(80);
    const during = await page.evaluate(() => {
      const loading = [...document.querySelectorAll("p")].find((p) =>
        /loading the catalogue/i.test(p.textContent || ""),
      );
      const table = document.querySelector("table");
      return {
        loadingVisible: Boolean(loading),
        loadingMinH: loading ? getComputedStyle(loading.closest("[aria-live]") || loading).minHeight : null,
        tableTop: table ? table.getBoundingClientRect().top : null,
        liveRegionH: loading?.closest("[aria-live]")?.getBoundingClientRect().height ?? 0,
      };
    });
    await page.waitForTimeout(1500);
    const after = await page.locator("table").boundingBox();
    const labelAfter = await page.getByRole("button", { name: /hide|unhide/i }).first().innerText();
    const jump = during.liveRegionH;
    if (during.loadingVisible && jump > 120) {
      note(
        "high",
        "UX",
        "Hide/unhide inserts a 45vh LoadingState above the table",
        `liveRegionH=${Math.round(jump)}px tableTopDuring=${during.tableTop} beforeTop=${before?.y} afterTop=${after?.y} ${labelBefore}->${labelAfter}`,
      );
    } else {
      note(
        "info",
        "UX",
        "Hide/unhide layout",
        `loadingVisible=${during.loadingVisible} liveRegionH=${jump} ${labelBefore}->${labelAfter}`,
      );
    }
    await page.screenshot({ path: join(SHOTS, "dashboard-cars-staff.png") });

    // Staff must not see Orders/Users nav
    const ordersLink = await page.getByRole("link", { name: /^orders$/i }).count();
    const usersLink = await page.getByRole("link", { name: /^users$/i }).count();
    if (ordersLink || usersLink) {
      note("high", "Roles", "Staff dashboard shows admin-only nav", `orders=${ordersLink} users=${usersLink}`);
    } else {
      note("info", "Roles", "Staff dashboard hides Orders and Users");
    }

    await page.goto(`${BASE}/dashboard/users`, { waitUntil: "networkidle" });
    const landed = page.url();
    if (landed.includes("/dashboard/users")) {
      note("high", "Roles", "Staff can open /dashboard/users via direct URL");
    } else {
      note("info", "Roles", "Staff direct URL to /dashboard/users was redirected", landed);
    }

    if (logs.length) note("medium", "Console", "Staff dashboard console", logs.slice(0, 6).join(" | "));
    await context.close();
  }

  // Customer direct URL to dashboard
  if (custToken) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await skipIntro(page);
    await loginViaUi(page, customer.username, customer.password);
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    if (page.url().includes("/dashboard")) {
      note("high", "Roles", "Customer can open /dashboard via direct URL");
    } else {
      note("info", "Roles", "Customer /dashboard redirected", page.url());
    }
    await page.goto(`${BASE}/checkout`, { waitUntil: "networkidle" });
    await page.screenshot({ path: join(SHOTS, "checkout-empty-customer.png") });
    await context.close();
  }

  // Admin users page
  if (adminToken) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await skipIntro(page);
    await loginViaUi(page, "admin", "admin-demo-2049");
    await page.goto(`${BASE}/dashboard/users`, { waitUntil: "networkidle" });
    await page.screenshot({ path: join(SHOTS, "dashboard-users-admin.png") });
    const ownerSelectDisabled = await page.evaluate(() => {
      const rows = [...document.querySelectorAll("tr")];
      const ownerRow = rows.find((r) => /owner/i.test(r.textContent || ""));
      if (!ownerRow) return "no-owner-row";
      const select = ownerRow.querySelector("select");
      return select ? String(select.disabled) : "no-select";
    });
    note("info", "Roles", "Admin vs Owner row controls", `ownerSelectDisabled=${ownerSelectDisabled}`);
    await context.close();
  }

  // Performance: homepage request count
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const page = await context.newPage();
    await skipIntro(page);
    const reqs = [];
    page.on("request", (req) => reqs.push({ url: req.url(), type: req.resourceType() }));
    const start = Date.now();
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
    const elapsed = Date.now() - start;
    const frames = reqs.filter((r) => r.url.includes("/frames/"));
    const bytesHint = frames.length;
    note(
      "info",
      "Performance",
      "Mobile homepage after intro-skip",
      `${elapsed}ms, ${reqs.length} requests, ${bytesHint} frame files`,
    );
    if (bytesHint > 40) {
      note(
        "medium",
        "Performance",
        "Mobile still preloads a large frame sequence",
        `${bytesHint} /frames/ requests even after skipping intro`,
      );
    }
    await context.close();
  }

  await browser.close();

  const summary = {
    generatedAt: new Date().toISOString(),
    findings,
    shots: SHOTS,
  };
  writeFileSync(join(SHOTS, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(`\nWrote ${findings.length} notes to ${join(SHOTS, "summary.json")}`);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
