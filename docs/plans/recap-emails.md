# Monthly recap emails

**User problem:** People forget to import the new month. A short recap in email would bring them back.

**Design:** One email after the first week of a new month. Default is no amounts (same as share cards). Unsubscribe link required.

**Storage:** Needs Resend, a sending domain, `RESEND_API_KEY`, `HARBOR_FROM_EMAIL` in Vercel, and a Vercel Cron job. No new table if we send from last import date already stored.

**Privacy:** No merchants or amounts unless Liam later turns amounts on.

**Effort:** M. **Risks:** spam, stale versions, unsubscribes.

**Questions for Liam (D13):** Do you have a Resend account and sending domain? What from-address?
