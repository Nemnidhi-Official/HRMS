import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import {
  AttendanceModel,
  LeadFollowUpModel,
  LeadModel,
  MeetingModel,
  SalesTargetModel,
  TaskModel,
} from "@/models";
import { closedDealProgress } from "@/lib/sales-targets/progress";
import { getAttendanceMonthKey } from "@/lib/attendance/date";
import { isClosedStatus, normalizeTaskStatus } from "@/lib/tasks/status";
import type { UserRole } from "@/types/user";

/**
 * Role dashboards.
 *
 * The one dashboard that existed answered a business-owner's questions - leads
 * this month, client growth, pipeline by source - and everyone who was not an
 * owner got either that or, for developers, a redirect to the task list. This
 * builds the figures each role actually opens the app to check, so the page can
 * show a developer their own workload rather than the company's revenue.
 */

export type RoleMetric = {
  key: string;
  label: string;
  value: string;
  hint?: string;
  tone: "blue" | "green" | "amber" | "violet" | "red" | "cyan";
};

export type RoleListItem = {
  id: string;
  title: string;
  detail: string;
  meta?: string;
  href: string;
  tone?: "default" | "danger" | "warning";
};

export type RoleProgress = {
  label: string;
  achieved: number;
  target: number;
  display: string;
};

export type RoleDashboard = {
  headline: string;
  metrics: RoleMetric[];
  progress: RoleProgress[];
  lists: Array<{ title: string; emptyText: string; href: string; items: RoleListItem[] }>;
};

const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

