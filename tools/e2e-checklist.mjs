/**
 * Walks the FoNix build brief's Section 12 checklist as an actual user,
 * in a real Chromium session. Prints PASS/FAIL per item.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const API = "http://127.0.0.1:8000/api";

const results = [];
let consoleIssues = [];

/**
 * Set while the harness is deliberately submitting invalid data. The browser
 * logs any 4xx response as a console error, so without this the intentional
 * validation test would fail the "no console errors" check with the very
 * error it is asserting on.
 */
let expectServerRejection = false;

function record(id, name, ok, detail = "") {
  results.push({ id, name, ok, detail });
  const tag = ok ? "PASS" : "FAIL";
  console.log(`[${tag}] ${id} ${name}${detail ? ` :: ${detail}` : ""}`);
}

/**
 * Click the first visible button matching one of `names`. The checkout renders
 * a desktop button (hidden on small screens) and a mobile sticky-bar button
 * with a shorter label for the same action, so a plain getByRole would match
 * two elements. This picks whichever is actually on screen.
 */
async function clickVisible(page, names) {
  // Poll for up to 10s: the target may still be hydrating right after a
  // navigation or a state change, and a single pass would race it.
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    for (const name of names) {
      const buttons = page.getByRole("button", { name });
      const count = await buttons.count();
      for (let i = 0; i < count; i += 1) {
        const button = buttons.nth(i);
        if (await button.isVisible().catch(() => false)) {
          await button.click();
          return true;
        }
      }
    }
    await page.waitForTimeout(300);
  }
  throw new Error(`No visible button matched: ${names.join(", ")}`);
}

function attachConsoleWatch(page, label) {
  page.on("console", (msg) => {
    const type = msg.type();
    if (type === "error" || type === "warning") {
      const text = msg.text();
      // Vite's HMR chatter and the React DevTools nag are not app defects.
      if (/vite|react devtools|Download the React/i.test(text)) return;
      // Emitted by THIS harness, not the app: canvasFingerprint() calls
      // getImageData to compare frames. The app itself never reads the canvas
      // back, so this warning does not exist in normal use.
      if (/willReadFrequently/i.test(text)) return;
      // The deliberate invalid-input test provokes a 400 on purpose.
      if (expectServerRejection && /status of 400/.test(text)) return;
      consoleIssues.push(`[${label}] ${type}: ${text}`);
    }
  });
  page.on("pageerror", (err) => {
    consoleIssues.push(`[${label}] pageerror: ${err.message}`);
  });
}

async function canvasFingerprint(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    // Sample a small strip rather than the whole buffer -- cheap and enough to
    // tell two different frames apart.
    const data = ctx.getImageData(
      Math.floor(canvas.width * 0.4),
      Math.floor(canvas.height * 0.4),
      40,
      40,
    ).data;
    let hash = 0;
    for (let i = 0; i < data.length; i += 7) {
      hash = (hash * 31 + data[i]) >>> 0;
    }
    return hash;
  });
}

