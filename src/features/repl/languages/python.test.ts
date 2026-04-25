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
  it("executes user code through the native interpreter", async () => {
    const calls: string[] = [];
    const sandbox: SandboxRuntime = {
      mkdir: async () => undefined,
      writeFile: async () => undefined,
      exec: async () => ({ success: true, exitCode: 0, stdout: "", stderr: "" }),
      runCode: async (code, options) => {
        calls.push(`${code}:${options?.language}:${options?.timeout}`);
        return { logs: { stdout: ["hi\n"], stderr: [] }, results: [] };
      },
    };

    await expect(runPythonCommand(sandbox, request, "/workspace/jobs/job_test")).resolves.toEqual({
      stdout: "hi\n",
      stderr: "",
      exitCode: 0,
      timedOut: false,
    });
    expect(calls).toEqual(['print("hi"):python:5000']);
  });

  it("includes expression results in stdout", async () => {
    const sandbox: SandboxRuntime = {
      mkdir: async () => undefined,
      writeFile: async () => undefined,
      exec: async () => ({ success: true, exitCode: 0, stdout: "", stderr: "" }),
      runCode: async () => ({
        logs: { stdout: [], stderr: [] },
        results: [{ text: "4" }],
      }),
    };

    await expect(runPythonCommand(sandbox, { ...request, code: "2 + 2" }, "/unused")).resolves.toEqual(
      {
        stdout: "4",
        stderr: "",
        exitCode: 0,
        timedOut: false,
      },
    );
  });

  it("normalizes timeout exceptions", async () => {
    const sandbox: SandboxRuntime = {
      mkdir: async () => undefined,
      writeFile: async () => undefined,
      exec: async () => ({ success: true, exitCode: 0, stdout: "", stderr: "" }),
      runCode: async () => {
        throw new Error("Command timed out");
      },
    };

    await expect(
      runPythonCommand(sandbox, request, "/workspace/jobs/job_test"),
    ).resolves.toMatchObject({
      stdout: "",
      stderr: "Timed out after 5s.",
      exitCode: null,
      timedOut: true,
    });
  });
});
