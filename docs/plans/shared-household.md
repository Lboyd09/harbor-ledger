# Shared household budget

**User problem:** Two people edit one budget. Today each signed-in user has one JSON payload.

**Design:** Household id, members, invites, last-write-wins with an undo snapshot. One ledger row per household, not per user.

**Storage change:** New `households` and `household_members` tables. Migrate: copy the owner's ledger to a household. Rollback: keep per-user payload.

**Effort:** L. **Privacy:** Invites expose email. **Risks:** conflicts, data loss.

**Questions for Liam (D14):** Is shared editing this year? Who is the owner?
