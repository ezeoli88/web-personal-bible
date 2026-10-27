// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  readAnnotations,
  removeAnnotationPart,
  updateAnnotations,
  type AnnotationTarget,
} from "../../src/web/annotations/annotations";

const john316: AnnotationTarget = { bookNumber: 43, chapter: 3, verse: 16, text: "Pues Dios amó tanto al mundo", translation: "NTV" };
const john317: AnnotationTarget = { bookNumber: 43, chapter: 3, verse: 17, text: "Dios no envió a su Hijo", translation: "NTV" };

afterEach(() => localStorage.clear());

describe("verse annotations", () => {
  it("keeps highlight, bookmark and note on the same verse and drops a verse left empty", () => {
    updateAnnotations([john316, john317], { highlight: "yellow" }, 1);
    updateAnnotations([john316], { bookmarked: true }, 2);
    updateAnnotations([john316], { note: "  Amor que da  " }, 3);
    expect(readAnnotations()["43:3:16"]).toMatchObject({ highlight: "yellow", bookmarked: true, note: "Amor que da", updatedAt: 3 });

    updateAnnotations([john317], { highlight: null });
    expect(readAnnotations()["43:3:17"]).toBeUndefined();

    removeAnnotationPart(john316, "note");
    removeAnnotationPart(john316, "bookmarked");
    expect(readAnnotations()["43:3:16"]).toMatchObject({ highlight: "yellow" });
    expect(readAnnotations()["43:3:16"].note).toBeUndefined();
    removeAnnotationPart(john316, "highlight");
    expect(readAnnotations()).toEqual({});
  });

  it("is shared by every translation of the same verse", () => {
    updateAnnotations([john316], { bookmarked: true });
    updateAnnotations([{ ...john316, translation: "RV1960", text: "Porque de tal manera amó Dios al mundo" }], { highlight: "blue" });
    expect(readAnnotations()["43:3:16"]).toMatchObject({ bookmarked: true, highlight: "blue", translation: "RV1960" });
  });

  it("ignores damaged or unknown stored entries", () => {
    localStorage.setItem("verse-annotations", JSON.stringify([
      { bookNumber: 43, chapter: 3, verse: 16, text: "x", translation: "NTV", highlight: "purple" },
      { bookNumber: 0, chapter: 3, verse: 16, text: "x", translation: "NTV", bookmarked: true },
      { bookNumber: 43, chapter: 3, verse: 18, text: "x", translation: "XYZ", bookmarked: true },
      { bookNumber: 43, chapter: 3, verse: 19, text: "x", translation: "LBLA", note: "ok", updatedAt: 5 },
    ]));
    expect(Object.keys(readAnnotations())).toEqual(["43:3:19"]);
    localStorage.setItem("verse-annotations", "{not json");
    expect(readAnnotations()).toEqual({});
  });
});
