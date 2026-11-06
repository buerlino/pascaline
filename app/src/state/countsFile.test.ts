// SPDX-License-Identifier: GPL-3.0-or-later
// R127: the counts export's file name and notice. The save port itself is clipboard/files.ts (tested there).
import { describe, expect, it, vi } from "vitest";
import { countsName, saveCounts } from "./countsFile.ts";

describe("the counts file (R127)", () => {
  it("is named n62-counts-<local date>.json", () => expect(countsName(new Date(2026, 10, 5, 9))).toBe("n62-counts-2026-11-05.json"));
  it("hands the text to the file port under that name and says what happened", async () => {
    const saveFile = vi.fn(() => Promise.resolve("saved" as const));
    vi.doMock("../clipboard/files.ts", () => ({ saveFile }));
    expect(await saveCounts("{}", new Date(2026, 10, 5))).toBe("Counts saved");
    expect(saveFile).toHaveBeenCalledWith("n62-counts-2026-11-05.json", "application/json", "{}");
    vi.doUnmock("../clipboard/files.ts");
  });
});
