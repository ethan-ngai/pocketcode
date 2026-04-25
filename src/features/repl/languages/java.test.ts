/**
 * @file java.test.ts
 * @description Unit coverage for the Java sandbox adapter.
 * @module repl
 */
import { describe, expect, it } from "vitest";

import type { ExecutionRequest, SandboxRuntime } from "../repl.types";
import { runJavaCommand, toJavaProgram } from "./java";

const request: ExecutionRequest = {
  id: "job_test",
  userId: null,
  phoneE164: "+15555550123",
  language: "java",
  code: 'System.out.println("hi");',
  timeoutMs: 8_000,
  maxOutputChars: 4_000,
};

describe("toJavaProgram", () => {
  it("wraps snippets in a Main class", () => {
    expect(toJavaProgram('System.out.println("hi");')).toContain("public class Main");
    expect(toJavaProgram('System.out.println("hi");')).toContain('    System.out.println("hi");');
  });

  it("preserves full Main class submissions", () => {
    const source = "public class Main { public static void main(String[] args) {} }";

    expect(toJavaProgram(source)).toBe(source);
  });
});

describe("runJavaCommand", () => {
  it("writes Main.java and executes the fixed compile/run command", async () => {
    const calls: string[] = [];
    const sandbox: SandboxRuntime = {
      mkdir: async () => undefined,
      runCode: async () => ({ logs: { stdout: [], stderr: [] }, results: [] }),
      writeFile: async (path, content) => {
        calls.push(`${path}:${content.includes("public class Main")}`);
      },
      exec: async (command, options) => {
        calls.push(`${command}:${options?.cwd}:${options?.timeout}`);
        return { success: true, exitCode: 0, stdout: "hi\n", stderr: "" };
      },
    };

    await expect(runJavaCommand(sandbox, request, "/workspace/jobs/job_test")).resolves.toEqual({
      stdout: "hi\n",
      stderr: "",
      exitCode: 0,
      timedOut: false,
    });
    expect(calls).toEqual([
      "/workspace/jobs/job_test/Main.java:true",
      "ecj Main.java && java Main:/workspace/jobs/job_test:8000",
    ]);
  });

  it("normalizes timeout exceptions with the Java timeout budget", async () => {
    const sandbox: SandboxRuntime = {
      mkdir: async () => undefined,
      runCode: async () => ({ logs: { stdout: [], stderr: [] }, results: [] }),
      writeFile: async () => undefined,
      exec: async () => {
        throw new Error("Command timed out");
      },
    };

    await expect(
      runJavaCommand(sandbox, request, "/workspace/jobs/job_test"),
    ).resolves.toMatchObject({
      stdout: "",
      stderr: "Timed out after 8s.",
      exitCode: null,
      timedOut: true,
    });
  });
});
