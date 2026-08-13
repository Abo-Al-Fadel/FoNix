# Learning Django with this project

Nine exercises, in order. Each one is a thing you *do*, not a thing you read -
you break something, watch it fail, and put it back. That loop is what actually
teaches a framework.

Every command assumes you are in the `backend/` folder with the virtual
environment's Python:

```powershell
cd C:\Users\ismae\Documents\FoNix\backend
```

Where you see `python`, use `..\backend_venv\Scripts\python.exe` - or activate
the environment once per terminal and just type `python`:

```powershell
..\backend_venv\Scripts\Activate.ps1
```

You'll know it worked when your prompt gains a `(backend_venv)` prefix.

---

## Exercise 1 - Feel the N+1 problem

**Time: 5 minutes. This is the most important one.**

The single biggest performance mistake in Django is issuing one query per row.
You've read about it; now watch it happen.

### Step 1: see the current state

```powershell
python manage.py test cars.tests.test_api.CarDetailAPITests
```

All 4 tests pass. One of them, `test_the_gallery_is_prefetched_rather_than_queried_per_image`,
asserts the endpoint runs exactly **2** queries.

### Step 2: break it deliberately

Open [backend/cars/views.py](backend/cars/views.py). Find:

```python
def get_queryset(self):
    queryset = CarModel.objects.all()
    if self.action == "retrieve":
        queryset = queryset.prefetch_related("images")
    return queryset
```

Delete the two middle lines so it reads:

```python
def get_queryset(self):
    queryset = CarModel.objects.all()
    return queryset
```

### Step 3: run it again

```powershell
python manage.py test cars.tests.test_api.CarDetailAPITests
```

You get a failure like:

```
AssertionError: 7 != 2 : 7 queries executed, 2 expected
```

**Seven queries instead of two.** The test created a car with 5 gallery images:
1 query for the car, then 1 more for *each image*. Add a hundred images and it
becomes 101 queries.

### Step 4: put it back

Restore the two lines. Re-run. Back to passing.

**What you learned:** `prefetch_related` collapses "one query per related row"
into one extra query total. The test is a tripwire - if someone removes it in
six months, the suite tells them immediately instead of the site quietly getting
slower.

---

## Exercise 2 - See the actual SQL

Same idea, but visually.

1. Make sure the Django server is running (`python manage.py runserver`).
2. Open this in a real browser:

   ```
   http://127.0.0.1:8000/api/cars/?format=api
   ```

3. You get DRF's browsable API page. On the right is the **django-debug-toolbar**
   panel. Click **SQL**.

You'll see every query the request ran, how long each took, and - click
"Toggle Stacktrace" - exactly which line of your code triggered it.

Now try the detail endpoint:

```
http://127.0.0.1:8000/api/cars/ignis/?format=api
```

Try Exercise 1's break again with the toolbar open. Watch the query count climb
in real time.

**What you learned:** you never have to guess what the ORM is doing. The toolbar
shows you.

---

## Exercise 3 - Talk to your models directly

The Django shell is a Python REPL with your project loaded. It is the fastest
way to understand the ORM.

```powershell
python manage.py shell
```

Then, line by line:

```python
from cars.models import CarModel, CarImage
from orders.models import Order
from django.contrib.auth import get_user_model
User = get_user_model()

# Every car
CarModel.objects.all()

# Just one, by slug
ignis = CarModel.objects.get(slug="ignis")
ignis.name
ignis.base_price

# The reverse relationship - every image pointing at this car
ignis.images.all()
ignis.images.count()

# Filtering
CarModel.objects.filter(range_km__gte=600)          # 600 or more
CarModel.objects.filter(name__icontains="ig")       # case-insensitive contains
CarModel.objects.exclude(is_hero=True)

# Ordering and slicing (this becomes SQL LIMIT, not a Python slice)
CarModel.objects.order_by("base_price")[:3]

# THE IMPORTANT TRICK: see the SQL any queryset will run
print(CarModel.objects.filter(range_km__gte=600).query)

# Aggregation
from django.db.models import Avg, Max, Count
CarModel.objects.aggregate(Avg("base_price"), Max("top_speed_kmh"))

# Annotation - attach a computed column to each row
CarModel.objects.annotate(image_count=Count("images")).values("name", "image_count")
```

