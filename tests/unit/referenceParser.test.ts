import { describe, expect, it } from "vitest";
import { parseReference } from "../../src/core/lib/referenceParser";

function describeReference(input: string): string | null {
  const parsed = parseReference(input);
  if (!parsed) return null;
  const chapter = parsed.chapter === undefined ? "" : ` ${parsed.chapter}`;
  const verses = parsed.verses ? `:${parsed.verses[0]}${parsed.verses.length > 1 ? `-${parsed.verses.at(-1)}` : ""}` : "";
  return `${parsed.book.name}${chapter}${verses}`;
}

describe("parseReference", () => {
  it.each([
    ["Jn 3:16", "Juan 3:16"],
    ["juan 3,16", "Juan 3:16"],
    ["Juan", "Juan"],
    ["1 cor 13", "1 Corintios 13"],
    ["1cor13", "1 Corintios 13"],
    ["1 Co. 13:4-7", "1 Corintios 13:4-7"],
    ["sal 23", "Salmos 23"],
    ["Gén 1:1", "Génesis 1:1"],
    ["fil 4:13", "Filipenses 4:13"],
    ["filem 4", "Filemón 1:4"],
    ["Judas 3", "Judas 1:3"],
    ["3 juan 4", "3 Juan 1:4"],
    ["1 juan 4:8", "1 Juan 4:8"],
    ["cantar de los cantares 2", "Cantares 2"],
    ["apoc 21", "Apocalipsis 21"],
    ["mt 5:3-12", "Mateo 5:3-12"],
  ])("reads %s as %s", (input, expected) => {
    expect(describeReference(input)).toBe(expected);
  });

  it.each(["", "zz 1", "fi 1", "jo 1", "juan 22", "juan 3:5-2", "juan 0", "1"])("rejects %j", (input) => {
    expect(parseReference(input)).toBeNull();
  });
});
