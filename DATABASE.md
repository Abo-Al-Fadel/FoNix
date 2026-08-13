# The database, explained

Written for a learner. What the project uses now, why, how the two engines
differ, and exactly how to switch, back up, reset, or fix a broken one.

---

## What you are using right now

**SQLite.** A single file at `backend/db.sqlite3`.

You did not choose it or configure it. It is the *default* the settings fall
back to when you have not told Django to use anything else:

```python
# backend/config/settings/base.py
DATABASES = {
    "default": env.db("DATABASE_URL", default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}"),
}
```

Read that line as: "use whatever `DATABASE_URL` says; if it is not set, use a
SQLite file called `db.sqlite3`." Since your `.env` has no `DATABASE_URL`, you
get SQLite. That is intentional: a brand-new clone of this project runs with
zero database setup.

You can confirm which engine is live at any time:

```powershell
python manage.py dbshell --help    # tells you which client it would open
python manage.py shell -c "from django.db import connection; print(connection.vendor)"
# -> sqlite
```

---

## SQLite vs PostgreSQL, honestly

Both are real SQL databases. The difference is not "toy vs real" so much as
"one file vs one server".

| | SQLite (now) | PostgreSQL (production target) |
|---|---|---|
| What it is | A file on disk | A server process you connect to |
| Setup | None | Install, create a database and user |
| Concurrent writers | One at a time; others wait or get "database is locked" | Many at once, safely |
| Column types | Loosely enforced (it will store text in a number column) | Strictly enforced |
| Row locking (`SELECT ... FOR UPDATE`) | Ignored | Real |
| Good for | Learning, tests, single-user local dev | Anything with real traffic |

**Why this matters to you as a learner:** if your development database is SQLite
but the real one is Postgres, you can write code that works on your machine and
breaks in production, because SQLite quietly allowed something Postgres refuses.
Developing against the same engine you deploy removes that surprise. That is the
whole reason the project is *built* to run on Postgres even though it *defaults*
to SQLite.

The key design point: **because the database is chosen by one environment
variable, switching engines is a config change, not a code change.** You never
edit a `.py` file to move to Postgres.

---

## How to switch to PostgreSQL

Full step-by-step (installing Postgres, creating the database, migrating, and
moving your data across) lives in [LEARNING.md](LEARNING.md), Exercise 8. The
short version once Postgres is installed:

```powershell
# 1. install the driver
..\backend_venv\Scripts\python.exe -m pip install "psycopg[binary]==3.2.3"

# 2. add ONE line to backend/.env
DATABASE_URL=postgres://fonix_user:your-password@localhost:5432/fonix

# 3. build the schema in the new database
python manage.py migrate
python manage.py createsuperuser
python manage.py seed_catalog
```

To go back to SQLite: comment out that one line. Your SQLite file is untouched.

---

## Fixing a broken database

The failures a learner actually hits, and the fix for each.

### "no such table" / "table already exists"

Your migration state and your actual tables have drifted apart. Rebuild from the
migration files:

```powershell
python manage.py migrate
```

If it still complains, see the nuclear option below.

### "You have N unapplied migration(s)"

You (or a `git pull`) changed the models but never applied the migration:

```powershell
python manage.py migrate
```

### You changed a model and nothing happened in the database

Changing `models.py` does **not** touch the database. You must generate and
apply a migration:

```powershell
python manage.py makemigrations   # writes a migration file describing the change
python manage.py migrate          # applies it to the database
```

### "database is locked" (SQLite only)

Two processes tried to write at once, usually a stray `runserver` plus a shell.
Close the other one. This is exactly the limitation Postgres does not have.

### Inspect what is actually in there

```powershell
python manage.py dbshell
# then normal SQL:  SELECT name, base_price FROM cars_carmodel;   \q to quit
```

Or, far friendlier, use the Django admin (below) or the shell (LEARNING.md
Exercise 3).

### The nuclear option: start the database over

SQLite makes this trivial because the whole database is one file. **This deletes
all local data**, so only do it in development:

```powershell
# from backend/
del db.sqlite3                # PowerShell:  Remove-Item db.sqlite3
python manage.py migrate      # recreate every table from the migration files
python manage.py createsuperuser
python manage.py seed_catalog # repopulate the six cars
```

That sequence is the reliable "make it work again" reset. Because the schema
lives in the committed migration files and the catalog lives in the
`seed_catalog` command, nothing of value is lost.

### Reset just the catalog (not the whole database)

```powershell
python manage.py seed_catalog --reset
```

This clears and repopulates the cars only. It deliberately refuses if any car
has been ordered, because `OrderItem.car` is `PROTECT` - the database will not
let you delete a car that a real order depends on. That is a feature, not an
error.

---

## Migrations, in one paragraph

A migration is a Python file describing one change to the database schema
(add a table, add a column). You never write SQL. `makemigrations` looks at your
models and writes the file; `migrate` runs the pending files against the
database. The files are committed to git, so they are the *history* of your
schema, and every teammate replays the same sequence to reach the same
structure. To see the SQL a migration will run without running it:
`python manage.py sqlmigrate cars 0001`.

---

## Accessing the Django admin panel

The admin is a full web UI for your data that Django generates for free. It is
the easiest way to look at and edit the database.

### 1. Make sure you have a superuser

A superuser is an account allowed into the admin. If you have not made one:

```powershell
python manage.py createsuperuser
```

It asks for a username, email and password. (It does **not** ask for the custom
`role` field, so the new account is created with `role="customer"` - that is
fine, `User.is_fonix_admin` treats every superuser as an admin regardless.)

### 2. Start the server and open the admin

```powershell
python manage.py runserver
```

Then open **http://127.0.0.1:8000/admin/** and log in with that superuser.

### 3. What you can do there

- **Cars**: add a model, edit its price and specs, upload gallery images inline
  (the "visualisation pending" flag lives here too).
- **Orders**: see every order placed, with its line items and total. These are
  read-only on purpose so a click cannot rewrite what a customer was charged.
- **Users**: see accounts, and this is where you promote someone to staff.
- **Contact messages**: read enquiries submitted from the /contact form.

### Promoting a normal account to admin (staff)

New sign-ups from the website are always customers. To give an existing account
catalog-editing rights:

1. In the admin, open **Users** and click the account.
2. Set its **role** to **Admin** (the field this project added), and tick
   **Staff status** so it can log into the admin at all.
3. Save.

That account can now use the admin-only API endpoints (creating and editing
cars) and the admin panel.

### Which accounts can log into the admin?

Only accounts with **Staff status** ticked. A superuser has it automatically. An
ordinary customer does not, which is why a random visitor cannot reach
`/admin/` even if they somehow learn the URL.
