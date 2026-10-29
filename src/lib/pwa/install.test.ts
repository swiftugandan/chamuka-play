import { describe, it, expect, afterEach } from "vitest";
import { installMode, isStandalone } from "./install";

const env = (userAgent: string, extra: Partial<Parameters<typeof installMode>[0]> = {}) =>
  installMode({ standalone: false, canPrompt: false, userAgent, maxTouchPoints: 0, ...extra });

const UA = {
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  ipad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  android:
    "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36",
  chromeDesktop:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
  firefoxDesktop: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0",
};

describe("installMode", () => {
  it("knows when it's already an installed app", () => {
    expect(env(UA.android, { standalone: true, canPrompt: true })).toBe("installed");
  });

  it("prefers the browser's own prompt when it offered one", () => {
    expect(env(UA.chromeDesktop, { canPrompt: true })).toBe("prompt");
  });

  it("explains Share → Add to Home Screen on iPhone and iPad", () => {
    expect(env(UA.iphone)).toBe("ios");
    expect(env(UA.ipad, { maxTouchPoints: 5 })).toBe("ios"); // iPadOS reports as a Mac
  });

  it("points Safari on a Mac to Add to Dock", () => {
    expect(env(UA.ipad, { maxTouchPoints: 0 })).toBe("safari-mac");
  });

  it("falls back to the browser menu where installing is possible", () => {
    expect(env(UA.android)).toBe("manual");
    expect(env(UA.chromeDesktop)).toBe("manual");
  });

  it("offers nothing where web apps can't be installed", () => {
    expect(env(UA.firefoxDesktop)).toBe("unsupported");
  });
});

describe("isStandalone", () => {
  const realMatchMedia = window.matchMedia;
  function displayMode(mode: "browser" | "standalone" | "fullscreen") {
    window.matchMedia = ((query: string) =>
      ({ matches: query === `(display-mode: ${mode})` }) as MediaQueryList) as typeof window.matchMedia;
  }
  function elementFullscreen(on: boolean) {
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => (on ? document.body : null),
    });
  }
  afterEach(() => {
    window.matchMedia = realMatchMedia;
    delete (document as { fullscreenElement?: Element | null }).fullscreenElement;
  });

  it("is an app when installed as one, standalone or full screen", () => {
    displayMode("standalone");
    expect(isStandalone()).toBe(true);
    displayMode("fullscreen"); // a game app opens full screen
    expect(isStandalone()).toBe(true);
  });

  it("isn't an app in a browser tab, even with the game full screen", () => {
    displayMode("browser");
    expect(isStandalone()).toBe(false);
    displayMode("fullscreen");
    elementFullscreen(true); // the Full screen button, not an installed app
    expect(isStandalone()).toBe(false);
  });
});
