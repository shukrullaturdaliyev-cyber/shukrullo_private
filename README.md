# Shukrullo's personal zettelkasten

A private, single-user operations dashboard with three faces and a set of shared modules.

* **Work** — head of the English department at an SAT-prep school: overview, teacher 1-1 journals, tasks, CSV report engines.
* **CAU** (Central Asian University) — overview, timetable, courses, tasks, lecture notes (*Konspekty*).
* **Apply** — the admissions cycle: universities and scholarships, requirement checklists, essays, recommenders,
  tests and scores, its own task board.
* **Everywhere** — a Today page across all three faces, a native calendar with two-way Google sync, habits, goals and
  the weekly review, an Obsidian-style note vault, a health log, finances, settings.

One user, one passphrase. The app itself is static; data lives in a Cloudflare KV namespace and is
mirrored into `localStorage` so nothing is ever lost when the network is not there.

---

## What is in the repository

```
public/index.html          the whole shell
public/style.css           the design system (dark only, four themes)
public/app.js              the entire app — routing, modules, engines
public/vendor/             Chart.js 4, PapaParse 5, marked, lz-string,
                           React 18 + ReactDOM UMD, Excalidraw 0.17.6 + excalidraw-assets/
public/_headers            security + caching headers for Cloudflare Pages
functions/api/data/[collection].js   JSON blob store on KV
functions/api/google/[[path]].js     Google Calendar OAuth bridge and API proxy
dev/seed.js                development seed data (never served — see "Trying it locally")
```

No build step, no framework, no CDN calls at runtime except Google Fonts.

---

## Deploying to Cloudflare Pages

1. **Push this repository to a private GitHub repo.**

2. **Create the Pages project.** Cloudflare dashboard → *Workers & Pages* → *Pages* → *Connect to Git* →
   pick the repo.
   * Framework preset: **None**
   * Build command: **leave empty**
   * Build output directory: **`public`**

3. **Create the KV namespace and bind it.** *Workers & Pages* → *KV* → *Create namespace*, call it
   `desk`. Then in the Pages project → *Settings* → *Bindings* → *KV namespace bindings* → add
   **Variable name `DESK`** → namespace `desk`. Add it for **Production** and **Preview**.

4. **Add the secrets.** Pages project → *Settings* → *Variables and Secrets* (encrypted):
   * `SITE_PASSPHRASE` — the passphrase that unlocks the app. Required.
   * `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` — only needed for the calendar.

5. **Retry the deployment.** Bindings and secrets added after the first build are only picked up by a
   new deployment: *Deployments* → *Retry deployment*.

Open `https://<site>.pages.dev`, enter the passphrase, and the desk is live. Every device that knows the
passphrase sees the same data.

### Google Calendar (free, no billing account needed)

