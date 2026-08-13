# FoNix - how it all fits together

A walkthrough written for someone learning Django properly. It follows a real
request from the browser to the database and back, then covers the data model,
security, and how the two codebases talk.

Read it next to the code - every section names the file it is describing.

---

## 1. The two halves

```
   BROWSER                          SERVER
   ┌──────────────────┐             ┌──────────────────────┐
   │ React SPA        │  HTTP/JSON  │ Django + DRF         │
   │ localhost:5173   │ ──────────► │ 127.0.0.1:8000       │
   │                  │ ◄────────── │                      │
   │ Vite dev server  │             │ runserver            │
   └──────────────────┘             └──────────┬───────────┘
                                               │ SQL
                                     ┌─────────▼──────────┐
                                     │ SQLite (dev)       │
                                     │ db.sqlite3         │
                                     └────────────────────┘
```

These are **two separate programs**. Django serves no HTML for the site - it
only answers `/api/...` with JSON (and `/admin/` with its own HTML). React
renders everything the visitor sees.

That separation is why CORS exists in this project at all, and why there are
two terminals to run. It is also why the frontend has its own router: when you
click "Store", React swaps the page in the browser and Django is never told.

---

## 2. Following one request end to end

Let's trace **loading the store page**.

### Step 1 - React asks for data

`src/pages/Store.jsx` renders and calls a hook:

```jsx
const fetcher = useCallback(() => fetchCars(), []);
const { data: cars, error, isLoading, retry } = useApiResource(fetcher);
```

`useApiResource` (`src/hooks/useApiResource.js`) runs the fetcher in a
`useEffect` and tracks three states - loading, error, data. Every page that
loads data uses it, which is why they all behave the same.

### Step 2 - the API client sends it

`fetchCars` lives in `src/api/endpoints.js`:

```js
export async function fetchCars() {
  const { data } = await api.get("/cars/");
  return data.results ?? data;   // unwrap DRF's pagination envelope
}
```

`api` is the configured axios instance from `src/api/client.js`. **Nothing in
the app imports bare `axios`** - everything goes through this one instance, so
the interceptors below always apply.

On the way out, a request interceptor attaches the JWT if one is stored:

```js
config.headers.Authorization = `Bearer ${token}`;
```

The catalog is public so this is not needed here, but it costs nothing and
means every request is uniformly authenticated.

### Step 3 - Django routes it

The URL is `http://127.0.0.1:8000/api/cars/`. Django matches it in order:

1. **`config/urls.py`** - the root URL map. It sees the path starts with
   `api/cars/` and hands the *rest* of the path to another file:

   ```python
   path("api/cars/", include("cars.urls")),
   ```

2. **`cars/urls.py`** - this app's own URL map. It does not list routes by
   hand; a DRF router generates them from the ViewSet:

   ```python
   router = DefaultRouter()
   router.register(r"", CarModelViewSet, basename="carmodel")
   urlpatterns = router.urls
   ```

   The router creates `/` → list/create and `/<slug>/` → retrieve/update/delete,
   and names them `carmodel-list` and `carmodel-detail`.

> **The file you have open, `accounts/urls.py`, is the same pattern** - except
> auth endpoints aren't a ViewSet (register, login and refresh are three
> unrelated actions, not CRUD on one resource), so they're listed by hand:
>
> ```python
> app_name = "accounts"
> urlpatterns = [
>     path("register/", RegisterView.as_view(), name="register"),
>     path("login/",    LoginView.as_view(),    name="login"),
>     path("refresh/",  TokenRefreshView.as_view(), name="refresh"),
>     path("me/",       MeView.as_view(),       name="me"),
> ]
> ```
>
> `app_name` + `name=` is what lets tests write
> `reverse("accounts:login")` instead of hardcoding `"/api/auth/login/"`.
> Change the path later and every test follows it automatically.

### Step 4 - permissions run *before* anything else

`cars/views.py` declares:

```python
permission_classes = [IsAdminOrReadOnly]
```

DRF checks this **before** the view body or any validation. `GET` is in
`SAFE_METHODS`, so an anonymous visitor passes. A `POST` from a customer stops
here with **403** and never touches the database.

