/**
 * @file repl-contract.test.ts
 * @description Contract coverage for shared REPL execution shapes.
 * @module tests
 */
import { describe, expect, it } from "vitest";

import type { ExecutionRequest, ExecutionResult } from "../../src/features/repl/repl.types";

describe("REPL execution contracts", () => {
  it("keeps ExecutionRequest fields stable for SMS and sandbox workstreams", () => {
    const request = {
      id: "job_contract",
      userId: null,
      phoneE164: "+15555550123",
      language: "python",
      code: 'print("hi")',
      timeoutMs: 5_000,
      maxOutputChars: 4_000,
    } satisfies ExecutionRequest;

    expect(Object.keys(request).sort()).toEqual([
      "code",
      "id",
      "language",
      "maxOutputChars",
      "phoneE164",
      "timeoutMs",
      "userId",
    ]);
  });

  it("keeps ExecutionResult fields stable for persistence and SMS egress", () => {
    const result = {
      status: "succeeded",
      stdout: "hi\n",
      stderr: "",
      exitCode: 0,
      durationMs: 10,
      sandboxId: "sandbox_contract",
      errorCode: undefined,
    } satisfies ExecutionResult;

    expect(Object.keys(result).sort()).toEqual([
      "durationMs",
      "errorCode",
      "exitCode",
      "sandboxId",
      "status",
      "stderr",
      "stdout",
    ]);
  });
});
