import { describe, expect, it } from "vitest";
import {
  PlayerSystemCuratedSnapshotSchema,
  PlayerSystemNormalizedEventBatchSchema,
  PlayerSystemObservedEventBatchSchema,
} from "../src/index.js";

const observedEvent = {
  id: "event-1",
  playerId: "player-1",
  occurredAt: "2026-05-16T09:48:00.000Z",
  kind: "social",
  title: "Public dispute resolved",
  summary: "A public dispute ended without escalation.",
  highlighted: true,
} as const;

describe("player-system event schemas", () => {
  it("validates and defaults raw observed-event batches", () => {
    const result = PlayerSystemObservedEventBatchSchema.validate({
      source: "player-system",
      emittedAt: "2026-05-16T09:49:00.000Z",
      events: [
        {
          ...observedEvent,
          highlighted: undefined,
        },
      ],
    });

    expect(result.valid).toBe(true);
    expect(result.value?.events[0]?.highlighted).toBe(false);
  });

  it("rejects non-observable event categories and unsafe summaries", () => {
    const invalidKind = PlayerSystemObservedEventBatchSchema.validate({
      source: "player-system",
      emittedAt: "2026-05-16T09:49:00.000Z",
      events: [{ ...observedEvent, kind: "server-secret" }],
    });
    const unsafeSummary = PlayerSystemObservedEventBatchSchema.validate({
      source: "player-system",
      emittedAt: "2026-05-16T09:49:00.000Z",
      events: [{ ...observedEvent, summary: "<hidden server truth>" }],
    });

    expect(invalidKind.valid).toBe(false);
    expect(unsafeSummary.valid).toBe(false);
  });

  it("keeps only the contract fields when serializing normalized batches", () => {
    const serialized = PlayerSystemNormalizedEventBatchSchema.serialize({
      type: "player-system-normalized-event-batch",
      version: "1.0.0",
      sourceBlobName: "observed-events/raw/2026/05/event.json",
      processedAt: "2026-05-16T09:50:00.000Z",
      events: [
        {
          ...observedEvent,
          deterministicKey: "player-1:social:2026-05-16T09:48:00.000Z:event-1",
          hiddenServerTruth: "must not persist",
        },
      ],
      hiddenBatchMetadata: "must not persist",
    });

    expect(serialized).not.toHaveProperty("hiddenBatchMetadata");
    expect(serialized.events[0]).not.toHaveProperty("hiddenServerTruth");
    expect(serialized.events[0]?.playerId).toBe("player-1");
  });

  it("marks playerId as low PII and pseudonymizes it in log output", () => {
    const audit = PlayerSystemCuratedSnapshotSchema.getPiiAudit();
    expect(audit).toContainEqual(
      expect.objectContaining({
        field: "playerId",
        classification: "low",
        action: "none",
        logHandling: "pseudonym",
      }),
    );

    const logSafe = PlayerSystemCuratedSnapshotSchema.sanitizeForLog(
      {
        type: "player-system-curated-snapshot",
        version: "1.0.0",
        playerId: "player-1",
        projectedAt: "2026-05-16T09:50:00.000Z",
        lastObservedAt: "2026-05-16T09:48:00.000Z",
        highlights: [],
        events: [observedEvent],
        achievements: [],
        tracks: [],
      },
      (value) => `pseudonym:${String(value)}`,
    );

    expect(logSafe.playerId).toBe("pseudonym:player-1");

    const rawLogSafe = PlayerSystemObservedEventBatchSchema.sanitizeForLog(
      {
        type: "player-system-observed-event-batch",
        version: "1.0.0",
        source: "player-system",
        emittedAt: "2026-05-16T09:49:00.000Z",
        events: [observedEvent],
      },
      (value) => `pseudonym:${String(value)}`,
    );

    expect(rawLogSafe.events[0]?.playerId).toBe("pseudonym:player-1");
  });

  it("validates curated achievements and progress tracks", () => {
    const result = PlayerSystemCuratedSnapshotSchema.validate({
      playerId: "player-1",
      projectedAt: "2026-05-16T09:50:00.000Z",
      lastObservedAt: "2026-05-16T09:48:00.000Z",
      highlights: [],
      events: [observedEvent],
      achievements: [
        {
          id: "achievement-first-mediation",
          title: "First Mediation",
          tier: "bronze",
          progressLabel: "Earned for resolving a public dispute.",
          earnedAt: "2026-05-16T09:48:00.000Z",
        },
      ],
      tracks: [
        {
          id: "track-guild-trust",
          title: "Guild trust stabilizer",
          current: 1,
          target: 3,
          status: "tracking",
        },
      ],
    });

    expect(result.valid).toBe(true);
  });
});
