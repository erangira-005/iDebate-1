# Coach Field Log

A small web app for coaches to record what happens at schools: school profiles, student profiles, daily session reports with attendance, and pre/post assessment scores. Everyone's entries land in one shared database, ready for analysis. Admins can also build extra forms without touching code.

It is a plain website (no build step), so you host it for free on **GitHub Pages**. The shared data and the logins live in **Supabase** (free plan), because GitHub Pages can only serve files, not store data.

```
Coach's phone or laptop  ──►  your GitHub Pages site  ──►  your Supabase project
                              (this repo's files)          (logins + all records)
```

You will do four things: create a Supabase project, paste two values into `config.js`, put the repo on GitHub, switch on Pages. About 20 minutes.

---

## Setup

### 1. Create the database (Supabase)

1. Sign up at [supabase.com](https://supabase.com) and click **New project**. Pick a region close to your coaches. Save the database password somewhere safe.
2. Open **SQL Editor → New query**, paste the whole of `schema.sql` from this repo and click **Run**. You should see "Success". Running it again later is harmless.

### 2. Decide how sign-up works

Open **Authentication → Sign In / Providers → Email**.

- **Confirm email**: with it on, new people must click a link in an email before they can sign in. Supabase's built-in email sender only delivers to addresses on your own Supabase team and is capped at about 2 emails an hour, so without your own email service (custom SMTP) your coaches would never receive the link. For a small team the simple choice is to **turn it off**. Admin approval (below) is the real gate either way. If you set up custom SMTP and keep it on, also set **Authentication → URL Configuration → Site URL** to your Pages address from step 4.
- **Allow new users to sign up**: leave it on if coaches will create their own accounts. If you would rather add everyone yourself, turn it off and use **Authentication → Users → Add user**. They still need approval in the app's People tab.

Menu names move around now and then; the setting names above are what to look for.

### 3. Connect the app to the database

In Supabase open **Settings → API Keys** (or click **Connect** at the top of the dashboard) and copy two things:

- the **Project URL**, like `https://abcdefgh.supabase.co`
- the **publishable key** (starts `sb_publishable_`; older projects call it the **anon** key)

Paste them into `config.js`. These two values are meant to be public. What protects the data is the login plus the rules in `schema.sql`. **Never** paste the `secret` or `service_role` key anywhere in this repo.

### 4. Put it on GitHub and turn on Pages

1. On GitHub create a **new repository**. Make it **public**: GitHub Pages is free only for public repositories on a free account. Your data is not in the repo; only the app's code is.
2. Upload every file from this folder, or push them with git (or GitHub Desktop). `.github` and `.nojekyll` are hidden files; some drag-and-drop uploads skip them. The site works without them, so they are optional extras.
3. Go to the repo's **Settings → Pages**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and Save. After a minute or two the page shows your address: `https://<your-username>.github.io/<repo-name>/`.

Anyone with the address can open the page, but without an approved account they see only a sign-in screen and the database returns nothing to them.

### 5. Create your admin account first

Open your site and choose **Create an account**. **The first account ever created becomes the admin**, so do this yourself before you share the link with anyone. After that, every new account waits for approval.

### 6. Bring in the coaches

Send them the address. Each coach creates an account (name, email, password of 8+ characters) and sees "Waiting for approval". You open **People**, check that the name and email belong to someone you know, and press **Approve**. Only approve people you recognise: with Confirm email off, anyone can type any email address.

---

## Google sign-in (optional)

A **Continue with Google** button can sit above the email and password form. Google has already checked the person's email address, so there is no password to forget or mistype. New Google accounts still wait for admin approval in People, exactly like everyone else, and coaches without a Google account can keep using a password. It is switched off until you finish the steps below, and costs nothing.

1. **Google Cloud Console** ([console.cloud.google.com](https://console.cloud.google.com)): create or choose a project. Open **Google Auth Platform** (older menus: APIs & Services → OAuth consent screen) and fill in the app name (for example "Coach Field Log"), a support email and a contact email. Choose **External** as the audience. The default sign-in details (email, profile) are all the app needs. Under **Audience**, publish the app (status **In production**), otherwise only people on a test-users list can sign in.
2. In the same place open **Clients → Create client** and choose **Web application**. Under **Authorized JavaScript origins** add your site's address without any path, for example `https://erangira-005.github.io`. Under **Authorized redirect URIs** add your Supabase callback address, `https://<your-project>.supabase.co/auth/v1/callback`. Supabase shows the exact one on its Google provider page, so copy it from there. Create the client and copy the **Client ID** and **Client secret**.
3. **Supabase**: **Authentication → Sign In / Providers → Google**. Switch it on, paste the Client ID and secret, and save.
4. **Supabase**: **Authentication → URL Configuration**. Set **Site URL** to the address your site opens at, for example `https://erangira-005.github.io/iDebate-1/`, and add the same address followed by `**` under **Redirect URLs**. If Site URL is left at its default, people come back from Google to a page that does not exist.
5. In `config.js` change `googleSignIn: false` to `googleSignIn: true` and commit. Within a minute or two, refresh the site: the button appears.
6. Try it once with a test account: sign out, press **Continue with Google**, choose an account. You should land on "Waiting for approval", and the person appears in **People**.

Notes: if a coach already has a password account and then uses Google with the same email address, Supabase should treat them as one person; check this once with a test account before relying on it. If the button shows "Google sign-in is not fully set up yet", one of the steps above is missing or mistyped; a "redirect_uri_mismatch" message from Google means the redirect address in step 2 does not exactly match Supabase's.

## Using it

| Who | Can do |
|---|---|
| Approved coach | Fill in all forms for the schools they are assigned to, see everything recorded at those schools, edit or delete their own records, download CSV |
| Admin | See every school; edit or delete anyone's records; **Build a form**; manage **People** (approve, make admin, remove access, **assign schools**, reset a password) |

### Which school a coach can see

A coach sees only the schools an admin has assigned to them, and everything recorded at those schools (students, sessions, scores), including entries by other coaches there. This is enforced in the database, so it holds even if someone calls the database directly.

- **Assign schools:** People → press **Schools** on a coach → tick the schools they work at. Changes apply straight away (a coach's open page catches up within about 30 seconds or on refresh).
- **A coach who adds a school profile is assigned to it automatically.** Anyone else working at that school needs to be ticked by an admin.
- A coach with no school assigned sees an empty app and a message saying so. Their **My schools** tab shows numbers for their schools only, with a filter when there is more than one.
- **Custom forms** made with Build a form have no school question, so a coach sees only their own entries for them (admins see all). A custom form that does carry a school follows that school's rules.
- All coaches can still see each other's names and emails (so records can say who entered them), and everyone sees the list of form definitions.
- **Upgrading an existing database:** running the new `schema.sql` keeps each school visible to the coach who created it. Everyone else loses access until you assign schools in People. Re-running the file later does not undo assignments or removals.

- **Forms**: School profile and Student profile once each; Session report (with a Present / Absent / Excused tap list for the school's students) and Assessment scores each time. "Save and add another" keeps the school selected.
- **Overview**: attendance rate, pre and post averages and the change, hours delivered, per school and per coach.
- **Build a form** (admin): name a form, add questions (text, number, date, choice, and so on), and it appears for everyone. Its records are stored like any other.
- Every record shows who recorded it and when. That is stamped by the database, so it cannot be faked from the browser.

## Getting the data out for analysis

Two ways:

1. **CSV from the app.** Open any form's list and press **Download CSV**. Session and assessment files have one row per student.
2. **Ready-made tables in Supabase.** Under **Table Editor** you will find views that turn the stored records into ordinary tables. Each has an **Export to CSV** button, and you can query them in the SQL Editor or connect Excel, Power BI, Looker Studio, R or Python to the database.

| View | One row per | Useful columns |
|---|---|---|
| `analysis_schools` | school | name, region, type, learners |
| `analysis_students` | student | school, name, grade, consent |
| `analysis_sessions` | session report | date, school, coach, module, hours, present / absent / excused counts, attendance % |
| `analysis_attendance` | student in a session | session, student, status |
| `analysis_assessments` | student score | school, student, type (Pre/Post), score, max, `score_pct` |
| `analysis_pre_post` | student and module | `pre_pct`, `post_pct`, `change_points` |

Custom forms made with **Build a form** are not in these views. Their records are in the `records` table (one JSON document each) and in each form's CSV.

## Things you should know about the free plan

- **Pausing.** A free Supabase project is paused after about a week without activity. Your data is kept, and you un-pause it with one click in the dashboard, but until then the app cannot load. The included workflow `.github/workflows/keepalive.yml` calls the database twice a week to help prevent this. It needs no setup. GitHub switches scheduled workflows off after 60 days with no activity in the repo; if that happens, re-enable it in the **Actions** tab. Delete the file if you do not want it.
- **No backups.** The free plan does not include automatic backups. Download the CSVs (or the `analysis_*` views) regularly, for example at the end of each month, and keep them somewhere safe. A paid Supabase plan adds backups.
- **Size.** 500 MB of database on the free plan is a lot for text records; you are unlikely to reach it.
- **Reliability.** A free project has no uptime guarantee. If coaches depend on this daily, consider the paid plan.

## Child data and privacy

The app stores names, dates of birth, guardian contacts and consent status for students. Before real use:

- Check your organisation's rules and your country's data-protection law, and get the consent you need. The Student profile has a consent field, but the app does not enforce anything about it.
- Collect only what you need. If you do not need guardian phone numbers or birth dates, remove those fields from `BUILTIN` in `app.js`.
- Choose the Supabase region deliberately; it decides where the data physically sits.
- Keep the admin list short, and use **Remove access** in People when a coach leaves.
- A coach sees only the schools an admin assigns to them, but admins see everything, so keep the admin list short.

## Passwords

- **Show / Hide.** Every password box has a Show button so people can check what they typed, and sign-up asks for the password twice. Emails are lower-cased and trimmed automatically.
- **Change your own password.** Signed-in people tap **Password** at the top of the page.
- **Forgot your password.** The sign-in screen says to ask an admin. The admin opens **People**, presses **Reset password** next to the person's name, and gives them the temporary password shown (the app suggests a random one; the admin can type their own). The person signs in and chooses their own under **Password**. This works without any email, which matters because Supabase's built-in email cannot reach your coaches (see step 2).
- **If someone gets "That email and password do not match an account".** That message comes from the sign-in service and appears before approval is checked, so approval is not the cause. The usual causes are a mistyped email, or a password that is not what the person thinks they typed when they signed up (it was hidden). Have them tap Show, and if it still fails, reset their password from People. In Supabase, **Authentication → Users** shows whether the account exists, and **Authentication → Logs** shows the exact reason for each failed sign-in.
- Resetting needs the `admin_set_password` function from the latest `schema.sql`. If you see "Run the latest schema.sql", paste the file into the SQL Editor again and run it; running it twice is harmless.

## Updating the app

Edit files directly on GitHub (pencil icon) and commit; the site updates within a minute or two. If a new version of `schema.sql` is released, run it again in the SQL Editor: it is safe to repeat. Coaches may need to refresh the page to get the new version.

## What is in this repo

| File | What it is |
|---|---|
| `index.html`, `style.css`, `app.js` | The app: screens, forms, validation, overview |
| `backend.js` | The only file that talks to Supabase (sign-in, saving, live updates). Swap it to use a different database |
| `config.js` | Your Supabase URL and publishable key |
| `schema.sql` | Tables, access rules and analysis views, run once in Supabase |
| `vendor/supabase.js` | A copy of the Supabase client library (v2.118.0, MIT licence in `vendor/`), so the page does not depend on a third-party download |
| `.github/workflows/keepalive.yml` | Optional keep-awake ping |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |

## How the data is protected

- Only signed-in, approved people can read or write anything. Signed-out and not-yet-approved visitors get nothing from the database. Approved coaches reach only their assigned schools.
- Authors and admins can edit or delete a record; other coaches cannot. Only admins can create custom forms, approve people or change roles. These rules are enforced inside the database (row level security), not just hidden in the page, so they hold even if someone calls the database directly with the public key.
- The author and timestamps are stamped by the database.
- The `analysis_*` views obey the same rules as the records they read.

## What was and was not tested

Tested while building this repo:

- `schema.sql` was run in a real PostgreSQL engine (PGlite) with 135 checks: the first account becoming admin, signed-out and unapproved users being refused, people being unable to approve or promote themselves, authorship being stamped on the server, who can edit or delete what, coaches seeing and changing only their assigned schools (records, views, custom forms), admins alone assigning schools, upgrading a database that already holds data, admin-only custom forms, the admin-only password reset (including that the stored value is a bcrypt hash and that non-admins are refused), and the analysis views returning the right numbers under the same access rules.
- The app screens and flows were run in a simulated browser (158 checks): sign-in and sign-up validation, Show/Hide, the retype box, friendly error messages, the waiting-for-approval screen, approving people, resetting a password, changing your own password, assigning schools and the coach's school-only view, sign-out, adding schools, students, sessions with attendance and assessments with scores, editing, deleting, CSV files, the overview numbers and building a custom form. A mobile-width screenshot of the main screens was reviewed.
- `backend.js` was tested against a stand-in for the Supabase library (97 checks): record mapping, paging past 1,000 rows, live-update refreshes, error handling, sign-in and sign-up results. The real library file also loads and shows the sign-in screen.

Not tested: a real, live Supabase project, and the Google sign-in round trip (it needs your own Google and Supabase setup). In particular, I could not confirm against the real sign-in service that a password set by an admin through `admin_set_password` is accepted at sign-in; try it once on a test account. Likewise, school-by-school access was checked in a real Postgres engine, but not through Supabase's own data service: after upgrading, check once that a test coach can add a school profile and then see it. The sign-in service, the live-update connection, the email settings and the dashboard menus were not run end to end, because that needs your own project. Expect to spend a few minutes on first setup double-checking those; if something does not work, the browser's developer console (F12) usually names the cause.

## Licence

The app code is yours to use and change. `vendor/supabase.js` is the Supabase client library under its own MIT licence (`vendor/supabase-js.LICENSE`).
