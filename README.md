# Famhub web prototype (version 4.9)

Famhub is the family eldercare coordination app.

Open this folder in VS Code and follow "Famhub: Web Prototype Deployment Guide".
No commands to type.

## New in 4.9: simpler Infants tab and profile photos

- Infants menu: Today, Routine, Calendar, Chat, More (Babies and Requests are gone from the menu).
- Routine: the day's feeds, meals, naps, bath, vitamins and play, each with a time and the person who does it
  (the helper by default). Tap Done: milk asks how many ml each baby drank (plus and minus 10), meals ask how
  much was eaten, the rest tick at once. Undo is one tap. Milk and meals still feed the reports.
- A starting routine is suggested for the baby's age (newborn, 1 to 3 months, 3 to 6, 6 to 12, over 12);
  "Change routine" edits times, amounts, food and who does it, or resets to the suggestion.
- The helper is reminded at each time; the family hears if something is not ticked 45 minutes later.
- To do: a short job list under the routine (for example "Buy diapers"), with who does it.
- Today shows the routine items due now, with Done buttons.
- Calendar: "Add them to the calendar" adds the Singapore baby check-ups and National Childhood Immunisation
  Schedule vaccinations (2, 4, 6, 12, 15 and 18 months) from the birth date, to change to the booked times.
- Feeding details, growth, nutrition and reports are still there: Routine (bottom links) or More.
- Photos: tap your picture in More > My profile to add a photo; baby photos on the Routine page or My profile;
  a photo of the parent, kid or teen in My profile. Photos show everywhere in place of initials.
- Helpers can now save a PayNow / PayLah! mobile (for helper pay).

## New in 4.8: payments with PayNow and PayLah!

- More > Payments, in every tab (Parents, Infants, Kids, Teens). Famhub never holds money: it shows the
  PayNow QR code of the person being paid, which PayLah! and every Singapore banking app can scan, and keeps
  a record of who paid whom.
- Request money: anyone (including the helper) can ask a member to pay them back, or ask for pocket money.
  The person asked can pay, or decline with a note. The requester can send a reminder (once an hour).
- Pay the helper (owner and family): salary, top-up, reimbursement or bonus, once or every week or month.
  "Also add to shared costs" puts the payment into Costs, split equally among the family.
- Allowance (owner and family): monthly allowance for a parent, weekly pocket money for a kid or teen.
  The child does not need an account; save the child's PayNow / PayLah! mobile on the Payments page.
- Paying: "Pay with PayNow or PayLah!" shows the QR code, a button to save it as an image (to scan from the
  gallery on the same phone), and the mobile number, amount and reference to copy. Then "I have paid"
  (PayNow, PayLah!, bank transfer or cash). The person paid taps "Got it" when the money arrives.
- Repeating payments are created on their day and the payer is reminded; pause or stop them any time.
- Today shows payments waiting for you. Costs > Settle up also says "Pay with PayNow or PayLah!".

## New in 4.7: infant reports and automatic nutrition targets

- Babies tab > Reports: Day, Week, Month or Pick dates (tick boxes on a calendar; dots mark days with
  entries). For each baby, or all babies: energy, protein, fat and carbs (totals, a day, per kg, and the
  share of energy from each), milk (formula and breast milk), breastfeeds, pumping, solids, feeds and
  the average gap, sleep, diapers, weight change, length and head; daily targets reached; charts of
  energy (milk and food), macronutrients and milk per day; feeding times by hour; what was fed (each
  milk and food with nutrients); and a day-by-day table with averages. Download CSV (opens in Excel) or
  Print or save as PDF for the doctor.
- Automatic daily targets (Baby settings > Daily targets > Automatic): energy from the National
  Academies 2023 equation using age, length, weight and sex (Institute of Medicine 2005 equation when
  the length or sex is missing); protein from the Dietary Reference Intakes per kg; fat and carbs from
  the DRI shares for the age; milk (under 6 months) from energy / 67 kcal per 100 ml. They update by
  themselves with each new weight or length. "Set my own" lets parents override any value.
