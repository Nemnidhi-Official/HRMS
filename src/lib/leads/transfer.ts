import { LeadModel, UserModel } from "@/models";
import { ApiError } from "@/lib/api/responses";
import { assertRoleAccess } from "@/lib/auth/permissions";
import type { UserRole } from "@/types/user";

export async function changeLeadOwner(id: string, payload: { ownerId: string; expectedOwnerId: string | null }, actor: { userId: string; role: UserRole }) {
    assertRoleAccess(actor.role, { oneOf: ["admin", "sales"] });
    const recipient = await UserModel.exists({ _id: payload.ownerId, role: "sales", status: "active" });
    if (!recipient) throw new ApiError("Choose an active salesperson", 422);
    if (payload.ownerId === payload.expectedOwnerId) throw new ApiError("Lead is already assigned to this salesperson", 422);
    const lead = await LeadModel.findOneAndUpdate(
      { _id: id, ownerId: payload.expectedOwnerId },
      { $set: { ownerId: payload.ownerId }, $push: { assignmentHistory: {
        from: payload.expectedOwnerId, to: payload.ownerId, actorId: actor.userId,
        method: actor.role === "admin" ? "manual" : "transfer", at: new Date(),
      } } },
      { returnDocument: "after", runValidators: true },
    ).select("ownerId");
    if (!lead) {
      if (!await LeadModel.exists({ _id: id })) throw new ApiError("Lead not found", 404);
      throw new ApiError("Assignment changed. Refresh and try again.", 409);
    }
    return lead;
}
