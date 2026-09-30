import { describe, expect, test } from "bun:test";
import { photoRun } from "../../registry/imessage/ios-messages-app";
import type { Message } from "../../registry/imessage/message-list";

/**
 * What the full-screen viewer pages over.
 *
 * The rule these assertions encode came out of ChatKit on this Mac, not out of a screenshot:
 * `-[CKChatController _displayPreviewItemForMediaObject:]` fills
 * `CKQLPreviewControllerDataSource.previewItems` from
 * `-previewItemsForMediaObject:currentItemIndex:containsRestoring:`, and that method reads the
 * tapped chat item's `layoutGroupIdentifier` and then enumerates the WHOLE transcript's `chatItems`,
 * keeping every item whose own `layoutGroupIdentifier` matches. So the viewer pages across messages.
 * With a send of N photos landing as N separate messages — which the device also showed, and which
 * `references/simulator-cases.md` §3.4 records — tapping one of them has to open a viewer holding
 * all N.
 *
 * What is NOT measured is how `layoutGroupIdentifier` is derived, so `photoRun`'s definition of the
 * group (adjacent photo messages, same direction, same sender) is this kit's analogue rather than a
 * reading, and these tests pin that analogue rather than claiming it is Apple's rule.
 */
const at = (minutes: number) => new Date(Date.UTC(2026, 0, 1, 12, minutes));

function photo(id: string, count = 1, over: Partial<Message> = {}): Message {
  return {
    id, text: "", direction: "outgoing", sentAt: at(Number(id.replace(/\D/g, "")) || 0), kind: "image",
    images: Array.from({ length: count }, (_, i) => ({ src: `${id}-${i}.jpg`, alt: `${id} ${i}` })),
    ...over,
  };
}
const bubble = (id: string, over: Partial<Message> = {}): Message =>
  ({ id, text: "hi", direction: "outgoing", sentAt: at(Number(id.replace(/\D/g, "")) || 0), ...over });

describe("photoRun", () => {
  test("a run of single-photo messages is one list, whichever one is tapped", () => {
    const messages = [photo("p1"), photo("p2"), photo("p3")];
    for (const id of ["p1", "p2", "p3"]) {
      const run = photoRun(messages, id);
      expect(run.ids).toEqual(["p1", "p2", "p3"]);
      expect(run.photos.map(image => image.src)).toEqual(["p1-0.jpg", "p2-0.jpg", "p3-0.jpg"]);
      expect(run.offsets).toEqual([0, 1, 2]);
    }
  });

  test("offsets index each message's first photo, so a multi-photo message still lines up", () => {
    const run = photoRun([photo("p1", 2), photo("p2", 3), photo("p3", 1)], "p2");
    expect(run.offsets).toEqual([0, 2, 5]);
    expect(run.photos).toHaveLength(6);
  });

  test("a message of another kind ends the run on that side", () => {
    const messages = [photo("p1"), bubble("m2"), photo("p3"), photo("p4")];
    expect(photoRun(messages, "p3").ids).toEqual(["p3", "p4"]);
    expect(photoRun(messages, "p1").ids).toEqual(["p1"]);
  });

  test("the run does not cross a change of direction", () => {
    const messages = [photo("p1"), photo("p2", 1, { direction: "incoming" }), photo("p3", 1, { direction: "incoming" })];
    expect(photoRun(messages, "p1").ids).toEqual(["p1"]);
    expect(photoRun(messages, "p2").ids).toEqual(["p2", "p3"]);
  });

  test("in a group, the run does not cross a change of sender", () => {
    const messages = [
      photo("p1", 1, { direction: "incoming", sender: "Kate" }),
      photo("p2", 1, { direction: "incoming", sender: "Kate" }),
      photo("p3", 1, { direction: "incoming", sender: "Daniel" }),
    ];
    expect(photoRun(messages, "p1").ids).toEqual(["p1", "p2"]);
    expect(photoRun(messages, "p3").ids).toEqual(["p3"]);
  });

  test("a message that is not a photo, or is not there at all, has no run", () => {
    const messages = [photo("p1"), bubble("m2")];
    expect(photoRun(messages, "m2").photos).toEqual([]);
    expect(photoRun(messages, "nope").photos).toEqual([]);
    expect(photoRun([], "p1").ids).toEqual([]);
  });
});
