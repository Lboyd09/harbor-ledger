import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { authMiddleware } from "@/lib/auth/middleware";

function originFromRequest() {
  const request = getRequest();
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

async function sendMail(to: string, subject: string, text: string, html: string) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.HARBOR_FROM_EMAIL?.trim();
  if (!key || !from) {
    return {
      configured: false as const,
      sent: false as const,
      error: "Email is not connected yet. Add RESEND_API_KEY and HARBOR_FROM_EMAIL where Harbor is hosted.",
    };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, text, html }),
  });
  if (!res.ok) {
    return {
      configured: true as const,
      sent: false as const,
      error: "The mail service refused the message. Check that HARBOR_FROM_EMAIL is a domain you verified in Resend.",
    };
  }
  return { configured: true as const, sent: true as const, error: null };
}

async function issueToken(userId: string, email: string, purpose: "reset" | "confirm") {
  const { createHash, randomBytes } = await import("node:crypto");
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const raw = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(raw).digest("hex");
  const hours = purpose === "reset" ? 1 : 72;
  const expires = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  await sql.query(`delete from email_tokens where user_id = $1 and purpose = $2 and used_at is null`, [userId, purpose]);
  await sql.query(
    `insert into email_tokens (token_hash, user_id, email, purpose, expires_at)
     values ($1, $2, $3, $4, $5)`,
    [tokenHash, userId, email, purpose, expires],
  );
  return raw;
}

export const emailStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const users = await sql.query<{ email: string; emailVerified: boolean }>(
      `select email, "emailVerified" as "emailVerified" from "user" where id = $1`,
      [context.userId],
    );
    const configured = Boolean(process.env.RESEND_API_KEY?.trim() && process.env.HARBOR_FROM_EMAIL?.trim());
    return {
      configured,
      email: users[0]?.email ?? "",
      verified: Boolean(users[0]?.emailVerified),
    };
  });

export const sendConfirmationEmail = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const users = await sql.query<{ email: string }>(`select email from "user" where id = $1`, [context.userId]);
    const email = users[0]?.email?.trim().toLowerCase();
    if (!email) return { ok: false as const, configured: false, sent: false, error: "This sign-in has no email.", previewLink: null as string | null };
    const token = await issueToken(context.userId, email, "confirm");
    const link = `${originFromRequest()}/confirm?token=${token}`;
    const mailed = await sendMail(
      email,
      "Confirm your Harbor email",
      `Confirm this email for Harbor: ${link}\n\nThe link works for 3 days. If you did not create a Harbor account, ignore this note.`,
      `<p>Confirm this email for Harbor.</p><p><a href="${link}">Confirm email</a></p><p>The link works for 3 days. If you did not create a Harbor account, you can ignore this note.</p>`,
    );
    if (!mailed.configured) {
      return { ok: true as const, configured: false, sent: false, error: mailed.error, previewLink: link };
    }
    return { ok: mailed.sent, configured: mailed.configured, sent: mailed.sent, error: mailed.error, previewLink: null as string | null };
  });

export const confirmEmailToken = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => ({ token: data.token.trim() }))
  .handler(async ({ data }) => {
    if (!data.token || data.token.length < 20) return { ok: false as const, error: "That confirmation link is not valid." };
    const { createHash } = await import("node:crypto");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const tokenHash = createHash("sha256").update(data.token).digest("hex");
    const rows = await sql.query<{ user_id: string }>(
      `update email_tokens set used_at = now()
       where token_hash = $1 and purpose = 'confirm' and used_at is null and expires_at > now()
       returning user_id`,
      [tokenHash],
    );
    if (!rows[0]) return { ok: false as const, error: "That confirmation link is expired or already used." };
    await sql.query(`update "user" set "emailVerified" = true, "updatedAt" = now() where id = $1`, [rows[0].user_id]);
    return { ok: true as const };
  });

