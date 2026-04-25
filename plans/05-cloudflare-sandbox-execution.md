# 05 — Cloudflare Sandbox Execution

## Owner

Sandbox/execution owner.

## Depends on

- `00-start-here-common-contract.md`
- DB job lifecycle API
- Worker foundation with Sandbox export/binding

## Goal

Execute untrusted Python and Java code in isolated Cloudflare Sandboxes and return normalized execution results.

## Runtime model

MVP should use one-shot execution:

1. Write user code to a temporary file.
2. Run language-specific command with timeout.
3. Capture stdout/stderr/exit code.
4. Delete or isolate per-job files.
5. Return `ExecutionResult`.

Do not implement persistent interactive REPL first. SMS latency, session safety, and Java process lifetime will become much harder.

## Cloudflare Sandbox binding

Worker entrypoint likely needs:

```ts
export { Sandbox } from "@cloudflare/sandbox";
```

And `wrangler.jsonc` will need the relevant Durable Object/container configuration once the SDK-generated setup is known.

## Sandbox client

Create:

```txt
src/repl/sandbox-client.ts
```

Export:

```ts
export async function executeInSandbox(
  request: ExecutionRequest,
  env: Env
): Promise<ExecutionResult>;
```

Implementation shape:

```ts
import { getSandbox } from "@cloudflare/sandbox";

export async function executeInSandbox(request, env) {
  const sandbox = getSandbox(env.Sandbox, request.id);

  const started = Date.now();

  try {
    const result = await runLanguageCommand(sandbox, request);
    return {
      status: result.timedOut ? "timed_out" : result.exitCode === 0 ? "succeeded" : "failed",
      stdout: clamp(result.stdout, request.maxOutputChars),
      stderr: clamp(result.stderr, request.maxOutputChars),
      exitCode: result.exitCode,
      durationMs: Date.now() - started,
      sandboxId: request.id
    };
  } catch (error) {
    return {
      status: "failed",
      stdout: "",
      stderr: "Execution failed.",
      exitCode: null,
      durationMs: Date.now() - started,
      sandboxId: request.id,
      errorCode: "SANDBOX_EXECUTION_ERROR"
    };
  }
}
```

Adjust exact API calls to the current Sandbox SDK.

## Python execution

Create:

```txt
src/repl/languages/python.ts
```

Execution plan:

1. Write `/tmp/main.py`.
2. Run:

```sh
python3 /tmp/main.py
```

3. Timeout after `EXECUTION_TIMEOUT_MS`.
4. Capture stdout and stderr.

Rejected patterns for MVP:

- network access, if Sandbox supports disabling it
- file writes outside working directory
- code body over limit
- binary output

## Java execution

Create:

```txt
src/repl/languages/java.ts
```

MVP input style:

```java
System.out.println("hi");
```

Wrap snippets in:

```java
public class Main {
  public static void main(String[] args) throws Exception {
    // user code here
  }
}
```

Also support full class mode if code contains:

```txt
public class Main
```

Execution plan:

```sh
javac Main.java && java Main
```

Timeout applies to compile and run together.

Potential problem:

- Java cold start and compilation may be too slow for SMS expectations.
- Keep timeout slightly higher for Java if needed, but cap it hard.

## Safety constraints

Sandbox isolation is necessary but not sufficient.

Add app-level limits:

- max source length
- max output chars
- max execution time
- per-phone rate limit
- per-phone daily quota
- disallow obvious fork bombs where detectable
- do not expose filesystem beyond job workspace
- no secrets mounted into sandbox
- no DB/Twilio credentials in sandbox environment

## Job lifecycle

Execution function should be wrapped by a job service:

```txt
src/repl/jobs.ts
```

Flow:

1. Create job as `queued`.
2. Mark `running`.
3. Execute.
4. Store output.
5. Mark terminal state.
6. Ask SMS responder to send result.

## Acceptance criteria

- `py print("hi")` returns stdout `hi`.
- `py raise Exception("x")` returns failed status and stderr preview.
- `java System.out.println("hi");` returns stdout `hi`.
- Infinite loop times out.
- Source over limit is rejected before sandbox.
- No app secrets are visible from code.
