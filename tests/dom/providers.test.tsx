import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DatabaseProvider, useBibleRepository } from "../../src/core/hooks/DatabaseProvider";
import { ThemeProvider, useTheme } from "../../src/core/providers/ThemeProvider";
import { createAppQueryClient } from "../../src/core/providers/QueryProvider";
import { ThemeToggle } from "../../src/web/components/ThemeToggle";

function TranslationProbe() {
  const { translation, setTranslation } = useBibleRepository();
  return <button type="button" onClick={() => void setTranslation("RV1960")}>{translation}</button>;
}

function ThemeProbe() {
  const { mode } = useTheme();
  return <span>{mode}</span>;
}

describe("DatabaseProvider", () => {
  it("stores a validated translation in localStorage", async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={createAppQueryClient()}>
        <DatabaseProvider>
          <TranslationProbe />
        </DatabaseProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByRole("button")).toHaveTextContent("NTV");
    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveTextContent("RV1960");
    expect(localStorage.getItem("bible-translation")).toBe("RV1960");
  });
});

describe("ThemeProvider", () => {
  it("defaults to light and persists the toggle", async () => {
    const user = userEvent.setup();
    localStorage.setItem("theme-mode", "dark");
    render(
      <ThemeProvider>
        <ThemeProbe />
        <ThemeToggle />
      </ThemeProvider>,
    );
    expect(screen.getByText("dark")).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe("dark");
    await user.click(screen.getByTestId("theme-toggle"));
    expect(screen.getByText("light")).toBeInTheDocument();
    expect(localStorage.getItem("theme-mode")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

describe("fresh query client", () => {
  it("does not refetch on window focus", () => {
    const client = createAppQueryClient();
    expect(client.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false);
  });
});
