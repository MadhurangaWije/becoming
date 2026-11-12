# Backup format

Becoming stores everything on the device. The backup file (Settings → Export backup) is a complete, lossless copy of the local database. It is also the migration path:

- **New phone:** on the new device, open Becoming and choose **Restore from backup** on the first onboarding screen (or Settings → Import backup later).
- **Future backend:** a server can ingest this file as-is. Every record already carries a stable UUID and timestamps, so imports are idempotent upserts.

## File

```jsonc
{
  "format": "becoming-backup",       // constant
  "version": 1,                       // backup format version (see Versioning)
  "exportedAt": "2026-11-12T08:30:00.000Z",
  "app": { "name": "Becoming", "schemaVersion": 1 },   // local DB schema version
  "counts": { "food": 212, "workout": 80, ... },        // integrity check
  "tables": {
    "settings": [ ... ],      // exactly one row, id = "me"
    "food": [ ... ],
    "workout": [ ... ],
    "learning": [ ... ],
    "expense": [ ... ],
    "dayRecords": [ ... ],
    "xpEvents": [ ... ],
    "messages": [ ... ],
    "badges": [ ... ],
    "weeklyReviews": [ ... ]
  }
}
```

Field-level types for every table are in [`src/domain/types.ts`](../src/domain/types.ts).

## Conventions

| Thing | Rule |
| --- | --- |
| IDs | `id` is a UUID v4 string, generated on the device, never reused. `dayRecords` are keyed by `day` and use the day as `id`. |
| Timestamps | `createdAt`, `updatedAt`, `closedAt`, `readAt`, and so on are ISO 8601 in UTC. |
| Days | `day` is a local-time `YYYY-MM-DD` string. Logs before `settings.dayCloseHour` (default 3am) belong to the previous day. Store as `DATE`, not a timestamp. |
| Times | Meal `time` is local `HH:mm`. |
| Money | `amount` is in `settings.currency` (LKR), as a plain number. |
| Enums | Stored as their string values (`on_plan`, `need`, `gym`, ...). |

## Source of truth vs derived data

When migrating to a backend, decide per table whether to import or recompute:

| Table | Kind | Notes |
| --- | --- | --- |
| `settings` | Source | Goals, meal plan, whys, future-self statement. |
| `food`, `workout`, `learning`, `expense` | Source | The user's actual logs. Always import. |
| `dayRecords` | Derived, mostly | Scores can be recomputed from the logs with `domain/scoring.ts`. Import anyway: it also holds `noSpendDay`, `reflection` and `usedFreeze`, which are not derivable. |
| `xpEvents` | History | Append-only ledger. Each stat's XP is the sum of its events. Import it; recomputing would need replaying every day close in order. |
| `messages` | History | Companion messages and the user's intervention responses. |
| `badges` | History | One row per badge earned, with `earnedOn`. |
| `weeklyReviews` | Source | Holds the user's chosen weekly `focus`. |

The game logic in `src/domain/` is pure TypeScript with no browser dependencies, so a Node backend can reuse it directly to recompute or verify derived data.

## Suggested relational mapping

One table per key in `tables`, a `user_id` column added to each, primary key `(user_id, id)`. Upsert on `id` and keep the row with the newest `updatedAt`. That makes repeated imports safe and gives a starting point for multi-device sync.

## Versioning

- `version` changes only when the file shape changes in a way old readers cannot handle.
- The app imports any version from 1 up to its own. Older files are upgraded step by step by `migrateBackup` in [`src/data/backup.ts`](../src/data/backup.ts). Every format bump must add a step there.
- Files from a newer app version are rejected with a message to update the app.

## Integrity

Import rejects a file that is not a Becoming backup, has a malformed table, has no settings row, or whose row counts do not match `counts` (for example a truncated download). Restore runs in one transaction: it either replaces everything or changes nothing.
