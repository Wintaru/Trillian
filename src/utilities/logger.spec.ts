import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as logger from "./logger.js";

describe("logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    logger.setLevel("INFO");
  });

  it("should log info at INFO level", () => {
    logger.setLevel("INFO");
    logger.info("test message");
    expect(console.log).toHaveBeenCalledTimes(1);
  });

  it("should not log info at WARN level", () => {
    logger.setLevel("WARN");
    logger.info("test message");
    expect(console.log).not.toHaveBeenCalled();
  });

  it("should not log info at ERROR level", () => {
    logger.setLevel("ERROR");
    logger.info("test message");
    expect(console.log).not.toHaveBeenCalled();
  });

  it("should log debug at DEBUG level", () => {
    logger.setLevel("DEBUG");
    logger.debug("verbose detail");
    expect(console.log).toHaveBeenCalledTimes(1);
  });

  it("should not log debug at INFO level", () => {
    logger.setLevel("INFO");
    logger.debug("verbose detail");
    expect(console.log).not.toHaveBeenCalled();
  });

  it("should always log errors regardless of level", () => {
    logger.setLevel("ERROR");
    logger.error("bad thing");
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("should log warn at WARN level", () => {
    logger.setLevel("WARN");
    logger.warn("heads up");
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("should not log warn at ERROR level", () => {
    logger.setLevel("ERROR");
    logger.warn("heads up");
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("should include timestamp, PID, and level in output", () => {
    logger.setLevel("INFO");
    logger.info("test");
    const call = vi.mocked(console.log).mock.calls[0][0] as string;
    expect(call).toMatch(/\[\d{4}-\d{2}-\d{2}T/);
    expect(call).toContain("[PID:");
    expect(call).toContain("[INFO]");
  });
});
