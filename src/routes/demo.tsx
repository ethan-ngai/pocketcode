/**
 * @file demo.tsx
 * @description Interactive SMS simulator route for testing Pocketcode execution.
 * @module routes
 */
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type ReactElement } from "react";

/**
 * Public demo route definition.
 * @remarks This page intentionally calls the temporary manual execute endpoint
 * so deployed Python execution can be tested without sending real SMS.
 */
export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      {
        title: "Pocket Code Demo - Text Python",
      },
      {
        name: "description",
        content: "Simulate texting Python code to Pocket Code and see the sandbox result.",
      },
    ],
  }),
  component: DemoRoute,
});

interface DemoMessage {
  /** Stable client-side message id. */
  id: string;
  /** Message direction inside the simulated SMS thread. */
  tone: "in" | "out";
  /** Text rendered in the message bubble. */
  text: string;
  /** Whether monospace code styling should be applied. */
  code?: boolean;
  /** Whether this message represents a pending execution. */
  pending?: boolean;
}

interface ManualExecuteResponse {
  /** Execution status returned by the manual execute endpoint. */
  status?: string;
  /** Captured Python stdout. */
  stdout?: string;
  /** Captured Python stderr or rejection text. */
  stderr?: string;
  /** Stable execution error code when the sandbox fails or rejects code. */
  errorCode?: string;
}

/**
 * Renders the deployed SMS execution demo.
 * @returns Interactive phone simulator and supporting instructions.
 */
