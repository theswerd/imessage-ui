import { describe, expect, test } from "bun:test";
import { dateSeparatorMetrics, formatClockTime, formatDateLabel } from "../../registry/imessage/date-separator";

/**
 * The header's wording rules, from references/SPEC.md: Today / Yesterday / a weekday inside the week /
 * an absolute date beyond it, joined to the time by " at ". Apple sets a narrow no-break space (U+202F)
 * between the minutes and AM/PM; a plain space would wrap and measure wider.
 */
const NNBSP = " ";
/** Tuesday, September 8 2026, 9:41 AM local time (the fixture "now"). */
const at = (year: number, month: number, day: number, hours = 9, minutes = 41) => new Date(year, month - 1, day, hours, minutes);
const now = at(2026, 9, 8);

describe("formatClockTime", () => {
  test("uses a 12-hour clock with a narrow no-break space before AM/PM", () => {
    expect(formatClockTime(at(2026, 9, 8, 9, 41))).toBe(`9:41${NNBSP}AM`);
    expect(formatClockTime(at(2026, 9, 8, 13, 5))).toBe(`1:05${NNBSP}PM`);
    expect(formatClockTime(at(2026, 9, 8, 9, 41))).not.toContain(" ");
  });

  test("midnight and noon are 12, and minutes are always two digits", () => {
    expect(formatClockTime(at(2026, 9, 8, 0, 0))).toBe(`12:00${NNBSP}AM`);
    expect(formatClockTime(at(2026, 9, 8, 12, 0))).toBe(`12:00${NNBSP}PM`);
    expect(formatClockTime(at(2026, 9, 8, 0, 7))).toBe(`12:07${NNBSP}AM`);
    expect(formatClockTime(at(2026, 9, 8, 23, 59))).toBe(`11:59${NNBSP}PM`);
  });

  test("accepts a timestamp as well as a Date", () => {
    const date = at(2026, 9, 8, 1, 25);
    expect(formatClockTime(date.getTime())).toBe(formatClockTime(date));
  });
});

describe("formatDateLabel", () => {
  test("today keeps the day name and joins it with a plain space", () => {
    const label = formatDateLabel(at(2026, 9, 8, 1, 25), now);
    expect(label.day).toBe("Today");
    expect(label.joiner).toBe(" ");
    expect(label.text).toBe(`Today 1:25${NNBSP}AM`);
  });

  test("today is decided by the calendar day, not by 24 hours", () => {
    // 00:05 today is more than 9 hours before "now" but still Today; 23:00 yesterday is Yesterday.
    expect(formatDateLabel(at(2026, 9, 8, 0, 5), now).day).toBe("Today");
    expect(formatDateLabel(at(2026, 9, 7, 23, 0), now).day).toBe("Yesterday");
  });

  test("a day inside the week reads as its weekday", () => {
    expect(formatDateLabel(at(2026, 9, 6, 10, 0), now).day).toBe("Sunday");
    expect(formatDateLabel(at(2026, 9, 5, 10, 0), now).day).toBe("Saturday");
    // Six days back is still a weekday; seven is not.
    expect(formatDateLabel(at(2026, 9, 2, 10, 0), now).day).toBe("Wednesday");
    expect(formatDateLabel(at(2026, 9, 2, 10, 0), now).joiner).toBe(" ");
  });

  test("beyond the week it is an absolute date joined with \"at\"", () => {
    const label = formatDateLabel(at(2026, 9, 1, 13, 25), now);
    expect(label.day).toBe("Sep 1, 2026");
    expect(label.joiner).toBe(" at ");
    expect(label.text).toBe(`Sep 1, 2026 at 1:25${NNBSP}PM`);
    expect(formatDateLabel(at(2025, 12, 24, 8, 0), now).day).toBe("Dec 24, 2025");
  });

  test("a future date falls back to the absolute form", () => {
    const label = formatDateLabel(at(2026, 9, 9, 8, 0), now);
    expect(label.day).toBe("Sep 9, 2026");
    expect(label.joiner).toBe(" at ");
  });

  test("text is day + joiner + time, and iso round-trips the moment", () => {
    const date = at(2026, 9, 8, 9, 41);
    const label = formatDateLabel(date, now);
    expect(label.text).toBe(`${label.day}${label.joiner}${label.time}`);
    expect(label.time).toBe(formatClockTime(date));
    expect(new Date(label.iso).getTime()).toBe(date.getTime());
  });

  test("accepts timestamps for both the value and the reference time", () => {
    expect(formatDateLabel(at(2026, 9, 7, 9, 0).getTime(), now.getTime()).day).toBe("Yesterday");
  });
});

describe("dateSeparatorMetrics", () => {
  test("carry the measured type scale for both platforms", () => {
    expect(dateSeparatorMetrics.ios.fontSize).toBe(11);
    expect(dateSeparatorMetrics.ios.lineHeight).toBe(14);
    expect(dateSeparatorMetrics.macos.fontSize).toBe(9);
    expect(dateSeparatorMetrics.macos.lineHeight).toBe(11);
    // The day is heavier than the time on both platforms.
    for (const platform of ["ios", "macos"] as const) {
      expect(dateSeparatorMetrics[platform].dayWeight).toBeGreaterThan(dateSeparatorMetrics[platform].weight);
      // A mid-list header opens a gap of its own above; the opening one leans on the chrome.
      expect(dateSeparatorMetrics[platform].midGapAbove).toBeGreaterThan(dateSeparatorMetrics[platform].gapAbove);
    }
  });
});
