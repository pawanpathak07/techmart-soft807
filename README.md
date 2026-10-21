# TechMart - Full-stack CRUD shop (customer site + admin panel)

Node.js + Express backend, SQLite database, plain HTML/CSS/JavaScript frontend.
No build step. Install, run, open the browser. The SQLite database remains the default runtime database.

## 1. Requirements

- Node.js **22.13 or newer** (24 is fine). Check with `node -v`. Get the LTS version at https://nodejs.org
- Nothing else: no Python, no C++ tools, no database program. SQLite is built into Node.

## 2. Setup (5 commands)

```bash
cd shopapp
npm install                 # installs every package listed below
cp .env.example .env        # Windows: copy .env.example .env
# open .env and set JWT_SECRET to any long random text
npm start                   # or: npm run dev   (auto-restarts on changes)
```

Open **http://localhost:3000** (shop) and **http://localhost:3000/admin/** (admin panel).

The database file `data/shop.db` and all tables are created automatically on first start,
and demo products and accounts are added when the database is empty.

| Role     | Email              | Password     |
|----------|--------------------|--------------|
| Admin    | admin@shop.local   | Admin@123    |
| Customer | demo@shop.local    | Customer@123 |

Change or delete these accounts before putting the site online.

## 3. Packages

Installed by `npm install` (all already listed in `package.json`):

| Package | Why it is used |
|---|---|
| express | Web server and API routes |
| bcryptjs | Hashes passwords so they are never stored as plain text |
| jsonwebtoken | Creates and checks the login token |
| cookie-parser | Reads the login cookie |
| helmet | Adds secure HTTP headers (including a Content-Security-Policy) |
| express-rate-limit | Slows down password guessing on login and register |
| nodemailer | Optional SMTP email notifications |
| mysql2 | MySQL client used by the one-time migration utility |
| dotenv | Loads settings from the `.env` file |
| nodemon (dev only) | Restarts the server when you edit code (`npm run dev`) |

The database itself is Node's built-in `node:sqlite` module, so it is not in this list. You may see
an "ExperimentalWarning: SQLite" message when the server starts. It is harmless.

Windows tip: do not keep the folder inside OneDrive (Desktop or Documents are often synced).
OneDrive can block `npm install` with EPERM errors. Move the folder to something like `C:\shopapp`.

## 4. Pages

**Customer side**

| Page | URL | What it does |
|---|---|---|
| Shop | `/` | Browse, search, filter by category, add to cart |
| Cart | `/cart.html` | Change quantities, remove items, place order (login needed) |
| My orders | `/orders.html` | See order history, cancel pending orders, edit name / password |
| Log in | `/login.html` | Sign in |
| Sign up | `/register.html` | Create a customer account |

**Admin panel** (admin accounts only)

| Page | URL | CRUD |
|---|---|---|
| Dashboard | `/admin/` | Revenue, orders, low stock, recent orders |
| Products | `/admin/products.html` | Create, read, update, delete products |
| Orders | `/admin/orders.html` | Read orders, update status, delete |
| Customers | `/admin/customers.html` | Create, read, update (role, active, password), delete users |
| Notifications | `/admin/notifications.html` | New orders and order status activity |
| Database | `/admin/database.html` | Read-only record counts and JSON data export |

## 5. API (all under `/api`)

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | /auth/register | public | Create customer account |
| POST | /auth/login | public | Log in (sets httpOnly cookie) |
| POST | /auth/logout | anyone | Log out |
| GET / PUT | /auth/me | logged in | Current user / update own profile |
| GET | /products, /products/:id, /products/meta/categories | public | Read products |
| POST / PUT / DELETE | /products, /products/:id | admin | Create / update / delete product |
| POST | /orders | customer | Place order (price and stock checked on the server) |
| GET | /orders/mine | customer | Own orders |
| POST | /orders/:id/cancel | customer | Cancel own pending order |
| GET | /orders | admin | All orders (`?status=`) |
| PATCH | /orders/:id/status | admin | Change status |
| DELETE | /orders/:id | admin | Delete order |
| GET / POST | /users | admin | List / create users |
| GET / PUT / DELETE | /users/:id | admin | Read / update / delete user |
| GET | /stats | admin | Dashboard numbers |
| GET | /notifications | logged in | List scoped notifications and unread count |
| PATCH | /notifications/:id/read | logged in | Mark one notification read |
| POST | /notifications/read-all | logged in | Mark all scoped notifications read |
| GET | /database | admin | Database engine and table record counts |
| GET | /database/export | admin | JSON export without password hashes |
| GET | /products/:id/reviews | public | Read product reviews and rating summary |
| POST | /products/:id/reviews | customer | Create/update own 1–5-star product review |