function DemoRoute(): ReactElement {
  const [draft, setDraft] = useState('print("hello from pocketcode")');
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState<DemoMessage[]>([
    {
      id: "welcome",
      tone: "in",
      text: "Pocket Code here. Text me Python and I will run it in the Cloudflare sandbox.",
    },
    {
      id: "example",
      tone: "in",
      text: "Try: for i in range(3): print(i)",
      code: true,
    },
  ]);
  const threadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  /**
   * Sends the composed SMS text to the execute endpoint.
   * @param event - Form submission event from the phone compose area.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const visibleText = draft.trim();
    const code = normalizeSmsCode(visibleText);
    if (!code || isRunning) {
      return;
    }

    const pendingId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), tone: "out", text: visibleText, code: true },
      { id: pendingId, tone: "in", text: "Running in sandbox...", pending: true },
    ]);
    setDraft("");
    setIsRunning(true);

    try {
      const response = await fetch("/api/repl/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language: "python", code }),
      });
      const payload = (await response.json().catch(() => null)) as ManualExecuteResponse | null;
      const reply = formatExecutionReply(response.ok, payload);

      setMessages((current) =>
        current.map((message) =>
          message.id === pendingId ? { id: pendingId, tone: "in", text: reply, code: true } : message,
        ),
      );
    } catch {
      setMessages((current) =>
        current.map((message) =>
          message.id === pendingId
            ? {
                id: pendingId,
                tone: "in",
                text: "Network error. The deployed execute endpoint did not respond.",
              }
            : message,
        ),
      );
    } finally {
      setIsRunning(false);
    }
  }

  /**
   * Inserts a sample Python snippet into the compose box.
   * @param sample - Python code to preload.
   */
  function selectSample(sample: string): void {
    if (!isRunning) {
      setDraft(sample);
    }
  }

  return (
    <>
      <style>{demoStyles}</style>
      <main className="demo-page">
        <section className="demo-panel">
          <div className="demo-copy">
            <Link className="demo-home" to="/">
              Back to home
            </Link>
            <div className="demo-kicker">Live execute endpoint</div>
            <h1>Text Python to the sandbox.</h1>
            <p>
              This demo simulates the SMS loop: your outgoing text posts to
              <code> /api/repl/execute</code>, then Pocket Code replies with stdout or stderr.
            </p>
            <div className="demo-samples" aria-label="Python samples">
              <button type="button" onClick={() => selectSample('print("SMS works")')}>
                Hello
              </button>
              <button type="button" onClick={() => selectSample("for i in range(3):\n    print(i)")}>
                Loop
              </button>
              <button type="button" onClick={() => selectSample("print(sum([2, 4, 8]))")}>
                Math
              </button>
            </div>
          </div>

          <div className="demo-phone-shell" aria-label="Interactive phone SMS demo">
            <div className="demo-phone">
              <div className="demo-island" />
              <div className="demo-screen">
                <div className="demo-status">
                  <span>9:41</span>
                  <span>LTE</span>
                </div>
                <div className="demo-contact">
                  <div className="demo-avatar">PC</div>
                  <div>
                    <strong>Pocket Code</strong>
                    <span>Text Python</span>
                  </div>
                </div>
                <div className="demo-thread" ref={threadRef} aria-live="polite">
                  <div className="demo-date">Today 9:41 AM</div>
                  {messages.map((message) => (
                    <div className={`demo-row demo-row-${message.tone}`} key={message.id}>
                      <div
                        className={`demo-bubble demo-bubble-${message.tone}${
                          message.code || message.pending ? " demo-code" : ""
                        }${message.pending ? " demo-pending" : ""}`}
                      >
                        {message.text}
                      </div>
                    </div>
                  ))}
                </div>
                <form className="demo-compose" onSubmit={handleSubmit}>
                  <textarea
                    aria-label="Python text message"
                    disabled={isRunning}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Text Python code"
                    rows={2}
                    value={draft}
                  />
                  <button disabled={isRunning || !draft.trim()} type="submit">
                    Send
                  </button>
                </form>
                <div className="demo-homebar" />
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

/**
 * Normalizes SMS-style language prefixes before dispatching Python source.
 * @param value - Raw composed text.
 * @returns Source code suitable for the Python execute endpoint.
 */
function normalizeSmsCode(value: string): string {
  return value.replace(/^(py|python)\s+/i, "").trim();
}

/**
 * Formats the execute endpoint response as a compact SMS reply.
 * @param ok - Whether the endpoint returned a successful HTTP response.
 * @param payload - Parsed JSON payload from the endpoint.
 * @returns Incoming SMS text for the simulator.
 */
function formatExecutionReply(ok: boolean, payload: ManualExecuteResponse | null): string {
  if (!ok || !payload) {
    return "Execution failed before the sandbox returned a result.";
  }

  const output = payload.stdout?.trimEnd() || payload.stderr?.trimEnd();
  if (output) {
    return output;
  }

  if (payload.status === "succeeded") {
    return "(no output)";
  }

  return payload.errorCode ? `Execution failed: ${payload.errorCode}` : "Execution failed.";
}

const demoStyles = `
@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap");

*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
}

.demo-page {
  background:
    radial-gradient(circle at 15% 14%, rgba(224, 120, 2, 0.25), transparent 28%),
    radial-gradient(circle at 82% 72%, rgba(37, 99, 235, 0.2), transparent 32%),
    #111827;
  color: #fff;
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  min-height: 100vh;
  overflow: hidden;
  padding: 32px;
}

.demo-panel {
  align-items: center;
  display: grid;
  gap: 48px;
  grid-template-columns: minmax(0, 1fr) 370px;
  margin: 0 auto;
  max-width: 1120px;
  min-height: calc(100vh - 64px);
}

.demo-copy {
  max-width: 610px;
}

.demo-home {
  color: rgba(255, 255, 255, 0.62);
  display: inline-flex;
  font-size: 0.78rem;
  font-weight: 700;
  margin-bottom: 40px;
  text-decoration: none;
  text-transform: uppercase;
}

.demo-home:hover {
  color: #ffd59e;
}

.demo-kicker {
  background: rgba(224, 120, 2, 0.18);
  border: 1px solid rgba(255, 213, 158, 0.28);
  border-radius: 999px;
  color: #ffd59e;
  display: inline-flex;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  margin-bottom: 18px;
  padding: 6px 12px;
  text-transform: uppercase;
}

.demo-copy h1 {
  font-size: clamp(2.4rem, 7vw, 5.8rem);
  letter-spacing: -0.08em;
  line-height: 0.92;
  margin: 0 0 24px;
}

.demo-copy p {
  color: rgba(255, 255, 255, 0.7);
  font-size: 1rem;
  line-height: 1.8;
  margin: 0;
  max-width: 560px;
}

.demo-copy code {
  color: #ffd59e;
  font: inherit;
  font-weight: 700;
}

.demo-samples {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 28px;
}

.demo-samples button {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 10px 15px;
}

.demo-samples button:hover {
  background: rgba(224, 120, 2, 0.28);
  border-color: rgba(255, 213, 158, 0.42);
}

.demo-phone-shell {
  display: flex;
  justify-content: center;
}

.demo-phone {
  background: #070708;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 54px;
  box-shadow: 0 42px 90px rgba(0, 0, 0, 0.48), 0 0 0 10px rgba(255, 255, 255, 0.03);
  height: 680px;
  padding: 10px;
  position: relative;
  width: 340px;
}

.demo-island {
  background: #050506;
  border-radius: 999px;
  height: 30px;
  left: 50%;
  position: absolute;
  top: 20px;
  transform: translateX(-50%);
  width: 104px;
  z-index: 2;
}

.demo-screen {
  background: #f7f7f8;
  border-radius: 44px;
  color: #111113;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.demo-status {
  align-items: flex-end;
  display: flex;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  font-size: 0.78rem;
  font-weight: 700;
  height: 56px;
  justify-content: space-between;
  padding: 0 28px 9px;
}

.demo-contact {
  align-items: center;
  background: rgba(247, 247, 248, 0.94);
  border-bottom: 1px solid rgba(60, 60, 67, 0.12);
  display: flex;
  gap: 10px;
  padding: 10px 18px 12px;
}

.demo-avatar {
  align-items: center;
  background: linear-gradient(135deg, #e07802, #2563eb);
  border-radius: 50%;
  color: #fff;
  display: flex;
  font-size: 0.7rem;
  font-weight: 700;
  height: 38px;
  justify-content: center;
  width: 38px;
}

.demo-contact strong,
.demo-contact span {
  display: block;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
}

.demo-contact strong {
  font-size: 0.84rem;
}

.demo-contact span {
  color: #8e8e93;
  font-size: 0.68rem;
  margin-top: 2px;
}

.demo-thread {
  background: #fff;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 7px;
  overflow-y: auto;
  padding: 14px 12px;
}

.demo-thread::-webkit-scrollbar {
  width: 0;
}

.demo-date {
  align-self: center;
  color: #8e8e93;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  font-size: 0.62rem;
  font-weight: 700;
  margin-bottom: 3px;
}

.demo-row {
  display: flex;
  min-width: 0;
}

.demo-row-in {
  justify-content: flex-start;
}

.demo-row-out {
  justify-content: flex-end;
}

.demo-bubble {
  border-radius: 19px;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  font-size: 0.78rem;
  line-height: 1.35;
  max-width: 84%;
  overflow-wrap: anywhere;
  padding: 8px 12px;
  white-space: pre-wrap;
}

.demo-bubble-in {
  background: #e9e9eb;
  border-bottom-left-radius: 5px;
  color: #111113;
}

.demo-bubble-out {
  background: #007aff;
  border-bottom-right-radius: 5px;
  color: #fff;
}

.demo-code {
  font-family: "IBM Plex Mono", "SF Mono", ui-monospace, monospace;
  font-size: 0.68rem;
  line-height: 1.45;
}

.demo-pending {
  color: #6b7280;
}

.demo-compose {
  align-items: flex-end;
  background: #fff;
  border-top: 1px solid rgba(60, 60, 67, 0.12);
  display: grid;
  gap: 8px;
  grid-template-columns: 1fr auto;
  padding: 9px 12px 7px;
}

.demo-compose textarea {
  background: #fff;
  border: 1px solid #c7c7cc;
  border-radius: 18px;
  color: #111113;
  font: 0.72rem/1.35 "IBM Plex Mono", ui-monospace, monospace;
  max-height: 92px;
  min-height: 38px;
  outline: none;
  padding: 9px 11px;
  resize: vertical;
  width: 100%;
}

.demo-compose textarea:focus {
  border-color: #007aff;
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.14);
}

.demo-compose button {
  background: #007aff;
  border: 0;
  border-radius: 999px;
  color: #fff;
  cursor: pointer;
  font: 700 0.72rem "IBM Plex Mono", ui-monospace, monospace;
  min-height: 38px;
  padding: 0 13px;
}

.demo-compose button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.demo-homebar {
  background: #000;
  border-radius: 999px;
  flex-shrink: 0;
  height: 5px;
  margin: 6px auto 9px;
  width: 110px;
}

@media (max-width: 860px) {
  .demo-page {
    padding: 22px;
  }

  .demo-panel {
    gap: 30px;
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .demo-copy {
    max-width: none;
  }

  .demo-home {
    margin-bottom: 28px;
  }

  .demo-phone {
    height: 640px;
    width: min(340px, 100%);
  }
}
`;
