"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import { getHomeRouteForRole } from "@/lib/auth/constants";
import { cn } from "@/lib/utils/cn";

/**
 * The single sign-in form.
 *
 * There used to be one page per role plus a separate client login, with a
 * dropdown for picking your own role. That asked people a question only the
 * server can answer - the account already knows what it is - and a wrong guess
 * returned "invalid email or password", which reads as a lost password rather
 * than the wrong portal. One form, one endpoint, and the role decides where you
 * land.
 */
export function UniversalLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No role: the account's own role is the answer.
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Could not sign you in.");
      }

      router.push(getHomeRouteForRole(data?.data?.user?.role ?? ""));
      router.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Could not sign you in.");
      setLoading(false);
    }
    // Deliberately not clearing `loading` on success - the redirect is in flight
    // and re-enabling the button invites a second submit.
  }

  return (
    <form onSubmit={login} className="w-full">
      <h2 className="text-[22px] font-semibold leading-tight text-vega-text">Sign in</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-vega-text-muted">
        Use your work email. Your account decides what you see.
      </p>

      <div className="mt-6 space-y-3.5">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.07em] text-vega-text-muted">
            Email
          </span>
          <span className="relative block">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vega-text-dim"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              className={cn(
                "h-11 w-full rounded-lg border border-vega-border bg-[#0a131d] pl-10 pr-3 text-sm text-vega-text",
                "placeholder:text-vega-text-dim transition-colors",
                "focus:border-vega-accent focus:outline-none focus:ring-2 focus:ring-vega-accent/25",
              )}
            />
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.07em] text-vega-text-muted">
            Password
          </span>
          <span className="relative block">
            <LockKeyhole
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vega-text-dim"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              className={cn(
                "h-11 w-full rounded-lg border border-vega-border bg-[#0a131d] pl-10 pr-11 text-sm text-vega-text",
                "placeholder:text-vega-text-dim transition-colors",
                "focus:border-vega-accent focus:outline-none focus:ring-2 focus:ring-vega-accent/25",
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-vega-text-dim transition-colors hover:bg-vega-surface-hover hover:text-vega-text-secondary"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
              )}
            </button>
          </span>
        </label>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-vega-red/40 bg-vega-red-soft px-3 py-2.5 text-[13px] text-[#fca5a5]"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading || !email.trim() || password.length < 8}
        className={cn(
          "mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium text-white",
          "bg-vega-accent transition-all hover:bg-vega-accent-hover",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vega-accent/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d1620]",
          "disabled:cursor-not-allowed disabled:opacity-45",
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Signing in...
          </>
        ) : (
          "Sign in"
        )}
      </button>

      <p className="mt-5 text-center text-xs leading-relaxed text-vega-text-dim">
        Staff and client accounts both sign in here.
        <br />
        Trouble getting in? Ask your admin to check your account.
      </p>
    </form>
  );
}
