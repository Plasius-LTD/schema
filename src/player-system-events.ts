import { field } from "./field.js";
import { createSchema } from "./schema.js";

/** Event classes that can be observed by a player. */
export const PLAYER_SYSTEM_EVENT_KINDS = [
  "combat",
  "social",
  "mission",
  "crafting",
  "world",
] as const;

export type PlayerSystemEventKind = (typeof PLAYER_SYSTEM_EVENT_KINDS)[number];

/** Achievement tiers exposed by the curated player projection. */
export const PLAYER_SYSTEM_ACHIEVEMENT_TIERS = [
  "bronze",
  "silver",
  "gold",
] as const;

export type PlayerSystemAchievementTier =
  (typeof PLAYER_SYSTEM_ACHIEVEMENT_TIERS)[number];

/** Projection states for an achievement progress track. */
export const PLAYER_SYSTEM_ACHIEVEMENT_TRACK_STATUSES = [
  "tracking",
  "earned",
] as const;

export type PlayerSystemAchievementTrackStatus =
  (typeof PLAYER_SYSTEM_ACHIEVEMENT_TRACK_STATUSES)[number];

const playerIdField = () =>
  field
    .string()
    .min(1)
    .max(128)
    .PID({
      classification: "low",
      action: "none",
      logHandling: "pseudonym",
      purpose: "a stable player-scoped storage identifier",
    })
    .description(
      "Stable player identifier; the only personal identifier retained in event projections",
    );

const eventIdField = () => field.string().min(1).max(128);

const eventKindField = () =>
  field.string().enum(PLAYER_SYSTEM_EVENT_KINDS);

const eventTitleField = () =>
  field
    .generalText()
    .min(1)
    .max(120)
    .description("Player-visible event title");

const eventSummaryField = () =>
  field
    .generalText()
    .min(1)
    .max(320)
    .description("Player-visible event summary");

const observedEventFields = (defaultHighlighted = true) => ({
  id: eventIdField(),
  playerId: playerIdField(),
  occurredAt: field.dateTimeISO(),
  kind: eventKindField(),
  title: eventTitleField(),
  summary: eventSummaryField(),
  highlighted: defaultHighlighted
    ? field.boolean().default(false)
    : field.boolean(),
});

const eventHighlightFields = () => ({
  id: eventIdField(),
  title: eventTitleField(),
  summary: eventSummaryField(),
  occurredAt: field.dateTimeISO(),
  kind: eventKindField(),
});

const eventEntryFields = () => ({
  id: eventIdField(),
  title: eventTitleField(),
  summary: eventSummaryField(),
  occurredAt: field.dateTimeISO(),
  kind: eventKindField(),
  highlighted: field.boolean(),
});

const achievementFields = () => ({
  id: eventIdField(),
  title: eventTitleField(),
  tier: field.string().enum(PLAYER_SYSTEM_ACHIEVEMENT_TIERS),
  progressLabel: eventSummaryField(),
  earnedAt: field.dateTimeISO().optional(),
});

const achievementTrackFields = () => ({
  id: eventIdField(),
  title: eventTitleField(),
  current: field.number().min(0).max(1000),
  target: field.number().min(1).max(1000),
  status: field.string().enum(PLAYER_SYSTEM_ACHIEVEMENT_TRACK_STATUSES),
});

/** A player-observable event accepted at the ingestion boundary. */
export interface PlayerSystemObservedEvent {
  id: string;
  playerId: string;
  occurredAt: string;
  kind: PlayerSystemEventKind;
  title: string;
  summary: string;
  highlighted: boolean;
}

/** A raw event batch written to the blob-backed ingestion zone. */
export interface PlayerSystemObservedEventBatch {
  source: string;
  emittedAt: string;
  events: readonly PlayerSystemObservedEvent[];
}

/** A normalized event enriched with its deterministic deduplication key. */
export interface PlayerSystemNormalizedObservedEvent
  extends PlayerSystemObservedEvent {
  deterministicKey: string;
}

/** A normalized event batch written by the projection processor. */
export interface PlayerSystemNormalizedEventBatch {
  sourceBlobName: string;
  processedAt: string;
  events: readonly PlayerSystemNormalizedObservedEvent[];
}

/** A highlighted event shown in the curated player Event Log. */
export interface PlayerSystemEventHighlight {
  id: string;
  title: string;
  summary: string;
  occurredAt: string;
  kind: PlayerSystemEventKind;
}

/** A recent event shown in the curated player Event Log. */
export interface PlayerSystemEventEntry extends PlayerSystemEventHighlight {
  highlighted: boolean;
}

/** An earned or explainable achievement projected from observed events. */
export interface PlayerSystemAchievementEntry {
  id: string;
  title: string;
  tier: PlayerSystemAchievementTier;
  progressLabel: string;
  earnedAt?: string;
}

/** Progress toward an achievement projected from observed events. */
export interface PlayerSystemAchievementTrack {
  id: string;
  title: string;
  current: number;
  target: number;
  status: PlayerSystemAchievementTrackStatus;
}

/** Curated per-player Event Log and Achievement read model. */
export interface PlayerSystemCuratedSnapshot {
  playerId: string;
  projectedAt: string;
  lastObservedAt: string;
  highlights: readonly PlayerSystemEventHighlight[];
  events: readonly PlayerSystemEventEntry[];
  achievements: readonly PlayerSystemAchievementEntry[];
  tracks: readonly PlayerSystemAchievementTrack[];
}

/** Schema for raw player-observable event batches. */
export const PlayerSystemObservedEventBatchSchema = createSchema(
  {
    source: field.string().min(1).max(120),
    emittedAt: field.dateTimeISO(),
    events: field.array(field.object(observedEventFields())),
  },
  "player-system-observed-event-batch",
  {
    version: "1.0.0",
    piiEnforcement: "strict",
  },
);

/** Schema for normalized event batches used by projections and gossip sourcing. */
export const PlayerSystemNormalizedEventBatchSchema = createSchema(
  {
    sourceBlobName: field.string().min(1).max(512),
    processedAt: field.dateTimeISO(),
    events: field.array(
      field.object({
        ...observedEventFields(false),
        deterministicKey: field.string().min(1).max(256),
      }),
    ),
  },
  "player-system-normalized-event-batch",
  {
    version: "1.0.0",
    piiEnforcement: "strict",
  },
);

/** Schema for curated per-player Event Log and Achievement read models. */
export const PlayerSystemCuratedSnapshotSchema = createSchema(
  {
    playerId: playerIdField(),
    projectedAt: field.dateTimeISO(),
    lastObservedAt: field.dateTimeISO(),
    highlights: field.array(field.object(eventHighlightFields())),
    events: field.array(field.object(eventEntryFields())),
    achievements: field.array(field.object(achievementFields())),
    tracks: field.array(field.object(achievementTrackFields())),
  },
  "player-system-curated-snapshot",
  {
    version: "1.0.0",
    piiEnforcement: "strict",
  },
);

export type PlayerSystemObservedEventBatchEntity =
  PlayerSystemObservedEventBatch & {
    type: "player-system-observed-event-batch";
    version: "1.0.0";
  };

export type PlayerSystemNormalizedEventBatchEntity =
  PlayerSystemNormalizedEventBatch & {
    type: "player-system-normalized-event-batch";
    version: "1.0.0";
  };

export type PlayerSystemCuratedSnapshotEntity = PlayerSystemCuratedSnapshot & {
  type: "player-system-curated-snapshot";
  version: "1.0.0";
};
