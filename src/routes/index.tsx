/**
 * @file index.tsx
 * @description Public marketing route for the Pocketcode app.
 * @module routes
 */
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
// @ts-ignore — Vite resolves this at build time as a static URL
import logoSvgUrl from "../../icon/LOGO.svg?url";

/**
 * Public index route definition.
 * @remarks This route owns the unauthenticated marketing and sign-up experience.
 */
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Pocket Code - Learn to Code by Text",
      },
      {
        name: "description",
        content:
          "Pocket Code teaches real programming through SMS with no app, laptop, or internet required.",
      },
    ],
    links: [
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23e07802'/%3E%3Cpath d='M19 18h19c6 0 10 4 10 10s-4 10-10 10H29v8H19V18zm10 9v4h8c2 0 3-1 3-2s-1-2-3-2h-8z' fill='white'/%3E%3C/svg%3E",
      },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
    ],
  }),
  component: IndexRoute,
});

type PageName = "intro" | "signup";

/**
 * Renders the Pocket Code logo cropped from the full SVG canvas.
 * The SVG is 1440×810; the logo mark lives in the region x=409.5 y=303 w=621 h=204.
 * We scale so the logo width fits 110px, then shift the image to show only that region.
 */
function LogoIcon(): React.ReactElement {
  const scale = 110 / 621;
  const imgW = Math.round(1440 * scale);
  const imgH = Math.round(810 * scale);
  const offsetX = Math.round(409.5 * scale);
  const offsetY = Math.round(303 * scale);
  const displayH = Math.round(204 * scale);
  return (
    <div
      role="img"
      aria-label="Pocket Code logo"
      style={{ width: 110, height: displayH, overflow: "hidden", position: "relative", flexShrink: 0 }}
    >
      <img
        src={logoSvgUrl}
        alt=""
        style={{ position: "absolute", width: imgW, height: imgH, left: -offsetX, top: -offsetY, maxWidth: "none" }}
      />
    </div>
  );
}

/**
 * Renders the public marketing experience.
 * @returns TanStack frontend route with marketing and sign-up pages.
 */
