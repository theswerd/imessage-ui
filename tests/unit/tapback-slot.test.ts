import { describe, expect, test } from "bun:test";
import { balloonGeometry, balloonSlot } from "../../registry/imessage/tapback";
import { reactionOffsets } from "../../registry/imessage/message-bubble";
import { reactionSlot } from "../../registry/imessage/message-image";

/**
 * Three files carry the Tapback slot, and they have to be the same three numbers.
 *
 * `tapback.tsx` exports it as `balloonSlot` because that is where the balloon is drawn and measured.
 * `message-bubble.tsx` keeps `reactionOffsets` because `message-list.tsx` reads that one for every
 * message kind that is not a text bubble — a photo, a link card, an audio row, a file card, a bare
 * emoji. `message-image.tsx` keeps `reactionSlot` for a caller that hands `reactions` straight to
 * `MessageImages` instead of going through the list. Each is a separately installable registry item,
 * so none may import another for a three-number table; this test is what stops them drifting.
 *
 * They HAD drifted, and the copy that drew was the stale one. Before this test:
 *
 *   balloonSlot.macos      { marginTop: 27.4, top: -22.05, side: -11.79 }   (measured)
 *   reactionOffsets.macos  { marginTop: 19.6, top: -19.1,  side: -9.9  }    (7.8 / 2.95 / 1.89 off)
 *
 * so a Tapback on a macOS photo — which is exactly the `reactionOffsets` path — sat 7.8 pt short in
 * the slot the list opens for it, 2.95 pt too low against the photo and 1.89 pt too far in over it.
 * iOS was off by 0.14 and 0.25 pt the same way.
 *
 * The values themselves are measured, not asserted here: iOS averages `tapback-love-light.png` and
 * the mirrored `incoming-light.png`, macOS is circle-fitted on `tapback-love-dark-2x.png` and
 * cross-checked light. See the doc comment on `balloonSlot`.
 */
describe("the Tapback slot is one measurement, in three files", () => {
  for (const platform of ["ios", "macos"] as const) {
    test(`${platform}: message-bubble's reactionOffsets match tapback's balloonSlot`, () => {
      expect(reactionOffsets[platform]).toEqual(balloonSlot[platform]);
    });
    test(`${platform}: message-image's reactionSlot match tapback's balloonSlot`, () => {
      expect(reactionSlot[platform]).toEqual(balloonSlot[platform]);
    });
  }

  /**
   * The slot the list opens above a message has to clear the balloon, or the balloon laps whatever
   * sits above it. `marginTop` is a whole balloon's worth of space (28 against Ø34 on iOS, 27.4
   * against Ø28 on Mac) and `top` hangs the balloon inside it, so what has to hold is that the
   * balloon's top does not rise above the space the slot bought.
   */
  for (const platform of ["ios", "macos"] as const) {
    test(`${platform}: the balloon fits inside the slot the list opens`, () => {
      expect(-balloonSlot[platform].top).toBeLessThanOrEqual(balloonSlot[platform].marginTop);
      expect(balloonGeometry[platform].main).toBeGreaterThan(-balloonSlot[platform].top);
    });
  }
});