Type `exit()` to leave.

**Try to break it:**

```python
CarModel.objects.get(slug="does-not-exist")
```

You get `CarModel.DoesNotExist`. That is why views use `get_object_or_404` or
DRF's generic views instead of a bare `.get()`.

**What you learned:** querysets are lazy - none of the filtering above touched
the database until you printed the result. That laziness is what lets you chain
`.filter().exclude().order_by()` and still issue one query.

---

## Exercise 4 - Add a field (the full migration cycle)

You're going to add a `body_style` field to cars.

### Step 1: change the model

In [backend/cars/models.py](backend/cars/models.py), inside `class CarModel`,
add after `tagline`:

```python
    class BodyStyle(models.TextChoices):
        COUPE = "coupe", "Coupé"
        SALOON = "saloon", "Saloon"
        SUV = "suv", "SUV"

    body_style = models.CharField(
        max_length=10,
        choices=BodyStyle.choices,
        default=BodyStyle.COUPE,
    )
```

### Step 2: create the migration

```powershell
python manage.py makemigrations cars
```

Output:

```
Migrations for 'cars':
  cars\migrations\0002_carmodel_body_style.py
    + Add field body_style to carmodel
```

**Open that file and read it.** It is plain Python describing the change. This
is the file that gets committed to git - it is your schema's history.

### Step 3: preview the SQL

```powershell
python manage.py sqlmigrate cars 0002
```

You get the literal `ALTER TABLE` statement Django will run. You never write SQL,
but you can always see it.

### Step 4: apply it

```powershell
python manage.py migrate
```

### Step 5: confirm

```powershell
python manage.py shell -c "from cars.models import CarModel; print(CarModel.objects.first().body_style)"
```

Prints `coupe` - the default was applied to existing rows.

### Step 6: expose it in the API

In [backend/cars/serializers.py](backend/cars/serializers.py), add
`"body_style"` to the `fields` tuple of `CarDetailSerializer`. Reload
`http://127.0.0.1:8000/api/cars/ignis/` and it's there.

### Step 7 (optional): undo it

```powershell
python manage.py migrate cars 0001
```

That rolls the database back to migration 0001. Then delete the 0002 file and
remove the model field.

**What you learned:** the cycle is always *change model → makemigrations →
migrate*. Migrations are reversible and readable. And a field existing in the
database does not make it visible in the API - the serializer decides that.

---

## Exercise 5 - Break a permission, watch the guard hold

This is how you build confidence that security actually works.

### Step 1: confirm it currently blocks

```powershell
python manage.py test cars.tests.test_api.CarWritePermissionTests
```

9 tests pass. One proves a logged-in customer gets **403** when they try to
create a car.

### Step 2: sabotage the permission

In [backend/cars/permissions.py](backend/cars/permissions.py), change:

```python
return bool(user and user.is_authenticated and user.is_fonix_admin)
```

to:

```python
return bool(user and user.is_authenticated)   # oops - any logged-in user
```

### Step 3: run again

```powershell
python manage.py test cars.tests.test_api.CarWritePermissionTests
```

`test_a_logged_in_customer_cannot_create_a_car` **fails**: `201 != 403`. Your
test suite just caught a privilege-escalation bug before it shipped.

### Step 4: restore it.

**What you learned:** permission classes are where authorisation lives, and
tests are what stop a one-word change from opening your catalog to the world.

---

## Exercise 6 - Prove the price cannot be faked

The most important security property in the whole project.

With the server running, in a **new terminal**:

