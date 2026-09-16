import type { ReactNode } from "react";

/**
 * Sign-in shell.
 *
 * Two panels on a wide screen, one on a phone - where the pitch panel is hidden
 * entirely rather than stacked, because nobody signing in on a phone needs to
 * scroll past marketing copy to reach the password field.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-vega-bg px-4 py-8">
      {/* Ambient glow. Purely decorative, and kept behind everything. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-vega-accent/[0.13] blur-[120px]" />
        <div className="absolute -bottom-52 -right-32 h-[30rem] w-[30rem] rounded-full bg-[#22d3ee]/[0.07] blur-[130px]" />
      </div>

      <div className="relative w-full min-w-0 max-w-[940px]">
        <div className="overflow-hidden rounded-2xl border border-vega-border bg-vega-surface-1/90 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.75)] backdrop-blur-sm">
          <div className="grid min-w-0 lg:grid-cols-[1.02fr_0.98fr]">
            {/* Pitch panel - desktop only. */}
            <section className="relative hidden flex-col justify-between overflow-hidden border-r border-vega-border-soft bg-[#080f18] p-9 lg:flex">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-[0.55]"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.12) 1px, transparent 0)",
                  backgroundSize: "22px 22px",
                }}
              />
              <div className="relative">
                <span className="inline-flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-vega-accent text-base font-bold text-white">
                    V
                  </span>
                  <span className="text-sm font-semibold tracking-wide text-vega-text">Vega</span>
                </span>

                <h1 className="mt-9 text-[34px] font-semibold leading-[1.15] tracking-tight text-vega-text">
                  Command
                  <br />
                  Center
                </h1>
                <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-vega-text-muted">
                  Leads, clients, tasks and delivery in one place - built for clarity, speed and
                  everyday execution.
                </p>
              </div>

              <ul className="relative mt-10 space-y-2.5">
                {[
                  "Role-based secure access",
                  "Structured task tracking",
                  "Live team and delivery visibility",
                ].map((item, index) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 rounded-lg border border-vega-border-soft bg-white/[0.02] px-3.5 py-3 text-[13px] text-vega-text-secondary"
                  >
                    <span className="font-mono text-[10px] text-vega-accent">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <div className="flex min-w-0 items-center justify-center p-5 sm:p-8 lg:p-10">
              <div className="w-full min-w-0 max-w-[360px]">
                {/* Phone-only brand mark, since the pitch panel is hidden there. */}
                <span className="mb-7 inline-flex items-center gap-2.5 lg:hidden">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-vega-accent text-base font-bold text-white">
                    V
                  </span>
                  <span className="text-sm font-semibold tracking-wide text-vega-text">Vega</span>
                </span>
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
