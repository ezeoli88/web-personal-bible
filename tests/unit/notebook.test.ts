// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BiblePassage } from "../../src/core/types/ai";
import {
  addNotebookEntry,
  notebookToMarkdown,
  passagePlace,
  readNotebook,
  removeNotebookEntry,
  setNotebookTags,
} from "../../src/web/notebook/notebook";
import { clearUserData, loadUserData } from "../../src/web/userData/userData";
import { fakeUserDataApi, TEST_READER } from "../setup/fakeUserData";

const passage: BiblePassage = {
  reference: "Juan 3:16-17",
  translation: "NTV",
  verses: [
    { id: "ntv-43-3-16", text: "Porque tanto amó Dios al mundo." },
    { id: "ntv-43-3-17", text: "Dios no envió a su Hijo para condenar." },
  ],
};

let api: ReturnType<typeof fakeUserDataApi>;

beforeEach(async () => {
  api = fakeUserDataApi();
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo, init?: RequestInit) => api.handle(input, init) ?? new Response("no", { status: 404 })));
  await loadUserData(TEST_READER);
});

afterEach(() => {
  clearUserData();
  vi.unstubAllGlobals();
});

describe("notebook", () => {
  it("reads the place from the verse ids", () => {
    expect(passagePlace(passage)).toEqual({ bookNumber: 43, chapter: 3, verses: [16, 17] });
    expect(passagePlace({ ...passage, verses: [{ id: "x", text: "y" }] })).toBeNull();
  });

  it("saves entries newest first, once each, and keeps clean tags", async () => {
    const first = addNotebookEntry({ kind: "ai", title: "Reflexión", content: "Dios ama.", passage }, 1)!;
    addNotebookEntry({ kind: "ask", title: "¿Quién?", content: "Dios [16].", passage }, 2);
    addNotebookEntry({ kind: "ai", title: "Reflexión", content: "Dios ama.", passage }, 3);
    expect(readNotebook().map((entry) => entry.title)).toEqual(["¿Quién?", "Reflexión"]);
    expect(readNotebook()[1]).toMatchObject({ id: first.id, translation: "NTV", place: { bookNumber: 43 } });

    setNotebookTags(first.id, ["#Amor", " amor ", "Gracia de Dios", ""]);
    expect(readNotebook()[1].tags).toEqual(["amor", "gracia de dios"]);

    removeNotebookEntry(first.id);
    expect(readNotebook()).toHaveLength(1);
    await vi.waitFor(() => expect(api.data.notebook).toHaveLength(1));
    expect(api.requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
      "GET /api/user-data",
      "POST /api/user-data/notebook",
      "POST /api/user-data/notebook",
      `PATCH /api/user-data/notebook/${first.id}`,
      `DELETE /api/user-data/notebook/${first.id}`,
    ]);
  });

  it("exports Markdown with the verse notes", () => {
    const entry = addNotebookEntry({ kind: "word", title: "Palabra: amó", content: "### ἀγαπάω\nAmor que elige.", passage }, 1)!;
    setNotebookTags(entry.id, ["amor"]);
    const markdown = notebookToMarkdown(readNotebook(), [{ reference: "Juan 3:19", note: "La luz expone.", text: "La luz vino al mundo." }]);
    expect(markdown).toContain("# Cuaderno de estudio");
    expect(markdown).toContain("## Palabra: amó");
    expect(markdown).toContain("*Palabra a fondo · Juan 3:16-17 (NTV)*");
    expect(markdown).toContain("Etiquetas: #amor");
    expect(markdown).toContain("**Juan 3:19** — La luz expone.");
  });
});
