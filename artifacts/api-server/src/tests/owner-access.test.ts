import test from "node:test";
import assert from "node:assert/strict";
import express, { type ErrorRequestHandler } from "express";
import { db, pool, schoolUsersTable, activityLogsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { claimOrBindAccount } from "../middlewares/schoolAuth";
import { isConfiguredOwnerEmail } from "../lib/owner-access";
import management from "../routes/management";
import { ApiProblem } from "../lib/school-core";

test("designated owners require a verified primary identity, bind atomically and cannot be demoted", async () => {
  const suffix = crypto.randomUUID();
  const email = `owner-${suffix}@example.invalid`;
  const userId = `synthetic-owner-${suffix}`;
  const oldEnv = process.env.SCHOOL_OWNER_EMAILS;
  const created: string[] = [];
  let server: ReturnType<express.Express["listen"]> | undefined;
  const identity = (id: string, address: string, status = "verified") => ({
    id, firstName: "مالك", lastName: "اختبار", primaryEmailAddressId: "primary",
    emailAddresses: [{ id: "primary", emailAddress: address, verification: { status } }],
  });
  try {
    // This env override lives only in this isolated test process, not the running app.
    process.env.SCHOOL_OWNER_EMAILS = ` ${email.toUpperCase()} `;
    assert.ok(isConfiguredOwnerEmail(email));
    assert.ok(!isConfiguredOwnerEmail(`prefix-${email}`));
    assert.ok(!isConfiguredOwnerEmail(`${email}.attacker.invalid`));
    const [admin] = await db.insert(schoolUsersTable).values({
      email: `admin-${suffix}@example.invalid`, fullName: "مدير اختبار",
      clerkUserId: `synthetic-admin-${suffix}`, role: "administrator", status: "active",
    }).returning();
    created.push(admin!.id);
    const forbidden = (error: unknown) => error instanceof ApiProblem && error.status === 403;
    await assert.rejects(claimOrBindAccount(userId, async () => identity(userId, email, "unverified")), forbidden);
    await assert.rejects(claimOrBindAccount(userId, async () => ({
      ...identity(userId, `other-${suffix}@example.invalid`),
      emailAddresses: [
        ...identity(userId, `other-${suffix}@example.invalid`).emailAddresses,
        { id: "secondary", emailAddress: email, verification: { status: "verified" } },
      ],
    })), forbidden);
    await assert.rejects(claimOrBindAccount(userId, async () => identity("wrong-id", email)),
      (error: unknown) => error instanceof ApiProblem && error.status === 401);
    const owner = await claimOrBindAccount(userId, async () => identity(userId, email));
    created.push(owner.id);
    assert.equal(owner.role, "administrator");
    assert.equal(owner.status, "active");
    assert.equal(owner.email, email);
    assert.equal((await claimOrBindAccount(userId, async () => identity(userId, email))).id, owner.id);
    const logs = await db.select().from(activityLogsTable).where(eq(activityLogsTable.actorUserId, owner.id));
    assert.equal(logs.length, 1, "repeat login must not create another account or audit event");
    await db.update(schoolUsersTable).set({ role: "viewer", status: "suspended" }).where(eq(schoolUsersTable.id, owner.id));
    const promoted = await claimOrBindAccount(userId, async () => identity(userId, email));
    assert.equal(promoted.role, "administrator");
    assert.equal(promoted.status, "active");
    await db.update(schoolUsersTable).set({ clerkUserId: null, role: "viewer", status: "invited" }).where(eq(schoolUsersTable.id, owner.id));
    const bound = await claimOrBindAccount(userId, async () => identity(userId, email));
    assert.equal(bound.id, owner.id);
    assert.equal(bound.role, "administrator");
    assert.equal(bound.clerkUserId, userId);
    await assert.rejects(claimOrBindAccount(`unknown-${suffix}`, async (id) => identity(id, `unknown-${suffix}@example.invalid`)), forbidden);
    const app = express();
    app.use(express.json());
    app.use((_req, res, next) => { res.locals.schoolUser = admin; next(); });
    app.use(management);
    const errors: ErrorRequestHandler = (error, _req, res, _next) => {
      res.status(error instanceof ApiProblem ? error.status : 500).json({ error: "test" });
    };
    app.use(errors);
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server!.once("listening", resolve));
    const addr = server.address();
    assert.ok(addr && typeof addr !== "string");
    const url = `http://127.0.0.1:${addr.port}/users/${owner.id}`;
    assert.equal((await fetch(url, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: "viewer" }) })).status, 400);
    assert.equal((await fetch(url, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "suspended" }) })).status, 400);
    assert.equal((await fetch(url, { method: "DELETE" })).status, 400);
  } finally {
    if (server) { server.closeAllConnections(); await new Promise<void>((resolve) => server!.close(() => resolve())); }
    await db.transaction(async (tx) => {
      if (created.length) {
        await tx.delete(activityLogsTable).where(inArray(activityLogsTable.actorUserId, created));
        await tx.delete(schoolUsersTable).where(inArray(schoolUsersTable.id, created));
      }
    });
    if (oldEnv === undefined) delete process.env.SCHOOL_OWNER_EMAILS;
    else process.env.SCHOOL_OWNER_EMAILS = oldEnv;
    await pool.end();
  }
});
