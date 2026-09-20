import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { emptySnapshot, normalizeSnapshot } from "./normalize";
import type { LedgerSnapshot } from "./types";

export const loadLedger = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<LedgerSnapshot | null> => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql.query<{ payload: unknown }>("select payload from ledgers where user_id = $1", [
      context.userId,
    ]);
    if (!rows[0]) return null;
    return normalizeSnapshot(rows[0].payload);
  });

export const saveLedger = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: LedgerSnapshot) => data)
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const payload = JSON.stringify(data);
    await sql.query(
      `insert into ledgers (user_id, payload, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (user_id) do update set payload = excluded.payload, updated_at = now()`,
      [context.userId, payload],
    );
    return { ok: true as const };
  });

export const clearLedger = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const empty = JSON.stringify(emptySnapshot());
    await sql.query(
      `insert into ledgers (user_id, payload, updated_at)
       values ($1, $2::jsonb, now())
       on conflict (user_id) do update set payload = excluded.payload, updated_at = now()`,
      [context.userId, empty],
    );
    return { ok: true as const };
  });

export const issueRecoveryCode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { createHash, randomBytes } = await import("node:crypto");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const users = await sql.query<{ email: string }>(`select email from "user" where id = $1`, [context.userId]);
    const email = users[0]?.email?.trim().toLowerCase();
    if (!email) return { ok: false as const, error: "No email on this account." };
    const raw = randomBytes(5).toString("hex").toUpperCase();
    const code = `HARBOR-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    const codeHash = createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
    await sql.query(
      `insert into ledger_recovery (email, user_id, code_hash, created_at)
       values ($1, $2, $3, now())
       on conflict (email) do update set user_id = excluded.user_id, code_hash = excluded.code_hash, created_at = now()`,
      [email, context.userId, codeHash],
    );
    return { ok: true as const, code };
  });

export const resetPasswordWithCode = createServerFn({ method: "POST" })
  .validator((data: { email: string; code: string; newPassword: string }) => ({
    email: data.email.trim().toLowerCase(),
    code: data.code.trim().toUpperCase(),
    newPassword: data.newPassword,
  }))
  .handler(async ({ data }) => {
    const generic = "That email and recovery code did not match.";
    if (!data.email || !data.code || data.newPassword.length < 8) {
      return { ok: false as const, error: "Use a valid email, recovery code, and a password of at least 8 characters." };
    }
    const { createHash, timingSafeEqual } = await import("node:crypto");
    const { hashPassword } = await import("better-auth/crypto");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rec = await sql.query<{ user_id: string; code_hash: string }>(
      "select user_id, code_hash from ledger_recovery where email = $1",
      [data.email],
    );
    const hash = createHash("sha256").update(data.code).digest("hex");
    if (!rec[0]) return { ok: false as const, error: generic };
    const left = Buffer.from(rec[0].code_hash);
    const right = Buffer.from(hash);
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      return { ok: false as const, error: generic };
    }
    const accounts = await sql.query<{ id: string }>(
      `select id from account where "userId" = $1 and "providerId" = 'credential'`,
      [rec[0].user_id],
    );
    if (!accounts[0]) {
      return {
        ok: false as const,
        error: "This email signs in with Google or X. Use those buttons instead of a password.",
      };
    }
    const hashed = await hashPassword(data.newPassword);
    await sql.query(`update account set password = $1, "updatedAt" = now() where id = $2`, [hashed, accounts[0].id]);
    await sql.query(`delete from session where "userId" = $1`, [rec[0].user_id]);
    return { ok: true as const };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { confirm: string }) => data)
  .handler(async ({ context, data }) => {
    if (data.confirm.trim().toUpperCase() !== "DELETE") {
      return { ok: false as const, error: "Type DELETE to confirm." };
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql.query("delete from ledgers where user_id = $1", [context.userId]);
    await sql.query("delete from ledger_recovery where user_id = $1", [context.userId]);
    await sql.query(`delete from "user" where id = $1`, [context.userId]);
    return { ok: true as const };
  });
