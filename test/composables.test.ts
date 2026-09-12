import { describe, expect, it } from "vitest";
import { ApiProblem } from "@/shared/errors/api-problem";
import { useAsyncData } from "@/shared/composables/useAsyncData";
import { useSubmission } from "@/shared/composables/useSubmission";

describe("useAsyncData", () => {
  it("moves from loading to ready with the fetched data", async () => {
    const { data, state, load } = useAsyncData(() => Promise.resolve([1, 2]), []);
    expect(state.value).toBe("loading");
    await load();
    expect(state.value).toBe("ready");
    expect(data.value).toEqual([1, 2]);
  });

  it("shows Core's safe problem detail on failure", async () => {
    const { state, error, load } = useAsyncData(
      () => Promise.reject(new ApiProblem(404, { detail: "The requested resource does not exist." })),
      null,
    );
    await load();
    expect(state.value).toBe("error");
    expect(error.value).toBe("The requested resource does not exist.");
  });
});

describe("useSubmission", () => {
  it("maps field problems and reports failure", async () => {
    const { run, fields, error } = useSubmission();
    const ok = await run(() =>
      Promise.reject(
        new ApiProblem(422, {
          detail: "One or more fields are invalid.",
          errors: [{ field: "body.slug", code: "INVALID", message: "Bad slug." }],
        }),
      ),
    );
    expect(ok).toBe(false);
    expect(fields.value).toEqual({ slug: "Bad slug." });
    expect(error.value).toBe("One or more fields are invalid.");
  });

  it("reports success", async () => {
    const { run, submitting } = useSubmission();
    expect(await run(() => Promise.resolve())).toBe(true);
    expect(submitting.value).toBe(false);
  });
});
