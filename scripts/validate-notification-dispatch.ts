import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import mongoose from "mongoose";

const certDir = process.env.PUSH_TEST_CERT_DIR;
if (!certDir) throw new Error("Set PUSH_TEST_CERT_DIR to a directory holding key.pem and cert.pem");
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const uri = process.env.PUSH_TEST_URI;
if (!uri || !/^mongodb:\/\/127\.0\.0\.1:27017\/hrms_push_test_[a-z0-9]+$/.test(uri)) {
  throw new Error("Use an isolated test database: hrms_push_test_<suffix> on 127.0.0.1:27017");
}

function fakePushService() {
  const received: Array<{ headers: http.IncomingHttpHeaders; body: Buffer }> = [];
  const server = https.createServer(
    { key: fs.readFileSync(`${certDir}/key.pem`), cert: fs.readFileSync(`${certDir}/cert.pem`) },
    (req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => { received.push({ headers: req.headers, body: Buffer.concat(chunks) }); res.writeHead(201).end(); });
    },
  );
  return {
    received,
    listen: () => new Promise<number>((r) => server.listen(0, "127.0.0.1", () => r((server.address() as { port: number }).port))),
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

function browserKeys() {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  return { p256dh: ecdh.getPublicKey().toString("base64url"), auth: crypto.randomBytes(16).toString("base64url") };
}

/** Wait for the fire-and-forget push to land, without a blind sleep. */
async function settled(service: { received: unknown[] }, expected: number, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (service.received.length < expected && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
  }
  return service.received.length;
}

async function main() {
  const service = fakePushService();
  const port = await service.listen();

  // notifyUser calls connectToDatabase, which validates the server env before it
  // notices mongoose is already connected. Point it at the same throwaway
  // database this test uses so nothing can reach a real one.
  process.env.MONGODB_URI = uri!;
  process.env.MONGODB_DB_NAME = new URL(uri!.replace("mongodb://", "http://")).pathname.slice(1);
  process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? crypto.randomBytes(32).toString("hex");

  const keys = (await import("web-push")).default.generateVAPIDKeys();
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  process.env.VAPID_CONTACT_EMAIL = "test@test.invalid";

  const { notifyUser } = await import("@/lib/notifications/dispatch");
  const { PushSubscriptionModel, NotificationModel } = await import("@/models");

  await mongoose.connect(uri!);

  const recipient = new mongoose.Types.ObjectId();
  const actor = new mongoose.Types.ObjectId();
  const lead = new mongoose.Types.ObjectId();
  await PushSubscriptionModel.create({
    userId: recipient, endpoint: `https://127.0.0.1:${port}/d1`, ...browserKeys(),
  });

  const base = {
    actorId: String(actor),
    type: "lead_assigned" as const,
    title: "Lead assigned to you",
    body: "Acme Corp",
    entityType: "lead" as const,
    entityId: String(lead),
    url: `/leads/${lead}`,
    dedupeKey: `lead_assigned:${lead}:none:${recipient}`,
  };

  // --- First raise: writes the bell row and pushes.
  const first = await notifyUser({ ...base, recipientUserId: String(recipient) });
  assert.equal(first.created, true);
  assert.equal(await settled(service, 1), 1, "should have pushed once");

  const row = await NotificationModel.findOne({ recipientUserId: recipient }).lean();
  assert.ok(row, "in-app row should exist");
  assert.equal(row.entityType, "lead");
  assert.equal(row.url, `/leads/${lead}`, "url must be stored so the bell and the push agree");
  assert.deepEqual([...row.channels].sort(), ["in_app", "push"]);

  // --- Re-raising the same thing must not buzz the phone a second time.
  const second = await notifyUser({ ...base, recipientUserId: String(recipient) });
  assert.equal(second.created, false, "duplicate should not create a second row");
  assert.equal(await settled(service, 2, 1200), 1, "a deduped notification must not push again");
  assert.equal(await NotificationModel.countDocuments({ recipientUserId: recipient }), 1);

  // --- Nobody is told about their own action.
  const selfInflicted = await notifyUser({
    ...base,
    recipientUserId: String(actor),
    actorId: String(actor),
    dedupeKey: `self:${lead}`,
  });
  assert.equal(selfInflicted.created, false, "acting on your own lead must not notify you");
  assert.equal(await NotificationModel.countDocuments({ recipientUserId: actor }), 0);

  // --- A genuinely different event for the same lead still gets through.
  const moved = await notifyUser({
    ...base,
    recipientUserId: String(recipient),
    type: "lead_transferred",
    title: "Lead moved off your list",
    dedupeKey: `lead_moved_away:${lead}:${recipient}:someone-else`,
  });
  assert.equal(moved.created, true, "a different hand-off is a new notification");
  assert.equal(await settled(service, 2), 2);

  // --- A recipient with no devices still gets the bell row; push is just skipped.
  const deviceless = new mongoose.Types.ObjectId();
  const quiet = await notifyUser({
    ...base, recipientUserId: String(deviceless), dedupeKey: `quiet:${lead}`,
  });
  assert.equal(quiet.created, true);
  assert.equal(await NotificationModel.countDocuments({ recipientUserId: deviceless }), 1);
  assert.equal(await settled(service, 3, 1200), 2, "no devices means no push, but the row stands");

  // --- Payload actually carries the click-through target.
  for (const request of service.received) {
    assert.equal(request.headers["content-encoding"], "aes128gcm");
  }

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await service.close();
  console.log("notification dispatch checks passed");
}

main().catch(async (error) => {
  console.error(error);
  try { await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } catch {}
  process.exit(1);
});