export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator((data: { email: string }) => ({ email: data.email.trim().toLowerCase() }))
  .handler(async ({ data }) => {
    const configured = Boolean(process.env.RESEND_API_KEY?.trim() && process.env.HARBOR_FROM_EMAIL?.trim());
    if (!configured) {
      return {
        ok: false as const,
        configured: false,
        error: "Email is not connected yet. Use a recovery code, or add RESEND_API_KEY and HARBOR_FROM_EMAIL where Harbor is hosted.",
      };
    }
    if (!data.email.includes("@")) return { ok: true as const, configured: true };
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const users = await sql.query<{ id: string }>(`select id from "user" where lower(email) = $1`, [data.email]);
    const userId = users[0]?.id;
    if (!userId) return { ok: true as const, configured: true };
    const accounts = await sql.query<{ id: string }>(
      `select id from account where "userId" = $1 and "providerId" = 'credential'`,
      [userId],
    );
    if (!accounts[0]) return { ok: true as const, configured: true };
    const token = await issueToken(userId, data.email, "reset");
    const link = `${originFromRequest()}/reset?token=${token}`;
    await sendMail(
      data.email,
      "Reset your Harbor password",
      `Set a new Harbor password: ${link}\n\nThis link works for one hour. If you did not ask for it, ignore this note.`,
      `<p>Set a new Harbor password.</p><p><a href="${link}">Choose a new password</a></p><p>This link works for one hour. If you did not ask for it, you can ignore this note.</p>`,
    );
    return { ok: true as const, configured: true };
  });

/** Signed-in reset. If mail is not connected, the link is returned only to this user. */
export const sendOwnResetLink = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const users = await sql.query<{ email: string }>(`select email from "user" where id = $1`, [context.userId]);
    const email = users[0]?.email?.trim().toLowerCase();
    if (!email) return { ok: false as const, configured: false, sent: false, error: "This sign-in has no email.", previewLink: null };
    const accounts = await sql.query<{ id: string }>(
      `select id from account where "userId" = $1 and "providerId" = 'credential'`,
      [context.userId],
    );
    if (!accounts[0]) {
      return {
        ok: false as const,
        configured: false,
        sent: false,
        error: "This sign-in uses Google or X. There is no password to reset.",
        previewLink: null,
      };
    }
    const token = await issueToken(context.userId, email, "reset");
    const link = `${originFromRequest()}/reset?token=${token}`;
    const mailed = await sendMail(
      email,
      "Reset your Harbor password",
      `Set a new Harbor password: ${link}\n\nThis link works for one hour. If you did not ask for it, ignore this note.`,
      `<p>Set a new Harbor password.</p><p><a href="${link}">Choose a new password</a></p><p>This link works for one hour. If you did not ask for it, you can ignore this note.</p>`,
    );
    if (!mailed.configured) {
      return { ok: true as const, configured: false, sent: false, error: mailed.error, previewLink: link };
    }
    return {
      ok: mailed.sent,
      configured: true as const,
      sent: mailed.sent,
      error: mailed.error,
      previewLink: null as string | null,
    };
  });

export const resetPasswordWithToken = createServerFn({ method: "POST" })
  .validator((data: { token: string; newPassword: string }) => ({
    token: data.token.trim(),
    newPassword: data.newPassword,
  }))
  .handler(async ({ data }) => {
    if (data.newPassword.length < 8) return { ok: false as const, error: "Use at least 8 characters." };
    if (!data.token) return { ok: false as const, error: "That reset link is not valid." };
    const { createHash } = await import("node:crypto");
    const { hashPassword } = await import("better-auth/crypto");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const tokenHash = createHash("sha256").update(data.token).digest("hex");
    const rows = await sql.query<{ user_id: string }>(
      `update email_tokens set used_at = now()
       where token_hash = $1 and purpose = 'reset' and used_at is null and expires_at > now()
       returning user_id`,
      [tokenHash],
    );
    if (!rows[0]) return { ok: false as const, error: "That reset link is expired or already used." };
    const accounts = await sql.query<{ id: string }>(
      `select id from account where "userId" = $1 and "providerId" = 'credential'`,
      [rows[0].user_id],
    );
    if (!accounts[0]) {
      return { ok: false as const, error: "This email signs in with Google or X. Use those buttons instead of a password." };
    }
    const hashed = await hashPassword(data.newPassword);
    await sql.query(`update account set password = $1, "updatedAt" = now() where id = $2`, [hashed, accounts[0].id]);
    await sql.query(`delete from session where "userId" = $1`, [rows[0].user_id]);
    return { ok: true as const };
  });
