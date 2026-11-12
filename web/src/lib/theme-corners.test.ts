import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyCornerOverrides,
  getCornerOverrides,
  MAX_CORNER_RADIUS,
  setCornerOverride,
} from "./theme-corners";

const stored = new Map<string, string>();
const cssVars = new Map<string, string>();

const fakeStorage = {
  clear: () => stored.clear(),
  getItem: (key: string) => stored.get(key) ?? null,
  key: (index: number) => [...stored.keys()][index] ?? null,
  get length() {
    return stored.size;
  },
  removeItem: (key: string) => stored.delete(key),
  setItem: (key: string, value: string) => stored.set(key, value),
};

const fakeStyle = {
  getPropertyValue: (name: string) => cssVars.get(name) ?? "",
  removeProperty: (name: string) => cssVars.delete(name),
  setProperty: (name: string, value: string) => cssVars.set(name, value),
};

describe("theme corner overrides", () => {
  beforeEach(() => {
    stored.clear();
    cssVars.clear();
    vi.stubGlobal("localStorage", fakeStorage);
    vi.stubGlobal("document", { documentElement: { style: fakeStyle } });
    // Reset module state so each case starts from "follow the theme".
    setCornerOverride("button", null);
    setCornerOverride("container", null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clamps a value into the usable range instead of passing it through", () => {
    setCornerOverride("button", 999);
    expect(getCornerOverrides().button).toBe(MAX_CORNER_RADIUS);

    setCornerOverride("button", -8);
    expect(getCornerOverrides().button).toBe(0);
  });

  it("drives the per-surface CSS variables separately", () => {
    setCornerOverride("button", 3);
    setCornerOverride("container", 12);

    expect(cssVars.get("--theme-radius-button")).toBe("3px");
    expect(cssVars.get("--theme-radius-container")).toBe("12px");
  });

  it("clearing an override hands the corner back to the theme", () => {
    setCornerOverride("container", 14);
    expect(cssVars.get("--theme-radius-container")).toBe("14px");

    setCornerOverride("container", null);
    expect(cssVars.has("--theme-radius-container")).toBe(false);
  });

  it("re-applies the stored values after a reload", () => {
    setCornerOverride("button", 5);
    cssVars.clear();

    applyCornerOverrides();

    expect(cssVars.get("--theme-radius-button")).toBe("5px");
    expect(JSON.parse(stored.get("hermes-theme-corners") ?? "{}")).toEqual({
      button: 5,
      container: null,
    });
  });
});
