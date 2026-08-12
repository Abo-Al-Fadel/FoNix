/**
 * Adversarial probe against the FoNix API.
 *
 * Every request here is something a malicious client would actually try. The
 * point is to confirm the server refuses each one -- authorization is enforced
 * on the backend, not by the frontend hiding a button.
 *
 * Authorized security testing against my own local instance only.
 */
const API = "http://127.0.0.1:8000/api";

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed });
  console.log(`[${passed ? "SECURE" : "VULN!!"}] ${name}${detail ? ` :: ${detail}` : ""}`);
}

async function req(method, path, { body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, data };
}

const stamp = Date.now().toString().slice(-8);

// Two ordinary customer accounts, plus we'll try to reach admin-only things.
const alice = { username: `atk_a_${stamp}`, password: "probe-Pass-2049", email: `a${stamp}@probe.test` };
const bob = { username: `atk_b_${stamp}`, password: "probe-Pass-2049", email: `b${stamp}@probe.test` };

console.log("=== setup: register two customers ===");
await req("POST", "/auth/register/", { body: { ...alice, password_confirm: alice.password } });
await req("POST", "/auth/register/", { body: { ...bob, password_confirm: bob.password } });
const aliceToken = (await req("POST", "/auth/login/", { body: { username: alice.username, password: alice.password } })).data.access;
const bobToken = (await req("POST", "/auth/login/", { body: { username: bob.username, password: bob.password } })).data.access;
console.log(`  alice token: ${aliceToken ? "ok" : "FAILED"}, bob token: ${bobToken ? "ok" : "FAILED"}\n`);

// ---------------------------------------------------------------- //
console.log("=== A. Broken access control ===");

// A1: customer tries to create a car (admin-only)
{
  const r = await req("POST", "/cars/", {
    token: aliceToken,
    body: { name: "Pwned", description: "x", base_price: "1", range_km: 1, top_speed_kmh: 1, acceleration_0_100: "1" },
  });
  check("A1 customer cannot create a car", r.status === 403, `status=${r.status}`);
}

// A2: customer tries to delete a car
{
  const r = await req("DELETE", "/cars/ignis/", { token: aliceToken });
  check("A2 customer cannot delete a car", r.status === 403, `status=${r.status}`);
}

// A3: customer tries to PATCH a car's price
{
  const r = await req("PATCH", "/cars/ignis/", { token: aliceToken, body: { base_price: "1.00" } });
  check("A3 customer cannot edit a car price", r.status === 403, `status=${r.status}`);
}

// A4: alice places an order, bob tries to read it (IDOR)
let aliceOrderId;
{
  const placed = await req("POST", "/orders/", { token: aliceToken, body: { items: [{ car: "ignis", quantity: 1 }] } });
  aliceOrderId = placed.data?.id;
  const bobReads = await req("GET", `/orders/${aliceOrderId}/`, { token: bobToken });
  check("A4 IDOR: bob cannot read alice's order", bobReads.status === 404, `status=${bobReads.status} (404 preferred over 403)`);
}

// A5: order list is scoped -- bob must not see alice's order
{
  const bobList = await req("GET", "/orders/", { token: bobToken });
  const ids = (bobList.data?.results ?? []).map((o) => o.id);
  check("A5 bob's order list excludes alice's order", !ids.includes(aliceOrderId), `bob sees ids: [${ids}]`);
}

// A6: unauthenticated access to orders
{
  const r = await req("GET", "/orders/");
  check("A6 anonymous cannot list orders", r.status === 401, `status=${r.status}`);
}

// ---------------------------------------------------------------- //
console.log("\n=== B. Mass assignment / privilege escalation ===");

// B1: register with role=admin injected
{
  const u = { username: `esc_${stamp}`, password: "probe-Pass-2049", email: `esc${stamp}@probe.test` };
  await req("POST", "/auth/register/", { body: { ...u, password_confirm: u.password, role: "admin", is_staff: true, is_superuser: true } });
  const t = (await req("POST", "/auth/login/", { body: { username: u.username, password: u.password } })).data.access;
  const me = await req("GET", "/auth/me/", { token: t });
  const escalated = me.data?.role === "admin";
  // Prove it's not just a cosmetic role: try an admin action.
  const adminTry = await req("POST", "/cars/", { token: t, body: { name: "x", description: "x", base_price: "1", range_km: 1, top_speed_kmh: 1, acceleration_0_100: "1" } });
  check("B1 role=admin at registration is ignored", !escalated && adminTry.status === 403, `role=${me.data?.role} adminAction=${adminTry.status}`);
}

// B2: PATCH /me/ to elevate role
{
  const r = await req("PATCH", "/auth/me/", { token: aliceToken, body: { role: "admin", is_staff: true } });
  const me = await req("GET", "/auth/me/", { token: aliceToken });
  check("B2 cannot PATCH own role to admin", me.data?.role === "customer", `role after patch=${me.data?.role}`);
}

// ---------------------------------------------------------------- //
console.log("\n=== C. Price / input tampering ===");

