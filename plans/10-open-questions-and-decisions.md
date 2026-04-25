# 10 — Open Questions and Decisions

Use this file to track unresolved choices before implementation.

## Questions for product/engineering owner

1. Should the MVP be public to any phone number, or invite-only by allowlisted phone numbers?
2. Should every execution send an immediate `Running code...` SMS, or should execution try to complete inside the inbound Twilio response when fast?
3. What is the target max wait time users will tolerate over SMS?
4. Should Java input be snippets only, full `public class Main`, or both?
5. Should persistent REPL state be required for demo, or is one-shot execution acceptable?
6. Should users be able to install packages/import libraries?
7. Should code execution have network access?
8. Do you want a web editor/admin panel in the MVP, or only SMS?
9. Is the app for a hackathon demo, a limited Cornell pilot, or a real public service?
10. What is the Twilio cost ceiling per day?
11. Should phone numbers be masked in the DB/admin UI by default?
12. Should Better Auth be used only for admins at first, or should SMS users be able to create accounts immediately?

## Recommended default answers

For fastest safe MVP:

1. Invite-only by allowlisted phone numbers.
2. Send immediate `Running code...`.
3. Target under 10 seconds.
4. Support snippets and full `public class Main`.
5. One-shot execution only.
6. No package installation.
7. No network access from code execution.
8. Minimal admin panel only.
9. Hackathon/limited pilot.
10. Set a hard daily cap in Twilio and app quotas.
11. Mask phone numbers by default.
12. Better Auth for admins only at first.

## Decisions made

Add dated decisions here:

```txt
2026-04-25 — Decision: MVP uses one-shot execution, not persistent REPL state.
2026-04-25 — Decision: Default language is Python.
2026-04-25 — Decision: Feature-first repository convention uses `src/features/<feature>`, `*.functions.ts` for server functions, and `*.types.ts` for shared feature types.
```
