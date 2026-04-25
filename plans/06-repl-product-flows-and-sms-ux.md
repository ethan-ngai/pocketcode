# 06 — REPL Product Flows + SMS UX

## Owner

Product/API owner.

## Depends on

- `00-start-here-common-contract.md`
- SMS parser
- Sandbox execution
- DB sessions

## Goal

Define exactly how users interact with the SMS REPL and how state changes over time.

## Feature folder contract

Product flow logic should live in feature modules, not route files:

```txt
src/features/sms/parser.ts
src/features/sms/responder.ts
src/features/sms/sms.functions.ts
src/features/repl/repl.functions.ts
src/features/repl/repl.types.ts
src/features/admin/admin.functions.ts
src/features/admin/components/
```

The admin pages under `src/routes/app/admin/**` should mostly compose components from `src/features/admin/components/**`.

## MVP user flows

### First message

User texts:

```txt
help
```

System replies:

```txt
Commands:
py <code>
java <code>
lang py
lang java
reset
```

### Python one-shot

User texts:

```txt
py print(2 + 2)
```

System replies:

```txt
Running code...
```

Then:

```txt
Output:
4
```

### Java one-shot

User texts:

```txt
java System.out.println(2 + 2);
```

System replies:

```txt
Running code...
```

Then:

```txt
Output:
4
```

### Default language

User texts:

```txt
lang java
```

System replies:

```txt
Default language set to Java.
```

Then user texts:

```txt
System.out.println("hello");
```

System executes it as Java.

### Reset

User texts:

```txt
reset
```

System replies:

```txt
Session reset.
```

## Session rules

MVP session state:

```json
{
  "defaultLanguage": "python",
  "lastExecutionJobId": "...",
  "lastActiveAt": "..."
}
```

Do not persist variable state across executions in MVP.

Later persistent REPL state may add:

```json
{
  "pythonProcessId": "...",
  "javaWorkspaceId": "...",
  "variables": "not directly inspectable"
}
```

## SMS formatting rules

- Avoid Markdown that SMS clients render inconsistently.
- Do not use code fences in SMS.
- Prefer short labels.
- Strip ANSI color escape codes.
- Normalize Windows and Unix newlines.
- Trim trailing whitespace.

## Error messages

### Syntax/runtime error

```txt
Error:
<short stderr preview>
```

### Timeout

```txt
Timed out after 5s.
```

### Too long

```txt
Code is too long. Limit: 2000 characters.
```

### Unknown command

```txt
Unknown command. Text HELP for examples.
```

## Abuse-resistant product limits

MVP defaults:

- 20 executions per phone per hour
- 100 executions per phone per day
- 2,000 chars max input
- 5s Python timeout
- 8s Java timeout if needed
- 4,000 chars stored output preview
- 2 SMS chunks max per result

## Admin dashboard MVP

Pages:

```txt
/app/admin
/app/admin/messages
/app/admin/executions
/app/admin/users
```

Views:

- recent inbound messages
- recent execution jobs
- failed jobs
- top phone numbers by usage
- manual test execution

No editing of DB records in MVP except quota overrides if necessary.

## Acceptance criteria

- User can discover commands with `help`.
- User can set language once and omit prefix afterward.
- Errors are understandable over SMS.
- Long output does not spam the user.
- Admin can inspect execution history.