// C1: supply own price_at_purchase
{
  const r = await req("POST", "/orders/", { token: aliceToken, body: { items: [{ car: "ignis", quantity: 1, price_at_purchase: "1.00" }] } });
  const total = r.data?.total;
  check("C1 client price is ignored (still full price)", total === "2400000.00", `total=${total}`);
}

// C2: negative quantity
{
  const r = await req("POST", "/orders/", { token: aliceToken, body: { items: [{ car: "ignis", quantity: -5 }] } });
  check("C2 negative quantity rejected", r.status === 400, `status=${r.status}`);
}

// C3: integer overflow quantity
{
  const r = await req("POST", "/orders/", { token: aliceToken, body: { items: [{ car: "ignis", quantity: 99999999999 }] } });
  check("C3 absurd quantity rejected", r.status === 400, `status=${r.status}`);
}

// C4: order on behalf of another user (user field injection)
{
  const r = await req("POST", "/orders/", { token: aliceToken, body: { user: 1, items: [{ car: "ignis", quantity: 1 }] } });
  // Should succeed but be owned by alice, not user 1.
  const owned = r.data?.id ? await req("GET", `/orders/${r.data.id}/`, { token: aliceToken }) : { status: 0 };
  check("C4 user field injection ignored", r.status === 201 && owned.status === 200, `created=${r.status}, alice can read own=${owned.status}`);
}

// ---------------------------------------------------------------- //
console.log("\n=== D. Injection ===");

// D1: SQL injection in the slug lookup
{
  const r = await req("GET", "/cars/ignis'%20OR%20'1'%3D'1/");
  check("D1 SQLi in slug returns clean 404", r.status === 404, `status=${r.status}`);
}

// D2: XSS payload stored via contact form -- should be stored as data, not executed.
// (Execution risk is on render; the API storing it verbatim is correct. We just
//  confirm it doesn't 500.)
{
  const r = await req("POST", "/contact/", { body: { name: "<script>alert(1)</script>", email: "x@x.com", subject: "t", message: "<img src=x onerror=alert(1)> testing xss payload storage" } });
  check("D2 XSS payload stored without server error", r.status === 201 || r.status === 429, `status=${r.status}`);
}

// ---------------------------------------------------------------- //
console.log("\n=== E. Auth / token handling ===");

// E1: tampered JWT (flip a character in the signature)
{
  const parts = aliceToken.split(".");
  const tampered = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -3)}AAA`;
  const r = await req("GET", "/auth/me/", { token: tampered });
  check("E1 tampered JWT rejected", r.status === 401, `status=${r.status}`);
}

// E2: "none" algorithm forgery attempt
{
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ user_id: 1, token_type: "access", exp: 9999999999 })).toString("base64url");
  const forged = `${header}.${payload}.`;
  const r = await req("GET", "/auth/me/", { token: forged });
  check("E2 alg=none forgery rejected", r.status === 401, `status=${r.status}`);
}

// E3: expired-looking / garbage token
{
  const r = await req("GET", "/auth/me/", { token: "garbage.token.value" });
  check("E3 garbage token rejected", r.status === 401, `status=${r.status}`);
}

// E4: refresh endpoint with a stolen access token (wrong token type)
{
  const r = await req("POST", "/auth/refresh/", { body: { refresh: aliceToken } });
  check("E4 access token rejected at refresh endpoint", r.status === 401, `status=${r.status}`);
}

// ---------------------------------------------------------------- //
console.log("\n=== F. Info disclosure / hardening ===");

// F1: DEBUG must be off -- a 500 must not leak a traceback.
{
  // Force a validation path that could 500 if unhandled: malformed JSON body.
  const res = await fetch(`${API}/orders/`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${aliceToken}` }, body: "{not json" });
  const text = await res.text();
  const leaksTraceback = /Traceback|django|File \"/i.test(text);
  check("F1 malformed body does not leak a traceback", !leaksTraceback, `status=${res.status}`);
}

// F2: security headers present
{
  const res = await fetch(`${API}/cars/`);
  const xcto = res.headers.get("x-content-type-options");
  // In DEBUG/local this may be absent; production.py sets it. Report, don't fail hard.
  check("F2 (info) X-Content-Type-Options on responses", xcto === "nosniff", `header=${xcto ?? "absent (set in production.py)"}`, );
}

// ---------------------------------------------------------------- //
console.log("\n=== G. Rate limiting ===");

// G1: contact form throttle
{
  let got429 = false;
  for (let i = 0; i < 8; i++) {
    const r = await req("POST", "/contact/", { body: { name: "x", email: "x@x.com", subject: "s", message: "rate limit probe message here" } });
    if (r.status === 429) { got429 = true; break; }
  }
  check("G1 contact form is rate-limited", got429, got429 ? "429 after repeated posts" : "no throttle hit in 8 tries");
}

// ---------------------------------------------------------------- //
console.log("\n========================================");
const vulns = results.filter((r) => !r.passed);
console.log(`${results.length - vulns.length}/${results.length} checks secure`);
if (vulns.length) {
  console.log("\nATTENTION:");
  for (const v of vulns) console.log(`  - ${v.name}`);
}
