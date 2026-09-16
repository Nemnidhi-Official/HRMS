"use client";

import { type ComponentType, useEffect, useMemo, useState } from "react";
import {
  AlarmClock,
  CalendarDays,
  CalendarX,
  Check,
  Clock,
  Coffee,
  Contrast,
  FileText,
  LogIn,
  LogOut,
  Play,
  RefreshCw,
  Square,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import type {
  AttendancePayload,
  AttendanceRecord,
  BreakSessionRecord,
} from "@/lib/attendance/queries";

type ApiResponse = {
  success: boolean;
  data?: unknown;
  error?: {
    message?: string;
  };
};

type Notice = {
  tone: "success" | "error";
  text: string;
};

type AttendanceLocationPayload = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

function formatDateFromKey(dateKey?: string) {
  if (!dateKey) {
    return "--";
  }
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatFullDate(dateKey?: string) {
  const date = dateKey ? new Date(`${dateKey}T00:00:00`) : new Date();
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value?: string | null) {
  if (!value) {
    return "--";
  }
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMinutesAsHours(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "0h 00m";
  }
  const wholeHours = Math.floor(minutes / 60);
  const remainderMinutes = minutes % 60;
  return `${wholeHours}h ${String(remainderMinutes).padStart(2, "0")}m`;
}

function calculateMinutesBetween(startAt: Date, endAt: Date) {
  const minutes = Math.floor((endAt.getTime() - startAt.getTime()) / 60000);
  return Math.max(0, minutes);
}

function calculateActiveBreakMinutes(
  breakSessions: BreakSessionRecord[],
  now: Date,
) {
  return breakSessions.reduce((total, session) => {
    if (!session.startAt || session.endAt) {
      return total;
    }

    return total + calculateMinutesBetween(new Date(session.startAt), now);
  }, 0);
}

function getLiveWorkedMinutes(
  entry: AttendanceRecord | null,
  breakSessions: BreakSessionRecord[],
  now: Date,
) {
  if (!entry?.checkInAt) {
    return entry?.workedMinutes ?? 0;
  }

  if (entry.checkOutAt) {
    return entry.workedMinutes ?? 0;
  }

  const elapsedMinutes = calculateMinutesBetween(new Date(entry.checkInAt), now);
  const completedBreakMinutes = entry.totalBreakMinutes ?? 0;
  const activeBreakMinutes = calculateActiveBreakMinutes(breakSessions, now);
  return Math.max(0, elapsedMinutes - completedBreakMinutes - activeBreakMinutes);
}

function statusFromEntry(entry: AttendanceRecord | null) {
  if (!entry) {
    return { label: "Not Marked", variant: "warning" as const };
  }
  if (entry.dayStatus === "absent") {
    return { label: "Absent", variant: "danger" as const };
  }
  if (entry.dayStatus === "half_day") {
    return { label: "Half Day", variant: "warning" as const };
  }
  if (entry.dayStatus === "late_coming") {
    return { label: "Late Coming", variant: "warning" as const };
  }
  if (entry.checkOutAt) {
    return { label: "Checked Out", variant: "success" as const };
  }
  return { label: "Checked In", variant: "accent" as const };
}

function getActiveBreak(breakSessions: BreakSessionRecord[]) {
  return breakSessions.find((entry) => !entry.endAt) ?? null;
}

function getCurrentAttendanceLocation() {
  return new Promise<AttendanceLocationPayload>((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Location access is not available in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      () => {
        reject(new Error("Please allow location access to mark attendance."));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      },
    );
  });
}

interface AttendanceTrackerProps {
  initialData: AttendancePayload;
}

export function AttendanceTracker({ initialData }: AttendanceTrackerProps) {
  const [data, setData] = useState(initialData);
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function loadAttendance() {
    try {
      const response = await fetch("/api/attendance", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error?.message ?? "Unable to load attendance.");
      }

      setNow(new Date());
      setData(payload.data as AttendancePayload);
    } catch (error) {
      throw error instanceof Error ? error : new Error("Unable to load attendance.");
    }
  }

  async function refreshAttendance() {
    setLoading(true);
    setNotice(null);
    try {
      await loadAttendance();
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to refresh attendance data.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function runAction(
    actionKey: string,
    path: string,
    method: "POST" | "PATCH",
    successText: string,
    options?: { requiresLocation?: boolean },
  ) {
    setActionLoading(actionKey);
    setNotice(null);

    try {
      const location = options?.requiresLocation ? await getCurrentAttendanceLocation() : null;
      const response = await fetch(path, {
        method,
        headers: location ? { "Content-Type": "application/json" } : undefined,
        body: location ? JSON.stringify(location) : undefined,
      });
      const payload = (await response.json()) as ApiResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? "Unable to complete this action.");
      }

      await loadAttendance();
      setNotice({ tone: "success", text: successText });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to complete this action.",
      });
    } finally {
      setActionLoading(null);
    }
  }

  function confirmBeforeCheckout() {
    if (typeof window !== "undefined") {
      const shouldContinue = window.confirm(
        "Are you sure you want to check out for today?",
      );
      if (!shouldContinue) {
        return;
      }
    }

    void runAction(
      "check-out",
      "/api/attendance/checkout",
      "PATCH",
      "Check-out marked successfully.",
    );
  }

  const todayEntry = data.todayEntry;
  const monthSummary = data.monthSummary;
  const todayBreakSessions = todayEntry?.breakSessions ?? [];
  const activeBreak = getActiveBreak(todayBreakSessions);
  const liveTodayWorkedMinutes = getLiveWorkedMinutes(todayEntry, todayBreakSessions, now);
  const liveMonthWorkedMinutes = useMemo(() => {
    const storedTodayMinutes = todayEntry?.workedMinutes ?? 0;
    return monthSummary.workedMinutes - storedTodayMinutes + liveTodayWorkedMinutes;
  }, [liveTodayWorkedMinutes, monthSummary.workedMinutes, todayEntry?.workedMinutes]);
  const attendanceStatus = statusFromEntry(todayEntry);
  const canCheckIn = !todayEntry;
  const canCheckOut = Boolean(todayEntry?.checkInAt && !todayEntry?.checkOutAt && !activeBreak);
  const canStartBreak = Boolean(todayEntry?.checkInAt && !todayEntry?.checkOutAt && !activeBreak);
  const canEndBreak = Boolean(todayEntry?.checkInAt && !todayEntry?.checkOutAt && activeBreak);

  useEffect(() => {
    if (!todayEntry?.checkInAt || todayEntry.checkOutAt) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 30000);

    return () => window.clearInterval(timer);
  }, [todayEntry?.checkInAt, todayEntry?.checkOutAt]);

  return (
    <section className="space-y-3.5">
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          icon={CalendarDays}
          tone="blue"
          label="Present Days"
          period="(Month)"
          value={String(monthSummary.presentDays)}
        />
        <StatTile
          icon={Clock}
          tone="green"
          label="Worked Time"
          period="(Month)"
          value={formatMinutesAsHours(liveMonthWorkedMinutes)}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatTile
          icon={Check}
          tone="violet"
          label="Completed Days"
          period="(Month)"
          value={String(monthSummary.completedDays)}
        />
        <StatTile
          icon={Contrast}
          tone="amber"
          label="Half Days"
          period="(Month)"
          value={String(monthSummary.halfDays)}
        />
        <StatTile
          icon={Coffee}
          tone="pink"
          label="Break Time"
          period="(Month)"
          value={formatMinutesAsHours(monthSummary.breakMinutes)}
        />
      </div>

      {/* Late coming and absent are not in the mock, but they drive salary
          deductions - hiding them would hide why someone was paid less. */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          icon={AlarmClock}
          tone="orange"
          label="Late Coming"
          period="(Month)"
          value={String(monthSummary.lateComingDays)}
        />
        <StatTile
          icon={CalendarX}
          tone="red"
          label="Absent Days"
          period="(Month)"
          value={String(monthSummary.absentDays)}
        />
      </div>

      <div className="rounded-2xl border border-vega-border bg-vega-surface-1 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-vega-accent-border bg-vega-accent-soft text-[#93c5fd]">
              <CalendarDays className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden={true} />
            </span>
            <h2 className="truncate text-[17px] font-semibold text-vega-text">
              Today&apos;s Attendance
            </h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-lg border border-vega-border bg-vega-surface-2 px-3 py-2 text-[12.5px] text-vega-text-secondary">
            <CalendarDays className="h-4 w-4 shrink-0 text-vega-text-muted" strokeWidth={1.8} aria-hidden={true} />
            {formatFullDate(todayEntry?.dateKey)}
          </span>
        </div>

        <p className="mt-3 text-[13px] text-vega-text-muted">
          Mark check-in and check-out once per day.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Badge variant={attendanceStatus.variant}>{attendanceStatus.label}</Badge>
          <span className="text-[12.5px] text-vega-text-muted">
            Admin is excluded from this flow.
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat icon={LogIn} tone="green" label="Check-In" value={formatTime(todayEntry?.checkInAt)} />
          <MiniStat icon={LogOut} tone="red" label="Check-Out" value={formatTime(todayEntry?.checkOutAt)} />
          <MiniStat icon={Clock} tone="blue" label="Worked Time" value={formatMinutesAsHours(liveTodayWorkedMinutes)} />
          <MiniStat icon={Coffee} tone="violet" label="Break Time" value={formatMinutesAsHours(todayEntry?.totalBreakMinutes ?? 0)} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-vega-border-soft pt-4 min-[420px]:grid-cols-3">
          <ActionButton
            icon={Play}
            primary
            label={actionLoading === "check-in" ? "Checking In..." : "Check In"}
            onClick={() =>
              runAction("check-in", "/api/attendance", "POST", "Check-in marked successfully.", {
                requiresLocation: true,
              })
            }
            disabled={loading || actionLoading !== null || !canCheckIn}
          />
          <ActionButton
            icon={LogOut}
            label={actionLoading === "check-out" ? "Checking Out..." : "Check Out"}
            onClick={confirmBeforeCheckout}
            disabled={loading || actionLoading !== null || !canCheckOut}
          />
          <ActionButton
            icon={Coffee}
            label={actionLoading === "break-start" ? "Starting Break..." : "Start Break"}
            onClick={() => runAction("break-start", "/api/attendance/break/start", "PATCH", "Break started.")}
            disabled={loading || actionLoading !== null || !canStartBreak}
          />
          <ActionButton
            icon={Square}
            label={actionLoading === "break-end" ? "Ending Break..." : "End Break"}
            onClick={() => runAction("break-end", "/api/attendance/break/end", "PATCH", "Break ended.")}
            disabled={loading || actionLoading !== null || !canEndBreak}
          />
          <ActionButton
            icon={RefreshCw}
            label={loading ? "Refreshing..." : "Refresh"}
            onClick={() => void refreshAttendance()}
            disabled={loading || actionLoading !== null}
          />
        </div>

        {activeBreak ? (
          <p className="mt-3 rounded-lg border border-vega-yellow/35 bg-vega-yellow/10 px-3 py-2.5 text-[13px] text-vega-yellow">
            Break in progress since {formatTime(activeBreak.startAt)}.
          </p>
        ) : null}

        {notice ? (
          <p
            role="alert"
            className={
              notice.tone === "error"
                ? "mt-3 rounded-lg border border-vega-red/35 bg-vega-red/10 px-3 py-2.5 text-[13px] text-vega-red"
                : "mt-3 rounded-lg border border-vega-green/35 bg-vega-green/10 px-3 py-2.5 text-[13px] text-[#66dc91]"
            }
          >
            {notice.text}
          </p>
        ) : null}

        {todayBreakSessions.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-vega-border text-left text-vega-text-muted">
                  <th className="px-2 py-2 font-medium">Break Start</th>
                  <th className="px-2 py-2 font-medium">Break End</th>
                  <th className="px-2 py-2 font-medium">Duration</th>
                </tr>
              </thead>
              <tbody>
                {todayBreakSessions.map((session, index) => (
                  <tr key={`${session.startAt ?? "start"}-${index}`} className="border-b border-vega-border-soft">
                    <td className="px-2 py-2 text-vega-text">{formatTime(session.startAt)}</td>
                    <td className="px-2 py-2 text-vega-text-muted">
                      {session.endAt ? formatTime(session.endAt) : "In Progress"}
                    </td>
                    <td className="px-2 py-2 text-vega-text-muted">
                      {formatMinutesAsHours(session.minutes ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-vega-border bg-vega-surface-1 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-vega-accent-border bg-vega-accent-soft text-[#93c5fd]">
              <FileText className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden={true} />
            </span>
            <h2 className="truncate text-[17px] font-semibold text-vega-text">Recent Attendance</h2>
          </div>
          <p className="text-[12.5px] text-vega-text-muted">
            Last 21 entries from your attendance log.
          </p>
        </div>

        {data.recentEntries.length === 0 ? (
          <p className="mt-4 text-[13px] text-vega-text-muted">No attendance records yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-vega-border text-left text-vega-text-muted">
                  <th className="px-1.5 py-2.5 font-medium">Date</th>
                  <th className="px-1.5 py-2.5 font-medium">Check-in</th>
                  <th className="px-1.5 py-2.5 font-medium">Check-out</th>
                  <th className="px-1.5 py-2.5 font-medium">Worked Time</th>
                  <th className="px-1.5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentEntries.map((entry) => {
                  const status = statusFromEntry(entry);
                  return (
                    <tr key={entry._id} className="border-b border-vega-border-soft">
                      <td className="px-1.5 py-3 text-vega-text">{formatDateFromKey(entry.dateKey)}</td>
                      <td className="px-1.5 py-3 text-vega-text-muted">
                        {formatTime(entry.checkInAt)}
                      </td>
                      <td className="px-1.5 py-3 text-vega-text-muted">
                        {formatTime(entry.checkOutAt)}
                      </td>
                      <td className="px-1.5 py-3 text-vega-text-muted">
                        {formatMinutesAsHours(
                          entry._id === todayEntry?._id
                            ? liveTodayWorkedMinutes
                            : entry.workedMinutes ?? 0,
                        )}
                      </td>
                      <td className="px-1.5 py-3">
                        <Badge variant={status.variant} className="whitespace-nowrap">
                          {status.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

const TONES = {
  blue: "border-[#2f6bff]/35 bg-[#12213c] text-[#6da2ff]",
  green: "border-[#22c55e]/30 bg-[#0f2418] text-[#5fd88c]",
  violet: "border-[#8b5cf6]/30 bg-[#1c1733] text-[#a98bff]",
  amber: "border-[#eab308]/30 bg-[#2a2210] text-[#e6bb3f]",
  pink: "border-[#ec4899]/30 bg-[#2a1322] text-[#f07cb5]",
  orange: "border-[#f97316]/30 bg-[#2b1a0e] text-[#f59e5c]",
  red: "border-[#ef4444]/30 bg-[#2b1416] text-[#f47171]",
} as const;

type Tone = keyof typeof TONES;
type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

/** A month figure: coloured icon tile, two-line label, then the number. */
function StatTile({
  icon: Icon,
  tone,
  label,
  period,
  value,
}: {
  icon: IconType;
  tone: Tone;
  label: string;
  period: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-vega-border bg-vega-surface-1 p-3.5">
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl border", TONES[tone])}>
        <Icon className="h-[19px] w-[19px]" strokeWidth={1.9} />
      </span>
      <p className="mt-3 text-[13px] font-semibold leading-tight text-vega-text">{label}</p>
      <p className="text-[12px] leading-tight text-vega-text-muted">{period}</p>
      <p className="mt-2 truncate text-[22px] font-bold leading-none text-vega-text">{value}</p>
    </div>
  );
}

/** Today's four figures - icon and label on one line, value beneath. */
function MiniStat({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: IconType;
  tone: Tone;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-vega-border bg-vega-surface-2 p-3">
      <span className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4 shrink-0", TONE_TEXT[tone])} strokeWidth={1.9} />
        <span className="truncate text-[12px] text-vega-text-muted">{label}</span>
      </span>
      <p className="mt-1.5 truncate text-[15px] font-semibold text-vega-text">{value}</p>
    </div>
  );
}

/** Just the foreground colour of each tone, for icons that sit on no tile. */
const TONE_TEXT: Record<Tone, string> = {
  blue: "text-[#6da2ff]",
  green: "text-[#5fd88c]",
  violet: "text-[#a98bff]",
  amber: "text-[#e6bb3f]",
  pink: "text-[#f07cb5]",
  orange: "text-[#f59e5c]",
  red: "text-[#f47171]",
};

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  primary = false,
}: {
  icon: IconType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-[46px] items-center justify-center gap-1.5 rounded-xl px-2 text-[13px] font-medium transition-colors sm:gap-2 sm:px-3 sm:text-[14px]",
        primary
          ? "bg-vega-accent text-white hover:bg-vega-accent-hover"
          : "border border-vega-border bg-vega-surface-2 text-vega-text-secondary hover:bg-vega-surface-hover hover:text-vega-text",
        "disabled:cursor-not-allowed disabled:opacity-45",
      )}
    >
      <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.9} />
      <span className="truncate">{label}</span>
    </button>
  );
}
