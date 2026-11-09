# 09: Share actions: copy link, copy as message, Web Share

**What to build:** Next to each participant link the organizer gets three actions: Copy link, Copy as message (short greeting with the person's name plus the link, ready to paste into Signal or any chat), and Share (native share sheet on devices that support the Web Share API, hidden elsewhere).

**Blocked by:** 07

**Status:** resolved

**GitHub:** Kuebic/secretsanta#9

- [x] Copy link copies the bare URL
- [x] Copy as message copies a translated greeting + link, personalised with the participant's name
- [x] Share button appears only when `navigator.share` exists and calls it with title + URL
- [x] Works on the pre-draw link list and after the draw
- [x] No email or phone fields anywhere
