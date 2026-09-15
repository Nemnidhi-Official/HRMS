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

  const enable = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      // Must stay inside the click handler's task - Chrome ignores a permission
      // request that is not tied to a user gesture.
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

      setState("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not enable notifications.");
    } finally {
      setBusy(false);
    }
  }, []);

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
