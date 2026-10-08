import { describe, expect, it } from "vitest";
import { scheduleHint } from "@/modules/events/event-schedule";
import type { EventDto } from "@/modules/events/events.api";

function event(overrides: Partial<EventDto>): EventDto {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    name: "LightSim",
    slug: "lightsim",
    timeZone: "Europe/Berlin",
    status: "draft",
    version: 1,
    startsAt: null,
    endsAt: null,
    takLoginTokenDays: 0,
    permanentAccounts: false,
    meshtasticEnabled: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const now = new Date("2026-10-06T12:00:00.000Z");

describe("event schedule", () => {
  it("describes where an event stands in time", () => {
    expect(scheduleHint(event({ startsAt: "2026-10-11T08:00:00.000Z" }), now)).toBe("Starts in 5 days");
    expect(scheduleHint(event({ startsAt: "2026-10-07T08:00:00.000Z" }), now)).toBe("Starts tomorrow");
    expect(scheduleHint(event({ startsAt: "2026-10-05T08:00:00.000Z", endsAt: "2026-10-08T08:00:00.000Z" }), now)).toBe("Running");
    expect(scheduleHint(event({ endsAt: "2026-10-01T08:00:00.000Z" }), now)).toBe("Ended");
    expect(scheduleHint(event({}), now)).toBeNull();
  });
});
