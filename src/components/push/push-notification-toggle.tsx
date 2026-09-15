"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** VAPID keys travel as base64url; PushManager wants raw bytes. */
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

/**
 * Chrome stops showing the permission prompt for good once a user has dismissed
 * it a few times, and that state is not recoverable from inside the page. So the
 * automatic ask on app open is budgeted: after this many dismissals we stop
 * asking and leave the bell as the way in, which keeps the permission reachable.
 */
const AUTO_PROMPT_BUDGET = 2;
const AUTO_PROMPT_KEY = "hrms:push-auto-prompts";

function autoPromptsUsed() {
  try {
    return Number(window.localStorage.getItem(AUTO_PROMPT_KEY) ?? "0") || 0;
  } catch {
    // Private window or blocked storage: we cannot count, so do not auto-ask.
    return AUTO_PROMPT_BUDGET;
  }
}

function setAutoPromptsUsed(count: number) {
  try {
    window.localStorage.setItem(AUTO_PROMPT_KEY, String(count));
  } catch {
    // Nothing to do - the budget just will not persist.
  }
}

type State = "checking" | "unsupported" | "off" | "on" | "blocked";

export function PushNotificationToggle({ className }: { className?: string }) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) setState("unsupported");
        return;
      }

      try {
        // updateViaCache: "none" keeps a stale cached worker from surviving a deploy.
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        const existing = await registration.pushManager.getSubscription();
        if (cancelled) return;

        if (Notification.permission === "denied") {
          setState("blocked");
          return;
        }
        // A subscription can outlive the server row it was saved as (database
        // restored from backup, user re-registered elsewhere). Re-post it so the
        // two stay in step; it upserts.
        if (existing) {
          void fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(existing.toJSON()),
          });
        }
        setState(existing ? "on" : "off");
      } catch (e) {
        if (!cancelled) {
          setState("off");
          setError(e instanceof Error ? e.message : "Could not set up notifications.");
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async ({ auto = false } = {}) => {
    setBusy(true);
    setError("");
    try {
      // Safari and Firefox only honour this inside a user gesture, so the
      // automatic ask is best-effort there and the bell remains the real path.
      // Chrome shows it on load, which is what makes the auto-prompt work.
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setState("blocked");
        return;
      }
      if (permission !== "granted") return;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
        ),
      });

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        // Don't leave a live browser subscription pointing at a server that has
        // no row for it - it would push nothing and look silently broken.
        await subscription.unsubscribe();
        throw new Error(payload?.error?.message ?? "Could not save the subscription.");
      }

      setAutoPromptsUsed(0);
      setState("on");
    } catch (e) {
      // A refused auto-ask is an expected outcome, not something to shout about.
      if (!auto) setError(e instanceof Error ? e.message : "Could not enable notifications.");
    } finally {
      setBusy(false);
    }
  }, []);

  // Ask on first open instead of waiting for the bell to be noticed. Deliberately
  // after a short delay: a prompt thrown over a still-blank screen reads as spam
  // and gets dismissed, and every dismissal spends the budget above.
  useEffect(() => {
    if (state !== "off" || Notification.permission !== "default") return;

    const used = autoPromptsUsed();
    if (used >= AUTO_PROMPT_BUDGET) return;

    const timer = setTimeout(() => {
      setAutoPromptsUsed(used + 1);
      void enable({ auto: true });
    }, 1500);
    return () => clearTimeout(timer);
  }, [state, enable]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("off");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not turn notifications off.");
    } finally {
      setBusy(false);
    }
  }, []);

  if (state === "checking" || state === "unsupported") return null;

  const label =
    state === "blocked"
      ? "Notifications blocked - allow them in browser settings"
      : state === "on"
        ? "Chat notifications on - tap to turn off"
        : "Turn on chat notifications";

  const Icon = busy ? Loader2 : state === "on" ? BellRing : state === "blocked" ? BellOff : Bell;

  return (
    <button
      type="button"
      disabled={busy || state === "blocked"}
      onClick={() => void (state === "on" ? disable() : enable())}
      title={error || label}
      aria-label={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md transition",
        state === "on"
          ? "text-vega-accent hover:bg-vega-surface-hover"
          : "text-vega-text-secondary hover:bg-vega-surface-hover",
        state === "blocked" && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <Icon className={cn("h-5 w-5", busy && "animate-spin")} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}
