# Landschaft CRM — Clickable Prototype

An internal CRM for a landscaping company that does garden **design**, site
**execution**, and ongoing **maintenance**. This is a clickable prototype: every
screen is real and the interactions work, but there is no backend and no
authentication yet.

Built from the client's structure document (`landschaft_crm_strudcture.pdf`).

## Running it

```bash
cd frontend && npm install && npm run dev
```

Then open http://localhost:5173.

## Two things drive the whole design

**1. Design and Execution are optional modules on one project.**
A project is Design Only, Execution Only, or Design + Execution, and carries
only the phases actually sold. Progress is computed from whichever modules
exist, so a design-only project is never penalised for having no site work.

The three worked examples from the document are seeded so you can check the
arithmetic against their own numbers:

| Project | Phases | Overall |
|---|---|---|
| Residence Landscape Design (design only) | 100 / 80 / 0 / 0 | **45%** |
| Villa Landscape Execution (execution only) | 100 / 65 / 0 | **55%** |
| Resort Landscape (both) | design 100, execution 65 | **82%** |

Maintenance is tracked and displayed but sits outside the percentage — it only
begins after handover.

**2. The foreman is a restricted, mobile-first user.**
Site foremen get `MY SITES → SELECT SITE → DAILY WORK REPORT` and nothing else.
They cannot reach the rest of the CRM; navigating to `/projects` as a foreman
redirects back to the field app.

## Walking the prototype

There is no login. Use the **role switcher** in the top-right to sign in as
anyone in the org chart.

A good demo path:

1. **Ashiq** (foreman) → My Sites → *Panampilly Nagar, Kochi* → fill the report.
   Ticking workers sets the headcount; 10:00 and 15:40 gives 5h 40m
   automatically. Enter an issue other than "Nothing", attach a photo, submit.
2. **Jidhin** (Execution PM) → the dashboard's *Pending Reports* has gone up and
   the issue appears under *Open Issues*. Open the report and **Approve** — the
   Next Day Plan lines become tasks due tomorrow, and the pending count drops.
   Or **Send Back** with a note.
3. **Ashiq** again → the site card shows *Sent Back* with the reviewer's note,
   and the report is editable once more.
4. **Ashfaq** (CEO) → *New Project*. Tick Execution, then MEP, and watch
   Irrigation / Electrical / Drainage appear. The project detail then shows only
   the phases you selected.

## Departments, clients and people

Added after the client's first review of the prototype:

- **AMC is its own department.** It has its own sidebar section (Contracts,
  Visit Schedule, Renewals) instead of sitting under Execution. The old
  `/execution/maintenance` link redirects to `/amc`. Nobody is assigned to the
  AMC department yet. Move people in from Employee → Role in Company.
- **CEO dashboard** shows Design, Execution and AMC as three separate boxes.
  Below them are money owed, approvals and the CEO's own consultations.
- **CEO Consultations** (`/consultations`) is visible to every role. Anyone can
  book a slot on a Monday-to-Saturday, 9:00–18:00 diary. Clashes are refused.
  Only the CEO's office can mark a consultation completed. The person who booked
  it can cancel their own booking.
- **Client details** (`/crm/clients/:id`) has these tabs:
  - **Work History** draws one timeline from leads, site visits, tasks, daily
    reports, AMC visits, payments and resolved clarifications.
  - **Receivables & Follow-ups** shows balances, payment requests,
    transactions and a payment follow-up log.
  - **One tab per department** (Design, Execution, AMC, Accounts) holds that
    department's client clarifications, attachments and internal team chat.
- **Phone and WhatsApp are separate numbers.** A "same as phone" tick mirrors
  the phone into WhatsApp. Clients and employees both use this.
- **Employee details** (`/employees/:id`, or *My profile* in the role switcher)
  has these tabs:
  - **Profile**: photo, personal details and family details.
  - **Works**: tasks, projects, reports, site visits and bookings.
  - **Attendance**: a monthly calendar. Managers click a day to change it.
  - **Role in Company**: role, department, reporting line, extra
    responsibilities and system access.

  Personal and family fields start blank in the seed. The names come from the
  client's real org chart, so the prototype does not invent personal details
  for them.

