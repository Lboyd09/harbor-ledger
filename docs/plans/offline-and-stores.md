# Offline viewing and app stores

**User problem:** People want the app on the home screen and to open it without a network.

**Design:** A service worker for offline viewing (risk: stale versions after deploys). A store wrapper later (L).

This run did not add a service worker. Add to Home Screen is a one-time card after the first import.

**Effort:** M for a worker, L for stores.

**Questions for Liam:** Accept stale-cache risk after deploys?