const run = async () => {
  // Drive the locally installed Chrome rather than Playwright's bundled build.
  const browser = await chromium.launch({
    channel: "chrome",
    args: ["--autoplay-policy=no-user-gesture-required"],
  });

  // ===================================================================== //
  // 1. Homepage hero
  // ===================================================================== //
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    attachConsoleWatch(page, "home");

    await page.goto(BASE, { waitUntil: "domcontentloaded" });

    const video = page.locator("video");
    await video.waitFor({ state: "attached", timeout: 15000 });

    const videoState = await video.evaluate((el) => ({
      muted: el.muted,
      playsInline: el.playsInline,
      autoplayWorking: !el.paused,
      currentTime: el.currentTime,
    }));
    record(
      "1a",
      "Intro video autoplays, muted, inline",
      videoState.muted && videoState.playsInline && videoState.autoplayWorking,
      JSON.stringify(videoState),
    );

    // Scroll must be locked while the video plays.
    await page.waitForTimeout(900);
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(350);
    const lockedScrollY = await page.evaluate(() => window.scrollY);
    const bodyOverflow = await page.evaluate(
      () => document.body.style.overflow,
    );
    record(
      "1c",
      "Scroll is blocked until the video ends",
      lockedScrollY === 0 && bodyOverflow === "hidden",
      `scrollY=${lockedScrollY} overflow=${bodyOverflow}`,
    );

    // Title should still be hidden before the 2.2s mark, then appear.
    const earlyOpacity = await page
      .locator("h1", { hasText: "The future" })
      .evaluate((el) => getComputedStyle(el.parentElement).opacity);

    await page.waitForFunction(
      () => {
        const v = document.querySelector("video");
        return v && v.currentTime >= 2.0;
      },
      { timeout: 15000 },
    );
    await page.waitForTimeout(1200);
    const lateOpacity = await page
      .locator("h1", { hasText: "The future" })
      .evaluate((el) => getComputedStyle(el.parentElement).opacity);

    record(
      "1b",
      "Nav + title fade in around the 2.2s mark",
      Number(earlyOpacity) < 0.5 && Number(lateOpacity) > 0.9,
      `opacity before=${earlyOpacity} after=${lateOpacity}`,
    );

    // Wait for the video to end and scroll to unlock.
    await page.waitForFunction(
      () => document.body.style.overflow !== "hidden",
      { timeout: 20000 },
    );
    record("1d", "Scroll unlocks once the intro finishes", true);

    const scrollHint = page.getByText("Scroll", { exact: true });
    await scrollHint.waitFor({ timeout: 8000 });
    const hintOpacity = await scrollHint.evaluate(
      (el) => getComputedStyle(el.parentElement).opacity,
    );
    record(
      "1e",
      'The "SCROLL" hint appears after the intro',
      Number(hintOpacity) > 0.9,
      `opacity=${hintOpacity}`,
    );

    // Scrubbing: the canvas must show different frames at different scroll
    // positions.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(700);
    const frameA = await canvasFingerprint(page);

    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.4));
    await page.waitForTimeout(1600);
    const frameB = await canvasFingerprint(page);

    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2.8));
    await page.waitForTimeout(1600);
    const frameC = await canvasFingerprint(page);

    record(
      "1f",
      "Scrolling scrubs the canvas through the frame sequence",
      frameA !== null && frameA !== frameB && frameB !== frameC,
      `frames=${frameA},${frameB},${frameC}`,
    );

    await context.close();
  }

  // ===================================================================== //
  // 2. Reduced motion
  // ===================================================================== //
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    attachConsoleWatch(page, "reduced-motion");

    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);

    const videoCount = await page.locator("video").count();
    const stillVisible = await page
      .locator('img[alt*="dihedral door"]')
      .isVisible()
      .catch(() => false);
    const overflow = await page.evaluate(() => document.body.style.overflow);
    const titleOpacity = await page
      .locator("h1", { hasText: "The future" })
      .evaluate((el) => getComputedStyle(el.parentElement).opacity);

    record(
      "2",
      "Reduced motion: no video, static final state, UI immediate, no scroll lock",
      videoCount === 0 &&
        stillVisible &&
        overflow !== "hidden" &&
        Number(titleOpacity) > 0.9,
      `video=${videoCount} still=${stillVisible} overflow="${overflow}" titleOpacity=${titleOpacity}`,
    );

    // The page must scroll normally with no pin.
    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(400);
    const scrolled = await page.evaluate(() => window.scrollY);
    record("2b", "Reduced motion: page scrolls normally", scrolled > 200, `scrollY=${scrolled}`);

    await context.close();
  }

  // ===================================================================== //
  // 3-9. The shopping flow (desktop), then 11 repeats it on mobile
  // ===================================================================== //
  const flow = async (label, viewport, isMobile) => {
    const context = await browser.newContext({ viewport, isMobile: false });
    const page = await context.newPage();
    attachConsoleWatch(page, label);

    const prefix = isMobile ? "11" : "";
    const id = (n) => (isMobile ? `11.${n}` : n);

    // --- 3. Store -------------------------------------------------------
    await page.goto(`${BASE}/store`, { waitUntil: "domcontentloaded" });

    // Scoped to <main>: the footer also links to /store/<slug>, so an
    // unscoped selector matches four footer links while the grid is still
    // loading and reports a false pass.
    const cards = page.locator('main a[href^="/store/"]');
    await cards.first().waitFor({ timeout: 20000 });

    // Scroll the whole grid through the viewport so lazy-loaded, below-the-fold
    // card images actually start loading. On a narrow mobile viewport the six
    // cards stack vertically and most begin off-screen; without this the
    // "all images complete" check would time out on images the browser
    // correctly chose not to fetch yet.
    await page.evaluate(async () => {
      const step = window.innerHeight;
      for (let y = 0; y <= document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 250));
      }
      window.scrollTo(0, 0);
    });

    await page.waitForFunction(
      () => {
        const imgs = [...document.querySelectorAll("main img")];
        return imgs.length >= 6 && imgs.every((i) => i.complete);
      },
      { timeout: 20000 },
    );

    const cardCount = await cards.count();
    const imagesOk = await page.evaluate(() => {
      const imgs = [...document.querySelectorAll("main img")];
      return (
        imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0)
      );
    });
    const priceText = await page.locator("main").innerText();
    const hasPrices = /£2,400,000/.test(priceText) && /£420,000/.test(priceText);

    record(
      id("3"),
      "Store renders all catalog cars with images and prices",
      cardCount === 6 && imagesOk && hasPrices,
      `cards=${cardCount} imagesLoaded=${imagesOk} prices=${hasPrices}`,
    );

    // --- 4. Product detail ---------------------------------------------
    await page.goto(`${BASE}/store/ignis`, { waitUntil: "domcontentloaded" });
    await page.locator("h1", { hasText: "Ignis" }).waitFor({ timeout: 15000 });

    const thumbButtons = page.locator('button[aria-label^="View image"]');
    const galleryCount = await thumbButtons.count();

    const beforeSrc = await page.locator("main img").first().getAttribute("src");
    await thumbButtons.nth(2).click();
    await page.waitForTimeout(300);
    const afterSrc = await page.locator("main img").first().getAttribute("src");

    const detailText = await page.locator("main").innerText();
    const specsOk =
      /640/.test(detailText) && /412/.test(detailText) && /2\.1/.test(detailText);

    record(
      id("4"),
      "Product detail: gallery switches, specs render",
      galleryCount === 4 && beforeSrc !== afterSrc && specsOk,
      `gallery=${galleryCount} galleryClickChangedImage=${beforeSrc !== afterSrc} specs=${specsOk}`,
    );

    // --- 5. Cart (hold two allocations, persist, remove one) ------------
    // Product CTA is "Hold allocation" now, not "Add to cart" -- an allocation
    // is a build slot, not a warehouse item.
    await clickVisible(page, [/Hold allocation/i, /Hold slot/i, /Update configuration/i, /Update/i]);
    await page.waitForTimeout(300);

    await page.goto(`${BASE}/store/aurea`, { waitUntil: "domcontentloaded" });
    await clickVisible(page, [/Hold allocation/i, /Hold slot/i, /Update configuration/i, /Update/i]);
    await page.waitForTimeout(300);

    await page.goto(`${BASE}/cart`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    let cartText = await page.locator("main").innerText();
    const bothInCart = /FoNix Ignis/.test(cartText) && /FoNix Aurea/.test(cartText);

    // Persist across a reload (cart lives in localStorage).
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    cartText = await page.locator("main").innerText();
    const persisted = /FoNix Ignis/.test(cartText) && /FoNix Aurea/.test(cartText);

    // Remove the Aurea; the Ignis stays.
    const aureaRow = page.locator("li").filter({ hasText: "FoNix Aurea" });
    await aureaRow.getByRole("button", { name: "Remove" }).click();
    await page.waitForTimeout(300);
    cartText = await page.locator("main").innerText();
    const removedOk = !/FoNix Aurea/.test(cartText) && /FoNix Ignis/.test(cartText);

    record(
      id("5"),
      "Cart: hold allocations, persist across reload, remove a line",
      bothInCart && persisted && removedOk,
      `bothInCart=${bothInCart} persistedAcrossReload=${persisted} removal=${removedOk}`,
    );

    // --- 6. Register ----------------------------------------------------
    const stamp = Date.now().toString().slice(-9);
    const username = `e2e_${isMobile ? "m" : "d"}${stamp}`;
    const password = "hangar-ignition-49";

    await page.goto(`${BASE}/register`, { waitUntil: "domcontentloaded" });
    // Scope to the register <form>: the footer newsletter also has an Email
    // field, so a page-wide getByLabel("Email") is now ambiguous.
    const registerForm = page.locator("main form");
    await registerForm.getByLabel("Username").fill(username);
    await registerForm.getByLabel("First name").fill("Test");
    await registerForm.getByLabel("Email").fill(`${username}@fonix.test`);
    await registerForm.getByLabel("Password", { exact: true }).fill(password);
    await registerForm.getByLabel("Confirm password").fill(password);
    await page.getByRole("button", { name: /Create account/i }).click();

    await page.waitForURL(/\/account/, { timeout: 15000 });
    // The account page fetches orders before it renders its heading, so wait
    // for the heading itself rather than asserting the instant the URL changes.
    await page
      .getByRole("heading", { name: /Hello, Test/ })
      .waitFor({ timeout: 15000 });
    const registeredOk = /Hello, Test/.test(await page.locator("main").innerText());
    record(id("6a"), "Register a new account and land signed in", registeredOk);

    // Log out, then log back in with the same credentials.
    if (isMobile) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.waitForTimeout(300);
    }
    await page.getByRole("button", { name: "Log out" }).click();
    await page.waitForTimeout(400);

    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/account/, { timeout: 15000 });
    record(id("6b"), "Log in with the newly created account", true);

    // --- 7. Checkout (3-step allocation: review, handover, reservation) -
    await page.goto(`${BASE}/checkout`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    // Step 1 -> handover.
    await clickVisible(page, [/Continue to handover/i, /^Continue$/i]);
    await page.waitForTimeout(500);

    // Step 2: handover details, then -> reservation.
    await page.getByLabel("Full name").fill("Test Driver");
    await page.getByLabel("Phone").fill("07700 900123");
    await clickVisible(page, [/Continue to reservation/i, /^Continue$/i]);
    await page.waitForTimeout(500);

    // Step 3: the demonstration card, then authorise.
    await page.getByLabel("Card number").fill("4242 4242 4242 4242");
    await page.getByLabel("Expiry").fill("12 / 34");
    await page.getByLabel("CVC").fill("123");
    await page.getByLabel("Name on card").fill("Test Driver");
    await clickVisible(page, [/Pay .*reservation/i, /Pay reservation/i]);
    await page.waitForTimeout(2200);

    const confirmationText = await page.locator("main").innerText();
    const orderPlaced = /The slot is yours/i.test(confirmationText);
    const orderNumber = confirmationText.match(/#(\d+)/)?.[1];

    // Cart must be empty afterwards.
    await page.goto(`${BASE}/cart`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    const cartCleared = /Your cart is empty/.test(
      await page.locator("main").innerText(),
    );

    // Verify server-side via the API using the session's own token.
    const token = await page.evaluate(() =>
      window.localStorage.getItem("fonix.auth.access"),
    );
    const apiOrders = await fetch(`${API}/orders/?mine=1`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    const list = apiOrders.results ?? apiOrders;
    const placed = Array.isArray(list) ? list[0] : undefined;
    const serverHasOrder =
      !!placed &&
      placed.total === "2400000.00" &&
      placed.payment_status === "authorized";

    record(
      id("7"),
      "Checkout: 3-step allocation flow authorises a reservation and clears the cart",
      orderPlaced && cartCleared && serverHasOrder,
      `order#${orderNumber} placed=${orderPlaced} cartCleared=${cartCleared} total=${placed?.total} pay=${placed?.payment_status}`,
    );

    // --- 8. Allocation visible on the account page ----------------------
    await page.goto(`${BASE}/account`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    const accountText = await page.locator("main").innerText();
    record(
      id("8"),
      "The placed allocation appears on the account page",
      (orderNumber ? new RegExp(`#${orderNumber}`).test(accountText) : false) &&
        /£2,400,000/.test(accountText),
    );

    // --- 9. Logged-out /account redirects to login ----------------------
    if (isMobile) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.waitForTimeout(300);
    }
    await page.getByRole("button", { name: "Log out" }).click();
    await page.waitForTimeout(400);
    await page.goto(`${BASE}/account`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    record(
      id("9"),
      "Visiting /account logged out redirects to /login",
      /\/login$/.test(page.url()),
      `url=${page.url()}`,
    );

    // --- 11 extras: nav collapse + no horizontal overflow ---------------
    if (isMobile) {
      await page.goto(`${BASE}/store`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(600);

      const burgerVisible = await page
        .getByRole("button", { name: "Open menu" })
        .isVisible();
      const desktopLinksHidden = !(await page
        .getByRole("link", { name: "About", exact: true })
        .first()
        .isVisible()
        .catch(() => false));

      await page.getByRole("button", { name: "Open menu" }).click();
      await page.waitForTimeout(400);
      const drawerVisible = await page
        .locator("#mobile-drawer")
        .isVisible()
        .catch(() => false);

      record(
        "11.nav",
        "Mobile: navbar collapses to a working drawer",
        burgerVisible && desktopLinksHidden && drawerVisible,
        `burger=${burgerVisible} desktopLinksHidden=${desktopLinksHidden} drawerOpens=${drawerVisible}`,
      );

      // Horizontal overflow check across the key pages.
      const overflowing = [];
      for (const path of ["/", "/store", "/store/ignis", "/cart", "/checkout", "/about", "/contact"]) {
        await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(700);
        const overflows = await page.evaluate(
          () =>
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth + 1,
        );
        if (overflows) overflowing.push(path);
      }
      record(
        "11.overflow",
        "Mobile: no page scrolls horizontally",
        overflowing.length === 0,
        overflowing.length ? `overflowing: ${overflowing.join(", ")}` : "all clean",
      );
    }

    await context.close();
    return { username, password };
  };

  const desktopUser = await flow("desktop", { width: 1440, height: 900 }, false);

  // ===================================================================== //
  // 10. Admin-only endpoint rejects a logged-in customer
  // ===================================================================== //
  {
    const loginRes = await fetch(`${API}/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: desktopUser.username,
        password: desktopUser.password,
      }),
    }).then((r) => r.json());

    const createRes = await fetch(`${API}/cars/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginRes.access}`,
      },
      body: JSON.stringify({
        name: "Hacked Model",
        description: "Should never be created.",
        base_price: "1.00",
        range_km: 1,
        top_speed_kmh: 1,
        acceleration_0_100: "1.00",
      }),
    });

    const anonRes = await fetch(`${API}/cars/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Anon Model" }),
    });

    record(
      "10",
      "POST /api/cars/ is 403 for a customer and 401 for anonymous",
      createRes.status === 403 && anonRes.status === 401,
      `customer=${createRes.status} anonymous=${anonRes.status}`,
    );
  }

  // ===================================================================== //
  // 11. Mobile viewport repeat
  // ===================================================================== //
  {
    // Hero on mobile, checked separately so the flow function stays readable.
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    attachConsoleWatch(page, "mobile-hero");

    const frameRequests = [];
    page.on("request", (req) => {
      if (/\/frames\//.test(req.url())) frameRequests.push(req.url());
    });

    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);

    const usesMobileFrames =
      frameRequests.length > 0 &&
      frameRequests.every((u) => u.includes("scroll-mobile"));

    record(
      "11.1",
      "Mobile hero loads the reduced frame set, not the desktop one",
      usesMobileFrames,
      `${frameRequests.length} frame requests, all scroll-mobile=${usesMobileFrames}`,
    );

    await context.close();
  }

  await flow("mobile", { width: 390, height: 844 }, true);

  // ===================================================================== //
  // Contact form (a site page, not a numbered checklist item)
  // ===================================================================== //
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    attachConsoleWatch(page, "contact");

    await page.goto(`${BASE}/contact`, { waitUntil: "domcontentloaded" });
    // Scope to the contact <form> in <main>: the footer newsletter form (also
    // in the DOM) has its own Email field.
    const contactForm = page.locator("main form");
    await contactForm.getByLabel("Name").waitFor({ timeout: 10000 });

    await contactForm.getByLabel("Name").fill("Ada Lovelace");
    await contactForm.getByLabel("Email").fill("ada@example.com");
    await contactForm.getByLabel("Subject").fill("Ignis availability");
    await contactForm
      .getByLabel("Message")
      .fill("When does the Ignis reach the UK, and can I visit the hangar?");
    await contactForm.getByRole("button", { name: /Send message/i }).click();

    await page
      .getByRole("heading", { name: "Thank you." })
      .waitFor({ timeout: 15000 });
    // Case-insensitive: the eyebrow is `text-transform: uppercase`, and
    // innerText returns the rendered casing, not the source string.
    const sent = /message received/i.test(await page.locator("main").innerText());
    record("extra.contact", "Contact form submits and confirms", sent);

    // Short message must be rejected by the server's validation. The 400 this
    // provokes is the expected result, so it is excluded from the console
    // assertion below.
    expectServerRejection = true;
    await page.getByRole("button", { name: /Send another/i }).click();
    await page.waitForTimeout(400);
    await page.locator("main form").getByLabel("Message").fill("hi");
    await page
      .locator("main form")
      .getByRole("button", { name: /Send message/i })
      .click();
    await page.waitForTimeout(1200);
    const rejected = /at least 10 characters/i.test(
      await page.locator("main").innerText(),
    );
    record(
      "extra.contact-validation",
      "Contact form surfaces a server validation error",
      rejected,
    );

    await context.close();
  }

  // ===================================================================== //
  // 13. Every nav and footer link resolves
  // ===================================================================== //
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    attachConsoleWatch(page, "links");

    await page.goto(`${BASE}/about`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);

    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll("header a, footer a")]
        .map((a) => a.getAttribute("href"))
        .filter((h) => h && h.startsWith("/")),
    );
    const unique = [...new Set(hrefs)];

    const broken = [];
    for (const href of unique) {
      await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(700);
      const text = await page.locator("main").innerText();
      // /account and /checkout legitimately redirect to /login when logged out.
      const redirectedToLogin = /\/login/.test(page.url());
      if (/This road doesn.t exist/.test(text) && !redirectedToLogin) {
        broken.push(href);
      }
    }

    record(
      "13",
      "No nav or footer link 404s",
      broken.length === 0,
      `${unique.length} links checked${broken.length ? `; broken: ${broken.join(", ")}` : ""}`,
    );

    await context.close();
  }

  await browser.close();

  // ===================================================================== //
  // 12. Console cleanliness
  // ===================================================================== //
  record(
    "12",
    "No console errors or warnings across the whole walkthrough",
    consoleIssues.length === 0,
    consoleIssues.length
      ? `${consoleIssues.length} issue(s)`
      : "clean",
  );
  if (consoleIssues.length) {
    console.log("\n--- console issues ---");
    for (const issue of [...new Set(consoleIssues)]) console.log(issue);
  }

  // ===================================================================== //
  console.log("\n=====================================");
  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log("\nFAILED:");
    for (const f of failed) console.log(`  ${f.id} ${f.name} :: ${f.detail}`);
  }
  process.exit(failed.length ? 1 : 0);
};

run().catch((err) => {
  console.error("E2E harness crashed:", err);
  process.exit(2);
});
