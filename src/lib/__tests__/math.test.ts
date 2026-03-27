import { describe, it, expect } from "vitest";
import { median, stddev } from "../math";

describe("median", () => {
  it("returns 0 for empty array", () => {
    expect(median([])).toBe(0);
  });

  it("returns the single value for array of one", () => {
    expect(median([42])).toBe(42);
  });

  it("returns middle value for odd-length array", () => {
    expect(median([1, 3, 5])).toBe(3);
  });

  it("returns average of two middle values for even-length array", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("handles unsorted input", () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it("does not mutate input array", () => {
    const input = [5, 1, 3];
    median(input);
    expect(input).toEqual([5, 1, 3]);
  });
});

describe("stddev", () => {
  it("returns 0 for empty array", () => {
    expect(stddev([])).toBe(0);
  });

  it("returns 0 for single value", () => {
    expect(stddev([42])).toBe(0);
  });

  it("returns 0 for identical values", () => {
    expect(stddev([5, 5, 5, 5])).toBe(0);
  });

  it("calculates sample standard deviation", () => {
    // [2, 4, 4, 4, 5, 5, 7, 9] → mean=5, sample stddev≈2.14
    const result = stddev([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(result).toBeCloseTo(2.138, 2);
  });

  it("handles two values", () => {
    // [0, 10] → mean=5, sample variance=50, stddev≈7.07
    const result = stddev([0, 10]);
    expect(result).toBeCloseTo(7.071, 2);
  });
});