- Estimates are for healthy babies born at term; Famhub gives no feeding advice.

## Added in 4.6: version under the profile button

- Top right of every page: your profile picture with the version (for example v4.6) under it. It turns
  red when the page and the server differ. Tap it for your name and email, the page and server versions,
  when this version was built and when the server started, plus My profile and Reload page.
- The sign-in page shows the version at the bottom. /api/health also returns mode, builtAt and startedAt.

## Added in 4.5: live mode (real accounts) and who is online

- Live mode: app setting TEST_MODE = false (or not set on Azure). No TEST MODE bar, no demo people,
  no profile switching, no sample data; a fresh install starts empty. People create an account with
  their name, email and password, then set up a circle or join with an invite code.
- Passwords: "Forgot password?" emails a one-hour link (needs email set up: ACS_CONNECTION_STRING and
  ACS_SENDER, or SMTP). Without email, the circle owner can make a reset link (Circle and people >
  Who is online > Password reset link) and send it by WhatsApp. My profile > Change password.
- Optional app settings: REGISTRATION = closed stops new sign-ups; APP_URL sets the link address.
- Who is online (owners only): Circle and people shows each member as online (and on which page) or
  offline with when they were last active; Today shows a "Family online" card.
- TEST_MODE = true keeps everything as before for testing.

## Added in 4.4: milk powders and foods by macronutrients (Infants)

- Milk and food list (Babies tab > Milk > "Milk and food list"): add your own milk powders with the
  tin's "per 100 ml" values (energy, protein, fat, carbs; energy can be worked out from the other
  three) and set them for one baby or all. Choose them in Formula > Change > Your milk powders.
- Foods: about 24 common first foods with typical values per 100 g (porridges, vegetables, fruit,
  fish, chicken, egg, tofu, lentils, yogurt, cheese); copy and adjust any of them, or add your own
  home-cooked dishes and packet foods.
- Log solids as a meal: pick one or more foods, set the grams, and see energy, protein, fat and carbs
  for each food and the whole meal. Nutrients from food are added to the day's totals.
- Log a bottle with any milk in the list (the usual formula, breast milk or one of your milk powders).
- Daily targets per baby (optional, from your doctor or dietitian): milk ml, energy, protein, fat and
  carbs, shown as progress bars (Baby settings).

## Added in 4.3: Parents, Infants, Kids and Teens tabs

- Tabs at the top flip between Parents, Infants, Kids and Teens in one tap. Each has its own colour.
  When a tab has more than one person (for example Mum and Dad), their names show as chips under
  the tabs, with "+ Add" to set up another. An empty tab explains what it offers and has a set-up button.
- New care types in the set-up wizard:
  - Kids (preschool or primary school): school runs and pick-up rota, CCA and classes, allergies,
    learning support, school bus, check-ups. No daily check-in (an adult is always with them).
  - Teens (secondary, JC, Poly or ITE): a "home safe" check-in (default 7 pm), exams, CCA,
    travelling alone, allowance, NRIC at 15 and NS registration at about 16½.
- The Care tab is called Health for kids and teens; the Today card takes each tab's colour.
- Demo data (fresh install or Reset demo data): Chloe (primary school) and Ryan (secondary school)
  for Thomas, Mei Ling, Wei Jie and Siti.

## Added in 4.2: dark mode, colour themes, cancel a help call

