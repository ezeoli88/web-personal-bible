import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Verse } from "../../src/core/types/bible";
import type { WordEntry } from "../../src/core/types/ai";
import { SelectionActionBar } from "../../src/web/components/SelectionActionBar";
import { SelectionHeader } from "../../src/web/components/SelectionHeader";
import { VerseItem } from "../../src/web/components/VerseItem";
import { WordList } from "../../src/web/components/WordList";
import { LoginPrompt } from "../../src/web/auth/LoginPrompt";

const verse: Verse = {
  id: "ntv-43-3-16",
  chapterId: "book-43-chapter-3",
  number: 16,
  text: "Porque de tal manera [1] amó.",
};

describe("VerseItem", () => {
  it("selects with a tap, a 400ms press or the keyboard and ignores a text selection", () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const onPress = vi.fn();
    const onEscape = vi.fn();
    const onFootnotePress = vi.fn();
    const view = render(
      <VerseItem
        verse={verse}
        onLongPress={onLongPress}
        onPress={onPress}
        onEscape={onEscape}
        onFootnotePress={onFootnotePress}
      />,
    );
    const row = screen.getByTestId("verse-item");
    fireEvent.pointerDown(row);
    vi.advanceTimersByTime(399);
    expect(onLongPress).not.toHaveBeenCalled();
    fireEvent.pointerUp(row);
    vi.advanceTimersByTime(50);
    expect(onLongPress).not.toHaveBeenCalled();

    fireEvent.pointerDown(row);
    vi.advanceTimersByTime(400);
    expect(onLongPress).toHaveBeenCalledWith(verse);
    // The click that ends a long press does not count twice.
    fireEvent.click(row);
    expect(onLongPress).toHaveBeenCalledOnce();

    fireEvent.click(row);
    expect(onLongPress).toHaveBeenCalledTimes(2);
    expect(onPress).not.toHaveBeenCalled();

    fireEvent.keyDown(row, { key: "Enter" });
    expect(onLongPress).toHaveBeenCalledTimes(3);
    fireEvent.keyDown(row, { key: "Escape" });
    expect(onEscape).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTestId("verse-footnote"));
    expect(onFootnotePress).toHaveBeenCalledOnce();

    view.rerender(
      <VerseItem verse={verse} selectionActive selected onPress={onPress} onLongPress={onLongPress} />,
    );
    vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "amó" } as Selection);
    fireEvent.click(screen.getByTestId("verse-item"));
    expect(onPress).not.toHaveBeenCalled();
    vi.mocked(window.getSelection).mockReturnValue({ toString: () => "" } as Selection);
    fireEvent.click(screen.getByTestId("verse-item"));
    expect(onPress).toHaveBeenCalledWith(verse);
    vi.useRealTimers();
  });
});

describe("SelectionActionBar", () => {
  it("offers compare, share, copy and the AI in one row", () => {
    const actions = { onAskAI: vi.fn(), onCompare: vi.fn(), onShare: vi.fn(), onCopy: vi.fn() };
    const view = render(<SelectionActionBar count={1} {...actions} />);
    fireEvent.click(screen.getByRole("button", { name: "Comparar" }));
    fireEvent.click(screen.getByRole("button", { name: "Compartir" }));
    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    fireEvent.click(screen.getByRole("button", { name: "Preguntar a la IA" }));
    for (const action of Object.values(actions)) expect(action).toHaveBeenCalledOnce();

    view.rerender(<SelectionActionBar count={0} {...actions} />);
    for (const name of ["Comparar", "Compartir", "Copiar", "Preguntar a la IA"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });
});

describe("SelectionHeader", () => {
  it("names the selection and cancels it", () => {
    const onCancel = vi.fn();
    render(<SelectionHeader reference="Juan 3:16, 18" count={2} maxCount={10} translation="NTV" onCancel={onCancel} />);
    expect(screen.getByTestId("selection-header")).toHaveTextContent("Juan 3:16, 18");
    expect(screen.getByTestId("selection-header")).toHaveTextContent("2 de 10 versículos · NTV");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar selección" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe("WordList", () => {
  it("shows the lexicon banner and opens a word", () => {
    const word: WordEntry = {
      tokenId: "JHN.3.16:1",
      spanish: "mundo",
      original: "κόσμον",
      transliteration: "kosmon",
      language: "greek",
      hint: "el mundo",
      reference: "JHN.3.16",
      isKeyword: true,
      strong: "G2889",
      pos: "noun",
    };
    const onWordPress = vi.fn();
    render(<WordList words={[word]} passageReference="Juan 3:16" source="lexicon" onWordPress={onWordPress} />);
    expect(screen.getByText("Texto original y referencias del léxico bíblico")).toBeInTheDocument();
    expect(screen.getByText("✦ Clave")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("word-item"));
    expect(onWordPress).toHaveBeenCalledWith(word);
  });

  it("warns when the words come from the AI fallback", () => {
    const word: WordEntry = {
      spanish: "mundo",
      original: "κόσμον",
      transliteration: "kosmon",
      language: "greek",
      hint: "el mundo",
    };
    render(<WordList words={[word]} passageReference="Juan 3:16" source="llm" onWordPress={vi.fn()} />);
    expect(screen.getByTestId("unverified-words-note")).toBeInTheDocument();
    expect(screen.queryByText("Texto original y referencias del léxico bíblico")).not.toBeInTheDocument();
  });
});

describe("LoginPrompt", () => {
  it("asks the reader to sign in", () => {
    const onLogin = vi.fn();
    render(<LoginPrompt onLogin={onLogin} />);
    expect(screen.getByText("Iniciá sesión para usar la IA")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ingresar con tu correo" }));
    expect(onLogin).toHaveBeenCalledOnce();
  });
});
