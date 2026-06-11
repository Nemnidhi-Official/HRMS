import { model, models, Schema, type InferSchemaType } from "mongoose";

const breakSessionSchema = new Schema(
  {
    startAt: {
      type: Date,
      required: true,
    },
    endAt: {
      type: Date,
      default: null,
    },
    minutes: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { _id: false },
);

const attendanceSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    dateKey: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },
    dayStatus: {
      type: String,
      enum: ["present", "absent", "half_day", "late_coming"],
      default: "present",
      required: true,
      index: true,
    },
    checkInAt: {
      type: Date,
      default: null,
    },
    checkOutAt: {
      type: Date,
      default: null,
    },
    workedMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalBreakMinutes: {
      type: Number,
      min: 0,
      default: 0,
    },
    breakSessions: {
      type: [breakSessionSchema],
      default: [],
    },
    markedByAdminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    markedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

attendanceSchema.index({ userId: 1, dateKey: 1 }, { unique: true });
attendanceSchema.index({ dateKey: -1, userId: 1 });

export type AttendanceDocument = InferSchemaType<typeof attendanceSchema>;

const existingAttendanceModel = models.Attendance;
const existingDayStatusEnum = existingAttendanceModel?.schema.path("dayStatus")?.options?.enum;

// In dev HMR, an older cached model can keep the previous dayStatus enum.
if (
  existingAttendanceModel &&
  Array.isArray(existingDayStatusEnum) &&
  !existingDayStatusEnum.includes("late_coming")
) {
  delete models.Attendance;
}

export const AttendanceModel = models.Attendance || model("Attendance", attendanceSchema);