- Dark mode: the moon/sun button at the top switches instantly; More > Appearance offers
  Same as phone (follows the phone's dark mode), Light or Dark. Mum's Settings tab has it too.
- Colour themes (More > Appearance), based on the most common app palettes: Ocean blue (new
  default; blue is the most trusted and most used colour in health apps), Sage green (calm,
  healing), Warm sand (soft neutrals with terracotta, the 2026 trend), Indigo (bold) and Teal (4.0).
  Saved per device, so each person can choose.
- "I need help" pressed by mistake: Mum sees a big "Pressed by mistake" button (with a
  confirmation), which cancels the call, counts as "I'm OK" and tells everyone "False alarm".
  Family and helpers also get a "False alarm" button on the help banner and in the alert.

## Added in 4.1: open registration for testing

- In test mode (TEST_MODE = true), the sign-in page has "Create a new account": name, optional
  username and email, and a password of at least 8 characters. New people then set up a circle
  (parent, newborn, baby, twins or triplets) or join one with an invite code.
- Tap the circle name at the top to switch circles or "Set up someone new" at any time.
- Deploy with famhub-server-v4.x-deploy.zip (package.json at the top level).

## New in 4.0: care profiles, babies, twins and triplets, new look

- New look: fresher colours, gradient header cards, a floating bottom bar and a "Today" hero card
  with the day's key facts and a Care focus with tips.
- Launch wizard (new circle, or More > Set up someone new): choose an older parent or a
  newborn/baby/twins/triplets, then stage of life (including "Last stage of life", dementia,
  recovering after hospital), living situation (lives alone, with spouse, helper, nursing home) and
  needs. Famhub suggests a check-in time and starter requests to tick. More > Care profile changes it
  later. "Last stage of life" turns off overdue nudges (gentle mode).
- Baby log (the Care tab becomes "Baby" or "Babies"): bottle (formula or expressed breast milk),
  breastfeed (side and minutes), pumped milk, solids, sleep, diapers, weight, length and head size,
  shared by everyone in the circle, with a feed-due reminder (Notification settings > Baby).
- Singapore formula list: about 46 infant, follow-on and growing-up milks (Similac, Enfamil, NAN,
  Aptamil, S-26, Friso, Dumex, Bellamy's, Kendamil, Karihome, a2, FairPrice and others). Each bottle
  shows energy, protein, fat and carbs. Values are typical for each stage: enter the tin's values
  under Formula > "Enter the values from the tin".
- Twins and triplets (up to 4 babies): each baby has a name, colour, formula, growth chart and its own
  feed reminder. Tick one or all babies when logging (for bottles and weights each baby gets its own
  amount). "All" shows the babies side by side: feeds, ml, kcal, protein, fat, carbs, ml per kg, sleep
  and diapers, plus milk-per-day and weight charts. Add or remove a baby in Baby settings.
- Visit notes (from 3.10): More > Visit notes for doctor, dentist, physio and therapy visits, with
  photos, PDF documents, comments and an optional follow-up appointment.
- Demo data: use "Reset demo data" to add the demo twins circle (Ethan and Emma; Mei Ling is the
  owner, Thomas, Wei Jie and Siti are members). Existing data is kept on update.
- Famhub does not give feeding or medical advice.

## Added in 3.9: photos everywhere

- Take photo / Choose photos (up to 6) in Add and Edit medicine (the medicine, box or pharmacy label),
  New and edit appointment (appointment card or referral letter), Add renewal (the card, letter or
  permit) and Edit request (requests already had it when adding).
- Medicine photos show as a small picture beside each dose (also on Mum's big view), so the helper and
  Mum can recognise the right tablet. Photos show on the medicine list, appointments and renewals; tap to
  enlarge. Editing a repeating request or appointment for "all" copies the photos too.

## New in 3.8: manage and delete repeats

- Manage repeats: tap the repeat badge (Manage) on a request or appointment, choose "Choose dates to
  delete..." when deleting, or open More > Repeating items. Every date in the series is listed with a
  tick box (Tick all, Tick upcoming, Tick from the first ticked on, Clear); delete the ticked dates or the
  whole series. Done and past dates are marked.
- Edit a repeating request (new Edit button) or appointment: after Save you choose Only this one,
  This one and the later ones, or All of them. Title, type, time, who is doing it, place, notes and escort
  are copied; a new time moves the chosen repeats by the same amount.
- More > Repeating items lists every repeating request, appointment and medicine with its pattern, how
  many dates, how many are done and the next one.

## New in 3.7: repeating requests, appointments and medicines

- New request, New appointment and Add/Edit medicine have a Repeat section:
  Does not repeat, Daily, Weekly, Monthly or Yearly, "Every N" days/weeks/months/years, and tick boxes:
  - Daily and Weekly: which days of the week (with Every day, Weekdays, Weekends shortcuts)
  - Monthly: which days of the month (1 to 31; months without that day are skipped)
  - Yearly: which months
  - Repeat until (a date); a summary shows the pattern, how many times and the first dates.
- Requests and appointments: one item is made for each day in the pattern (up to 366, at most 3 years),
  so each can be taken, ticked, alerted and time-locked on its own day. Lists show a repeating series once
  (the next one) with "Every week on Mon, Thu - 26 more". Deleting asks: only this one, this one and the
  later ones, or all of them.
- Medicines: the pattern decides which days the medicine appears (no pattern = every day), from a start
  date, until stopped or until a chosen last day.

## New in 3.6.1

- You never see your own pointer or yourself in the live view, including right after switching person
  in a window (the window reconnects as the new person, and the old person disappears for everyone else).

## New in 3.6: co-working in one browser, last-touch pointers

- Each browser window is now signed in on its own, so two windows can be two different people.
  Before, all windows in one browser shared one sign-in, so you only ever saw yourself and the live
  view looked empty. To try it: Profiles > the "open in new window" icon next to a person.
- Pointers: you see where each other person last moved the mouse, tapped, clicked or scrolled on the
  page you share, labelled with their name and how long ago ("Mei Ling - tapped 6s ago",
  "scrolled here just now"). A ring pulses on a fresh tap. If their spot is above or below what you
  can see, a chip at the top or bottom edge ("down arrow Mei Ling") takes you there when tapped.

## New in 3.5 (real-time)

- Live stream: each open app keeps one connection (/api/live, Server-Sent Events). The server pushes
  where everyone is the moment they move, and tells every app when anything is saved, so new updates,
  alerts, ticks and appointments appear at once without refreshing.
- Your position (page, open form, typing, scroll) is checked every 200 ms and sent as soon as it changes.
  If the live connection cannot open, the app asks for everyone's position every 200 ms instead.
- What you see:
  - LIVE pill at the top with a pulsing dot and faces; for a few seconds it shows each move, for example
    "Mei Ling -> Calendar > New appointment". Tap it for Live now: each person's page, open form,
    typing, how far they have scrolled, how long they have been there, their last moves, and Go there.
  - Faces glide along the bottom menu to the menu each person is on (pencil = form open, dots = typing).
  - On the page you share, a green line says what the other person is doing ("Mei Ling is typing in
    New appointment") and a marker on the right edge shows how far down they are.

- Mouse pointers: on a computer, you see the other person's pointer with their name on the page you
  both have open.

Also in 3.5:
- Alerts appear at the very top (in the header) and keep flashing until you tap Dismiss (or an action such
  as "I'm handling it"). Urgent ones flash red, others amber; more waiting alerts show as "+2 more".
- New request: take a photo or choose photos (up to 6); they show on the request.
- Dates: tap a date and a calendar opens right underneath; tap a day to choose it.
- Time wheels scroll freely: flick, drag with the mouse, or use the mouse wheel; hours and minutes go
  round and round like on an iPhone.
- The day strip in Calendar (and other sideways lists) scrolls with the ordinary mouse wheel, can be
  dragged, and has arrow buttons on a computer.

## New in 3.4.1

- Fixed "npm error 404 ... nodemailer" on networks whose npm feed does not yet have the newest packages
  (for example company feeds). The server no longer needs the Azure SDK packages (it calls Azure
  Communication Services directly), and nodemailer is pinned to 10.0.10 and optional.
- If "Run Install" shows EPERM errors, stop the server first (it keeps files in node_modules open),
  delete the server\node_modules folder in File Explorer, then Run Install again.

## New in 3.4

- Fixed: Add, Profiles and Sign out. Sign out is now a plain page link, so it works even if a
  script fails. Profile sheets open straight away and show an error if profiles cannot load.
  Phone "ghost taps" no longer close a sheet the moment it opens.
- If the page and the server are different versions (server not restarted or not redeployed),
  a red banner says so.
- Time fields use iPhone-style wheels: hour, minute and AM/PM.
- Appointments have a Share button: the phone's share sheet (iPhone and Android), Add to my calendar
  (.ics for iPhone, Android and Outlook), Google Calendar, Email, WhatsApp, Copy, or download the .ics.
- Live presence ("co-author mode"): faces at the top show who else is online; tap them to see which
  menu each person is on and what they are doing (for example working on "New request"). Small faces on
  the bottom menu show who is where (a pencil means they have a form open), and a green line on a page
  says who else is on it.

## New in 3.3

- Sign in and sign out. The app opens on a Famhub sign-in page. "Sign out" (More, My profile,
  the parent's Settings, or the Profiles sheet) really signs out and returns to that page.
- Test accounts (password for all: Famhub2026!, or the TEST_PASSWORD app setting if set):

  | Username | Person | Role |
  | --- | --- | --- |
  | thomas | Thomas | Owner |
  | meiling | Mei Ling | Family |
  | weijie | Wei Jie | Family |
  | siti | Siti | Helper |
  | mum | Mum | Parent |

  Profiles you add get a username made from the name (or one you choose) and the same password,
  unless you set their own in Profiles > Edit.
- Tasks and medicines can only be ticked once their time comes. Tasks now have an optional time.
- Alerts when the time comes: tasks at their time (or 9 am on the day), medicines at the dose time,
  appointments at the start time. They arrive in the app, as a phone/computer push notification,
  and, if turned on in Notification settings, by email and WhatsApp.
- Email alerts: Azure Communication Services Email (ACS_CONNECTION_STRING, ACS_SENDER) or any
  SMTP server (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM).
- WhatsApp alerts: Azure Communication Services Advanced Messaging (ACS_CONNECTION_STRING,
  ACS_WHATSAPP_CHANNEL_ID) or Meta WhatsApp Cloud API (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID),
  with an approved template "famhub_alert" (body: Famhub: {{1}}. {{2}}).
- Test mode "Message outbox" shows every email and WhatsApp message the app tried to send.

## New in 3.2

- Test profiles you can switch like accounts in an app (test mode only). The yellow bar at the top
  shows everyone as round avatars with unread counts (red ring = urgent alert waiting). Tap one to switch.
- Tap "+ Add" to create as many test people as you like: any name, any role (owner, family, helper,
  parent) and any care circle, or "None yet" to test setting up a new circle (for example a second parent).
- "Profiles" opens the full list: switch, edit a person's name and role in each circle, or remove
  profiles you added. It also has Run reminder checks, Use my own account and Reset demo data.
- Reset demo data removes added profiles and restores the five demo people.

## New in 3.1

- Photos: helpers and the parent can take a picture with the phone camera or choose photos
  from the phone (up to 6 per update; 4 for the parent). Photos are resized before upload.
  - Helper: "Share a photo or update" on Today, or the camera on the Updates page.
  - Parent: big "Send a photo" button on Home and a new Photos tab with quick words
    ("My meal today", "Is this OK?") and photos from the family.
  - Tap any photo to view it full screen, swipe with the arrows, or download it.
- Calendar: select a day and tap Add; the date is filled in and the time defaults to 09:00
  (or the next hour today). "Choose on calendar" opens a month picker; quick time buttons.
  Month view and "Today" button on the Calendar page.
- "I need help" alerts now pop up on family and helper screens within about 8 seconds,
  when the app comes back to the front, and when switching person in test mode.
  With alerts turned on (More > Notification settings), a system pop-up also appears.

## New in 3.0

- New mobile-style interface: bottom navigation (Today, Calendar, Care, Requests, Updates, More),
  large page titles, bottom-sheet forms, avatars and colours per person, icons throughout.
- Today page: parent status, "Help wanted" cards to claim, one timeline for medicines, appointments and tasks.
- Calendar with a day strip, colour showing who is going, and "Escort needed" sign-up.
- Care: check-in plus medicines grouped Morning, Afternoon, Evening and Night; supply tracking and refill alerts.
- Requests: post once, anyone can claim, or ask one person who can accept or say "Can't do it".
- Updates feed with photos, Thanks and comments.
- Notifications rebuilt: a personal inbox with read state and action buttons, pop-up banners,
  real device alerts (Web Push), per-category choices (Alert, Inbox, Daily summary, Off),
  quiet hours, a daily summary, and scheduled reminders that escalate only when nobody responds.
- Installable to the Home Screen (needed for alerts on iPhone).

## Roles

| Role | Sees and does |
| --- | --- |
| Owner | Everything, including circle settings, members and roles |
| Family | Everything except settings and members; can invite people |
| Helper | Today page, tasks, medicines, updates with photos, calendar, documents shared with them; no money |
| Parent | Large simple view: I'm OK, I need help, medicines, next appointment, call family, send and see photos |

## Features

- Onboarding: create a circle, create a demo circle, or join with an invite code
- Invites by code (7 days, single use) for each role; add people who will not sign in
- Calendar: add, edit, delete; escort ("I'll go"); visit outcome after the appointment
- Tasks: types, due dates, assign, take, accept, hand back, done, reopen; filters
- Medicines: schedule (family), daily ticks (anyone), missed-dose alerts; no dosing advice
- Notes: text, photos, urgent flag
- Costs: types, receipts, split equally, by ratio or fixed amounts; settle up with PayNow QR;
  monthly statement with CSV download
- Documents: photos or PDFs by type; share selected ones with the helper
- Renewals: due dates with alerts 30 days before
- Check-ins: I'm OK, I need help (alerts everyone), "I'm handling it"
- Alerts on the Home page, and an Activity feed with unread count
- Several circles per person, with a circle switcher

## Test mode

A yellow bar at the top lets you act as any demo person (Thomas owner, Mei Ling and Wei Jie
family, Siti helper, Mum parent), and reset the demo data.
- On your PC it is always on.
- On Azure it is on only if the app setting TEST_MODE is true. Turn it off before real families use it.

## Where the data is kept

- On your PC: `server/data` (data file and uploaded files).
- On Azure App Service: `/home/data`, which survives restarts and redeploys.
- With the PGHOST, PGUSER, PGPASSWORD and PGDATABASE app settings, the data is kept in
  PostgreSQL (uploaded files still stay in `/home/data/files`).
- Updating from version 1.x starts again with fresh demo data. Updating from 2.0 keeps your data.

## Notifications on Azure

- Reminders and escalations run every minute inside the web app. On the Free F1 plan the app
  sleeps when nobody is using it, so timed reminders can be late. Use Basic B1 with Always on for
  reliable reminders.
- Device alerts need HTTPS (the azurewebsites.net address has it). On iPhone, add Famhub to the
  Home Screen first, open it from there, then turn alerts on under More > Notification settings.
- The keys for device alerts are created on first start and kept in the data folder.

## Everyday actions (VS Code, NPM SCRIPTS panel in the Explorer side bar)

- server > Run Install (first time), then server > start: preview at http://localhost:8080
- web > Run Install (first time), then web > build: rebuild after changing screens
- Deploy: right-click the `server` folder > Deploy to Web App...
