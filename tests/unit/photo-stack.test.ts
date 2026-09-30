import { describe, expect, test } from "bun:test";
import { photoBalloonSize, photoBox, photoStackCard, photoStackLayout, photoStackSize } from "../../registry/imessage/message-image";

/**
 * The photo stack, checked against the frames the framework itself returned.
 *
 * These are not a screenshot and not a reading of the normalized ivars: they came out of
 * `-[PXGLayout geometryForSpriteAtIndex:]` and `-styleForSpriteAtIndex:` on a real
 * `PXMessagesStackView` built by `-[CKGenericPhotoStackBalloonView _createStackView]`, driven with
 * `setNumberOfItems:` and no data source. Each row is the *painted* frame — after the 0.9^k scale —
 * in balloon space, plus the rotation about the card's own centre.
 *
 * This file exists because the previous stack was a reading rather than a measurement, and the
 * reading was wrong in almost every part: four cards instead of five, the fan mirrored for outgoing
 * messages, the card's aspect taken from the box instead of the photo, and the square taken as the
 * balloon's height rather than its width. A table of numbers is what stops that happening twice.
 */
const FRAMES = {
  ios: {
    balloon: { width: 350.625, height: 332.625 },
    cards: [
      { left: 55.0625, top: 6.0, width: 240.375, height: 320.5, rotate: 0 },
      { left: 90.4479, top: 22.025, width: 216.3375, height: 288.45, rotate: 2 },
      { left: 118.2056, top: 36.4475, width: 194.7038, height: 259.605, rotate: 4 },
      { left: 139.6241, top: 49.4278, width: 175.2334, height: 233.6445, rotate: 6 },
      { left: 158.9008, top: 61.11, width: 157.71, height: 210.28, rotate: 8 },
    ],
  },
  macos: {
    balloon: { width: 375, height: 353 },
    cards: [
      { left: 58.125, top: 4.0, width: 258.75, height: 345.0, rotate: 0 },
      { left: 96.0625, top: 21.25, width: 232.875, height: 310.5, rotate: 2 },
      { left: 125.8313, top: 36.775, width: 209.5875, height: 279.45, rotate: 4 },
      { left: 148.8106, top: 50.7475, width: 188.6287, height: 251.505, rotate: 6 },
      { left: 169.4921, top: 63.3228, width: 169.7659, height: 226.3545, rotate: 8 },
    ],
  },
} as const;

/** What the card actually covers once it is scaled about its centre — which is what was measured. */
const painted = (card: ReturnType<typeof photoStackCard>) => ({
  width: card.width * card.scale,
  height: card.height * card.scale,
  left: card.left + (card.width * (1 - card.scale)) / 2,
  top: card.top + (card.height * (1 - card.scale)) / 2,
});

describe("the photo stack reproduces the framework's own frames", () => {
  for (const [platform, table] of Object.entries(FRAMES)) {
    describe(platform, () => {
      for (const [index, want] of table.cards.entries()) {
        test(`card ${index}`, () => {
          // No photo aspect: the framework falls back to `minItemAspectRatio`, a portrait 0.75 card.
          const got = painted(photoStackCard(index, table.balloon.width, table.balloon.height, platform as "ios" | "macos"));
          expect(got.left).toBeCloseTo(want.left, 3);
          expect(got.top).toBeCloseTo(want.top, 3);
          expect(got.width).toBeCloseTo(want.width, 3);
          expect(got.height).toBeCloseTo(want.height, 3);
          expect(photoStackCard(index, table.balloon.width, table.balloon.height, platform as "ios" | "macos").rotate).toBe(want.rotate);
        });
      }

      test("all five cards share the square's centre line", () => {
        const centres = table.cards.map(card => card.top + card.height / 2);
        for (const centre of centres) expect(centre).toBeCloseTo(centres[0]!, 3);
      });
    });
  }

  test("the balloon each table was measured in is the one `photoStackSize` produces", () => {
    // 280.5 is `bubbleMetrics.ios.maxWidth`; macOS saturates at `previewMaxWidth` for any pane.
    expect(photoStackSize(280.5, "ios")).toEqual(FRAMES.ios.balloon);
    expect(photoStackSize(1000, "macos")).toEqual(FRAMES.macos.balloon);
  });
});

