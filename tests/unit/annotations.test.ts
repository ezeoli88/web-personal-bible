// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readAnnotations,
  removeAnnotationPart,
  updateAnnotations,
  type AnnotationTarget,
} from "../../src/web/annotations/annotations";
import { clearUserData, loadUserData } from "../../src/web/userData/userData";
import { fakeUserDataApi, TEST_READER } from "../setup/fakeUserData";

const john316: AnnotationTarget = { bookNumber: 43, chapter: 3, verse: 16, text: "Pues Dios amó tanto al mundo", translation: "NTV" };
const john317: AnnotationTarget = { bookNumber: 43, chapter: 3, verse: 17, text: "Dios no envió a su Hijo", translation: "NTV" };

let api: ReturnType<typeof fakeUserDataApi>;

async function signIn(initial?: Parameters<typeof fakeUserDataApi>[0]) {
  api = fakeUserDataApi(initial);
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo, init?: RequestInit) => api.handle(input, init) ?? new Response("no", { status: 404 })));
  await loadUserData(TEST_READER);
}

beforeEach(() => signIn());

afterEach(() => {
  clearUserData();
  vi.unstubAllGlobals();
  localStorage.clear();
});

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

  it("saves every change in the account", async () => {
    updateAnnotations([john316, john317], { highlight: "green" }, 1);
    updateAnnotations([john317], { highlight: null }, 2);
    await vi.waitFor(() => expect(api.requests).toHaveLength(3));
    expect(api.requests[1]).toMatchObject({ method: "POST", path: "/api/user-data/annotations", body: { remove: [] } });
    expect(api.requests[2].body).toEqual({ upsert: [], remove: [{ bookNumber: 43, chapter: 3, verse: 17 }] });
    expect(api.data.annotations).toEqual([expect.objectContaining({ verse: 16, highlight: "green" })]);
  });

  it("does nothing while signed out", () => {
    clearUserData();
    updateAnnotations([john316], { bookmarked: true });
    expect(readAnnotations()).toEqual({});
  });

  it("ignores damaged or unknown entries from the server", async () => {
    await signIn({ annotations: [
      { bookNumber: 43, chapter: 3, verse: 16, text: "x", translation: "NTV", highlight: "purple" },
      { bookNumber: 0, chapter: 3, verse: 16, text: "x", translation: "NTV", bookmarked: true },
      { bookNumber: 43, chapter: 3, verse: 18, text: "x", translation: "XYZ", bookmarked: true },
      { bookNumber: 43, chapter: 3, verse: 19, text: "x", translation: "LBLA", note: "ok", updatedAt: 5 },
    ] });
    expect(Object.keys(readAnnotations())).toEqual(["43:3:19"]);
  });

  it("uploads marks left on the device once and removes them there", async () => {
    clearUserData();
    localStorage.setItem("verse-annotations", JSON.stringify([
      { bookNumber: 43, chapter: 3, verse: 16, text: "x", translation: "NTV", bookmarked: true, updatedAt: 1 },
    ]));
    await signIn();
    expect(api.requests[0]).toMatchObject({ method: "POST", path: "/api/user-data/import" });
    expect(readAnnotations()["43:3:16"]).toMatchObject({ bookmarked: true });
    expect(localStorage.getItem("verse-annotations")).toBeNull();
  });
});
