import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BiblePassage } from "../../src/core/types/ai";
import { PassageReading } from "../../src/web/components/PassageReading";
import { StreamingText } from "../../src/web/components/StreamingText";

const passage: BiblePassage = {
  reference: "Juan 3:16-17",
  translation: "NTV",
  verses: [
    { id: "ntv-43-3-16", text: "Porque tanto amó Dios al mundo[1] que dio a su único Hijo." },
    { id: "ntv-43-3-17", text: "Dios no envió a su Hijo al mundo para condenarlo." },
  ],
};

afterEach(() => {
  vi.useRealTimers();
});

describe("PassageReading", () => {
  it("shows the verses without footnote markers and a slow notice after 8 seconds", () => {
    vi.useFakeTimers();
    render(<PassageReading passage={passage} status="Consultando sobre reflexión..." />);
    expect(screen.getByRole("status")).toHaveTextContent("Consultando sobre reflexión...");
    expect(screen.getByText("Juan 3:16-17 · NTV")).toBeInTheDocument();
    const reading = screen.getByTestId("passage-reading");
    expect(reading).toHaveTextContent("16Porque tanto amó Dios al mundo que dio a su único Hijo.");
    expect(reading).toHaveTextContent("17Dios no envió a su Hijo al mundo para condenarlo.");
    expect(reading).not.toHaveTextContent("[1]");

    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Está tardando más de lo normal. Seguimos esperando la respuesta…");
  });
});

describe("StreamingText", () => {
  it("formats markdown while streaming and hides unclosed markers on the last line", () => {
    const { container, rerender } = render(<StreamingText text={"Hola **x** y\n**inc"} isStreaming />);
    expect(container.querySelector("[class*='bold']")).toHaveTextContent(/^x$/);
    expect(container).not.toHaveTextContent("*");
    expect(container).toHaveTextContent("inc");
    expect(screen.getByTestId("streaming-caret")).toBeInTheDocument();

    rerender(<StreamingText text={"Hola **x** y\n##"} isStreaming />);
    expect(container).not.toHaveTextContent("#");
    expect(screen.getByTestId("streaming-caret")).toBeInTheDocument();

    rerender(<StreamingText text={"Hola **x** y\n## Fin"} isStreaming={false} />);
    expect(screen.getByText("Fin").className).toMatch(/heading/);
    expect(screen.queryByTestId("streaming-caret")).not.toBeInTheDocument();
  });
});