This is the single most important habit in the project: *permissions are
declared on the view, not written as `if` statements inside it.* An `if` can be
forgotten on the next endpoint you add; a permission class applies to every
action on the ViewSet automatically.

### Step 5 - the queryset

```python
def get_queryset(self):
    queryset = CarModel.objects.all()
    if self.action == "retrieve":
        queryset = queryset.prefetch_related("images")
    return queryset
```

`CarModel.objects.all()` does **not** hit the database yet. Django querysets are
lazy - SQL runs only when the results are actually iterated (during
serialization). That laziness is what lets you keep adding `.filter()`,
`.prefetch_related()` etc. and still issue one query.

`prefetch_related("images")` is the **N+1 fix**. Without it, serializing 20 cars
that each show their gallery would run 1 query for the cars and then 1 more per
car - 21 queries. `prefetch_related` fetches all the images in a single extra
`WHERE car_id IN (...)` query instead. Total: 2.

The list endpoint doesn't prefetch because `CarListSerializer` doesn't include
images - prefetching there would be a wasted query. Hence the `if`.

### Step 6 - the serializer

`cars/serializers.py` turns model instances into JSON-safe dicts.

There are **two** serializers on purpose:

| | Used by | Includes |
|---|---|---|
| `CarListSerializer` | the grid | name, price, thumbnail, headline specs |
| `CarDetailSerializer` | the product page | all of the above + description + gallery |

The view picks one:

```python
def get_serializer_class(self):
    if self.action == "list":
        return CarListSerializer
    return CarDetailSerializer
```

That is not duplication - it's the list endpoint refusing to send a 400-word
description for every card nobody is reading.

### Step 7 - back to React

DRF wraps the list in a pagination envelope:

```json
{ "count": 4, "next": null, "previous": null, "results": [ ... ] }
```

`fetchCars` unwraps `.results` so no component has to know the envelope exists.
`Store.jsx` maps over the array into `<CarCard>` components, and the browser
paints.

---

## 3. The database

### The tables

```
   User (accounts)
     id, username, email, password (hashed), role, is_staff, is_superuser …
       │
       │ PROTECT
       ▼
   Order (orders)                     CarModel (cars)
     id, user_id, status, created_at    id, name, slug, tagline, description,
       │                                base_price, range_km, top_speed_kmh,
       │ CASCADE                        acceleration_0_100, thumbnail, is_hero
       ▼                                  │            ▲
   OrderItem (orders)                     │ CASCADE    │ PROTECT
     id, order_id, car_id, quantity,      ▼            │
     price_at_purchase                CarImage ────────┘
                                        id, car_id, image, alt_text
```

### Reading the relationships

A **ForeignKey is just a column holding another table's id.** `OrderItem.car_id`
stores `3`, meaning "the car whose id is 3".

Django gives you both directions for free:

```python
item.car            # forward:  the CarModel this line refers to
car.order_items     # reverse:  every OrderItem pointing at this car
car.images          # reverse:  every CarImage pointing at this car
order.items         # reverse:  every OrderItem on this order
user.orders         # reverse:  every Order belonging to this user
```

The reverse name comes from `related_name=` on the ForeignKey. In
`cars/models.py`:

```python
car = models.ForeignKey(CarModel, related_name="images", on_delete=models.CASCADE)
```

…is what makes `car.images.all()` work.

### `on_delete` - the most important decision in the schema

This answers: *"when the row I point at is deleted, what happens to me?"*

| Relationship | Choice | Why |
|---|---|---|
| `Order.user` | **PROTECT** | Deleting a customer must never erase the record of sales they made. Raises an error instead. |
| `OrderItem.car` | **PROTECT** | Retiring a car from the catalog must not delete the line items proving people bought it. |
| `OrderItem.order` | CASCADE | A line item has no meaning without its order. Delete the order, delete its lines. |
| `CarImage.car` | CASCADE | A photo of a deleted car is an orphan row. |

There is a test for every one of these in `orders/tests/test_models.py` - so if
someone later "tidies up" a `PROTECT` into a `CASCADE`, the suite fails loudly.

### Migrations

A migration is a Python file describing a schema change. You never write SQL.

