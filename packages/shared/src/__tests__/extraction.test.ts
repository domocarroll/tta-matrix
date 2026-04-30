import { describe, it, expect } from "vitest";
import {
  titleCase,
  clampRaceNumber,
  parseHorseNumber,
  isRefusal,
  looksLikeJson,
  cleanResponse,
  needsContinuation,
  expandExtraction,
} from "../extraction.ts";

describe("titleCase", () => {
  it("converts uppercase to title case", () => {
    expect(titleCase("WINX")).toBe("Winx");
  });

  it("converts lowercase to title case", () => {
    expect(titleCase("black caviar")).toBe("Black Caviar");
  });

  it("handles mixed case", () => {
    expect(titleCase("nATURE sTRIP")).toBe("Nature Strip");
  });

  it("trims whitespace", () => {
    expect(titleCase("  Winx  ")).toBe("Winx");
  });
});

describe("clampRaceNumber", () => {
  it("clamps 0 to 1", () => {
    expect(clampRaceNumber(0)).toBe(1);
  });

  it("clamps negative to 1", () => {
    expect(clampRaceNumber(-1)).toBe(1);
  });

  it("clamps 11 to 10", () => {
    expect(clampRaceNumber(11)).toBe(10);
  });

  it("passes through valid numbers", () => {
    expect(clampRaceNumber(5)).toBe(5);
  });

  it("parses string numbers", () => {
    expect(clampRaceNumber("3")).toBe(3);
  });

  it("defaults NaN to 1", () => {
    expect(clampRaceNumber("abc")).toBe(1);
  });
});

describe("parseHorseNumber", () => {
  it("parses valid numbers", () => {
    expect(parseHorseNumber("5")).toBe(5);
  });

  it("returns undefined for NaN", () => {
    expect(parseHorseNumber("abc")).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(parseHorseNumber(undefined)).toBeUndefined();
  });

  it("passes through numeric input", () => {
    expect(parseHorseNumber(7)).toBe(7);
  });
});

describe("isRefusal", () => {
  it("detects common refusal phrases", () => {
    expect(isRefusal("I cannot process this image")).toBe(true);
    expect(isRefusal("Sorry, but I'm unable to extract")).toBe(true);
    expect(isRefusal("The image is too blurry to read")).toBe(true);
  });

  it("does not flag valid responses", () => {
    expect(isRefusal('[{"r":"1","t":[]}]')).toBe(false);
  });
});

describe("looksLikeJson", () => {
  it("detects JSON arrays", () => {
    expect(looksLikeJson('[{"r":"1"}]')).toBe(true);
  });

  it("detects JSON objects", () => {
    expect(looksLikeJson('{"raceNumber":1}')).toBe(true);
  });

  it("detects markdown JSON", () => {
    expect(looksLikeJson('```json\n[{"r":"1"}]```')).toBe(true);
  });

  it("detects text responses", () => {
    expect(looksLikeJson("Hello, here are the tips...")).toBe(false);
    expect(looksLikeJson("Unfortunately I cannot...")).toBe(false);
  });
});

describe("cleanResponse", () => {
  it("strips markdown fences", () => {
    expect(cleanResponse('```json\n[{"r":"1"}]\n```')).toBe('[{"r":"1"}]');
  });

  it("removes continuation markers", () => {
    expect(cleanResponse('[{"r":"1"},[CONTINUE]')).toBe('[{"r":"1"},');
  });

  it("trims whitespace", () => {
    expect(cleanResponse("  [1,2,3]  ")).toBe("[1,2,3]");
  });
});

describe("needsContinuation", () => {
  it("detects [CONTINUE] marker", () => {
    expect(needsContinuation('{"r":"1"}[CONTINUE]')).toBe(true);
  });

  it("detects truncated horseName", () => {
    // This string ends with "h": which IS the abbreviated horseName key — needs continuation
    expect(needsContinuation('"horseName":')).toBe(true);
    expect(needsContinuation('"h":')).toBe(true);
    // Complete JSON does not need continuation
    expect(needsContinuation('{"r":"1","t":[{"n":"TONY","s":[{"h":"WINX"}]}]}')).toBe(false);
  });

  it("detects trailing comma", () => {
    expect(needsContinuation('[{"r":"1"},{')).toBe(true);
  });

  it("returns false for complete JSON", () => {
    expect(needsContinuation('[{"r":"1","t":[]}]')).toBe(false);
  });
});

describe("expandExtraction", () => {
  it("expands abbreviated keys", () => {
    const raw = [
      {
        r: "3",
        t: [
          {
            n: "TONY",
            s: [
              { h: "WINX", num: "5" },
              { h: "BLACK CAVIAR", num: "2" },
            ],
          },
        ],
      },
    ];

    const expanded = expandExtraction(raw);

    expect(expanded).toHaveLength(1);
    expect(expanded[0]!.raceNumber).toBe(3);
    expect(expanded[0]!.tips).toHaveLength(1);
    expect(expanded[0]!.tips[0]!.tipsterName).toBe("TONY");
    expect(expanded[0]!.tips[0]!.selections).toHaveLength(2);
    expect(expanded[0]!.tips[0]!.selections[0]!.horseName).toBe("Winx");
    expect(expanded[0]!.tips[0]!.selections[0]!.horseNumber).toBe(5);
    expect(expanded[0]!.tips[0]!.selections[1]!.horseName).toBe("Black Caviar");
  });

  it("clamps invalid race numbers", () => {
    const raw = [{ r: "0", t: [{ n: "X", s: [{ h: "HORSE" }] }] }];
    const expanded = expandExtraction(raw);
    expect(expanded[0]!.raceNumber).toBe(1);
  });

  it("filters empty selections", () => {
    const raw = [{ r: "1", t: [{ n: "X", s: [{ h: "" }] }] }];
    const expanded = expandExtraction(raw);
    expect(expanded).toHaveLength(0); // empty horseName filtered out
  });
});
