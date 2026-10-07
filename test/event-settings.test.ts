import { describe, expect, it } from "vitest";
import { settingsFromEvent, settingsToRequest } from "@/modules/events/event-settings";
import type { EventDto } from "@/modules/events/events.api";
import { suggestSlug } from "@/modules/events/slug";

describe("event settings helpers", () => {
  it("suggests slugs Core accepts", () => {
    expect(suggestSlug("LightSim 2027")).toBe("lightsim-2027");
    expect(suggestSlug("  Übung -- Herbst!  ")).toBe("ubung-herbst");
  });

  it("round-trips instants through local datetime inputs", () => {
    const event = {
      name: "E",
      slug: "e",
      timeZone: "UTC",
      startsAt: "2027-05-01T08:00:00.000Z",
      endsAt: null,
      takLoginTokenDays: 14,
      permanentAccounts: true,
    } as EventDto;

    const request = settingsToRequest(settingsFromEvent(event));
    expect(request.startsAt).toBe("2027-05-01T08:00:00.000Z");
    expect(request.endsAt).toBeNull();
    expect(request.takLoginTokenDays).toBe(14);
    expect(request.permanentAccounts).toBe(true);
  });
});