```bash
python manage.py makemigrations   # look at my models, write a migration file
python manage.py migrate          # apply pending migration files to the DB
```

Migration files are **committed to git** - they are the history of your schema,
and every developer replays the same sequence to arrive at the same database.

**The custom User model** (`accounts/models.py`) is the one thing that had to be
right on day one. `AUTH_USER_MODEL = "accounts.User"` is baked into every
migration that references a user. Swapping it *after* the first `migrate` means
hand-editing migration history or dropping the database. Doing it up front cost
one file.

---

## 4. Where the business logic lives - "fat models, thin views"

The rule: **logic about data belongs on the model**, not in the view.

`orders/models.py`:

```python
@property
def total(self):
    return sum((item.subtotal for item in self.items.all()), Decimal("0.00"))
```

Because it lives here, the API response, the Django admin changelist and any
future invoice all read *the same number from the same code*. The moment that
calculation is copy-pasted into a view, two of the three will eventually
disagree.

Compare the views - `orders/views.py` is about 20 lines of actual logic. It
declares what serializer to use and who is allowed in; it computes nothing.

### The checkout, specifically

`Order.create_from_cart` is a classmethod on the model wrapped in
`@transaction.atomic`:

```python
@classmethod
@transaction.atomic
def create_from_cart(cls, *, user, cart_items):
    order = cls.objects.create(user=user)
    OrderItem.objects.bulk_create([
        OrderItem(
            order=order,
            car=item["car"],
            quantity=item["quantity"],
            price_at_purchase=item["car"].base_price,   # ← from the DB
        )
        for item in cart_items
    ])
    return order
```

Two things to notice:

1. **`@transaction.atomic`** - an order is meaningless without its lines. If
   the third `OrderItem` fails, the whole thing rolls back rather than leaving
   a £2m order with two of its three cars.
2. **`price_at_purchase=item["car"].base_price`** - the price is read from the
   *database record*, never from the request. This is the single most important
   line in the checkout.

---

## 5. Security

### Where the real protection is

**The frontend hiding a button is not security.** Anyone can open devtools and
send whatever request they like. Every rule below is enforced on the server, and
each has a test proving it.

### 1. Price tampering

A client could post `{"car": "ignis", "quantity": 1, "price_at_purchase": "1.00"}`.

`OrderItemWriteSerializer` (`orders/serializers.py`) is a plain `Serializer` with
only two fields - `car` and `quantity`. `price_at_purchase` is not a writable
field, so it is *structurally impossible* to supply. The server reads the price
itself.

> Test: `test_a_client_supplied_price_is_ignored`.

### 2. Privilege escalation

A user could post `{"username": "...", "role": "admin"}` at registration, or
`PATCH /api/auth/me/ {"role": "admin"}` afterwards.

`role` is in `read_only_fields` on `UserSerializer`, and `RegisterSerializer`
force-sets `Role.CUSTOMER` after creating the user. Both paths are closed.

> Tests: `test_registration_always_creates_a_customer`,
> `test_a_user_cannot_promote_themselves_to_admin`.

### 3. Ordering on someone else's account

The view never reads the owner from the request body:

```python
def perform_create(self, serializer):
    serializer.save(user=self.request.user)
```

`request.user` comes from the verified JWT signature. A client cannot forge it
without the server's `SECRET_KEY`.

### 4. Reading someone else's orders

Scoping happens in the **queryset**, not as a filter afterwards:

```python
def get_queryset(self):
    return Order.objects.with_items().for_user(self.request.user)
```

Because the restriction is on the queryset, *every* action on the ViewSet
inherits it - including any you add next month. A customer requesting another
person's order gets **404**, not 403, because a 403 would confirm that order
exists.

### 5. Role-gated writes

The catalogue is writable by **staff and above** (`IsStaffOrReadOnly`,
`cars/permissions.py`): `GET`/`HEAD`/`OPTIONS` are open; everything else requires
`user.is_staff_member`. Order tracking and user management sit one tier higher,
behind `IsAdmin`, and granting the Owner role behind `IsOwner`.

