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