```powershell
# 1. Log in and grab a token
$body = '{"username":"admin","password":"YOUR_PASSWORD"}'
$r = Invoke-RestMethod -Uri http://127.0.0.1:8000/api/auth/login/ -Method Post -Body $body -ContentType "application/json"
$token = $r.access

# 2. Try to buy a £2.4m hypercar for £1
$order = '{"items":[{"car":"ignis","quantity":1,"price_at_purchase":"1.00"}]}'
Invoke-RestMethod -Uri http://127.0.0.1:8000/api/orders/ -Method Post -Body $order -ContentType "application/json" -Headers @{Authorization="Bearer $token"}
```

The response comes back with `total: 2400000.00`. Your `price_at_purchase` was
**silently ignored** - the server read the real price from its own database.

Now find *why*: [backend/orders/serializers.py](backend/orders/serializers.py),
`OrderItemWriteSerializer`. It has exactly two fields, `car` and `quantity`.
There is no `price_at_purchase` field, so there is nothing to tamper with.

**What you learned:** the strongest security is structural. Not "we validate the
price" but "there is no way to send a price."

---

## Exercise 7 - Add your own endpoint

Build `GET /api/cars/stats/` returning range-wide statistics.

In [backend/cars/views.py](backend/cars/views.py), add to `CarModelViewSet`:

```python
from django.db.models import Avg, Count, Max, Min
from rest_framework.decorators import action
from rest_framework.response import Response

    # `detail=False` means this is a LIST-level route (/api/cars/stats/)
    # rather than a per-object one (/api/cars/<slug>/stats/).
    @action(detail=False, methods=["get"])
    def stats(self, request):
        data = CarModel.objects.aggregate(
            count=Count("id"),
            cheapest=Min("base_price"),
            dearest=Max("base_price"),
            average_range=Avg("range_km"),
        )
        return Response(data)
```

Visit `http://127.0.0.1:8000/api/cars/stats/`. That's it - the router found the
new action automatically, and `IsAdminOrReadOnly` already lets `GET` through.

**Now write a test for it** in `cars/tests/test_api.py`:

```python
    def test_stats_endpoint_is_public(self):
        CarModelFactory(base_price=Decimal("100000.00"))
        response = self.client.get(reverse("cars:carmodel-stats"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
```

**What you learned:** `@action` extends a ViewSet without touching urls.py, and
the router derives the route name (`carmodel-stats`) automatically.

---

## Exercise 8 - Move to PostgreSQL

SQLite is a single file and perfect for learning. PostgreSQL is what this
project is actually designed for - and there are real behaviours SQLite does not
enforce.

### Why bother

| | SQLite | PostgreSQL |
|---|---|---|
| Concurrent writers | One at a time; the rest get "database is locked" | Many, safely |
| Column types | Loosely enforced | Strictly enforced |
| `SELECT ... FOR UPDATE` | Ignored | Real row locking |
| Storage | One file | A server |

If your dev database is SQLite and production is Postgres, you can ship a bug
that only appears in production. Developing against the real engine removes that
class of surprise.

### Step 1: install PostgreSQL

Download the Windows installer from
<https://www.postgresql.org/download/windows/>. During setup you set a password
for the `postgres` superuser - write it down.

### Step 2: create the database

Open "SQL Shell (psql)" from the Start menu, press Enter through the prompts,
enter your password, then:

```sql
CREATE DATABASE fonix;
CREATE USER fonix_user WITH PASSWORD 'choose-a-real-password';

-- Recommended settings for a Django database user.
ALTER ROLE fonix_user SET client_encoding TO 'utf8';
ALTER ROLE fonix_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE fonix_user SET timezone TO 'UTC';

GRANT ALL PRIVILEGES ON DATABASE fonix TO fonix_user;

-- Django's test runner CREATES a database, so the user needs that right too.
ALTER USER fonix_user CREATEDB;

\q
```

### Step 3: install the Python driver

