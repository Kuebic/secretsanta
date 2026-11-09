# Secret Santa

A planner for blind gift exchanges. An organizer lists people and rules, the app draws who gives to whom, and each person learns only their own assignment.

## Language

### People

**Organizer**:
The person who creates an event, manages its participants and rules, and triggers draws.
_Avoid_: Admin, host, owner

**Participant**:
A person taking part in an event. Every participant is both a giver and a receiver.
_Avoid_: Member, user, player

**Giver**:
A participant in the role of buying a gift for their receiver.
_Avoid_: Santa, secret santa, sender

**Receiver**:
A participant in the role of getting a gift from their giver.
_Avoid_: Giftee, recipient, target

### Event

**Event**:
One gift exchange: its participants, rules, details, and the current draw.
_Avoid_: Exchange, group, session, game

**Details**:
Event-wide information every participant sees: title, budget, exchange date, location, notes.
_Avoid_: Instructions, settings, info

**Organizer link**:
The URL that grants organizer control over an event.
_Avoid_: Admin link, dashboard link

**Participant link**:
The URL a participant uses to see their assignment and edit their wishlist. Stable for the life of the event.
_Avoid_: Secret link, pairing link, invite

### Drawing

**Rule**:
A constraint on who a participant may be assigned. Either a Must or a Must Not.
_Avoid_: Constraint, restriction, exclusion

**Must**:
A rule forcing a giver to be assigned a specific receiver.
_Avoid_: Force, pin, fixed

**Must Not**:
A rule forbidding a giver from being assigned a specific receiver.
_Avoid_: Exclusion, block, ban

**Mutual exclusion**:
A pair of Must Not rules in both directions between two participants, as for couples.
_Avoid_: Couple rule, symmetric rule

**Draw**:
The act of generating assignments for every participant, and the result of that act.
_Avoid_: Generation, shuffle, pairing

**Assignment**:
One giver and the receiver they drew.
_Avoid_: Pairing, pair, match

**Previous draw**:
The assignments of an earlier event, used to avoid repeating them.
_Avoid_: Last year, history

### Gifting

**Wishlist**:
What a participant tells their giver they would like: a list of items plus free-text notes.
_Avoid_: Preferences, registry, suggestions

**Wishlist item**:
One entry in a wishlist: a description and an optional link.
_Avoid_: Gift idea, suggestion

**Organizer's note**:
Something the organizer writes about a receiver for their giver to see.
_Avoid_: Hint, gift hint

### Participant page

**Identity confirmation**:
The step where a participant confirms they are the named person before anything is revealed.
_Avoid_: Login, verification

**Reveal**:
The moment a participant is shown their assignment.
_Avoid_: Unlock, open

**Opened**:
State of a participant who has confirmed identity and seen their assignment.
_Avoid_: Viewed, read, clicked

**Nudge**:
A message the organizer sends a participant who has not filled in their wishlist.
_Avoid_: Reminder, ping