## 6. Database tables (SQLite)

- `users` - id, name, email (unique), password_hash, role (`customer` / `admin`), active, created_at
- `products` - id, name, description, category, price, stock, image_url, created_at, updated_at
- `orders` - id, user_id, total, status (`pending`, `paid`, `shipped`, `delivered`, `cancelled`), created_at
- `order_items` - id, order_id, product_id, name, price, qty (name and price are saved at purchase time)
- `notifications` - in-app order/activity notices scoped to a customer or admin audience
- `product_reviews` - one 1–5-star rating per customer/product, with an optional comment

To start fresh, stop the server and delete `data/shop.db`.

## 7. Security built in

- Passwords hashed with bcrypt; login token in an httpOnly, SameSite=strict cookie (2 hour expiry)
- Every admin API route checks the role on the server; the user is re-read from the database on each request, so deactivating or demoting an account takes effect immediately
- Order totals and stock come from the database, never from the browser; stock changes happen in a transaction
- All SQL uses prepared statements; all text is escaped before it is shown in a page
- Helmet headers, login rate limiting, request size limit, and same-site-only redirects after login

## 8. Project structure

```
shopapp/
  server.js              Express app: API + static files
  .env.example           Settings template
  src/
    db.js                Database connection and table creation
    seed.js              Demo data
    util.js              Input validation helpers
    middleware/auth.js   Login cookie, requireAuth, requireAdmin
    routes/              auth, products, orders, users, stats
  public/                Frontend (HTML, css/app.css, js/*.js)
    admin/               Admin panel pages
  data/                  SQLite file appears here
```

## 9. Notifications, ratings, backups and MySQL migration

- Customers receive in-app notifications when an order is placed, cancelled, or its status changes. Admins receive notifications for new orders, customer cancellations, and status changes. Signed-in pages refresh unread counts approximately every 30 seconds.
- Sign-up accepts only Gmail addresses ending in `@gmail.com`; duplicate addresses show a clear message asking the customer to try another Gmail ID or log in. New passwords must be at least 8 characters and at least one of @, #, $, or % (maximum 128 characters).
- Customer signup and order emails are sent to the customer’s registered Gmail address when SMTP is configured. Order emails include item names, quantities, unit prices, line totals, order total, and status (pending, paid, shipped, delivered, or cancelled). Without SMTP configuration, in-app notifications continue to work but email will not be delivered.
- To enable email, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` in `.env`. For Gmail SMTP, use a Google App Password (with 2-Step Verification enabled), not your normal Gmail password. Keep `.env` private and never commit it.
- Customers can leave or update one 1–5-star rating per product. Ratings and review counts appear on product cards.
- Admin Database Management (`/admin/database.html`) provides record counts and a JSON export. The export omits password hashes; store it securely because it contains customer and order information.
- A copy-only migration utility is included at `scripts/migrate-sqlite-to-mysql.js`. Install dependencies, create an empty MySQL database, configure `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DATABASE`, then run `npm run migrate:mysql`. The script stops if destination tables already contain rows and does not delete the SQLite source. Back up first and verify counts before using migrated data.
- **Important:** this migration utility copies data into MySQL; the running app still uses SQLite. Switching the live app to MySQL needs an additional database-adapter change and should be staged and tested separately. Do not point a production app at a migrated database until this is done.

## 10. Going live

Set `NODE_ENV=production` and a strong `JWT_SECRET`, serve the site over HTTPS (the cookie
becomes Secure in production), and change the demo passwords.
#   t e c h m a r t - s o f t 8 0 7  
 