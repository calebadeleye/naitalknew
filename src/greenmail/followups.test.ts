import { describe, expect, it } from "vitest";
import { quickTimes } from "./FollowUpsView";
import { isOfflineError } from "./offline";

describe("quickTimes", () => {
  it("offers later today in the morning, then tomorrow, three days and next Monday at 8am", () => {
    const wednesdayMorning = new Date(2026, 9, 21, 9, 30); // Wed 21 Oct 2026
    const options = quickTimes(wednesdayMorning);
    expect(options.map(([label]) => label)).toEqual(["Later today", "Tomorrow", "In 3 days", "Next week"]);
    expect(options[0][1].getHours()).toBe(12);
    expect(options[1][1]).toEqual(new Date(2026, 9, 22, 8, 0));
    expect(options[3][1]).toEqual(new Date(2026, 9, 26, 8, 0)); // Monday
  });

  it("drops later today in the evening", () => {
    expect(quickTimes(new Date(2026, 9, 21, 19, 0)).map(([label]) => label)).not.toContain("Later today");
  });
});

describe("isOfflineError", () => {
  it("treats a failed fetch as offline but not a server refusal", () => {
    expect(isOfflineError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isOfflineError(new Error("The subject is required."))).toBe(false);
  });
});