1. [Google Cloud Console](https://console.cloud.google.com) → new project.
2. *APIs & Services* → *Library* → enable **Google Calendar API**.
3. *OAuth consent screen* → **External** → fill in the app name and your email → under *Test users* add
   your own Gmail address(es). Leave the app in **testing** mode; for a single user that never expires
   into a review process, which is exactly what you want.
4. *Credentials* → *Create credentials* → *OAuth client ID* → **Web application**.
   Authorised redirect URI:

   ```
   https://<site>.pages.dev/api/google/callback
   ```

5. Copy the client ID and secret into the Pages secrets (step 4 above) and redeploy.
6. In the app: *Settings* → *Google Calendar* → **Connect**, approve the consent screen. It comes back
   to the calendar page with your calendars merged in.

The refresh token is stored in KV, never in the browser. Access tokens are refreshed server-side and
cached in KV with their expiry. Everything except the OAuth callback requires the passphrase header.

### Netlify

Netlify is not included as a second backend. Cloudflare is the target because Netlify's free plan meters
deploys, and the KV-backed functions here have no Netlify equivalent without a rewrite against Netlify
Blobs. If you ever want it, the two functions in `functions/` are the only server-side code to port.

---

## Trying it locally

The front end runs off any static server; the API calls will 404 and the app falls back to
**device-only mode** (the sync pill reads *this device*, everything still works and is stored in
`localStorage`).

```bash
python3 -m http.server 8788 --directory public
```

For the full thing including the functions, use Wrangler:

```bash
npx wrangler pages dev public --kv DESK
```

To fill an empty desk with realistic sample data (teachers with groups, two weekly exam exports, a
Google-Forms-shaped survey, courses, a timetable, transactions, a small note vault with one drawing),
open the browser console on a running instance and paste:

```js
fetch('/dev/seed.js').then(r => r.text()).then(eval)
```

`dev/` is outside `public/`, so on the deployed site that file does not exist — copy it into `public/`
temporarily if you want to seed the live desk, then delete it.

---

## How the pieces work

### Storage

Ten KV keys hold the collections: `settings`, `notes` (the index only), `teachers`, `tasks`, `uni`,
`finances`, `datasets`, `habits`, `goals`, `health`. Each note **body** lives in its own key `n_<id>` (`{"t": "…"}`) so a large vault
never runs into a value-size limit; bodies load lazily, are cached in memory and saved debounced.

Every save writes `localStorage` immediately and schedules a `PUT`. If the `PUT` fails the sync pill
turns red ("not saved") and a toast appears — the local copy is never discarded. *Settings* has a
**Download backup** (one JSON file including every note body) and **Restore**.

### Report engines — arithmetic only, no AI

Drop CSVs on the *Reports* page or link a Google Sheet (a normal share link is converted to
`/export?format=csv` and refetched on every open). Files are typed automatically and every column
mapping can be overridden in the **Columns** dialog.

* **Exam engine** — built for a `Student, Score, Group, Exam` export. It detects the score scale
  (≤ 100 → percent with 90/80/70 thresholds; otherwise SAT with 1500/1400/1300), attributes results to
  teachers through their **group lists** when the file has no teacher column — tenure-aware, so a week
  goes to whoever held the group that week — and buckets everything into ISO weeks (guessed from the
  filename, editable). Output: KPI row with vs-previous deltas, findings in sentences, ranked tables for
  teachers/groups/exams/branches, a median-per-teacher line over every uploaded week, a score
  distribution, student movers matched by name across the last two periods, duplicate-row detection and
  a needs-attention list.
* **Survey engine** — built for the monthly Google Forms quality survey with its ~27 long question
  headers and repeated columns. Roles are found by prioritised key lists (the *English* teacher question
  always beats a generic "teacher", and never a math/support one). Rows answering "I don't study
  English" and rows with no rating at all are dropped. Output: responses, CSAT, NPS and unhappy count
  with deltas, findings including small-sample warnings, a per-teacher table, CSAT over months, the
  0–10 recommendation spread, and every comment sorted worst-rating-first.
* **Generic fallback** — per-numeric statistics, a mean-by-category chart and a ranking, plus a nudge to
  map the columns properly.

### Teachers

Adding a teacher only asks for a name. Their page is a journal: *Note / Feedback / Task for me / Task for
them*, a date field and Ctrl+Enter to save. Under *Edit → Admin* live the groups they teach (this is what
the exam engine attributes through) and their joined/left dates. Setting **Left on** archives them into a
collapsed *Former teachers* list — history kept, excluded from the overview. A scorecard pulled from the
uploaded datasets loads on the profile.

### Today, habits and repeats

**Today** is the front door and the only page that spans both faces: what is overdue or due today, habits
with one-tap ticks, the day's classes, what you owe teachers, and the rest of the week. *Daily note* opens
(or creates) `Journal/YYYY-MM-DD` in the vault.

**Habits** are either daily or *N days a week*; the weekly kind stops asking once the number is met. Ticks
are stored as one id list per date, so the blob stays small. Streaks count days for daily habits and whole
weeks for weekly ones, and an unticked today counts as still open rather than already broken. The page has
a Mon–Sun strip you can tick straight into, a 30-day keep rate, and a square per day over twelve weeks.

**Repeating tasks** carry a rule of every *N* days, weeks or months. Finishing one rolls it forward instead
of leaving a dead card: the run is filed in `history`, steps come back undone and keep their distance from
the deadline, and the next date is stepped until it is genuinely ahead, so finishing late never queues up
dates already gone. Monthly repeats keep a day-of-month anchor, so the 31st runs Jan 31 → Feb 28 → Mar 31
rather than sticking to the 28th.

### Goals and the weekly review

Goals sit on three horizons — year, quarter, month — and each knows the window it covers, so "this quarter"
still means something in December. Link tasks to a goal and its bar is the average of their progress, with a
finished task counting as whole; only a goal with nothing linked falls back to its own slider. Tasks attach
from either side, and the page lists open tasks serving no goal at all.

The **weekly review** gathers the week before asking anything — what closed (repeat runs included), what
slipped past its date, how each habit did against what it owed, 1-1 entries, money spent, deadlines in the
next seven days — then asks three questions and files itself, optionally as a dated note in `Reviews/`.

### Health

One row a calendar day, every field optional, and a day with nothing in it is not kept. Sleep is entered as
lights-out and waking rather than a number of hours, so 23:40 → 06:15 reads as 6h 35m instead of going
negative across midnight; nights under six hours are marked short. Charts for hours a night over 30 days and
weight over the last 90 readings. Logging a day that already exists fills its gaps rather than replacing it.

### Admissions

One row per university or scholarship, each carrying everything that application needs.

* **The application** — kind, programme, level, country, round (ED/ED2/EA/REA/RD/rolling), deadline, decision date,
  portal link, fee, cost a year and aid a year. Net cost is cost minus aid, so offers can be compared on what you
  would actually pay.
* **Stage** — researching → preparing → submitted → interview → decided, moved by clicking the stepper. Reaching
  *decided* with no answer recorded opens the decision dialog; that stores the outcome, the aid offered and the
  reply-by date.
* **Checklist** — a new application starts with the usual list for its kind (transcript, personal statement, letters,
  English test, passport, CV, financial documents, fee), each item tickable, datable and annotatable. **Paste list**
  takes a requirements page straight off a university site, one per line, strips bullets and numbering, and skips
  anything already on the checklist.
* **Essays** — one essay can serve several applications and counts on all of them. Each keeps the prompt in the
  university's own words, the limit in words or characters, and a status (idea → draft → revising → final).
  **Write** creates the draft as a note under `Admissions/Essays` and opens the vault writer on it.
* **Recommenders** — the people writing for you, with role, organisation and contact. Per application a letter moves
  asked → agreed → submitted with one click, and the recommenders page shows who is still owed on what.
* **Tests** — IELTS, SAT and the rest: sitting date, status, score against target, section scores, fee, and the date
  the score stops counting. Scores expiring within a year are called out.
* **Interviews and tasks** — an interview has a date, time, mode and notes; a task on the *Apply* board can be tied to
  one application and shows on its page.

Nothing is silent: the overview lists a passed deadline as late, and within three weeks of one it names outstanding
requirements, letters not yet in, essays still in draft and fees not yet paid. Deadlines, decision dates, reply-by
dates and interviews all reach the Today page and the calendar.

### The vault

Folder tree with persisted collapse state, search across title/path/tags, a Move dialog with folder
autocomplete, `[[wikilinks]]` with aliases and headings, `![[embeds]]`, backlinks computed from the
links stored on each note at save time, and clicking a missing link creates that note in the current
folder. The writer is a centred 68ch column with fading controls, a Write/Read toggle and a Zen mode.
**Import vault** takes an Obsidian folder (`webkitdirectory`), keeps the relative paths, skips
`.obsidian/.trash/.git`, parses front-matter and inline `#tags`, unpacks `.excalidraw.md` files
(including `compressed-json` via lz-string) and updates in place by path + title — it never deletes.
Notes of kind `excalidraw` open the real Excalidraw editor, autosaving standard `.excalidraw` JSON into
the note body.

### Money that moved instead of being spent

Savings goals are pots with a target. Link the account the money actually sits in and the bar follows its
balance; otherwise keep the figure by hand.

The nudge matters more: an expense whose category or note reads like a move rather than a purchase —
*savings*, *avans*, *deposit*, *transfer*, *withdrawal*, or the name of one of your own accounts — is listed
under **Moved, or spent?** with the total it is adding to the month. One button files it as a real transfer,
so the money stays on the books, leaves the spending total, and lands where a savings goal can see it.

### Calendar

Day, week and month views drawn by the app: lane-packed overlapping events, a red now-line scrolled into
view, an all-day row, and `+N more` in month cells jumping to that day. Five kinds of source are merged —
timetable (expanded per week and limited to the semester dates), exams, deadlines (task *and* step due
dates, on every face), admissions dates (deadlines, decisions, reply-by dates and interviews), logged 1-1s,
and every Google calendar in its own colour. Legend chips toggle each source and the
hidden set persists. Clicking an empty slot opens *New event* with a destination: any Google calendar you
can write to, or "Desk · task deadline" which creates a task instead.

---

## Keyboard

| Key | Where |
| --- | --- |
| `Enter` | submits any dialog |
| `Esc` | closes a dialog, leaves Zen mode |
| `Ctrl`/`Cmd` + `Enter` | saves a journal entry |
| `Tab` | inserts two spaces inside the note editor |
