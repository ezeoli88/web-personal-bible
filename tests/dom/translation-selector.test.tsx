import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DatabaseProvider } from "../../src/core/hooks/DatabaseProvider";
import { createAppQueryClient } from "../../src/core/providers/QueryProvider";
import { TranslationSelector } from "../../src/web/components/TranslationSelector";

function renderSelector() {
  return render(
    <QueryClientProvider client={createAppQueryClient()}>
      <DatabaseProvider>
        <TranslationSelector />
      </DatabaseProvider>
    </QueryClientProvider>,
  );
}

describe("TranslationSelector", () => {
  it("opens an accessible modal sheet with the current translation selected and focused", async () => {
    const user = userEvent.setup();
    renderSelector();
    const trigger = screen.getByTestId("translation-select");
    await user.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Elegí una traducción" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const current = within(dialog).getByRole("option", { selected: true });
    expect(current).toBe(screen.getByTestId("translation-option-NTV"));
    expect(current).toHaveFocus();
  });

  it("selects a translation, closes and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderSelector();
    const trigger = screen.getByTestId("translation-select");
    await user.click(trigger);
    await user.click(screen.getByTestId("translation-option-RV1960"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveTextContent("RV1960");
    expect(trigger).toHaveFocus();
    expect(localStorage.getItem("bible-translation")).toBe("RV1960");
  });

  it("closes with Escape, the backdrop and the close button", async () => {
    const user = userEvent.setup();
    renderSelector();
    const trigger = screen.getByTestId("translation-select");

    await user.click(trigger);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(screen.getByTestId("translation-select-backdrop"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveTextContent("NTV");
  });

  it("keeps Tab focus inside the sheet", async () => {
    const user = userEvent.setup();
    renderSelector();
    await user.click(screen.getByTestId("translation-select"));
    const dialog = screen.getByRole("dialog");
    const options = within(dialog).getAllByRole("option");
    options[options.length - 1]!.focus();

    await user.tab();
    expect(within(dialog).getByRole("button", { name: "Cerrar" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(options[options.length - 1]).toHaveFocus();
  });
});