```powershell
..\backend_venv\Scripts\python.exe -m pip install "psycopg[binary]==3.2.3"
```

Then uncomment the `psycopg` line in `backend/requirements.txt`.

### Step 4: point Django at it

Add one line to `backend/.env`:

```
DATABASE_URL=postgres://fonix_user:choose-a-real-password@localhost:5432/fonix
```

That is all. The settings already read it:

```python
DATABASES = {
    "default": env.db("DATABASE_URL", default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}"),
}
```

No `DATABASE_URL` → SQLite. With one → Postgres. **You change zero Python.**

### Step 5: build the schema and reseed

```powershell
python manage.py migrate
python manage.py createsuperuser
python manage.py seed_catalog
python manage.py test
```

### Moving your existing data across (optional)

Migrations create empty tables. To carry data over, dump it *before* switching:

```powershell
# With DATABASE_URL still commented out (i.e. on SQLite):
python manage.py dumpdata --natural-foreign --natural-primary `
  --exclude contenttypes --exclude auth.Permission `
  --indent 2 -o backup.json

# Now set DATABASE_URL, then:
python manage.py migrate
python manage.py loaddata backup.json
```

`--exclude contenttypes --exclude auth.Permission` matters: those tables are
rebuilt by `migrate`, and loading a second copy causes unique-constraint errors.

### Going back

Comment out `DATABASE_URL`. SQLite is untouched and still there.

**What you learned:** because the database is configured through one environment
variable, swapping engines is a config change, not a code change. That is the
entire point of the split-settings pattern.

---

## Exercise 9 - Read a request end to end

No commands. Open five files in this order and trace one click:

1. [frontend/src/pages/Store.jsx](frontend/src/pages/Store.jsx) - calls `fetchCars()`
2. [frontend/src/api/endpoints.js](frontend/src/api/endpoints.js) - `api.get("/cars/")`
3. [backend/config/urls.py](backend/config/urls.py) - matches `api/cars/`, delegates
4. [backend/cars/urls.py](backend/cars/urls.py) - router maps it to the ViewSet
5. [backend/cars/views.py](backend/cars/views.py) - permission, queryset, serializer

Then read [ARCHITECTURE.md](ARCHITECTURE.md), which narrates exactly that path
with the reasoning at each step.

---

## Exercise 10 - Follow a permission guardrail

The control panel adds a four-tier role hierarchy. The interesting code is not
the happy path but the guardrails — the rules that stop an admin doing something
only an owner should. Prove one holds:

```bash
cd backend
../backend_venv/Scripts/python manage.py seed_team   # owner/admin/staff demos
../backend_venv/Scripts/python manage.py shell
```

```python
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
User = get_user_model()

admin = User.objects.get(username="admin")
owner = User.objects.get(username="owner")

c = APIClient()
c.force_authenticate(admin)

# An admin trying to touch an owner's account: expect 403.
r = c.patch(f"/api/admin/users/{owner.pk}/", {"role": "admin"}, format="json")
print(r.status_code, r.data)
```

Now read why: [`CanManageUser`](backend/accounts/permissions.py) (who may act on
whom) and [`UserAdminSerializer.validate`](backend/accounts/serializers.py) (what
a change may set). The whole matrix is in [ROLES.md](ROLES.md), and every rule
here has a test in `backend/accounts/tests/test_admin_api.py` — run just those
with `python manage.py test accounts.tests.test_admin_api`.

---

## Where to go after this

Things this project deliberately does not do, roughly in order of how much
you'd learn:

1. **`select_related` practice** - add a `Manufacturer` model with a FK from
   `CarModel`, then watch the store page N+1 and fix it.
2. **Filtering** - `django-filter` for `?min_range=600&sort=price`.
3. **Caching** - put Redis in front of the catalog endpoint.
4. **Celery** - send the order confirmation email in a background worker.
5. **Deployment** - `production.py` is already written; add Docker and a
   platform.

Do them one at a time, and write the test first each time.
