import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatabaseProvider, useBibleRepository } from "../../src/core/hooks/DatabaseProvider";
import { ThemeProvider, useTheme } from "../../src/core/providers/ThemeProvider";
import { darkTheme, lightTheme } from "../../src/core/theme";
import { createAppQueryClient } from "../../src/core/providers/QueryProvider";
import { ReadingSettings } from "../../src/web/components/ReadingSettings";

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

function renderTheme() {
  return render(
    <ThemeProvider>
      <ThemeProbe />
      <ReadingSettings />
    </ThemeProvider>,
  );
}

function stubSystemTheme(dark: boolean) {
  let matches = dark;
  const listeners = new Set<() => void>();
  const query = {
    get matches() { return matches; },
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal("matchMedia", vi.fn(() => query));
  return (next: boolean) => {
    matches = next;
    act(() => listeners.forEach((listener) => listener()));
  };
}

describe("ThemeProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.style.removeProperty("--font-body-size");
    document.documentElement.style.removeProperty("--font-body-line-height");
  });

  it("defaults to light, applies a stored dark theme and persists a new choice", async () => {
    const user = userEvent.setup();
    const colorScheme = () => document.querySelector('meta[name="color-scheme"]')?.getAttribute("content");
    const { unmount } = renderTheme();
    expect(screen.getByText("light")).toBeInTheDocument();
    expect(colorScheme()).toBe("only light");
    unmount();

    localStorage.setItem("theme-mode", "dark");
    renderTheme();
    expect(screen.getByText("dark")).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(colorScheme()).toBe("only dark");
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(darkTheme.colors.background);

    await user.click(screen.getByTestId("reading-settings"));
    await user.click(screen.getByRole("radio", { name: "Claro" }));
    expect(screen.getByText("light")).toBeInTheDocument();
    expect(localStorage.getItem("theme-mode")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(lightTheme.colors.background);
  });

  it("follows the system theme while Sistema is selected", async () => {
    const user = userEvent.setup();
    const setSystemDark = stubSystemTheme(true);
    renderTheme();
    await user.click(screen.getByTestId("reading-settings"));
    await user.click(screen.getByRole("radio", { name: "Sistema" }));
    expect(localStorage.getItem("theme-mode")).toBe("system");
    expect(screen.getByRole("radio", { name: "Sistema" })).toBeChecked();
    expect(document.documentElement.dataset.theme).toBe("dark");

    setSystemDark(false);
    expect(document.documentElement.dataset.theme).toBe("light");
    await user.click(screen.getByRole("radio", { name: "Oscuro" }));
    setSystemDark(false);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("changes and remembers the reading text size", async () => {
    const user = userEvent.setup();
    const bodySize = () => document.documentElement.style.getPropertyValue("--font-body-size");
    const { unmount } = renderTheme();
    await user.click(screen.getByTestId("reading-settings"));
    expect(screen.getByTestId("font-scale")).toHaveTextContent("100%");
    await user.click(screen.getByRole("button", { name: "Agrandar la letra" }));
    expect(screen.getByTestId("font-scale")).toHaveTextContent("113%");
    expect(bodySize()).toBe("20.25px");
    expect(localStorage.getItem("font-scale")).toBe("1.125");
    unmount();

    document.documentElement.style.removeProperty("--font-body-size");
    renderTheme();
    expect(bodySize()).toBe("20.25px");
    await user.click(screen.getByTestId("reading-settings"));
    await user.click(screen.getByRole("button", { name: "Achicar la letra" }));
    expect(bodySize()).toBe("");
    await user.click(screen.getByRole("button", { name: "Achicar la letra" }));
    expect(screen.getByRole("button", { name: "Achicar la letra" })).toBeDisabled();
    expect(bodySize()).toBe("15.75px");
  });
});

describe("fresh query client", () => {
  it("does not refetch on window focus", () => {
    const client = createAppQueryClient();
    expect(client.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false);
  });
});
