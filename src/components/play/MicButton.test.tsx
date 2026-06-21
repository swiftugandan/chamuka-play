import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MicButton } from "./MicButton";

/** Controllable stand-in for the browser SpeechRecognition (absent in jsdom). */
class FakeRecognition {
  static last: FakeRecognition | null = null;
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: ((e: { results: ArrayLike<unknown> }) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();
  constructor() {
    FakeRecognition.last = this;
  }
  emit(transcript: string, isFinal: boolean) {
    this.onresult?.({ results: [{ 0: { transcript }, isFinal }] });
  }
}

describe("MicButton", () => {
  beforeEach(() => {
    FakeRecognition.last = null;
  });
  afterEach(() => {
    // @ts-expect-error test cleanup of the injected global
    delete window.SpeechRecognition;
    // @ts-expect-error test cleanup of the injected global
    delete window.webkitSpeechRecognition;
  });

  function withSpeech() {
    // @ts-expect-error injecting the API jsdom lacks
    window.SpeechRecognition = FakeRecognition;
  }

  it("renders nothing where speech is unsupported", () => {
    const { container } = render(<MicButton value="" onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("appends spoken words onto text already in the field", () => {
    withSpeech();
    const onChange = vi.fn();
    render(<MicButton value="a cat" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Talk to type" }));
    FakeRecognition.last?.emit("that jumps", true);

    expect(onChange).toHaveBeenLastCalledWith("a cat that jumps");
  });

  it("sets the spoken words directly when the field is empty", () => {
    withSpeech();
    const onChange = vi.fn();
    render(<MicButton value="" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Talk to type" }));
    FakeRecognition.last?.emit("pop the balloons", true);

    expect(onChange).toHaveBeenLastCalledWith("pop the balloons");
  });

  it("does not start listening when disabled", () => {
    withSpeech();
    render(<MicButton value="" onChange={() => {}} disabled />);

    fireEvent.click(screen.getByRole("button", { name: "Talk to type" }));
    expect(FakeRecognition.last).toBeNull();
  });
});
