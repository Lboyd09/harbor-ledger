# Funnel event storage

**User problem:** We need to know if people finish setup, without storing their budget.

**Options:**
1. First-party table (a migration).
2. Vercel Web Analytics custom events (enable on Liam's account).
3. Nothing.

This run added a client `track()` helper with a no-op sink unless `VITE_ANALYTICS_ENDPOINT` is set. No amounts, merchants, names, emails, or free text.

**Effort:** S. **Questions for Liam (D12):** Where should events live?
