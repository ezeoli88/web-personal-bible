import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DatabaseProvider, useBibleRepository } from "../../src/core/hooks/DatabaseProvider";
import { ThemeProvider, useTheme } from "../../src/core/providers/ThemeProvider";
import { darkTheme, lightTheme } from "../../src/core/theme";
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
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(darkTheme.colors.background);
    await user.click(screen.getByTestId("theme-toggle"));
    expect(screen.getByText("light")).toBeInTheDocument();
    expect(localStorage.getItem("theme-mode")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(lightTheme.colors.background);
  });

  it("toggles light ↔ dark, opts out of forced dark and remembers the choice", async () => {
    const user = userEvent.setup();
    const colorScheme = () => document.querySelector('meta[name="color-scheme"]')?.getAttribute("content");
    const { unmount } = render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    const toggle = screen.getByTestId("theme-toggle");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(colorScheme()).toBe("only light");
    expect(toggle).toHaveAccessibleName("Activar tema oscuro");

    await user.click(toggle);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(colorScheme()).toBe("only dark");
    expect(toggle).toHaveAccessibleName("Activar tema claro");

    await user.click(toggle);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(colorScheme()).toBe("only light");
    expect(localStorage.getItem("theme-mode")).toBe("light");

    await user.click(toggle);
    unmount();
    document.documentElement.dataset.theme = "light";
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(colorScheme()).toBe("only dark");
    expect(screen.getByTestId("theme-toggle")).toHaveAccessibleName("Activar tema claro");
  });
});

describe("fresh query client", () => {
  it("does not refetch on window focus", () => {
    const client = createAppQueryClient();
    expect(client.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false);
  });
});
