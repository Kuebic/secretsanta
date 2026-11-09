# 10: Event details: budget, date, location, calendar file

**What to build:** The organizer fills in budget, exchange date and location alongside title and notes. Participants see them on their page, and the date offers an "Add to calendar" download. Changes made after links are sent appear for everyone on next load.

**Blocked by:** 07

**Status:** resolved

**GitHub:** Kuebic/secretsanta#10

- [x] Details editor: title, budget (free text), date, location, notes
- [x] Participant page shows all filled details in a clear block
- [x] Date present → `.ics` download with title, date, location, notes
- [x] Editing details after the draw updates participant pages without new links
- [x] Details blob stays under the 16 KB limit with a visible character budget on notes
