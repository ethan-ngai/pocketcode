/**
 * @file python.test.ts
 * @description Unit coverage for the Python sandbox adapter.
 * @module repl
 */
import { describe, expect, it } from "vitest";

import type { ExecutionRequest, SandboxRuntime } from "../repl.types";
import { runPythonCommand } from "./python";

const request: ExecutionRequest = {
  id: "job_test",
  userId: null,
  phoneE164: "+15555550123",
  language: "python",
  code: 'print("hi")',
  timeoutMs: 5_000,
  maxOutputChars: 4_000,
};

describe("runPythonCommand", () => {
  it("writes user code to a file and executes a fixed command", async () => {
    const calls: string[] = [];
    const sandbox: SandboxRuntime = {
      mkdir: async () => undefined,
      writeFile: async (path, content) => {
        calls.push(`${path}:${content}`);
      },
      exec: async (command, options) => {
        calls.push(`${command}:${options?.cwd}:${options?.timeout}`);
        return { success: true, exitCode: 0, stdout: "hi\n", stderr: "" };
      },
    };

    await expect(runPythonCommand(sandbox, request, "/workspace/jobs/job_test")).resolves.toEqual({
      stdout: "hi\n",
      stderr: "",
      exitCode: 0,
      timedOut: false,
    });
    expect(calls).toEqual([
      '/workspace/jobs/job_test/main.py:print("hi")',
      "python3 main.py:/workspace/jobs/job_test:5000",
    ]);
  });

  it("normalizes timeout exceptions", async () => {
    const sandbox: SandboxRuntime = {
      mkdir: async () => undefined,
      writeFile: async () => undefined,
      exec: async () => {
        throw new Error("Command timed out");
      },
    };

    await expect(runPythonCommand(sandbox, request, "/workspace/jobs/job_test")).resolves.toMatchObject({
      stdout: "",
      stderr: "Timed out after 5s.",
      exitCode: null,
      timedOut: true,
    });
  });
});
