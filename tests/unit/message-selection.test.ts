import { describe, expect, test } from "bun:test";
import { nextMessageSelection } from "../../registry/imessage/macos-messages-app";

/**
 * macOS click-to-select. A plain click replaces the selection, cmd toggles one message, and shift
 * extends from the anchor, which is the message a plain or cmd click last touched. Only the macOS
 * pane uses it; iOS keeps its checkbox select mode.
 */
const order = ["m1", "m2", "m3", "m4", "m5", "m6"];
const plain = {};
const cmd = { metaKey: true };
const shift = { shiftKey: true };

describe("nextMessageSelection", () => {
  test("a plain click keeps only the message it landed on", () => {
    expect(nextMessageSelection(order, [], "m3", plain, null)).toEqual(["m3"]);
    expect(nextMessageSelection(order, ["m1", "m2"], "m3", plain, "m1")).toEqual(["m3"]);
    expect(nextMessageSelection(order, ["m3"], "m3", plain, "m3")).toEqual(["m3"]);
  });

  test("cmd adds a message that is not selected and removes one that is", () => {
    expect(nextMessageSelection(order, ["m2"], "m5", cmd, "m2")).toEqual(["m2", "m5"]);
    expect(nextMessageSelection(order, ["m2", "m5"], "m2", cmd, "m2")).toEqual(["m5"]);
    expect(nextMessageSelection(order, [], "m4", cmd, null)).toEqual(["m4"]);
  });

  test("shift extends from the anchor, in either direction, in display order", () => {
    expect(nextMessageSelection(order, ["m2"], "m4", shift, "m2")).toEqual(["m2", "m3", "m4"]);
    expect(nextMessageSelection(order, ["m4"], "m2", shift, "m4")).toEqual(["m2", "m3", "m4"]);
    expect(nextMessageSelection(order, ["m3"], "m3", shift, "m3")).toEqual(["m3"]);
  });

  test("shift with no anchor, or past a message that is gone, selects the one message", () => {
    expect(nextMessageSelection(order, [], "m4", shift, null)).toEqual(["m4"]);
    expect(nextMessageSelection(order, ["deleted"], "m4", shift, "deleted")).toEqual(["m4"]);
  });

  test("cmd wins over shift when both are held, the way a Mac list resolves it", () => {
    expect(nextMessageSelection(order, ["m1"], "m4", { metaKey: true, shiftKey: true }, "m1")).toEqual(["m1", "m4"]);
  });
});