function IndexRoute(): React.ReactElement {
  const [activePage, setActivePage] = useState<PageName>("intro");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  /**
   * Changes the visible marketing page and restores the viewport to the top.
   * @param page - Page key to display.
   */
  function showPage(page: PageName): void {
    setActivePage(page);
    setSubmitted(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /**
   * Validates the sign-up form and displays the success state.
   */
  function handleSubmit(): void {
    if (!phone.trim()) return;
    if (!consent) return;
    setSubmitted(true);
  }

  return (
    <>
      <style>{landingStyles}</style>
      <nav className="pc-nav" aria-label="Main navigation">
        <button className="nav-logo" type="button" onClick={() => showPage("intro")}>
          <LogoIcon />
        </button>
        <div className="nav-links">
          <Link to="/demo">Try Demo</Link>
          <button className="nav-cta" type="button" onClick={() => showPage("signup")}>
            Get Started →
          </button>
        </div>
      </nav>

      {activePage === "intro" ? (
        <main>
          <section className="hero">
            <div className="hero-content">
              <div className="tag animate-fade-up">
                <span className="tag-dot" />
                No WiFi. No Problem.
              </div>
              <h1 className="animate-fade-up delay-1">
                Code
                <br />
                from <span className="accent">anywhere.</span>
              </h1>
              <p className="animate-fade-up delay-2">
                Text Python or Java to Pocket Code. Get your output back over SMS — instantly.
                No app, no laptop, no internet needed.
              </p>
              <div className="hero-btns animate-fade-up delay-3">
                <button className="btn btn-primary btn-lg" type="button" onClick={() => showPage("signup")}>
                  Get Started
                  <ArrowIcon />
                </button>
              </div>
            </div>
            <PhoneMockup />
          </section>

          <section className="how-strip">
            <div className="how-inner">
              <div className="tag tag-blue">
                <span className="tag-dot" />
                Simple as 1, 2, 3
              </div>
              <h2>Here's how it works</h2>
              <div className="how-steps">
                {[
                  ["01", "Sign up with your number", "Enter your phone number. We'll send you a welcome text with the number to message and a quick start guide."],
                  ["02", "Text your code", "Send any Python or Java snippet directly to the Pocket Code number, just like a normal SMS."],
                  ["03", "Get your output back", "Your code runs in a secure sandbox. The result comes straight back to your phone, usually in under a second."],
                ].map(([number, title, copy]) => (
                  <article className="step-card" key={number}>
                    <div className="step-num">{number}</div>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <StatsRow />

          <section className="movement-band">
            <div className="movement-inner">
              <div className="tag tag-pink-dark">
                <span className="tag-dot" />
                Built for real life
              </div>
              <h2>
                Code execution <span className="accent-blue">shouldn't need WiFi.</span>
              </h2>
              <p>
                Over 3 billion people lack consistent internet access. Pocket Code brings a full
                Python and Java REPL to everyone on the device they already have.
              </p>
              <button className="btn btn-white btn-lg" type="button" onClick={() => showPage("signup")}>
                Get Started →
              </button>
            </div>
          </section>

          <Footer onNavigate={showPage} />
        </main>
      ) : null}

      {activePage === "signup" ? (
        <main className="signup-wrap">
          <section className="signup-shell" aria-labelledby="signup-heading">
            <div className="signup-card">
              {!submitted ? (
                <div className="signup-form-wrap">
                  <button className="back-btn" type="button" onClick={() => showPage("intro")}>
                    Back home
                  </button>
                  <div className="tag">
                    <span className="tag-dot" />
                    Start by SMS
                  </div>
                  <h2 id="signup-heading">Get your Pocket Code number.</h2>
                  <p>Enter your phone number and we'll text a quick-start guide you can use from any device.</p>

                  <div className="form-group">
                    <label className="form-label" htmlFor="phone-number">
                      Phone number
                    </label>
                    <div className="phone-group">
                      <select className="country-select" aria-label="Country code" defaultValue="+1">
                        <option value="+1">US +1</option>
                        <option value="+44">UK +44</option>
                        <option value="+234">NG +234</option>
                        <option value="+91">IN +91</option>
                        <option value="+57">CO +57</option>
                        <option value="+254">KE +254</option>
                        <option value="+27">ZA +27</option>
                        <option value="+55">BR +55</option>
                      </select>
                      <input
                        className="form-input"
                        id="phone-number"
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="(555) 000-0000"
                        type="tel"
                        value={phone}
                      />
                    </div>
                  </div>

                  <label className="consent-row">
                    <input checked={consent} onChange={(event) => setConsent(event.target.checked)} type="checkbox" />
                    <span>
                      I agree to receive SMS messages from Pocket Code. Standard rates may apply.
                      Text STOP anytime to unsubscribe.
                    </span>
                  </label>

                  <button
                    className="submit-btn"
                    disabled={!phone.trim() || !consent}
                    onClick={handleSubmit}
                    type="button"
                  >
                    Send Welcome Text
                    <ArrowIcon />
                  </button>
                </div>
              ) : (
                <div className="success-state">
                  <div className="success-icon" aria-hidden="true">
                    <CheckIcon />
                  </div>
                  <h3>Check your phone.</h3>
                  <p>A welcome text is on its way with setup instructions.</p>
                  <button className="btn btn-outline" type="button" onClick={() => showPage("intro")}>
                    Back to home
                  </button>
                </div>
              )}
            </div>
            <SignupPreview />
          </section>
        </main>
      ) : null}
    </>
  );
}

/**
 * Renders the SMS REPL product preview as an iOS Messages-style phone mockup.
 * @returns Decorative phone mockup for the hero.
 */
function PhoneMockup(): React.ReactElement {
  return (
    <div className="hero-visual animate-fade-up delay-4" aria-hidden="true">
      <MessagesPhone />
    </div>
  );
}

/**
 * Renders a decorative iOS Messages-style phone preview.
 * @returns Phone mockup used across the marketing and sign-up views.
 */
function MessagesPhone(): React.ReactElement {
  return (
    <div className="phone-body">
      <div className="phone-bezel">
        <div className="phone-pill" />
        <div className="phone-screen">
          <div className="ios-status">
            <span>9:41</span>
            <div className="ios-icons" aria-hidden="true">
              <span className="signal-bars" />
              <span className="wifi-dot" />
              <span className="battery-shape" />
            </div>
          </div>
          <div className="imsg-header">
            <div className="imsg-back">
              <ChevronIcon />
              <span>Messages</span>
            </div>
            <div className="imsg-contact">
              <div className="imsg-avatar">PC</div>
              <strong>Pocket Code</strong>
            </div>
            <div className="imsg-action-dot" />
          </div>
          <div className="imsg-thread">
            <div className="imsg-date">Today 9:41 AM</div>
            <MessageBubble tone="in">Text me Python or Java and I will run it for you.</MessageBubble>
            <MessageBubble tone="out">print("Hello, world")</MessageBubble>
            <MessageBubble tone="in" code>
              Hello, world
            </MessageBubble>
            <MessageBubble tone="out">for i in range(3): print(i)</MessageBubble>
            <div className="imsg-delivered">Delivered</div>
            <MessageBubble tone="in" code>
              0{"\n"}1{"\n"}2
            </MessageBubble>
          </div>
          <div className="imsg-compose">
            <button className="imsg-plus" type="button" aria-label="Add attachment">
              +
            </button>
            <div className="imsg-input">iMessage</div>
            <button className="imsg-send" type="button" aria-label="Send message">
              <ArrowUpIcon />
            </button>
          </div>
          <div className="phone-home-bar" />
        </div>
      </div>
    </div>
  );
}

/**
 * Renders the sign-up companion panel.
 * @returns Branded panel that explains the next SMS interaction.
 */
function SignupPreview(): React.ReactElement {
  return (
    <aside className="signup-aside" aria-label="What happens next">
      <div>
        <div className="tag tag-blue">
          <span className="tag-dot" />
          No install needed
        </div>
        <h3>Open Messages. Start coding.</h3>
        <p>
          Pocket Code replies like a normal contact, but runs every snippet in a secure sandbox before sending the result back.
        </p>
      </div>
      <MessagesPhone />
    </aside>
  );
}

/**
 * Renders a single iMessage-style chat bubble.
 * @param props - Bubble content and display style.
 * @returns Decorative message bubble.
 */
function MessageBubble({
  children,
  code = false,
  tone,
}: {
  children: React.ReactNode;
  code?: boolean;
  tone: "in" | "out";
}): React.ReactElement {
  return (
    <div className={`imsg-row imsg-row-${tone}`}>
      <div className={`imsg-bubble imsg-bubble-${tone}${code ? " imsg-code" : ""}`}>{children}</div>
    </div>
  );
}

/**
 * Renders the public metrics row.
 * @returns Three high-level product stats.
 */
function StatsRow(): React.ReactElement {
  return (
    <section className="stats-row" aria-label="Pocket Code stats">
      {[
        ["Python + Java", "Languages Supported"],
        ["< 1s", "Average Execution"],
        ["Any Phone", "No Smartphone Needed"],
      ].map(([number, label]) => (
        <div className="stat-item" key={label}>
          <div className="stat-num">{number}</div>
          <div className="stat-label">{label}</div>
        </div>
      ))}
    </section>
  );
}

/**
 * Renders the public footer.
 * @param onNavigate - Callback to navigate between pages.
 * @returns Footer with brand and legal links.
 */
function Footer({ onNavigate }: { onNavigate: (page: PageName) => void }): React.ReactElement {
  return (
    <footer>
      <button className="footer-logo-btn" type="button" onClick={() => onNavigate("intro")}>
        <LogoIcon />
      </button>
      <p>Making code execution accessible everywhere · Terms · Privacy · Contact</p>
    </footer>
  );
}

/**
 * Renders a small right arrow icon.
 * @returns SVG arrow icon.
 */
function ArrowIcon(): React.ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

/**
 * Renders a compact check icon.
 * @returns SVG check icon.
 */
function CheckIcon(): React.ReactElement {
  return (
    <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 14 14" width="14">
      <path d="M2 7l3 3 7-7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

/**
 * Renders an iOS-style back chevron.
 * @returns SVG chevron icon.
 */
function ChevronIcon(): React.ReactElement {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 16 16">
      <path d="M10 3 5 8l5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

/**
 * Renders an iOS-style upward send arrow.
 * @returns SVG send icon.
 */
function ArrowUpIcon(): React.ReactElement {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 16 16">
      <path d="M8 12V4M4.5 7.5 8 4l3.5 3.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

const landingStyles = `
@import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap");

:root {
  --pink: #e07802;
  --pink-dark: #b35f00;
  --pink-light: #fff3e0;
  --pink-mid: #ffd59e;
  --blue: #2563eb;
  --blue-dark: #1d4ed8;
  --blue-light: #dbeafe;
  --blue-mid: #93c5fd;
  --ink: #111827;
  --ink-mid: #1f2937;
  --slate: #374151;
  --muted: #6b7280;
  --soft: #9ca3af;
  --border: #e5e7eb;
  --surface: #f9fafb;
  --white: #ffffff;
  --success: #16a34a;
  --warning: #d97706;
  --danger: #dc2626;
  --mono: "IBM Plex Mono", monospace;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-full: 9999px;
}

*, *::before, *::after {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  background: var(--white);
  color: var(--ink);
  font-family: var(--mono);
  line-height: 1.6;
  overflow-x: hidden;
}

button, input, select {
  font: inherit;
}

/* ── NAV ─────────────────────────────────────── */
.pc-nav {
  align-items: center;
  backdrop-filter: blur(20px);
  background: rgba(255, 255, 255, 0.94);
  border-bottom: 1.5px solid var(--border);
  display: flex;
  height: 64px;
  justify-content: space-between;
  padding: 0 2rem;
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-logo {
  align-items: center;
  background: transparent;
  border: 0;
  cursor: pointer;
  display: inline-flex;
  padding: 0;
  transition: opacity 0.2s;
}

.nav-logo:hover {
  opacity: 0.8;
}

.nav-links {
  align-items: center;
  display: flex;
  gap: 1.5rem;
}

.nav-links button,
.nav-links a {
  background: transparent;
  border: 0;
  color: var(--slate);
  cursor: pointer;
  font-family: var(--mono);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  padding: 0;
  text-decoration: none;
  text-transform: uppercase;
  transition: color 0.2s;
}

.nav-links button:hover,
.nav-links a:hover {
  color: var(--pink);
}

.nav-links .nav-cta {
  background: var(--pink);
  border-radius: var(--radius-full);
  color: var(--white);
  font-weight: 700;
  padding: 0.45rem 1.1rem;
}

.nav-links .nav-cta:hover {
  background: var(--pink-dark);
  color: var(--white);
  transform: translateY(-1px);
}

/* ── TYPOGRAPHY ──────────────────────────────── */
h1, h2, h3, h4 {
  font-family: var(--mono);
  letter-spacing: -0.03em;
  margin: 0;
}

h1 {
  font-size: clamp(2.2rem, 5.5vw, 3.6rem);
  font-weight: 700;
  line-height: 1.08;
  margin-bottom: 1.25rem;
}

h2 {
  font-size: clamp(1.6rem, 3.5vw, 2.5rem);
  font-weight: 700;
  line-height: 1.12;
}

h3 {
  font-size: 1.05rem;
  font-weight: 700;
}

p {
  color: var(--slate);
  font-size: 0.95rem;
  line-height: 1.75;
}

.accent {
  color: var(--pink);
}

.accent-blue {
  color: var(--blue);
}

/* ── TAGS ────────────────────────────────────── */
.tag {
  align-items: center;
  background: var(--pink-light);
  border: 1px solid var(--pink-mid);
  border-radius: var(--radius-full);
  color: var(--pink-dark);
  display: inline-flex;
  font-family: var(--mono);
  font-size: 0.65rem;
  font-weight: 700;
  gap: 6px;
  letter-spacing: 0.08em;
  margin-bottom: 1.25rem;
  padding: 5px 12px;
  text-transform: uppercase;
}

.tag-blue {
  background: var(--blue-light);
  border-color: var(--blue-mid);
  color: var(--blue-dark);
}

.tag-dark {
  background: rgba(224, 120, 2, 0.15);
  border-color: rgba(224, 120, 2, 0.3);
  color: #ffd59e;
}

.tag-pink-dark {
  background: rgba(224, 120, 2, 0.12);
  border-color: rgba(224, 120, 2, 0.25);
  color: var(--pink-dark);
}

.tag-dot {
  background: currentColor;
  border-radius: 50%;
  display: inline-block;
  height: 5px;
  width: 5px;
}

/* ── BUTTONS ─────────────────────────────────── */
.btn {
  align-items: center;
  border: 0;
  border-radius: var(--radius-full);
  cursor: pointer;
  display: inline-flex;
  font-family: var(--mono);
  font-weight: 700;
  font-size: 0.85rem;
  gap: 8px;
  justify-content: center;
  letter-spacing: 0.02em;
  padding: 0.75rem 1.75rem;
  text-decoration: none;
  transition: transform 0.15s, box-shadow 0.15s, background 0.2s, border-color 0.2s;
  white-space: nowrap;
}

.btn:active {
  transform: scale(0.97);
}

.btn-primary {
  background: var(--pink);
  box-shadow: 0 4px 18px rgba(224, 120, 2, 0.35);
  color: var(--white);
}

.btn-primary:hover {
  background: var(--pink-dark);
  box-shadow: 0 6px 26px rgba(224, 120, 2, 0.48);
  transform: translateY(-2px);
}

.btn-outline {
  background: transparent;
  border: 1.5px solid var(--border);
  color: var(--ink);
}

.btn-outline:hover {
  border-color: var(--pink);
  color: var(--pink);
  transform: translateY(-1px);
}

.btn-white {
  background: var(--white);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.14);
  color: var(--pink);
}

.btn-white:hover {
  box-shadow: 0 6px 26px rgba(0, 0, 0, 0.2);
  transform: translateY(-2px);
}

.btn-lg {
  font-size: 0.95rem;
  padding: 0.9rem 2.2rem;
}

/* ── ANIMATIONS ──────────────────────────────── */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@keyframes pulseRing {
  0% { box-shadow: 0 0 0 0 rgba(224, 120, 2, 0.4); transform: scale(0.95); }
  70% { box-shadow: 0 0 0 14px rgba(224, 120, 2, 0); transform: scale(1); }
  100% { transform: scale(0.95); }
}

.animate-fade-up {
  animation: fadeUp 0.65s ease forwards;
}

.delay-1, .delay-2, .delay-3, .delay-4 {
  opacity: 0;
}

.delay-1 { animation-delay: 0.1s; }
.delay-2 { animation-delay: 0.22s; }
.delay-3 { animation-delay: 0.36s; }
.delay-4 { animation-delay: 0.5s; }

/* ── HERO ────────────────────────────────────── */
.hero {
  align-items: center;
  display: grid;
  gap: 4rem;
  grid-template-columns: 1fr 1fr;
  margin: 0 auto;
  max-width: 1100px;
  padding: 5rem 2rem 4rem;
}

.hero h1 span {
  color: var(--pink);
}

.hero p {
  font-size: 1rem;
  margin: 0 0 2rem;
  max-width: 460px;
}

.hero-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.hero-visual {
  align-items: center;
  display: flex;
  justify-content: center;
}

/* ── PHONE MOCKUP ────────────────────────────── */
/* ── PHONE MOCKUP ─────────────────────────── */
.hero-visual {
  align-items: center;
  display: flex;
  flex-shrink: 0;
  justify-content: center;
}

.phone-body {
  animation: float 4s ease-in-out infinite;
  background: #1C1C1E;
  border-radius: 50px;
  box-shadow: 0 48px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.04);
  height: 520px;
  position: relative;
  width: 252px;
}

/* Dynamic island pill — floats above phone-inner */
.phone-pill {
  background: #000;
  border-radius: 14px;
  height: 28px;
  left: 50%;
  position: absolute;
  top: 14px;
  transform: translateX(-50%);
  width: 96px;
  z-index: 4;
}

/* Fills the phone-body completely; flex column so children stack reliably */
.phone-inner {
  border-radius: 50px;
  bottom: 0;
  display: flex;
  flex-direction: column;
  left: 0;
  overflow: hidden;
  position: absolute;
  right: 0;
  top: 0;
  background: #000;
}

/* Status bar — padding-top clears the 28px pill + 14px offset */
.ph-bar {
  align-items: center;
  background: #000;
  color: #fff;
  display: flex;
  flex-shrink: 0;
  height: 52px;
  justify-content: space-between;
  padding: 30px 20px 6px;
}

.ph-time {
  font-family: -apple-system, sans-serif;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.ph-icons {
  align-items: center;
  display: flex;
  gap: 5px;
}

/* Contact header */
.ph-head {
  align-items: center;
  background: #1C1C1E;
  border-bottom: 0.5px solid rgba(255,255,255,0.1);
  display: flex;
  flex-shrink: 0;
  gap: 10px;
  padding: 8px 14px;
}

.ph-avatar {
  align-items: center;
  background: linear-gradient(135deg, #e07802 0%, #b35f00 100%);
  border-radius: 50%;
  color: #fff;
  display: flex;
  flex-shrink: 0;
  font-size: 0.6rem;
  font-weight: 700;
  height: 34px;
  justify-content: center;
  width: 34px;
}

.ph-head-name {
  color: #fff;
  font-size: 0.75rem;
  font-weight: 600;
}

.ph-head-sub {
  color: #636366;
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.55rem;
  margin-top: 1px;
}

/* Message list */
.ph-msgs {
  background: #000;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
  padding: 12px 12px 6px;
}

.ph-ts {
  align-self: center;
  color: #636366;
  font-size: 0.55rem;
  margin-bottom: 4px;
}

.ph-row {
  display: flex;
}

.ph-in {
  justify-content: flex-start;
}

.ph-out {
  justify-content: flex-end;
}

.ph-bub {
  border-radius: 16px;
  font-family: -apple-system, sans-serif;
  font-size: 0.7rem;
  line-height: 1.45;
  max-width: 82%;
  padding: 7px 12px;
}

.ph-bub-in {
  background: #3A3A3C;
  border-radius: 16px 16px 16px 4px;
  color: #fff;
}

.ph-bub-out {
  background: #007AFF;
  border-radius: 16px 16px 4px 16px;
  color: #fff;
}

/* Code + result override fonts */
.ph-code {
  font-family: "IBM Plex Mono", "SF Mono", ui-monospace, monospace;
  font-size: 0.65rem;
  letter-spacing: -0.02em;
}

.ph-result {
  background: #1C1C1E;
  border-radius: 16px 16px 16px 4px;
  color: #32D74B;
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.65rem;
}

/* Compose bar */
.ph-compose {
  align-items: center;
  background: #1C1C1E;
  border-top: 0.5px solid rgba(255,255,255,0.1);
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  padding: 8px 12px;
}

.ph-input {
  align-items: center;
  background: #2C2C2E;
  border-radius: 18px;
  color: #636366;
  display: flex;
  flex: 1;
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.6rem;
  height: 30px;
  padding: 0 12px;
}

.ph-send {
  align-items: center;
  background: #007AFF;
  border: none;
  border-radius: 50%;
  color: #fff;
  cursor: default;
  display: flex;
  flex-shrink: 0;
  font-size: 0.8rem;
  font-weight: 700;
  height: 26px;
  justify-content: center;
  line-height: 1;
  padding: 0;
  width: 26px;
}

.ph-home-bar {
  background: #fff;
  border-radius: 3px;
  flex-shrink: 0;
  height: 4px;
  margin: 6px auto 8px;
  opacity: 0.2;
  width: 100px;
}

.cursor-blink {
  animation: blink 1s infinite;
  background: var(--pink);
  display: inline-block;
  height: 10px;
  margin-left: 2px;
  width: 1px;
}

/* iOS Messages preview */
.phone-body {
  animation: float 4s ease-in-out infinite;
  background: #111113;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 52px;
  box-shadow: 0 48px 90px rgba(17,24,39,0.34), 0 18px 38px rgba(224,120,2,0.16);
  height: 548px;
  padding: 9px;
  position: relative;
  width: 276px;
}

.signup-aside .phone-body {
  animation: none;
  height: 470px;
  transform: rotate(2deg);
  width: 236px;
}

.phone-bezel {
  background: #000;
  border-radius: 44px;
  height: 100%;
  overflow: hidden;
  position: relative;
  width: 100%;
}

.phone-pill {
  background: #050505;
  border-radius: 999px;
  height: 28px;
  left: 50%;
  position: absolute;
  top: 12px;
  transform: translateX(-50%);
  width: 92px;
  z-index: 5;
}

.phone-screen {
  background: #f7f7f8;
  border-radius: 40px;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.ios-status {
  align-items: flex-end;
  background: #f7f7f8;
  color: #0b0b0f;
  display: flex;
  flex-shrink: 0;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  font-size: 0.76rem;
  font-weight: 700;
  height: 52px;
  justify-content: space-between;
  letter-spacing: -0.03em;
  padding: 0 25px 8px;
}

.ios-icons {
  align-items: center;
  display: flex;
  gap: 5px;
  height: 14px;
}

.signal-bars {
  background: linear-gradient(to top, #0b0b0f 30%, transparent 30%), linear-gradient(to top, #0b0b0f 55%, transparent 55%), linear-gradient(to top, #0b0b0f 80%, transparent 80%);
  background-position: 0 0, 5px 0, 10px 0;
  background-repeat: no-repeat;
  background-size: 3px 12px;
  display: block;
  height: 12px;
  width: 13px;
}

.wifi-dot {
  background: #0b0b0f;
  border-radius: 50%;
  display: block;
  height: 5px;
  width: 5px;
}

.battery-shape {
  border: 1.5px solid #0b0b0f;
  border-radius: 4px;
  display: block;
  height: 10px;
  position: relative;
  width: 20px;
}

.battery-shape::before {
  background: #0b0b0f;
  border-radius: 2px;
  content: "";
  inset: 2px 4px 2px 2px;
  position: absolute;
}

.battery-shape::after {
  background: #0b0b0f;
  border-radius: 0 2px 2px 0;
  content: "";
  height: 4px;
  position: absolute;
  right: -4px;
  top: 2px;
  width: 2px;
}

.imsg-header {
  align-items: center;
  background: rgba(247,247,248,0.92);
  border-bottom: 1px solid rgba(60,60,67,0.12);
  display: grid;
  flex-shrink: 0;
  grid-template-columns: 1fr auto 1fr;
  min-height: 70px;
  padding: 5px 12px 8px;
}

.imsg-back {
  align-items: center;
  color: #007aff;
  display: flex;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  font-size: 0.74rem;
  gap: 1px;
}

.imsg-back svg {
  height: 16px;
  width: 16px;
}

.imsg-contact {
  align-items: center;
  color: #1c1c1e;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  font-size: 0.68rem;
  gap: 4px;
  line-height: 1;
}

.imsg-avatar {
  align-items: center;
  background: linear-gradient(135deg, var(--pink), var(--blue));
  border-radius: 50%;
  color: #fff;
  display: flex;
  font-family: var(--mono);
  font-size: 0.62rem;
  font-weight: 700;
  height: 33px;
  justify-content: center;
  width: 33px;
}

.imsg-action-dot {
  justify-self: end;
  width: 32px;
}

.imsg-thread {
  background: #fff;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 5px;
  overflow: hidden;
  padding: 12px 11px 8px;
}

.imsg-date {
  align-self: center;
  color: #8e8e93;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  font-size: 0.58rem;
  font-weight: 600;
  margin-bottom: 4px;
}

.imsg-row {
  display: flex;
  min-width: 0;
}

.imsg-row-in {
  justify-content: flex-start;
}

.imsg-row-out {
  justify-content: flex-end;
}

.imsg-bubble {
  border-radius: 18px;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  font-size: 0.7rem;
  letter-spacing: -0.02em;
  line-height: 1.32;
  max-width: 82%;
  overflow-wrap: anywhere;
  padding: 7px 11px;
  white-space: pre-wrap;
}

.imsg-bubble-in {
  background: #e9e9eb;
  border-bottom-left-radius: 5px;
  color: #111113;
}

.imsg-bubble-out {
  background: #007aff;
  border-bottom-right-radius: 5px;
  color: #fff;
}

.imsg-code {
  font-family: "IBM Plex Mono", "SF Mono", ui-monospace, monospace;
  font-size: 0.61rem;
  line-height: 1.45;
}

.imsg-delivered {
  align-self: flex-end;
  color: #8e8e93;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  font-size: 0.54rem;
  margin-top: -2px;
  padding-right: 6px;
}

.imsg-compose {
  align-items: center;
  background: #fff;
  border-top: 1px solid rgba(60,60,67,0.12);
  display: flex;
  flex-shrink: 0;
  gap: 7px;
  padding: 8px 10px 6px;
}

.imsg-plus,
.imsg-send {
  align-items: center;
  border: 0;
  border-radius: 50%;
  display: flex;
  flex-shrink: 0;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  justify-content: center;
  padding: 0;
}

.imsg-plus {
  background: #8e8e93;
  color: #fff;
  font-size: 1rem;
  height: 22px;
  width: 22px;
}

.imsg-input {
  align-items: center;
  border: 1px solid #c7c7cc;
  border-radius: 18px;
  color: #8e8e93;
  display: flex;
  flex: 1;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  font-size: 0.68rem;
  height: 30px;
  padding: 0 12px;
}

.imsg-send {
  background: #007aff;
  color: #fff;
  height: 23px;
  width: 23px;
}

.imsg-send svg {
  height: 13px;
  width: 13px;
}

.phone-home-bar {
  background: #000;
  border-radius: 999px;
  flex-shrink: 0;
  height: 5px;
  margin: 5px auto 8px;
  opacity: 0.92;
  width: 106px;
}

/* ── HOW IT WORKS ────────────────────────────── */
.how-strip {
  background: var(--surface);
  border-bottom: 1.5px solid var(--border);
  border-top: 1.5px solid var(--border);
  padding: 4rem 2rem;
}

.how-inner {
  margin: 0 auto;
  max-width: 1100px;
}

.how-steps {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: repeat(3, 1fr);
  margin-top: 2.5rem;
}

.step-card {
  background: var(--white);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 1.75rem;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
}

.step-card:hover {
  border-color: var(--pink-mid);
  box-shadow: 0 16px 40px rgba(224, 120, 2, 0.08);
  transform: translateY(-4px);
}

.step-num {
  color: var(--pink);
  font-family: var(--mono);
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.05em;
  line-height: 1;
  margin-bottom: 1rem;
}

.step-card h3 {
  margin-bottom: 0.5rem;
}

.step-card p {
  color: var(--muted);
  font-size: 0.85rem;
}

/* ── STATS ───────────────────────────────────── */
.stats-row {
  border-bottom: 1.5px solid var(--border);
  border-top: 1.5px solid var(--border);
  display: grid;
  gap: 0;
  grid-template-columns: repeat(3, 1fr);
  margin: 0 auto;
  max-width: 100%;
}

.stat-item {
  border-right: 1.5px solid var(--border);
  padding: 3.5rem 2rem;
  text-align: center;
}

.stat-item:last-child {
  border-right: 0;
}

.stat-num {
  color: var(--pink);
  font-family: var(--mono);
  font-size: 2.8rem;
  font-weight: 700;
  letter-spacing: -0.05em;
  line-height: 1;
  margin-bottom: 0.4rem;
}

.stat-label {
  color: var(--muted);
  font-family: var(--mono);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* ── MOVEMENT BAND ───────────────────────────── */
.movement-band {
  background: var(--pink);
  background-image: radial-gradient(circle at 10% 50%, rgba(255,255,255,0.06) 1px, transparent 1px),
    radial-gradient(circle at 90% 20%, rgba(0,0,0,0.08) 1px, transparent 1px);
  background-size: 44px 44px, 64px 64px;
  padding: 5rem 2rem;
  position: relative;
  text-align: center;
}

.movement-inner {
  margin: 0 auto;
  max-width: 640px;
  position: relative;
}

.movement-band h2 {
  color: var(--white);
  margin-bottom: 1rem;
}

.movement-band .accent-blue {
  color: #bfdbfe;
}

.movement-band p {
  color: rgba(255,255,255,0.8);
  margin: 0 auto 2rem;
}

/* ── FEATURES PAGE ───────────────────────────── */
.section {
  margin: 0 auto;
  max-width: 1100px;
  padding: 5rem 2rem;
}

.intro-section {
  max-width: 680px;
  text-align: center;
}

.intro-section p {
  margin-top: 1rem;
}

.feature-wrap {
  margin: 0 auto;
  max-width: 1100px;
  padding: 0 2rem 4rem;
}

.feature-grid {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: repeat(2, 1fr);
}

.feature-card {
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 1.75rem;
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
}

.feature-card:hover {
  border-color: rgba(37, 99, 235, 0.3);
  box-shadow: 0 12px 32px rgba(37, 99, 235, 0.08);
  transform: translateY(-3px);
}

.feat-num {
  color: var(--blue);
  font-family: var(--mono);
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.05em;
  margin-bottom: 0.75rem;
}

.feature-card h3 {
  margin-bottom: 0.5rem;
}

.feature-card p {
  color: var(--muted);
  font-size: 0.85rem;
}

/* ── CURRICULUM ──────────────────────────────── */
.curriculum {
  background: var(--ink);
  color: var(--white);
  padding: 5rem 2rem;
}

.curriculum-inner {
  margin: 0 auto;
  max-width: 1100px;
}

.curriculum h2 {
  color: var(--white);
}

.curriculum-inner > p {
  color: rgba(255,255,255,0.55);
  font-size: 0.9rem;
  margin-bottom: 3rem;
}

.tracks {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: repeat(3, 1fr);
  margin-top: 2.5rem;
}

.track-card {
  background: rgba(255,255,255,0.04);
  border: 1.5px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-xl);
  padding: 1.5rem;
  transition: background 0.2s, border-color 0.2s;
}

.track-card:hover {
  background: rgba(224, 120, 2, 0.08);
  border-color: rgba(224, 120, 2, 0.3);
}

.track-card h3 {
  color: var(--white);
}

.track-card p {
  color: rgba(255,255,255,0.55);
  font-size: 0.83rem;
}

.track-badge {
  border-radius: var(--radius-full);
  display: inline-block;
  font-family: var(--mono);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  margin-bottom: 0.75rem;
  padding: 3px 10px;
  text-transform: uppercase;
}

.badge-python {
  background: rgba(224, 120, 2, 0.2);
  color: #ffd59e;
}

.badge-web {
  background: rgba(37, 99, 235, 0.2);
  color: #93c5fd;
}

.badge-data {
  background: rgba(22, 163, 74, 0.2);
  color: #86efac;
}

.track-lessons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 0.75rem;
}

.lesson-pill {
  background: rgba(255,255,255,0.07);
  border-radius: 6px;
  color: rgba(255,255,255,0.5);
  font-family: var(--mono);
  font-size: 0.62rem;
  padding: 3px 8px;
}

/* ── TESTIMONIALS ────────────────────────────── */
.testimonials {
  margin: 0 auto;
  max-width: 1100px;
  padding: 5rem 2rem;
}

.testimonials-heading {
  margin: 0 auto 1rem;
  max-width: 580px;
  text-align: center;
}

.testi-grid {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: repeat(3, 1fr);
  margin-top: 2.5rem;
}

.testi-card {
  background: var(--white);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-xl);
  padding: 1.75rem;
  transition: transform 0.2s, box-shadow 0.2s;
}

.testi-card:hover {
  box-shadow: 0 16px 40px rgba(0,0,0,0.07);
  transform: translateY(-4px);
}

.testi-quote {
  color: var(--pink);
  font-family: var(--mono);
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 0.75rem;
}

.testi-card p {
  color: var(--slate);
  font-size: 0.85rem;
  line-height: 1.65;
}

.testi-author {
  align-items: center;
  display: flex;
  gap: 10px;
  margin-top: 1.25rem;
}

.testi-avatar {
  align-items: center;
  background: var(--pink-light);
  border: 1.5px solid var(--pink-mid);
  border-radius: 50%;
  color: var(--pink-dark);
  display: flex;
  font-family: var(--mono);
  font-size: 0.65rem;
  font-weight: 700;
  height: 36px;
  justify-content: center;
  width: 36px;
}

.testi-name {
  font-family: var(--mono);
  font-size: 0.82rem;
  font-weight: 700;
}

.testi-loc {
  color: var(--soft);
  font-size: 0.72rem;
}

/* ── CTA BAND ────────────────────────────────── */
.cta-band {
  background: var(--ink);
  overflow: hidden;
  padding: 5rem 2rem;
  position: relative;
  text-align: center;
}

.cta-band::before {
  background-image: radial-gradient(circle at 20% 50%, rgba(224, 120, 2, 0.06) 1px, transparent 1px),
    radial-gradient(circle at 80% 20%, rgba(37, 99, 235, 0.06) 1px, transparent 1px);
  background-size: 40px 40px, 60px 60px;
  content: "";
  inset: 0;
  position: absolute;
}

.cta-inner {
  position: relative;
}

.cta-band h2 {
  color: var(--white);
  margin-bottom: 0.75rem;
}

.cta-band p {
  color: rgba(255,255,255,0.6);
  font-size: 0.9rem;
  margin-bottom: 2rem;
}

/* ── SIGN-UP ─────────────────────────────────── */
.signup-wrap {
  align-items: center;
  background:
    radial-gradient(circle at 15% 20%, rgba(224,120,2,0.12), transparent 30%),
    radial-gradient(circle at 85% 70%, rgba(37,99,235,0.12), transparent 32%),
    var(--surface);
  display: flex;
  justify-content: center;
  min-height: calc(100vh - 64px);
  padding: 4rem 1.5rem;
}

.signup-shell {
  align-items: stretch;
  display: grid;
  gap: 1.5rem;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 0.82fr);
  margin: 0 auto;
  max-width: 1040px;
  width: 100%;
}

.signup-card {
  background: var(--white);
  border: 1.5px solid rgba(17,24,39,0.1);
  border-radius: var(--radius-xl);
  box-shadow: 0 24px 60px rgba(17,24,39,0.08);
  display: flex;
  min-height: 560px;
  padding: 2.5rem;
  width: 100%;
}

.back-btn {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-family: var(--mono);
  font-size: 0.8rem;
  margin-bottom: 1.5rem;
  padding: 0;
  transition: color 0.15s;
}

.back-btn::before {
  content: "< ";
}

.back-btn:hover {
  color: var(--ink);
}

.signup-form-wrap, .success-state {
  width: 100%;
}

.signup-card h2 {
  font-size: clamp(1.9rem, 4vw, 2.65rem);
  line-height: 1.08;
  margin-bottom: 0.8rem;
}

.signup-form-wrap > p {
  color: var(--muted);
  font-size: 0.92rem;
  margin: 0 0 2rem;
  max-width: 520px;
}

.signup-aside {
  align-items: center;
  background: var(--ink);
  border: 1.5px solid rgba(255,255,255,0.08);
  border-radius: var(--radius-xl);
  color: var(--white);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  padding: 2.25rem 1.5rem 0;
  position: relative;
}

.signup-aside::before {
  background-image:
    radial-gradient(circle at 25% 25%, rgba(224,120,2,0.32) 0 1px, transparent 1px),
    radial-gradient(circle at 72% 14%, rgba(37,99,235,0.28) 0 1px, transparent 1px);
  background-size: 32px 32px, 44px 44px;
  content: "";
  inset: 0;
  opacity: 0.7;
  position: absolute;
}

.signup-aside > * {
  position: relative;
}

.signup-aside h3 {
  color: var(--white);
  font-size: 1.45rem;
  line-height: 1.15;
  margin-bottom: 0.75rem;
}

.signup-aside p {
  color: rgba(255,255,255,0.68);
  font-size: 0.85rem;
  margin: 0;
}

.form-group {
  display: block;
  margin-bottom: 1.25rem;
}

.form-label {
  color: var(--ink);
  display: block;
  font-family: var(--mono);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  margin-bottom: 6px;
  text-transform: uppercase;
}

.form-input, .country-select {
  background: var(--white);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--ink);
  font-family: var(--mono);
  font-size: 0.88rem;
  height: 50px;
  outline: none;
  padding: 0 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  width: 100%;
}

.form-input:focus, .country-select:focus {
  border-color: var(--pink);
  box-shadow: 0 0 0 3px rgba(224, 120, 2, 0.14);
}

.form-input-error {
  border-color: var(--danger);
}

.phone-group {
  display: flex;
  gap: 10px;
}

.country-select {
  cursor: pointer;
  min-width: 100px;
  width: auto;
}

.track-select {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(3, 1fr);
}

.track-opt {
  align-items: center;
  background: var(--white);
  border: 1.5px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--slate);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  font-family: var(--mono);
  font-size: 0.75rem;
  font-weight: 700;
  gap: 5px;
  letter-spacing: 0.03em;
  padding: 12px 8px;
  transition: border-color 0.2s, background 0.2s, color 0.2s;
}

.track-opt:hover, .track-opt.selected {
  border-color: var(--pink);
  color: var(--pink-dark);
}

.track-opt.selected {
  background: var(--pink-light);
}

.track-dot {
  background: var(--pink);
  border-radius: 50%;
  height: 7px;
  width: 7px;
}

.consent-row {
  align-items: flex-start;
  color: var(--muted);
  display: flex;
  font-family: var(--mono);
  font-size: 0.75rem;
  gap: 10px;
  line-height: 1.55;
  margin: 1.25rem 0;
}

.consent-row input {
  accent-color: var(--pink);
  margin-top: 3px;
}

.consent-error {
  outline: 2px solid var(--danger);
  outline-offset: 6px;
  border-radius: 4px;
}

.submit-btn {
  align-items: center;
  background: var(--pink);
  border: 0;
  border-radius: var(--radius-md);
  box-shadow: 0 4px 18px rgba(224, 120, 2, 0.35);
  color: var(--white);
  cursor: pointer;
  display: flex;
  font-family: var(--mono);
  font-size: 0.95rem;
  font-weight: 700;
  gap: 8px;
  height: 54px;
  justify-content: center;
  transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
  width: 100%;
}

.submit-btn:hover:not(:disabled) {
  background: var(--pink-dark);
  box-shadow: 0 8px 26px rgba(224, 120, 2, 0.42);
  transform: translateY(-2px);
}

.submit-btn:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.divider-text {
  color: var(--soft);
  font-family: var(--mono);
  font-size: 0.72rem;
  margin: 1.25rem 0;
  position: relative;
  text-align: center;
}

.divider-text::before,
.divider-text::after {
  background: var(--border);
  content: "";
  height: 1px;
  position: absolute;
  top: 50%;
  width: 40%;
}

.divider-text::before { left: 0; }
.divider-text::after { right: 0; }

.already-copy {
  color: var(--muted);
  font-family: var(--mono);
  font-size: 0.78rem;
  text-align: center;
}

.success-state {
  padding: 2rem 0;
  text-align: center;
}

.success-icon {
  align-items: center;
  animation: pulseRing 2s infinite;
  background: var(--pink-light);
  border-radius: 50%;
  color: var(--pink);
  display: flex;
  height: 64px;
  justify-content: center;
  margin: 0 auto 1.25rem;
  width: 64px;
}

.success-icon svg {
  height: 24px;
  width: 24px;
}

.success-state h3 {
  font-size: 1.4rem;
  margin-bottom: 0.5rem;
}

.expect-card {
  background: var(--pink-light);
  border: 1px solid var(--pink-mid);
  border-radius: var(--radius-lg);
  margin: 2rem auto;
  max-width: 380px;
  padding: 1.25rem;
  text-align: left;
}

.expect-card strong {
  color: var(--pink-dark);
  display: block;
  font-family: var(--mono);
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
}

.expect-card p {
  font-size: 0.85rem;
  margin: 0;
}

/* ── FOOTER ──────────────────────────────────── */
footer {
  background: var(--ink);
  color: rgba(255,255,255,0.45);
  font-family: var(--mono);
  font-size: 0.75rem;
  padding: 3rem 2rem;
  text-align: center;
}

.footer-logo-btn {
  background: transparent;
  border: 0;
  cursor: pointer;
  display: inline-block;
  margin-bottom: 1rem;
  opacity: 0.85;
  padding: 0;
  transition: opacity 0.2s;
}

.footer-logo-btn:hover {
  opacity: 1;
}

footer p {
  color: rgba(255,255,255,0.4);
  margin: 0;
}

/* ── RESPONSIVE ──────────────────────────────── */
@media (max-width: 768px) {
  .pc-nav {
    padding: 0 1rem;
  }

  .nav-links {
    gap: 0.75rem;
  }

  .nav-links button:not(.nav-cta) {
    display: none;
  }

  .hero,
  .signup-shell {
    grid-template-columns: 1fr;
  }

  .hero {
    gap: 2.5rem;
    padding: 3rem 1.5rem;
    text-align: center;
  }

  .hero p {
    margin-left: auto;
    margin-right: auto;
  }

  .hero-btns {
    justify-content: center;
  }

  .phone-body {
    height: 500px;
    width: 252px;
  }

  .how-steps,
  .tracks,
  .testi-grid,
  .feature-grid,
  .stats-row {
    grid-template-columns: 1fr;
  }

  .stats-row {
    border-top: 0;
  }

  .stat-item {
    border-bottom: 1.5px solid var(--border);
    border-right: 0;
  }

  .signup-wrap {
    padding: 2rem 1rem;
  }

  .signup-card {
    min-height: auto;
    padding: 1.5rem;
  }

  .signup-aside {
    min-height: 600px;
    text-align: center;
  }

  .phone-group {
    flex-direction: column;
  }

  .country-select {
    width: 100%;
  }
}
`;
