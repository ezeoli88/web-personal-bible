import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstallAppButton } from "../../src/web/pwa/InstallAppButton";
import { resetInstallPromptForTests } from "../../src/web/pwa/installPrompt";

const originalMatchMedia = window.matchMedia;

function dispatchInstallPrompt(prompt = vi.fn(async () => {}), outcome: "accepted" | "dismissed" = "accepted") {
  const event = new Event("beforeinstallprompt", { cancelable: true });
  Object.assign(event, {
    prompt,
    userChoice: Promise.resolve({ outcome, platform: "web" }),
  });
  const followed = window.dispatchEvent(event);
  return { prompt, followed };
}

beforeEach(() => {
  resetInstallPromptForTests();
});

afterEach(() => {
  if (originalMatchMedia) window.matchMedia = originalMatchMedia;
  else Reflect.deleteProperty(window, "matchMedia");
});

describe("InstallAppButton", () => {
  it("stays hidden until the browser offers to install", () => {
    render(<InstallAppButton />);
    expect(screen.queryByRole("button", { name: "Instalar app" })).not.toBeInTheDocument();
  });

  it("shows a discreet button and prompts from the click", async () => {
    const user = userEvent.setup();
    render(<InstallAppButton />);
    const { prompt, followed } = dispatchInstallPrompt();
    expect(followed).toBe(false);
    await user.click(await screen.findByRole("button", { name: "Instalar app" }));
    expect(prompt).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Instalar app" })).not.toBeInTheDocument();
    });
  });

  it("hides when the app is already installed", async () => {
    window.matchMedia = ((query: string) => ({
      matches: query === "(display-mode: standalone)",
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
    })) as typeof window.matchMedia;
    render(<InstallAppButton />);
    const { followed } = dispatchInstallPrompt();
    expect(followed).toBe(false);
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Instalar app" })).not.toBeInTheDocument();
    });
  });

  it("hides after the browser reports the app was installed", async () => {
    render(<InstallAppButton />);
    dispatchInstallPrompt();
    expect(await screen.findByRole("button", { name: "Instalar app" })).toBeInTheDocument();
    window.dispatchEvent(new Event("appinstalled"));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Instalar app" })).not.toBeInTheDocument();
    });
  });
});