function hoursAndMinutes(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  return `${Math.floor(safe / 60)}h ${String(safe % 60).padStart(2, "0")}m`;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

/** Open tasks assigned to someone, split into the three states that matter. */
async function taskLoad(userId: string) {
  const open = await TaskModel.find({
    assignedToUserId: userId,
    archivedAt: null,
  })
    .select("title code status dueAt priority parentTaskId")
    .sort({ dueAt: 1 })
    .limit(200)
    .lean();

  const live = open.filter((task) => !isClosedStatus(normalizeTaskStatus(task.status as string)));
  const now = new Date();
  const todayEnd = endOfToday();

  return {
    open: live,
    overdue: live.filter((task) => task.dueAt && new Date(task.dueAt) < now),
    dueToday: live.filter(
      (task) => task.dueAt && new Date(task.dueAt) >= startOfToday() && new Date(task.dueAt) <= todayEnd,
    ),
  };
}

function taskItems(
  tasks: Array<{ _id: unknown; title: string; code?: string | null; dueAt?: Date | null; parentTaskId?: unknown }>,
  tone: RoleListItem["tone"] = "default",
): RoleListItem[] {
  return tasks.slice(0, 5).map((task) => ({
    id: String(task._id),
    title: task.title,
    detail: task.code ?? "",
    meta: task.dueAt ? new Date(task.dueAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "",
    // A subtask has no page of its own; its parent is where it is worked on.
    href: `/tasks/${String(task.parentTaskId ?? task._id)}`,
    tone,
  }));
}

async function myAttendanceThisMonth(userId: string) {
  const monthKey = getAttendanceMonthKey();
  const rows = await AttendanceModel.find({
    userId,
    dateKey: { $regex: `^${monthKey}` },
  })
    .select("dayStatus workedMinutes")
    .lean();

  return {
    present: rows.filter((row) => row.dayStatus !== "absent").length,
    lateComing: rows.filter((row) => row.dayStatus === "late_coming").length,
    workedMinutes: rows.reduce((total, row) => total + (row.workedMinutes ?? 0), 0),
  };
}

async function myUpcomingMeetings(userId: string) {
  // A meeting is booked against a contact and picked up by a staff member later,
  // so "mine" means assigned to me - there is no attendee list on the model.
  const meetings = await MeetingModel.find({
    status: "confirmed",
    startAt: { $gte: new Date() },
    assignedToUserId: userId,
  })
    .select("contactName startAt type location")
    .sort({ startAt: 1 })
    .limit(5)
    .lean();

  return meetings.map((meeting) => ({
    id: String(meeting._id),
    title: (meeting.contactName as string) ?? "Meeting",
    detail: meeting.type === "online" ? "Online" : ((meeting.location as string) ?? "In person"),
    meta: new Date(meeting.startAt as Date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
    href: "/meetings",
  }));
}

/** A salesperson opens this to see their book, their number, and who to call. */
async function salesDashboard(userId: string): Promise<RoleDashboard> {
  const monthKey = getAttendanceMonthKey();
  const owner = new Types.ObjectId(userId);

  const [openLeads, wonThisMonth, followUps, targets, progress, meetings, tasks] = await Promise.all([
    LeadModel.countDocuments({
      ownerId: owner,
      status: { $nin: ["closed_won", "closed_lost", "invalid", "wrong_number"] },
    }),
    LeadModel.countDocuments({
      "closure.salespersonId": owner,
      status: "closed_won",
      "closure.closedAt": { $gte: new Date(`${monthKey}-01T00:00:00`) },
    }),
    LeadFollowUpModel.find({ assignedToUserId: owner, status: "scheduled", dueAt: { $lte: endOfToday() } })
      .select("leadId nextAction dueAt")
      .sort({ dueAt: 1 })
      .limit(5)
      .lean(),
    SalesTargetModel.find({ assignedUserId: owner, period: "monthly", periodKey: monthKey })
      .select("metric target")
      .lean(),
    closedDealProgress([userId]),
    myUpcomingMeetings(userId),
    taskLoad(userId),
  ]);

  const achieved = progress.get(`${userId}:${monthKey}`) ?? { revenue: 0, deals: 0 };
  const followUpLeads = await LeadModel.find({ _id: { $in: followUps.map((item) => item.leadId) } })
    .select("title")
    .lean();
  const leadTitles = new Map(followUpLeads.map((lead) => [String(lead._id), lead.title as string]));

  return {
    headline: "Your pipeline today",
    metrics: [
      { key: "open", label: "Open leads", value: String(openLeads), tone: "blue" },
      { key: "won", label: "Closed this month", value: String(wonThisMonth), tone: "green" },
      {
        key: "revenue",
        label: "Revenue this month",
        value: `₹${INR.format(achieved.revenue)}`,
        tone: "violet",
      },
      {
        key: "followups",
        label: "Follow-ups due",
        value: String(followUps.length),
        hint: followUps.length > 0 ? "Includes anything overdue" : undefined,
        tone: followUps.length > 0 ? "amber" : "cyan",
      },
    ],
    progress: targets.map((target) => {
      const isRevenue = target.metric === "revenue";
      const value = isRevenue ? achieved.revenue : achieved.deals;
      return {
        label: isRevenue ? "Monthly revenue target" : "Monthly deals target",
        achieved: value,
        target: target.target as number,
        display: isRevenue
          ? `₹${INR.format(value)} of ₹${INR.format(target.target as number)}`
          : `${value} of ${target.target} deals`,
      };
    }),
    lists: [
      {
        title: "Follow-ups due",
        emptyText: "Nothing to chase right now.",
        href: "/follow-ups",
        items: followUps.map((item) => ({
          id: String(item._id),
          title: leadTitles.get(String(item.leadId)) ?? "Lead",
          detail: item.nextAction as string,
          meta: item.dueAt ? new Date(item.dueAt as Date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "",
          href: `/leads/${item.leadId}`,
          tone: "warning" as const,
        })),
      },
      { title: "Upcoming meetings", emptyText: "No meetings scheduled.", href: "/meetings", items: meetings },
      {
        title: "Your tasks",
        emptyText: "Nothing assigned to you.",
        href: "/tasks",
        items: taskItems(tasks.dueToday.length > 0 ? tasks.dueToday : tasks.open),
      },
    ],
  };
}

/** A developer opens this to see what is on them today, and their own attendance. */
async function developerDashboard(userId: string): Promise<RoleDashboard> {
  const [tasks, attendance] = await Promise.all([taskLoad(userId), myAttendanceThisMonth(userId)]);

  return {
    headline: "Your work today",
    metrics: [
      { key: "open", label: "Open tasks", value: String(tasks.open.length), tone: "blue" },
      { key: "today", label: "Due today", value: String(tasks.dueToday.length), tone: "amber" },
      {
        key: "overdue",
        label: "Overdue",
        value: String(tasks.overdue.length),
        tone: tasks.overdue.length > 0 ? "red" : "green",
      },
      {
        key: "worked",
        label: "Worked this month",
        value: hoursAndMinutes(attendance.workedMinutes),
        hint: `${attendance.present} days present`,
        tone: "violet",
      },
    ],
    progress: [],
    lists: [
      {
        title: "Overdue",
        emptyText: "Nothing overdue.",
        href: "/tasks",
        items: taskItems(tasks.overdue, "danger"),
      },
      { title: "Due today", emptyText: "Nothing due today.", href: "/tasks", items: taskItems(tasks.dueToday) },
      { title: "Everything assigned", emptyText: "Nothing assigned to you.", href: "/tasks", items: taskItems(tasks.open) },
    ],
  };
}

/** A project manager watches delivery across the team, not just their own queue. */
async function projectManagerDashboard(userId: string): Promise<RoleDashboard> {
  const now = new Date();
  const [allOpen, overdue, unassigned, meetings, mine] = await Promise.all([
    TaskModel.countDocuments({ archivedAt: null, status: { $nin: ["COMPLETED", "CANCELLED"] } }),
    TaskModel.find({ archivedAt: null, status: { $nin: ["COMPLETED", "CANCELLED"] }, dueAt: { $lt: now } })
      .select("title code dueAt parentTaskId")
      .sort({ dueAt: 1 })
      .limit(5)
      .lean(),
    TaskModel.countDocuments({ archivedAt: null, assignedToUserId: null, status: { $nin: ["COMPLETED", "CANCELLED"] } }),
    myUpcomingMeetings(userId),
    taskLoad(userId),
  ]);

  const overdueCount = await TaskModel.countDocuments({
    archivedAt: null,
    status: { $nin: ["COMPLETED", "CANCELLED"] },
    dueAt: { $lt: now },
  });

  return {
    headline: "Delivery at a glance",
    metrics: [
      { key: "open", label: "Open tasks", value: String(allOpen), tone: "blue" },
      { key: "overdue", label: "Overdue", value: String(overdueCount), tone: overdueCount > 0 ? "red" : "green" },
      { key: "unassigned", label: "Unassigned", value: String(unassigned), tone: unassigned > 0 ? "amber" : "cyan" },
      { key: "mine", label: "Assigned to you", value: String(mine.open.length), tone: "violet" },
    ],
    progress: [],
    lists: [
      { title: "Overdue across the team", emptyText: "Nothing overdue.", href: "/tasks", items: taskItems(overdue, "danger") },
      { title: "Upcoming meetings", emptyText: "No meetings scheduled.", href: "/meetings", items: meetings },
      { title: "Your tasks", emptyText: "Nothing assigned to you.", href: "/tasks", items: taskItems(mine.open) },
    ],
  };
}

/** Marketing cares where leads come from and how many are arriving. */
async function marketingDashboard(userId: string): Promise<RoleDashboard> {
  const monthKey = getAttendanceMonthKey();
  const monthStart = new Date(`${monthKey}-01T00:00:00`);

  const [thisMonth, untouched, sources, tasks] = await Promise.all([
    LeadModel.countDocuments({ createdAt: { $gte: monthStart } }),
    // Not "unassigned": the Lead pre-save hook round-robins an owner onto every
    // new lead, so that count is always zero and tells nobody anything. What
    // marketing can actually act on is inbound that nobody has spoken to yet.
    LeadModel.countDocuments({ status: "new" }),
    LeadModel.aggregate<{ _id: string | null; count: number }>([
      { $match: { createdAt: { $gte: monthStart } } },
      { $group: { _id: "$source", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    taskLoad(userId),
  ]);

  const topSource = sources[0];

  return {
    headline: "Lead flow this month",
    metrics: [
      { key: "new", label: "New leads", value: String(thisMonth), tone: "blue" },
      {
        key: "top",
        label: "Top source",
        value: topSource?._id ? String(topSource._id).replaceAll("_", " ") : "--",
        hint: topSource ? `${topSource.count} leads` : undefined,
        tone: "violet",
      },
      {
        key: "untouched",
        label: "Awaiting first contact",
        value: String(untouched),
        tone: untouched > 0 ? "amber" : "green",
      },
      { key: "tasks", label: "Your open tasks", value: String(tasks.open.length), tone: "cyan" },
    ],
    progress: sources.map((source) => ({
      label: source._id ? String(source._id).replaceAll("_", " ") : "unknown",
      achieved: source.count,
      target: thisMonth || 1,
      display: `${source.count} of ${thisMonth}`,
    })),
    lists: [
      { title: "Your tasks", emptyText: "Nothing assigned to you.", href: "/tasks", items: taskItems(tasks.open) },
    ],
  };
}

/**
 * Which dashboard a role gets. Admin and partner keep the full business
 * overview, which is a different page entirely; everyone else gets figures
 * scoped to what they do.
 */
export function usesBusinessOverview(role: UserRole) {
  return role === "admin" || role === "partner";
}

export async function getRoleDashboard(role: UserRole, userId: string): Promise<RoleDashboard> {
  await connectToDatabase();

  if (role === "sales") return salesDashboard(userId);
  if (role === "project_manager") return projectManagerDashboard(userId);
  if (role === "digital_marketing") return marketingDashboard(userId);
  return developerDashboard(userId);
}
