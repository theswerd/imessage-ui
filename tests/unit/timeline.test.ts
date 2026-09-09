import { describe, expect, test } from "bun:test";
import { conversation, frameAt, nativeMotion, scenarios } from "../../harness/scenarios";

describe("scenario timelines", () => {
  test("outgoing message exists only after send and delivers after the animation", () => {
    expect(frameAt("outgoing", 0).messages).toHaveLength(conversation.length);
    expect(frameAt("outgoing", 0).composerDraft).toBe("Blue for iMessage.");
    const during = frameAt("outgoing", 200);
    expect(during.messages.at(-1)?.status).toBe("sending");
    expect(during.arrival?.kind).toBe("send");
    expect(during.arrival!.progress).toBeGreaterThan(0);
    expect(during.arrival!.progress).toBeLessThan(1);
    expect(frameAt("outgoing", nativeMotion.send).arrival?.progress).toBe(1);
    expect(frameAt("outgoing", 1200).messages.at(-1)?.status).toBe("delivered");
  });
  test("typing resolves into an incoming message that pops in", () => {
    expect(frameAt("incoming", 700).typing).toBe(true);
    const after = frameAt("incoming", 1500);
    expect(after.typing).toBe(false);
    expect(after.messages).toHaveLength(conversation.length + 1);
    expect(after.arrival?.progress).toBe(1);
  });
  test("long press holds, then opens the menu", () => {
    expect(frameAt("long-press", 250).pressed?.progress).toBeCloseTo(0.5);
    expect(frameAt("long-press", 250).longPress).toBeUndefined();
    expect(frameAt("long-press", 500).longPress?.progress).toBe(0);
    expect(frameAt("long-press", 880).longPress?.progress).toBe(1);
  });
  test("applying a tapback ends with the reaction on the message", () => {
    expect(frameAt("tapback", 0).messages.find(message => message.id === "m5")?.reactions).toBeUndefined();
    const done = frameAt("tapback", 600);
    expect(done.tapbackApply?.progress).toBe(1);
    expect(done.messages.find(message => message.id === "m5")?.reactions).toEqual([{ type: "love", byMe: true }]);
  });
  test("screens and menus are exclusive states", () => {
    expect(frameAt("list", 0).screen).toBe("list");
    expect(frameAt("details", 0).screen).toBe("details");
    expect(frameAt("plus-menu", 0).menu).toBe("plus");
    expect(frameAt("conversation", 0).menu).toBeUndefined();
  });
  test("all checkpoints are bounded and replay without leaking state", () => {
    for (const scenario of scenarios) for (const time of scenario.checkpoints) {
      expect(time).toBeLessThanOrEqual(scenario.duration);
      const first = frameAt(scenario.id, time);
      first.messages[0].text = "mutated";
      first.messages[0].reactions?.push({ type: "like", byMe: true });
      const again = frameAt(scenario.id, time);
      expect(again.messages[0].text).not.toBe("mutated");
      expect(again.messages[0].reactions?.some(reaction => reaction.type === "like")).not.toBe(true);
    }
  });
});
