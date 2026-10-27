# Messenger Presence Runtime Runbook

## 1. Scope and authority

Messenger Presence v1 answers one question: whether an authenticated user has renewed an active
Messenger browser lease recently.

- Input: `PUT /api/messaging/v1/presence/heartbeat`, no request body
- Client cadence: immediately on an allowed visible/online Messenger Surface, then at the
  server-advertised refresh interval (20 seconds by default)
- Authority: Tenant-scoped Redis Sorted Set; member is `userId`, score is the expiry time
- Default lease TTL: 75 seconds
- API states: `AVAILABLE`, `OFFLINE`, `UNKNOWN`
- Authority states: `LIVE`, `UNAVAILABLE`
- Durable identity projection and historical `presence_state` values are never a live fallback

This signal does not prove that a user is reading the page, has an active socket, or is active in
another DWP product.

## 2. Configuration

| Environment variable                                       | Default                     | Purpose                        |
| ---------------------------------------------------------- | --------------------------- | ------------------------------ |
| `DWP_MESSAGING_PRESENCE_ENABLED`                           | `true`                      | Server-side kill switch        |
| `DWP_MESSAGING_PRESENCE_TTL`                               | `75s`                       | Lease validity                 |
| `DWP_MESSAGING_PRESENCE_REFRESH_AFTER`                     | `20s`                       | Advertised client renewal time |
| `DWP_MESSAGING_PRESENCE_KEY_PREFIX`                        | `dwp:messaging:presence:v1` | Tenant key prefix              |
| `DWP_MESSAGING_PRESENCE_ACTIVE_USER_WARNING_THRESHOLD`     | `5000`                      | Active-lease warning threshold |
| `DWP_MESSAGING_PRESENCE_MAXIMUM_ACTIVE_USERS` (deprecated) | none                        | Legacy threshold fallback      |
| `DWP_MESSAGING_REDIS_TIMEOUT`                              | `2s`                        | Redis command timeout          |
| `DWP_MESSAGING_REDIS_CONNECT_TIMEOUT`                      | `2s`                        | Redis connection timeout       |

The active-user warning threshold is observability only: it never truncates a lookup or changes an
otherwise `AVAILABLE` user to `OFFLINE`. During migration the deprecated maximum-active-users
variable remains a lower-precedence fallback. Remove it after every environment has adopted the new
name.

TTL and refresh values must be whole seconds. TTL must remain between 30 and 300 seconds, refresh
must be at least 5 seconds, and `refresh + 15 seconds <= TTL`. The 15-second reserve covers one
5-second heartbeat timeout, one 5-second retry timeout, and a 5-second safety margin. Invalid or
missing response timing is not interpreted as the server default: compatibility mode instead uses
the minimum safe 30-second TTL and a 5-second refresh cadence.

Each 5-second heartbeat request deadline is one absolute budget covering CSRF bootstrap, the first
dispatch and the single stale-CSRF replay. A replay reuses the remaining budget and never starts a
new 5-second window.

Changing the key prefix creates a new empty authority and intentionally makes every user offline
until clients renew. Do not reuse a prefix across environments.

## 3. Deployment and migration

Migration `V17__make_runtime_presence_authoritative.sql` changes compatibility projection values to
`UNKNOWN`. It is forward-only: a rollback must not recreate seeded `AVAILABLE` values.

Before production migration:

1. Record `SELECT count(*) FROM msg_people_snapshot WHERE presence_state <> 'UNKNOWN'` by Tenant.
2. Run the update on a production-sized clone and capture execution time, row locks, WAL and bloat.
3. Confirm the frontend understands `home.presence.authority` and filters to actual `AVAILABLE`
   values before applying the migration to a live environment.
4. Confirm Redis HA, memory headroom and eviction policy; Presence keys must not compete with a
   durable message store.
5. Deploy backend and frontend as one compatibility window, then verify two real user sessions.

If application rollback is required, keep the migrated rows at `UNKNOWN`. Roll back to a version
that also fails closed for unknown Presence, or keep the new frontend section disabled. Never restore
synthetic online states.

