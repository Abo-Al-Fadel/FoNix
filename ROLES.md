# Roles & the control panel

FoNix has four account tiers. Everything below the surface — which endpoints
answer, which buttons appear — is decided by where an account sits in this
hierarchy. This file is the single reference for that.

The panel itself is the React app at **`/dashboard`** (staff and above see a
"Dashboard" link in the navbar). It is separate from Django's own admin at
`/admin/` on the API, which remains available to superusers.

## The hierarchy

| Tier | Rank | What it can do |
|---|---|---|
| **Customer** | 0 | Browse the store, place orders, see its own orders. |
| **Staff** | 1 | Customer, plus **manage the catalogue**: add, edit, hide/unhide, delete cars. |
| **Admin** | 2 | Staff, plus **track orders** (advance fulfilment status) and **manage users** (view everyone, change roles up to Admin, deactivate accounts). |
| **Owner** | 3 | Admin, plus **grant/revoke the Owner role** and manage other owners. The oversight tier. (Revenue & profit dashboard arrives in a later phase.) |

Rank is the whole model: every gate is "rank ≥ X". A **superuser** ranks as
Owner regardless of its `role` column, so the person who owns the database is
never locked out of the panel they administer.

## Permission matrix

| Capability | Customer | Staff | Admin | Owner |
|---|:---:|:---:|:---:|:---:|
| Browse store, place orders | ✓ | ✓ | ✓ | ✓ |
| Add / edit / hide / delete cars | | ✓ | ✓ | ✓ |
| See every order, advance its status | | | ✓ | ✓ |
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

## Where each rule lives in the code

| Concern | File |
|---|---|
| The ranks and `is_owner`/`is_admin`/`is_staff_member` | `backend/accounts/models.py` |
| The endpoint gates (`IsStaffMember`, `IsAdmin`, `IsOwner`, `CanManageUser`) | `backend/accounts/permissions.py` |
| Role-ceiling + last-owner rules | `backend/accounts/serializers.py` (`UserAdminSerializer`) |
| Users API | `backend/accounts/views.py` (`UserAdminViewSet`) → `/api/admin/users/` |
| Car hide + cost, staff-write | `backend/cars/` (`is_published`, `cost`, `IsStaffOrReadOnly`) |
| Order lifecycle + status action | `backend/orders/` (`Order.Status`, `OrderViewSet.set_status`) |
| Frontend mirror | `frontend/src/lib/roles.js`, `components/routing/RequireRole.jsx`, `pages/dashboard/` |

## Demo accounts

`python manage.py seed_team` creates one account per tier for local demos and
promotes the `fonix` superuser to Owner. Passwords are dev-only:

| Username | Role | Password |
|---|---|---|
| `owner` | Owner | `owner-demo-2049` |
| `admin` | Admin | `admin-demo-2049` |
| `staff` | Staff | `staff-demo-2049` |

Never run `seed_team` against a real deployment.