describe("the stack's shape", () => {
  test("draws five cards, because `_stackedItemsCount` 4 counts the ones behind the front", () => {
    expect(photoStackLayout.visible).toBe(5);
  });

  test("never mirrors: the fan leans +x and rotates positive whichever side the bubble is on", () => {
    const cards = Array.from({ length: 5 }, (_, index) => photoStackCard(index, 350.625, 332.625, "ios"));
    for (let index = 1; index < cards.length; index++) {
      expect(cards[index]!.left).toBeGreaterThan(cards[index - 1]!.left);
      expect(cards[index]!.rotate).toBeGreaterThan(0);
    }
  });

  test("recedes by a tenth of the overlay per step of depth", () => {
    expect(Array.from({ length: 5 }, (_, index) => photoStackCard(index, 350.625, 332.625, "ios").scrim))
      .toEqual([0, 0.1, 0.2, 0.30000000000000004, 0.4]);
  });

  /**
   * The defect this closes: the box clamped with `maxWidth: 100%` while every card kept absolute
   * pixel geometry, so at a 140 pt container the front card hung 178.63 pt out of its row. Every
   * card must now stay inside the box at every width, including the rotation's own overhang.
   */
  test("stays inside its box at every width, rotation included", () => {
    for (const width of [140, 200, 280, 350.625, 375, 500]) {
      const height = (width / 350.625) * 332.625;
      for (let index = 0; index < photoStackLayout.visible; index++) {
        const card = photoStackCard(index, width, height, "ios");
        const box = painted(card);
        // A rotated rectangle's axis-aligned bounds, about its own centre.
        const radians = (card.rotate * Math.PI) / 180;
        const spread = (Math.abs(Math.cos(radians)) * box.width + Math.abs(Math.sin(radians)) * box.height - box.width) / 2;
        expect(box.left - spread).toBeGreaterThanOrEqual(-0.01);
        expect(box.left + box.width + spread).toBeLessThanOrEqual(width + 0.01);
      }
    }
  });

  test("fits the photo, not the box: a landscape photo makes a landscape card", () => {
    const portrait = photoStackCard(0, 350.625, 332.625, "ios", 0.75);
    const landscape = photoStackCard(0, 350.625, 332.625, "ios", 4 / 3);
    expect(landscape.width / landscape.height).toBeCloseTo(4 / 3, 4);
    expect(landscape.width).toBeGreaterThan(portrait.width);
    // Both clamps bite: `minItemAspectRatio` 0.75 and `maxItemAspectRatio` 1.3333 are the framework's.
    expect(photoStackCard(0, 350.625, 332.625, "ios", 0.2).width).toBeCloseTo(portrait.width, 4);
    expect(photoStackCard(0, 350.625, 332.625, "ios", 9).width).toBeCloseTo(landscape.width, 4);
  });
});

/**
 * **A photo balloon is narrower than a text bubble.** Captured off a real iPhone 17 Pro on iOS 26:
 * a sent photo measures 252.667 pt across (758 device px at 3x), right edge on 386.000, and that
 * width does not move between a landscape, a square and a portrait photo — only the height does.
 *
 * The three heights below are the discriminator. `-[CKUIBehavior thumbnailFillSizeForWidth:imageSize:]`
 * reproduces every one of them when handed 252.667 and none of them when handed the text bubble's
 * 280.5, which would make the portrait 374.0 where the device drew 337.0.
 */
describe("one photo's balloon", () => {
  const cases = [
    { name: "4:3 landscape", aspect: 4 / 3, width: 252.667, height: 189.5 },
    { name: "1:1 square", aspect: 1, width: 252.667, height: 252.667 },
    { name: "3:4 portrait", aspect: 0.75, width: 252.667, height: 337.0 },
  ];

  for (const item of cases) {
    test(item.name, () => {
      // 280.5 is what the transcript allows a *text* bubble; the photo cap is what has to bite.
      const got = photoBalloonSize(item.aspect, "ios", 280.5);
      expect(got.width).toBeCloseTo(item.width, 2);
      // Native rounds each result to the device pixel grid (253.0 rather than 252.667), so the
      // portrait lands 0.11 pt below its 337.0 — the tolerance is that rounding and nothing more.
      expect(got.height).toBeCloseTo(item.height, 0);
    });
  }

  test("the text bubble's own width would produce a different portrait, which is the whole point", () => {
    const asText = 280.5 * (4 / 3);
    expect(asText).toBeCloseTo(374, 0);
    expect(photoBalloonSize(0.75, "ios", 280.5).height).not.toBeCloseTo(asText, 0);
  });

  test("a caller with a narrower transcript still wins", () => {
    expect(photoBalloonSize(1, "ios", 180).width).toBe(180);
  });

  test("macOS keeps the bubble's width, because no capture holds a Mac photo balloon", () => {
    expect(photoBox.macos.maxWidth).toBeNull();
    expect(photoBalloonSize(1, "macos", 382.5).width).toBe(382.5);
  });
});
