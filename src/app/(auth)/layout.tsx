import type { ReactNode } from "react";
import { FileText, Shield, Users } from "lucide-react";

const FEATURES = [
  {
    icon: Shield,
    title: "Role-based secure access",
    detail: "Right people. Right access. Always secure.",
  },
  {
    icon: FileText,
    title: "Structured task tracking",
    detail: "Turn plans into progress.",
  },
  {
    icon: Users,
    title: "Live team and delivery visibility",
    detail: "See what is happening. Keep moving.",
  },
] as const;

function Wordmark({ size = "sm" }: { size?: "sm" | "lg" }) {
  const box = size === "lg" ? "h-11 w-11 rounded-xl text-lg" : "h-9 w-9 rounded-lg text-base";
  const text = size === "lg" ? "text-lg" : "text-base";
  return (
    <span className="inline-flex items-center gap-3">
      <span
        className={`flex items-center justify-center bg-[#2f6bff] font-bold text-white shadow-[0_6px_18px_-4px_rgba(47,107,255,0.7)] ${box}`}
      >
        V
      </span>
      <span className={`font-semibold tracking-tight text-white ${text}`}>Vega</span>
    </span>
  );
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#040a14] text-white">
      {/* Deep-space backdrop: a base wash, two sweeping arcs and a faint star
          field. All decorative, all behind the content, none of it interactive. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(125%_100%_at_50%_0%,#0b1b35_0%,#071224_45%,#040a14_100%)]" />
        <div className="absolute -left-[22%] -top-[65%] h-[150%] w-[105%] rounded-full border border-[#2f6bff]/25 shadow-[0_0_140px_35px_rgba(47,107,255,0.14)]" />
        <div className="absolute -bottom-[78%] -right-[28%] h-[150%] w-[105%] rounded-full border border-[#2f6bff]/20 shadow-[0_0_150px_45px_rgba(47,107,255,0.11)]" />
        <div className="absolute -left-[12%] top-[8%] h-[34rem] w-[34rem] rounded-full bg-[#2f6bff]/[0.10] blur-[130px]" />
        <div className="absolute -right-[10%] bottom-[2%] h-[30rem] w-[30rem] rounded-full bg-[#3b82f6]/[0.09] blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "radial-gradient(1.4px 1.4px at 18% 22%, rgba(255,255,255,0.55) 50%, transparent 51%)," +
              "radial-gradient(1.2px 1.2px at 71% 14%, rgba(255,255,255,0.40) 50%, transparent 51%)," +
              "radial-gradient(1.6px 1.6px at 86% 62%, rgba(255,255,255,0.35) 50%, transparent 51%)," +
              "radial-gradient(1.2px 1.2px at 32% 78%, rgba(255,255,255,0.30) 50%, transparent 51%)," +
              "radial-gradient(1.3px 1.3px at 58% 88%, rgba(255,255,255,0.28) 50%, transparent 51%)," +
              "radial-gradient(1.1px 1.1px at 9% 58%, rgba(255,255,255,0.30) 50%, transparent 51%)",
          }}
        />
      </div>

      <div className="relative flex min-h-[100dvh] flex-col px-5 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between">
          <Wordmark />
          <nav className="hidden items-center gap-2.5 text-[13px] text-[#8fb4ee] sm:flex">
            {["Work", "Teams", "Delivery", "Together"].map((item, index) => (
              <span key={item} className="flex items-center gap-2.5">
                {index > 0 ? <span className="text-[#3f5f92]">&bull;</span> : null}
                {item}
              </span>
            ))}
          </nav>
        </header>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full min-w-0 max-w-[1080px]">
            <div className="overflow-hidden rounded-[26px] border border-[#2f6bff]/20 bg-[#060e1c]/70 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] backdrop-blur-[2px]">
              <div className="grid min-w-0 lg:grid-cols-2">
                {/* Pitch panel. Hidden on a phone rather than stacked, so the
                    password field is reachable without scrolling past it. */}
                <section className="relative hidden min-w-0 flex-col justify-between overflow-hidden border-r border-[#2f6bff]/15 p-10 lg:flex xl:p-12">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-70"
                    style={{
                      backgroundImage:
                        "radial-gradient(circle at 1px 1px, rgba(120,160,255,0.16) 1px, transparent 0)",
                      backgroundSize: "20px 20px",
                      maskImage: "radial-gradient(70% 60% at 45% 30%, #000 0%, transparent 100%)",
                      WebkitMaskImage:
                        "radial-gradient(70% 60% at 45% 30%, #000 0%, transparent 100%)",
                    }}
                  />

                  <div className="relative">
                    <Wordmark size="lg" />
                    <h1 className="mt-8 text-[46px] font-bold leading-[1.06] tracking-tight xl:text-[52px]">
                      <span className="block text-white">Command</span>
                      <span className="block text-[#3b82f6]">Center</span>
                    </h1>
                    <p className="mt-5 max-w-[24rem] text-[15px] leading-[1.65] text-[#9fb3ce]">
                      Leads, clients, tasks and delivery in one place - built for clarity, speed and
                      everyday execution.
                    </p>

                    <ul className="mt-8 space-y-3">
                      {FEATURES.map(({ icon: Icon, title, detail }, index) => (
                        <li
                          key={title}
                          className="flex items-center gap-4 rounded-xl border border-[#1b3157] bg-[#08121f]/80 p-3.5"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#2f6bff]/35 bg-[#0d1e38] text-[13px] font-semibold text-[#5b9bff]">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <Icon
                            className="h-5 w-5 shrink-0 text-[#93b6e8]"
                            strokeWidth={1.7}
                            aria-hidden="true"
                          />
                          <span className="min-w-0">
                            <span className="block text-[14px] font-semibold text-white">
                              {title}
                            </span>
                            <span className="mt-0.5 block text-[12.5px] text-[#8399b7]">
                              {detail}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="relative mt-10 flex items-center gap-4">
                    <p className="text-[10px] font-medium uppercase leading-[1.7] tracking-[0.22em] text-[#42618f]">
                      Built for
                      <br />
                      What moves you forward.
                    </p>
                    <span className="h-px w-16 bg-gradient-to-r from-[#2f6bff]/60 to-transparent" />
                  </div>
                </section>

                <div className="flex min-w-0 items-center justify-center p-6 sm:p-10 xl:p-12">
                  <div className="w-full min-w-0 max-w-[400px]">
                    {/* Phone-only mark, since the pitch panel is hidden there. */}
                    <span className="mb-8 block lg:hidden">
                      <Wordmark />
                    </span>
                    {children}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="flex flex-col gap-2 text-[12px] text-[#5d7398] sm:flex-row sm:items-end sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Vega. All rights reserved.</p>
          <p className="leading-[1.6] sm:text-right">
            Smarter operations.
            <br />
            Brighter outcomes.
          </p>
        </footer>
      </div>
    </div>
  );
}
