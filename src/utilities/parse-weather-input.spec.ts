import { describe, it, expect, vi, afterEach } from "vitest";
import { parseWeatherInput } from "./parse-weather-input.js";

describe("parseWeatherInput", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return raw input as location when no date is found", () => {
    const result = parseWeatherInput("Chicago, IL");
    expect(result.location).toBe("Chicago, IL");
    expect(result.targetDate).toBeUndefined();
  });

  it("should parse 'next tuesday' and extract the location", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 10)); // Tuesday March 10, 2026

    const result = parseWeatherInput("Chicago next tuesday");
    expect(result.location).toBe("Chicago");
    expect(result.targetDate).toBeDefined();
    expect(result.targetDate!.getDay()).toBe(2); // Tuesday
  });

  it("should parse 'this saturday' and extract the location", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 10));

    const result = parseWeatherInput("90210 this saturday");
    expect(result.location).toBe("90210");
    expect(result.targetDate).toBeDefined();
    expect(result.targetDate!.getDay()).toBe(6); // Saturday
  });

  it("should parse 'friday' after the location", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 10));

    const result = parseWeatherInput("Denver friday");
    expect(result.location).toBe("Denver");
    expect(result.targetDate).toBeDefined();
    expect(result.targetDate!.getDay()).toBe(5); // Friday
  });

  it("should return empty location when input is only a date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 10));

    const result = parseWeatherInput("next wednesday");
    expect(result.location).toBe("");
    expect(result.targetDate).toBeDefined();
  });

  it("should return trimmed location for whitespace-only input", () => {
    const result = parseWeatherInput("   ");
    expect(result.location).toBe("");
    expect(result.targetDate).toBeUndefined();
  });

  it("should return empty results for empty input", () => {
    const result = parseWeatherInput("");
    expect(result.location).toBe("");
    expect(result.targetDate).toBeUndefined();
  });
});
