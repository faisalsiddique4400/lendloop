# LendLoop test cases

Two kinds of tests: automated ones you run with one command, and manual ones you click through in the browser.

## Automated

```bash
npm test
```

They run against an in-memory Convex, so nothing needs to be running.

| Area | What the tests prove |
|---|---|
| Dates (`convex/lib/dates.test.ts`) | Month-end math, overlapping bookings, the Tomorrow / This weekend / A week presets, overdue and due-back labels, impossible dates rejected |
| Signing (`convex/lib/hmac.test.ts`) | HMAC matches the standard test vector; wrong body, secret or signature is refused |
| Users (`convex/users.test.ts`) | One row per user, a missing name never exposes the email, only admins list or trust neighbors, `makeAdmin` ignores email case |
| Access (`convex/guards.test.ts`) | Every signed-in function refuses a signed-out caller; a non-owner can't return or remind |
| Tools (`convex/tools.test.ts`) | Name and description limits, availability and bookings, the public list hides owners, only the owner edits, delete blocked while lent out |
| Loans (`convex/loans.test.ts`) | Can't borrow your own tool, no past dates, no clashes, owner decides once, stale requests can't be approved, one reminder a day |
| Inbox (`convex/notifications.test.ts`) | Each event writes once, people only see their own notices, admins get alerts once |
| n8n sender (`convex/n8n.test.ts`) | Signed body with no names, 3 retries then an admin alert, missing settings alert instead of crashing |
| n8n routes (`convex/http.test.ts`) | Replays write nothing new; bad signature, stale time and missing fields are refused |
| Browse filter and sort (`lib/filterTools.test.ts`) | Search, category and "Available now" work together; sort by newest, name or available first |
| Status filter (`lib/filterLoans.test.ts`) | Loans group into Waiting, Out now, Overdue and Closed with the right counts; search matches the tool or either neighbor |

Also run `npm run typecheck` and `npm run lint`. Both should print no errors.

### Signed routes against the running app

```bash
CONVEX_SITE_URL=http://127.0.0.1:3211 LENDLOOP_HMAC_SECRET=<secret from .env> scripts/smoke.sh
```

Every line should start with `ok`.

## Manual

Start the app (`npx convex dev`, `npm run dev`, `docker compose up -d n8n`). Use two users: **A** in a normal window, **B** in a private window. Make A admin with `npx convex run users:makeAdmin '{"email":"<A's email>"}'`.

| # | Steps | Expected |
|---|---|---|
| 1 | Open http://localhost:3000 signed out | Headline word cycles, the Drill chip loops, "How it works" and "Free to borrow today" show |
| 2 | Turn on "reduce motion" in your OS, reload | Nothing moves, the page still reads correctly |
| 3 | Open http://localhost:3000/tools signed out | "Sign in to see your neighbors' tools" with a Sign in button |
| 4 | Sign in as A, go to My listings, click Save tool with an empty name | "Give the tool a name." under the field |
| 5 | Add a tool with a name and a short description | Toast confirms, row appears, counter shows characters used out of 200 |
| 6 | Edit the tool, change its condition, save | Toast "Changes saved.", row updates |
| 7 | As B, open Browse, press `/` | Search box gets focus |
| 8 | Type part of A's tool name, then try a category and "Available now" | List filters as you type and click |
| 9 | Click Request, click "This weekend" | Both dates fill, day count shows |
| 10 | Set the end date before the start date | "The end date is before the start." and Send is disabled |
| 11 | Pick valid dates, Send | Dialog closes, toast "Request sent. A gets a notice now." |
| 12 | As A, open Requests (keep it open before step 11 to see it live) | New row appears without reload and flashes once; "Waiting", "Starts in N days" |
| 13 | As A, open Inbox | "A neighbor wants to borrow your …" from n8n, nav shows the unread count |
| 14 | As A, Approve | Badge "Approved", "Due back in N days"; B's Inbox shows the approval |
| 15 | As B, Request the same tool for overlapping dates | "Those days are taken. Try others." and Send disabled |
| 16 | As A, try to Delete the lent or booked tool | While B has it, Delete is disabled. For a future booking, the confirm appears and then the toast "You can't delete a tool that is lent out or booked." |
| 17 | In the Convex dashboard (`npx convex dashboard`), set the loan's `endDate` to two days ago | Row shows "2 days late", Overdue badge, "Send reminder" |
| 18 | As A, click Send reminder | Button changes to "Reminder sent"; B gets one reminder in the Inbox |
| 19 | In n8n, run "LendLoop overdue reminders" twice | B has exactly one overdue reminder for today |
| 20 | As A, Mark returned | Badge "Returned", B's Inbox shows the return |
| 21 | As B, open /admin | "Admins only" |
| 22 | As A, open Admin, Neighbors tab, tick Trusted for B | Toast confirms; B's tools show a "Trusted" badge on Browse |
| 23 | As A, Admin, Listings tab, Remove a free tool | Confirm dialog, toast, tool gone from Browse for both users |
| 24 | Send the forged request from the README "Forged requests" | n8n answers 401 and no alert is written |
| 25 | `docker compose stop n8n`, then as B request a tool; wait about 40 seconds | A gets "Couldn't send the notice for the … after 4 tries. Check that n8n is running." Start n8n again after |
| 26 | Inbox: Mark all read | Count clears, dots disappear |
| 27 | Shrink the window to phone width (375 px) | No sideways scrolling on any page |
| 28 | Switch the OS to dark mode | All pages switch to the dark palette and stay readable |
| 29 | Browse: change the sort to "Name A to Z", then "Available first" | Rows reorder; free tools come first with the second option |
| 30 | Browse: pick a category with no tools | "Nothing matches these filters" with a Clear filters button that resets search, category and the switch |
| 31 | Requests: click each status chip (All, Waiting, Out now, Overdue, Closed) | Counts on the chips match the rows shown; an empty group offers Clear filters |
| 32 | Admin, All loans: search a neighbor's name, then pick a status chip | Only that neighbor's loans in that status remain |
| 33 | Admin, Listings: choose a category; Neighbors: turn on "Trusted only" | Lists narrow to that category and to trusted neighbors |
| 34 | Any list at phone width | Column headers hide and rows stack, with no sideways scrolling |

