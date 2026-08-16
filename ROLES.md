# Roles & the control panel

FoNix has four account tiers. Everything below the surface — which endpoints
answer, which buttons appear — is decided by where an account sits in this
hierarchy. This file is the single reference for that.

The panel itself is the React app at **`/dashboard`** (staff and above see a
"Dashboard" link in the navbar). It is separate from Django's own admin at
`/admin/` on the API, which remains available to superusers.

The commercial model is the one used by marques that sell online: the customer
configures a car, pays a **reservation** (here a demonstration 10% deposit),
and the hangar then confirms the allocation. Floor staff keep the catalogue
accurate. They do not set list price, see build cost, or confirm a sale.

## The hierarchy

| Tier | Rank | What it can do |
|---|---|---|
| **Customer** | 0 | Browse the store, configure a car, authorise a demonstration reservation, see and cancel **their own pending** allocations. |
| **Staff** | 1 | Customer, plus **manage the catalogue** (add, edit specs/imagery/slots, hide) and **read every order**. May leave hangar notes. Cannot change list price or cost, and cannot change order status. |
| **Admin** | 2 | Staff, plus **advance or cancel orders**, **set list price and cost**, **read operational stats**, and **manage users** (view everyone, change roles up to Admin, deactivate accounts). |
| **Owner** | 3 | Admin, plus **grant/revoke the Owner role**, manage other owners, and **see revenue, build cost and margin**. |

Rank is the whole model: every gate is "rank ≥ X". A **superuser** ranks as
Owner regardless of its `role` column, so the person who owns the database is
never locked out of the panel they administer.

## Permission matrix

| Capability | Customer | Staff | Admin | Owner |
|---|:---:|:---:|:---:|:---:|
| Browse store, hold an allocation | ✓ | ✓ | ✓ | ✓ |
| Authorise 10% demonstration reservation | ✓ | ✓ | ✓ | ✓ |
| Cancel own pending allocation | ✓ | ✓ | ✓ | ✓ |
| Add / edit specs, imagery, slots, hide cars | | ✓ | ✓ | ✓ |
| Change list price or build cost | | | ✓ | ✓ |
| See build cost | | | ✓ | ✓ |
| See every order | | ✓ | ✓ | ✓ |
| Leave a hangar note | | ✓ | ✓ | ✓ |
| Advance or cancel any order | | | ✓ | ✓ |
| Operational hangar stats | | | ✓ | ✓ |
| Revenue / cost / margin | | | | ✓ |
| See all users | | | ✓ | ✓ |
| Change a user's role (up to Admin) | | | ✓ | ✓ |
| Deactivate an account | | | ✓ | ✓ |
| Grant/revoke the **Owner** role | | | | ✓ |
| Manage another **Owner** | | | | ✓ |

## Guardrails

These are enforced **server-side** — in `UserAdminSerializer.validate` (what a
change may set) and `accounts/permissions.py::CanManageUser` (who may act on
whom). The dashboard UI mirrors them so it never offers an action the API would
refuse, but the UI is convenience, not the boundary.

1. **No self-management.** You cannot change your own role or deactivate
   yourself through the panel. (Editing your own profile is `/api/auth/me/`.)
2. **Owners are protected from admins.** An Admin editing or deactivating any
   Owner is a **403** — an Admin cannot change anything about an Owner's account.
3. **Only an Owner grants Owner.** The role menu never offers a role above the
   viewer's own rank, so an Admin can assign Customer/Staff/Admin but never Owner.
4. **Last-owner protection.** The final active Owner cannot be demoted or
   deactivated — the business can never be left with no owner.
5. **Deactivate, never hard-delete.** `Order.user` is `PROTECT`, so an account
   with orders cannot be deleted anyway. The panel toggles `is_active` instead,
   which is reversible and keeps the financial record intact.
6. **Pricing is not a hangar job.** Staff may create a car with an initial list
   price so it can appear in the store. After that, `base_price` and `cost` are
   admin/owner only. Cost is omitted from staff API responses.

## Allocations

A FoNix order is a **build slot**, not a warehouse SKU. The public flow matches
a typical OEM reservation:

1. Configure one car (paint, interior, wheels).
2. Choose hangar collection or delivery.
3. Authorise a **10% demonstration reservation** on a replica card form. The
   server computes the deposit from the snapshotted line total. Full card
   numbers are never stored.
4. The hangar confirms. Production, transit, delivery follow. The customer may
   cancel only while the allocation is still pending; the slot and the
   reservation then unwind.

- Checkout decrements `slots_remaining` and writes a pending order plus handover
  details. Quantity defaults to one car.
- `GET /api/orders/?mine=1` always returns the caller's own orders, so `/account`
  never dumps the hangar's book onto a staff login.
- `POST /api/orders/{id}/cancel/` is the buyer unwind: **pending only**, and the
  slot returns to the range. After confirm, the customer writes to the hangar.
- `PATCH /api/orders/{id}/status/` is admin/owner fulfilment. Cancel from here
  also returns the slot, unless the order is already delivered (terminal; the
  slot stays consumed).
- `POST /api/orders/{id}/note/` is a hangar remark. Staff and above. It does
  not change status and does not email the buyer.
- Staff can **read** every order in the dashboard. They cannot change status.

### Demonstration cards

Checkout is a replica of a Stripe-style authorisation. No money moves.

| Number | Result |
|---|---|
| `4242 4242 4242 4242` | Reservation authorised |
| `4000 0000 0000 0002` | Declined (HTTP 402), no slot taken |
| `4000 0000 0000 9995` | Insufficient funds (HTTP 402) |

The API stores brand, last four digits, a `pi_demo_*` reference, and the
computed deposit. It never stores the PAN or CVC.

## Where each rule lives in the code

| Concern | File |
|---|---|
| The ranks and `is_owner`/`is_admin`/`is_staff_member` | `backend/accounts/models.py` |
| The endpoint gates (`IsStaffMember`, `IsAdmin`, `IsOwner`, `CanManageUser`) | `backend/accounts/permissions.py` |
| Role-ceiling + last-owner rules | `backend/accounts/serializers.py` (`UserAdminSerializer`) |
| Users API | `backend/accounts/views.py` (`UserAdminViewSet`) → `/api/admin/users/` |
| Hangar stats | `backend/accounts/views.py` (`HangarStatsView`) → `/api/admin/stats/` |
| Car hide + cost, staff-write, price lock | `backend/cars/` (`is_published`, `cost`, `CarAdminSerializer.validate`) |
| Order lifecycle, slots, cancel, status, demo pay | `backend/orders/` (`payments.py`, `create_from_cart`, `transition_to`) |
| Frontend mirror | `frontend/src/lib/roles.js`, `components/routing/RequireRole.jsx`, `pages/dashboard/`, `/account` (`?mine=1`) |

## Demo accounts

`python manage.py seed_team` creates one account per tier for local demos and
promotes the `fonix` superuser to Owner. Passwords are dev-only:

| Username | Role | Password |
|---|---|---|
| `owner` | Owner | `owner-demo-2049` |
| `admin` | Admin | `admin-demo-2049` |
| `staff` | Staff | `staff-demo-2049` |

Never run `seed_team` against a real deployment.