"What counts as staff / admin / owner" is defined in exactly one place — the
rank properties on the User model (`accounts/models.py`) — so each gate is a
thin wrapper and changing the rule is a one-line edit. The full four-tier model,
the permission matrix and the user-management guardrails (no self-management,
owners protected from admins, last-owner protection) are documented in
[ROLES.md](ROLES.md); the security-critical guardrails are covered by
`accounts/tests/test_admin_api.py`.

### 6. Passwords

Never stored. `User.objects.create_user()` runs Django's PBKDF2 hasher. The
column holds something like
`pbkdf2_sha256$870000$xY3…$k9F…`. There is no way back to the original.

This is also why the factories in the test suite call `create_user()` - using
`Model.objects.create()` would write the raw string and every login test would
fail against perfectly correct code.

### 7. Secrets

`SECRET_KEY` is read from the environment with **no fallback**:

```python
SECRET_KEY = env("SECRET_KEY")
```

If it is missing the project refuses to start. That is deliberate - far better
than silently running on a default key identical on every checkout.

`backend/.env` holds your real key and is **gitignored**. `backend/.env.example`
is committed and holds only instructions.

### 8. `DEBUG`

`DEBUG = False` in `base.py`. Only `local.py` sets it to `True`. With `DEBUG=True`
an unhandled exception renders a full traceback *including settings values* to
whoever triggered it - which is why it must never be on in production.

### 9. CORS

Because the SPA is on a different origin (`:5173`) from the API (`:8000`), the
browser blocks requests unless the server opts in. `local.py` names the exact
origins - never `CORS_ALLOW_ALL_ORIGINS = True`, even in development, because
that is a habit you carry into production.

### 10. Rate limiting

`/api/contact/` is public and world-writable, so it is throttled to 5/hour per
IP (`contact/views.py`). Without it, a script can fill your database in seconds.

---

## 6. The frontend, briefly

### State that outlives a page

Two React Contexts wrap the whole app in `src/main.jsx`:

- **`AuthContext`** - who is logged in. On first mount it tries
  `GET /api/auth/me/` using whatever token is in `localStorage`. If the access
  token has expired, the axios interceptor silently refreshes and retries, so a
  returning visitor stays logged in without noticing.
- **`CartContext`** - a `useReducer` holding cart lines, mirrored to
  `localStorage` on every change. **There is no `Cart` table.** The cart lives
  entirely in the browser until checkout posts the whole thing in one request.

`CartProvider` sits *inside* `AuthProvider` because clearing the cart after
checkout needs to know who is logged in, while auth never needs the cart.

### Token refresh - a subtle bug worth understanding

`src/api/client.js` holds the in-flight refresh in a shared promise:

```js
refreshPromise = refreshPromise ?? refreshAccessToken();
```

Without this, a page firing four requests with an expired token starts four
refreshes. Since Django has `ROTATE_REFRESH_TOKENS` on, the first refresh
invalidates the token the other three are using - and the user gets logged out
at random. Sharing one promise means the first 401 refreshes and the rest wait.

### Route protection

`RequireAuth` (`src/components/routing/RequireAuth.jsx`) redirects logged-out
visitors away from `/account` and `/checkout`. To be clear about what this is:
it controls **navigation, not access**. It stops someone landing on a page that
would only show them errors. Deleting it would leak nothing - the API is scoped
regardless.

Note the `isRestoring` guard. While the session is still being restored from
`localStorage` we don't yet know if anyone is logged in, so redirecting there
would bounce a valid session to the login page on every hard refresh.

---

## 7. Verifying the N+1 work yourself

Two ways, and you should try both.

**Automated** - the tests assert exact query counts:

```python
with self.assertNumQueries(2):
    self.client.get(self.url)
```

Break it deliberately: delete `.prefetch_related("images")` from
`cars/views.py`, run `python manage.py test cars`, and watch
`test_the_gallery_is_prefetched_rather_than_queried_per_image` fail. Put it
back. That is the fastest way to *feel* what N+1 means.

**Visual** - django-debug-toolbar. With the dev server running, open:

```
http://127.0.0.1:8000/api/cars/?format=api
```

in a real browser. You get DRF's browsable API page with the toolbar panel on
the right. Click **SQL** to see every query the request ran, with timings.

(The toolbar only attaches to HTML responses, which is why `local.py` adds the
browsable renderer in development. Production returns JSON only.)