## Second review round

- **Sidebar shows main sections only.** Sub-pages (Leads / Clients / Site Visits,
  Concept / 3D / Civil / BOQ, and so on) appear as tabs at the top of each section.
- **Roles & Permissions** in Settings: tick View / Create / Edit / Delete per
  module for each role. View controls the sidebar and blocks the URL; the other
  three control which buttons appear. Super Admin is always full; foremen stay
  in the field app.
- **Create, edit and delete** for employees, execution workers, clients, leads,
  site visits, tasks and BOQs / quotations, with a confirm step before deleting.
- **Tasks** gain an *All Tasks* view, a time filter (today, this week, this
  month, overdue, custom range) plus project / assignee / priority filters, and
  drag-and-drop on the Task Board.
- **Site photos twice a day.** The foreman's report has separate Morning and
  Evening photo sections; when photos are mandatory, both are required.
- **Gallery** (`/gallery`) shows every project's daily photos in one window,
  filtered by project, day or date range, and session. Each project also has a
  *Site Photos* tab.
- **Execution worker detail pages** (`/employees/workers/:id`) cover profile,
  day rate, attendance calendar, sites worked, work history and AMC visits.
- **Attendance** is one register for employees and workers: mark P / H / L / A
  with time in, time out and overtime for the day; a month grid with totals;
  click a date to make it a holiday. Workers fill in from the daily reports.
- **Anees** carries the designation *Co-Founder & Design Director*. Any
  employee can be given a designation.
- **Calendar** has tick-box filters per event type and an "only mine" option.
- **CEO consultations** can be postponed to a free slot with a reason; the
  history is kept.
- **BOQ & Quotation** follow the project type: Design only → BOQ, Execution
  only → Quotation, Design + Execution → both. Each project has a checklist tab.
- **Map location** on project creation (OpenStreetMap; search, click or use
  the device location). The project page shows the pin and a Google Maps link.

The data version moved to v3, so earlier browser data is replaced by the new
seed on first load.

## Third review round

- **Logo.** The company mark (`public/logo.svg`) appears in the sidebar, the
  foreman app header and the browser tab (`public/favicon.svg`).
- **Photo compression on upload.** Foreman photos are shrunk on the phone
  before they are saved: longest side 1600 px, and quality stepped down until
  each photo is under 300 KB. Both limits are set in Settings → Daily Work
  Report. The report shows the saving, e.g. "4.2 MB → 220 KB".
- **Project remarks.** A WhatsApp-style chat on every project (*Remarks*
  tab). It has day dividers, replies that quote the message, photo
  attachments, emoji and unread counts. Foremen reach the same thread for
  their sites from the field app.
- **Client picker** on New Project. Search clients, turn a won lead into a
  client on the spot, or add a new client without leaving the form.
- **Leads get a WhatsApp number**, with the "same as phone" tick box clients
  already had. It carries over when the lead becomes a client.
- **AMC as a project service.** New Project offers Design, Execution and AMC,
  and a project can be AMC only. Ticking AMC opens the contract section:
  term, value, team, scope, and how often the site is visited. The interval
  can be weekly, fortnightly, monthly, quarterly, or every N days, weeks or
  months, with reminders N days before each visit and before renewal.
- **AMC calendar and reminders** (`/amc/calendar`). Each contract's repeat
  visits appear on a month calendar, colour-coded per contract. A reminders
  panel lists visits inside their reminder window, overdue visits and
  renewals due. Visits can be marked done or moved, and moving one keeps the
  rest of the schedule. Each contract's schedule can be changed from the AMC
  section. The main Calendar and the CEO dashboard read from the same schedule.
- **AMC Projects** tab under Projects.
- **Foreman app** now has a bottom tab bar with five screens:
  - *Sites*: today's reports and the site remarks.
  - *Works*: past reports by month and site.
  - *Attendance*: their own month.
  - *Pay*: salary earned so far from attendance, payments, advances, TA and
    the balance due.
  - *Profile*: edit contact details and photo, and call or WhatsApp their PM.