## 4. Runtime verification

For two users in the same Tenant:

1. Open Messenger for user A and confirm heartbeat returns `204` with
   `X-DWP-Presence-Lease-TTL-Seconds: 75` and
   `X-DWP-Presence-Refresh-After-Seconds: 20` (or the approved configured values).
2. Confirm the Tenant Redis key contains only user A's numeric ID and has a finite TTL.
3. Open user B's Home and confirm user A appears while user B does not see themselves.
4. Repeat with a user in a different Tenant and confirm no cross-Tenant disclosure.
5. Hide or close every user A Messenger Tab. After 75 seconds plus the advertised client refresh
   interval, confirm user A disappears.
6. Stop Redis. Heartbeat must return `503`; Home must return `UNAVAILABLE`; message history and
   durable sends must continue according to their own dependency contracts.
7. Restore Redis and confirm the next heartbeat returns the authority to `LIVE` without manual data
   repair.

The browser measures a successful lease conservatively from the heartbeat request start, not its
response completion. After the first failure it caps the retry start at `request start + TTL - 10s`,
reserving the full 5-second request deadline and 5-second margin before expiry. This cap takes
precedence over exponential backoff; later failures may allow the lease to expire and recover with a
new successful heartbeat.

Do not place Redis credentials, person names, email addresses or message content in verification
commands, dashboards or evidence.

## 5. Monitoring and alerts

Monitor at least:

- heartbeat success and failure rate
- snapshot/lookup success and failure rate
- Redis operation latency
- active lease count per Tenant as a bounded, non-personal aggregate
- active-lease warning-threshold exceedance
- heartbeat `503` rate and `UNAVAILABLE` Home response rate
- the Presence health component's `UNKNOWN` state

Alert when Presence failures persist for two heartbeat intervals, capacity warnings are non-zero,
or Redis latency threatens the 20-second renewal cadence. A Presence-only Redis failure reports the
component as `UNKNOWN`; it does not make the whole service readiness probe `DOWN`, because durable
messaging remains usable. Rate-limit repeated failure logs so a Redis outage does not produce one
warning per user every 20 seconds.

Inspect this non-critical component through the dedicated `/actuator/health/presence` group. The
group exposes only the Presence authority state and a coarse exception type; the standard readiness
group remains independent.

## 6. Capacity gate

Before onboarding a Tenant near the configured active-user warning threshold:

1. Load-test at least twice the expected concurrent Messenger population.
2. Measure Redis CPU, memory, command p95/p99, network bandwidth and Home/Directory query latency.
3. Verify candidate reads are bounded and person/member lookups score only their result user IDs.
4. Verify exceeding the warning threshold emits metrics without truncating a result into false
   `OFFLINE` states.
5. Raise the warning threshold only with measured headroom and an alert threshold below the new limit.

## 7. Incident response

### Redis unavailable

- Expected: Presence becomes `UNAVAILABLE`; heartbeat returns `503`; durable messaging remains
  governed by its own PostgreSQL/Kafka dependencies.
- Check Redis HA failover, connection saturation, command latency and eviction.
- Do not write `AVAILABLE` values into PostgreSQL as a workaround.
- After recovery, verify renewal and expiry with two real sessions.

### Unexpected active count or cross-Tenant result

- Treat cross-Tenant exposure as a security incident.
- Disable Presence with `DWP_MESSAGING_PRESENCE_ENABLED=false` and preserve Redis/audit evidence.
- Verify the key prefix includes the exact verified Tenant ID and that user IDs came from the
  authenticated request context.
- Do not delete evidence until the incident owner authorizes cleanup.

### Active-lease warning threshold exceeded

- Keep result lookups complete for their requested user IDs; do not truncate into false `OFFLINE` states.
- Confirm whether the count is legitimate, stale-score cleanup is working, and the configured threshold
  matches the approved capacity plan.
- Scale or raise the threshold only after the capacity gate passes.
