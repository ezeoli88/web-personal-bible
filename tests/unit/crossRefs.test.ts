import { describe, expect, it } from "vitest";
import { convertOpenBible, MAX_PER_VERSE } from "../../src/core/crossRefs/openBible";

const SAMPLE = [
  "From Verse\tTo Verse\tVotes\t#www.openbible.info CC-BY 2024-01-01",
  "John.3.16\tRom.5.8\t95",
  "John.3.16\t1John.4.9-1John.4.10\t120",
  "John.3.16\tProv.8.22-Prov.8.30\t3",
  "John.3.16\tJohn.1.1-John.2.11\t2",
  "John.3.16\tGen.1.1\t-4",
  "John.3.16\tRom.5.8-Gal.1.1\t40",
  "Gen.1.1\tJohn.1.1\t200",
  "Foo.1.1\tGen.1.1\t10",
  "",
].join("\n");

describe("convertOpenBible", () => {
  it("groups by book and verse, most voted first, and drops bad or downvoted rows", () => {
    const books = convertOpenBible(SAMPLE);
    expect(books.get(43)).toEqual({
      "3:16": [
        [62, 4, 9, 4, 10, 120],
        [45, 5, 8, 0, 0, 95],
        [20, 8, 22, 8, 30, 3],
        [43, 1, 1, 2, 11, 2],
      ],
    });
    expect(books.get(1)).toEqual({ "1:1": [[43, 1, 1, 0, 0, 200]] });
    expect([...books.keys()].sort()).toEqual([1, 43]);
  });

  it("keeps at most MAX_PER_VERSE connections per verse", () => {
    const rows = Array.from({ length: MAX_PER_VERSE + 5 }, (_, index) => `Gen.1.1\tPs.${index + 1}.1\t${index + 1}`);
    const verse = convertOpenBible(rows.join("\n")).get(1)?.["1:1"] ?? [];
    expect(verse).toHaveLength(MAX_PER_VERSE);
    expect(verse[0]).toEqual([19, MAX_PER_VERSE + 5, 1, 0, 0, MAX_PER_VERSE + 5]);
  });
});
