import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { ServiceWorkerRegister } from "./ServiceWorkerRegister";

function withServiceWorker(register: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "serviceWorker", {
    value: { register },
    configurable: true,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  // Remove the stub so it can't leak between tests.
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("ServiceWorkerRegister", () => {
  it("renders nothing", () => {
    const { container } = render(<ServiceWorkerRegister />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not register outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    const register = vi.fn().mockResolvedValue({});
    withServiceWorker(register);
    render(<ServiceWorkerRegister />);
    expect(register).not.toHaveBeenCalled();
  });

  it("registers /sw.js in production when supported", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const register = vi.fn().mockResolvedValue({});
    withServiceWorker(register);
    render(<ServiceWorkerRegister />);
    await vi.waitFor(() =>
      expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" }),
    );
  });
});
