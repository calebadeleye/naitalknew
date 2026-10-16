import { describe, expect, it } from "vitest";
import { articleBlocks } from "./KnowledgeBasePages";

describe("articleBlocks", () => {
  it("keeps plain paragraphs as they were", () => {
    expect(articleBlocks("First paragraph.\n\nSecond one.")).toEqual([
      { id: "section-1", heading: null, lines: ["First paragraph."] },
      { id: "section-2", heading: null, lines: ["Second one."] },
    ]);
  });

  it("turns '## ' into a heading and '- ' lines into one list", () => {
    const [block] = articleBlocks("## Open Green Mail\nDo this:\n- Go to /greenmail\n- Sign in\nDone.");
    expect(block).toEqual({ id: "open-green-mail", heading: "Open Green Mail", lines: ["Do this:", ["Go to /greenmail", "Sign in"], "Done."] });
  });
});