- **Staff pay.** Employee and worker pages have a *Payments* / *Wages* tab
  for recording salary, wages, advances, TA, bonus and deductions. Earnings
  are worked out from attendance: monthly salary pro rata, or the day rate.

The data version moved to v4, so browser data is replaced by the new seed on
first load. The sample salaries and wage payments for the foremen and site
workers are invented for the demo.

## Fourth review round

- **Refreshing on Vercel no longer 404s.** `frontend/vercel.json` rewrites
  every path to `index.html`, so a deep link such as `/projects/p3` loads
  the app and the router shows the page. The Vercel project's root directory
  must be `frontend`.
- **Dashboard time filter.** Every dashboard has Today · Week · Month · Year.
  Leads, new business, money received, reports, worker-days, tasks, AMC
  visits and consultations follow the period. Standing figures such as
  receivables and the review queue stay as they are today.
- **Projects map** (`/projects/map`, the Map tab under Projects). Every
  pinned site on one map, filtered by service, status, manager, client,
  delayed only, or search. Pins are coloured by status or by service.
  Clicking a pin shows the project with a directions link. Projects without
  a pin are listed so they can be pinned.
- **Reports** filter by period:
  - presets: today, week, month, last month, quarter, year, all time
  - or a custom date range.

  They also filter by service, project status, manager, client and lead
  source. **Export to Excel** downloads one `.xlsx` with the sheets Summary,
  Projects, Payments, Leads, Daily Reports, Tasks, AMC Visits and Foremen,
  all with the same filters and with real dates and amounts.
- **Client import from Excel** (Clients → Import from Excel). The modal:
  - offers a template to download
  - reads `.xlsx` or `.csv`
  - recognises common column titles (Name/Customer, Phone/Mobile,
    Address/Location…)
  - checks every row and flags duplicates against existing clients before
    anything is saved.

  **Export** downloads the client list.
- **Calendar reminders.** *Add reminder* on the calendar (and on any day),
  with a time and a repeat (daily, weekly, monthly or yearly, optionally
  until a date). A reminder can be for yourself, chosen people or everyone,
  and can be tied to a project. Repeats are ticked off one date at a time.
  The bell in the header shows today's and missed reminders on every page.

## What the document asked to keep configurable

These live in **Settings** rather than being hard-coded:

- **Design payment split** — defaults to 50/20/15/15, with the 25/25/25/25
  alternative as a preset. Any combination totalling 100 is accepted.
- **TA** — kept as the client's own term. Foremen record distance per worker;
  no amount is calculated until a rate per km is set. Off by default, because
  the document deliberately does not define the calculation.
- **Photos** — mandatory or optional on the daily report.
- **Free maintenance period** — one month by default, before AMC begins.

Overtime is recorded separately from working hours and can only be adjusted by
an authorised role, never on site.

## Deliberately absent

Materials, Inventory, Purchasing and Vendors were removed by the client and
appear nowhere. There is no client login — internal employees only.

## Structure

```
frontend/src/
├── domain/       types, roles + permissions, progress, finance, consultations, formatting
├── api/          client.ts is the seam; mockAdapter.ts holds the behaviour
├── mock/         seeded data and the persisted store
├── shells/       AdminShell (desktop CRM) and FieldShell (foreman mobile)
├── components/   progress, repeaters, worker picker, photo grid, shared UI
└── pages/        one folder per navigation section
```

State lives in the browser (`localStorage`), so a submitted report survives a
reload and the dashboards genuinely move when you act. **Settings → Reset
prototype data** restores the seed.

## Wiring up the real backend

The target stack is FastAPI + Postgres + React SPA. `src/api/client.ts` defines
a typed `Api` interface and exports a single binding:

```ts
export const api: Api = mock.adapter
```

Swapping to the real backend means writing an `httpAdapter` against the same
interface and changing that one line. No page imports the mock directly.
