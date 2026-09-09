import { describe, expect, test } from "bun:test";
import {
  conversation, detailsCollapseTravel, frameAt, frameworkMotion, nativeMotion, scenarioRuns, scenarios,
  unverifiedMotion, viewerPhotos, type Platform, type ScenarioId,
} from "../../harness/scenarios";

const scenarioFor = (id: ScenarioId) => scenarios.find(scenario => scenario.id === id)!;

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
    expect(frameAt("outgoing", 1017).messages.at(-1)?.status).toBe("delivered");
    // "Delivered" moves off the bubble above in the same frame, not before it and not after.
    expect(frameAt("outgoing", 1016).messages.find(message => message.id === "m6")?.status).toBe("delivered");
    expect(frameAt("outgoing", 1017).messages.find(message => message.id === "m6")?.status).toBeUndefined();
  });
  /**
   * The send was re-measured off `references/ios/motion/send-60fps.mp4` with t = 0 at f73: the
   * bubble overshoots its slot at 417 ms (f98) and does not settle until 690 (f114). A checkpoint
   * set that stops before 690 never shows the overshoot, which is the whole point of the re-measure,
   * so both frames are pinned here and `messageMotion.send.duration` has to keep agreeing.
   */
  test("the send settles at the re-measured 690 ms, and the overshoot has a checkpoint", () => {
    expect(nativeMotion.send).toBe(690);
    const outgoing = scenarioFor("outgoing");
    expect(outgoing.checkpoints).toContain(690);
    expect(outgoing.checkpoints).toContain(417);
    // 17 (f74) is still full width: the morph precedes the collapse, so the frame before it must
    // still show the draft in the field rather than a bubble.
    expect(frameAt("outgoing", 16).arrival).toBeUndefined();
    expect(frameAt("outgoing", 17).arrival?.progress).toBe(0);
    expect(frameAt("outgoing", 417).arrival!.progress).toBeLessThan(1);
    expect(frameAt("outgoing", 690).arrival!.progress).toBe(1);
  });
  test("typing resolves into an incoming message that pops in", () => {
    expect(frameAt("incoming", 700).typing).toBe(true);
    const after = frameAt("incoming", 1100);
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
  /**
   * A checkpoint list is a reading order: it opens on the resting frame, walks forward, and ends on
   * the settled one. A duplicate or an out-of-order entry is always a mistake, and a timed scenario
   * whose last checkpoint is short of its duration never shows the pose it settles in.
   */
  test("checkpoints climb, start at 0 and end on the duration", () => {
    for (const scenario of scenarios) {
      expect(scenario.checkpoints[0]).toBe(0);
      expect(scenario.checkpoints.at(-1)).toBe(scenario.duration);
      for (let i = 1; i < scenario.checkpoints.length; i++) {
        expect(scenario.checkpoints[i]).toBeGreaterThan(scenario.checkpoints[i - 1]);
      }
    }
  });
  /**
   * The point of a timed scenario is that its checkpoints are different frames. This catches the
   * failure a screenshot suite cannot report cheaply: a scenario whose state was never threaded
   * through `frameAt`, so every checkpoint renders the same picture under a moving clock.
   *
   * `typing` is the one exemption, and it is a real one: the dots are the component's own infinite
   * CSS loop rather than a state this file states, so the scene is identical at every checkpoint and
   * the harness pins the animation to the checkpoint's own time instead. Its duration is one full
   * `typingLoopMs`, so its first and last frames *should* match. Nothing else may join this list
   * without the same kind of reason.
   */
  test("a timed scenario's first and last checkpoints are different frames", () => {
    const componentClock = new Set(["typing"]);
    for (const scenario of scenarios) {
      if (!scenario.duration || componentClock.has(scenario.id)) continue;
      const start = JSON.stringify(frameAt(scenario.id, 0));
      const end = JSON.stringify(frameAt(scenario.id, scenario.duration));
      expect(`${scenario.id}: ${start === end ? "unchanged" : "moves"}`).toBe(`${scenario.id}: moves`);
    }
  });
  test("every frame is a pure function of its scenario and time", () => {
    for (const scenario of scenarios) for (const time of scenario.checkpoints) {
      expect(frameAt(scenario.id, time)).toEqual(frameAt(scenario.id, time));
    }
  });
  test("`only` is honoured in both directions and names a real platform", () => {
    for (const scenario of scenarios) {
      const only = (scenario as { only?: Platform }).only;
      if (!only) {
        expect(scenarioRuns(scenario.id, "ios") && scenarioRuns(scenario.id, "macos")).toBe(true);
        continue;
      }
      expect(["ios", "macos"]).toContain(only);
      expect(scenarioRuns(scenario.id, only)).toBe(true);
      expect(scenarioRuns(scenario.id, only === "ios" ? "macos" : "ios")).toBe(false);
    }
  });
});

/**
 * The surfaces the two shells grew, one test each. Every assertion here is about what the frame
 * *states*, not about what the component draws with it: a scrubbed checkpoint is only reproducible
 * if the number the shell is handed is a pure function of the scenario and the time.
 */
describe("the presented surfaces", () => {
  test("the photo viewer opens on a tile, pages at the halfway point and holds the drop", () => {
    const open = scenarioFor("photo-viewer");
    expect(open.duration).toBe(frameworkMotion.photoViewer);
    expect(frameAt("photo-viewer", 0).photoViewer).toEqual({ id: "ph", index: 2, progress: 0 });
    expect(frameAt("photo-viewer", 150).photoViewer!.progress).toBeCloseTo(0.5, 6);
    expect(frameAt("photo-viewer", 300).photoViewer!.progress).toBe(1);
    // The message it opens from carries five photos, so `pageWindow` has two either side and only
    // the first four have a tile in the log — the fifth is the case that fades instead of flying.
    const photos = frameAt("photo-viewer", 0).messages.find(message => message.id === "ph")?.images;
    expect(photos).toHaveLength(viewerPhotos.length);
    expect(viewerPhotos.length).toBeGreaterThan(4);
    // Paging commits at half of `timing.page`, so the two halves state different items.
    expect(frameAt("photo-viewer-page", 0).photoViewer!.index).toBe(1);
    expect(frameAt("photo-viewer-page", 149).photoViewer!.index).toBe(1);
    expect(frameAt("photo-viewer-page", 150).photoViewer!.index).toBe(2);
    expect(frameAt("photo-viewer-page", 300).photoViewer!.progress).toBe(1);
    // The drop is held by `dismiss`, never by the entrance, which stays settled throughout.
    const drop = frameAt("photo-viewer-dismiss", 300).photoViewer!;
    expect(drop.progress).toBe(1);
    expect(drop.chrome).toBe(false);
    expect(drop.dismiss).toBe(1);
    expect(frameAt("photo-viewer-dismiss", 0).photoViewer!.dismiss).toBe(0);
  });
  test("the recorder's three phases meet exactly, and only one is live at a time", () => {
    const scenario = scenarioFor("audio-record");
    // 260 of entrance, 2140 of take, 600 of the state-change spring: the phases tile the duration
    // with nothing over, so no checkpoint can land in a gap between two of them.
    expect(scenario.duration as number).toBe(unverifiedMotion.audioRecorderEnter + 2140 + frameworkMotion.audioStateChange);
    // Entrance: seeked, take empty.
    expect(frameAt("audio-record", 0).audioRecorder).toEqual({ state: "recording", position: 0, enter: 0 });
    expect(frameAt("audio-record", 130).audioRecorder!.enter).toBeCloseTo(0.5, 6);
    // Recording: no entrance left to seek, and the take grows in real seconds.
    const mid = frameAt("audio-record", 1200).audioRecorder!;
    expect(mid.state).toBe("recording");
    expect(mid.enter).toBeUndefined();
    expect(mid.position).toBeCloseTo(0.94, 6);
    expect(frameAt("audio-record", 2100).audioRecorder!.position).toBeGreaterThan(mid.position);
    // Stop: the framework's own spring, seeked, out of the recording pose.
    expect(frameAt("audio-record", 2400).audioRecorder).toEqual({ state: "stopped", position: 0, transition: { from: "recording", progress: 0 } });
    expect(frameAt("audio-record", 2700).audioRecorder!.transition!.progress).toBeCloseTo(0.5, 6);
    expect(frameAt("audio-record", 3000).audioRecorder).toEqual({ state: "stopped", position: 0 });
    // Playback walks the playhead, so every checkpoint moves the played/unplayed split.
    const heads = scenarioFor("audio-playback").checkpoints.map(t => frameAt("audio-playback", t).audioRecorder!.position);
    expect(heads).toEqual([...heads].sort((a, b) => a - b));
    expect(new Set(heads).size).toBe(heads.length);
  });
  test("search runs the close table rather than the open one backwards", () => {
    expect(scenarioFor("search-open").duration).toBe(nativeMotion.searchOpen);
    expect(scenarioFor("search-close").duration).toBe(nativeMotion.searchClose);
    expect(nativeMotion.searchClose).not.toBe(nativeMotion.searchOpen);
    expect(frameAt("search-open", 0).search).toEqual({ query: "", progress: 0 });
    expect(frameAt("search-open", 267).search!.progress).toBe(1);
    expect(frameAt("search-open", 267).search!.closing).toBeUndefined();
    // Closing counts UP through its own table: 0 is the surface still opaque, 1 the list back in
    // place. Reversing the open one would put the progress the other way round and be wrong.
    expect(frameAt("search-close", 0).search).toEqual({ query: "", progress: 0, closing: true });
    expect(frameAt("search-close", 292).search!.progress).toBe(1);
    expect(frameAt("search-results", 0).search!.results).toBe(true);
    expect(frameAt("search-results", 0).search!.query).toBe("design");
    // The list is what search covers, so every one of them has to be on it.
    for (const id of ["search-open", "search-close", "search-results"] as const) expect(frameAt(id, 0).screen).toBe("list");
    // macOS has no search overlay; its sidebar filters in place instead.
    for (const id of ["search-open", "search-close", "search-results"] as const) expect(scenarioRuns(id, "macos")).toBe(false);
    expect(frameAt("sidebar-search", 0).sidebarSearch).toBe("sam");
    expect(scenarioRuns("sidebar-search", "ios")).toBe(false);
  });
  test("both details surfaces are seekable, and each is stated on the platform that has it", () => {
    // The shared entry drives both: iOS pushes a screen, macOS opens the inspector beside the pane.
    const settled = frameAt("details", 0);
    expect(settled.screen).toBe("details");
    expect(settled.details).toEqual({ progress: 1 });
    expect(settled.detailsPane).toEqual({ open: true, progress: 1 });
    expect(scenarioFor("details-open").duration).toBe(unverifiedMotion.macDetailsOpen);
    expect(frameAt("details-open", 150).detailsPane!.progress).toBeCloseTo(0.5, 6);
    expect(frameAt("details-open", 300).detailsPane!.progress).toBe(1);
    expect(frameAt("details-photos", 0).detailsPane!.tab).toBe("photos");
    for (const id of ["details-open", "details-photos"] as const) expect(scenarioRuns(id, "ios")).toBe(false);
    // The group screen is the iOS one, and it seeks the same `iosDetailsMotion.enter` the
    // one-to-one screen does, because `group-details.tsx` imports it rather than restating it.
    expect(scenarioFor("group-details-open").duration).toBe(unverifiedMotion.detailsOpen);
    expect(frameAt("group-details-open", 180).details!.progress).toBeCloseTo(0.5, 6);
    expect(frameAt("group-details-open", 360).details!.progress).toBe(1);
    // The collapse has no clock: it is seeked with a scroll offset in points.
    expect(frameAt("group-details-scrolled", 0).details).toEqual({ progress: 1, scroll: detailsCollapseTravel });
    for (const id of ["group-details", "group-details-open", "group-details-scrolled"] as const) {
      expect(frameAt(id, 0).group?.participants.length).toBe(3);
      expect(scenarioRuns(id, "macos")).toBe(false);
    }
  });
  test("the plus menu opens and closes through the same pose, from opposite ends", () => {
    expect(frameAt("plus-menu", 0).plusMenu).toEqual({ progress: 1 });
    expect(frameAt("plus-menu-open", 0).plusMenu!.progress).toBe(0);
    expect(frameAt("plus-menu-open", 350).plusMenu!.progress).toBe(1);
    expect(frameAt("plus-menu-close", 0).plusMenu!.progress).toBe(1);
    expect(frameAt("plus-menu-close", 200).plusMenu!.progress).toBe(0);
    // macOS reads the same normalised progress through `menuTransition`, so `menu` stays set too.
    for (const id of ["plus-menu", "plus-menu-open", "plus-menu-close"] as const) {
      expect(frameAt(id, 0).menu).toBe("plus");
      expect(scenarioRuns(id, "ios") && scenarioRuns(id, "macos")).toBe(true);
    }
  });
  test("the pickers state their entrance, their detent and what has been picked", () => {
    expect(frameAt("photo-picker", 0).photoPicker).toEqual({ progress: 0, detent: "collapsed", selected: [] });
    expect(frameAt("photo-picker", 190).photoPicker!.progress).toBeCloseTo(0.5, 6);
    expect(frameAt("photo-picker", 380).photoPicker!.progress).toBe(1);
    // Picking is what the tail of the scenario is for: one tile, then a second.
    expect(frameAt("photo-picker", 700).photoPicker!.selected).toEqual(["bloom"]);
    expect(frameAt("photo-picker", 1400).photoPicker!.selected).toEqual(["bloom", "falls"]);
    // The expanded detent is iOS only: the Mac shows the same grid in a popover with no sheet to drag.
    expect(frameAt("photo-picker-expanded", 0).photoPicker!.detent).toBe("collapsed");
    expect(frameAt("photo-picker-expanded", 700).photoPicker!.detent).toBe("expanded");
    expect(scenarioRuns("photo-picker-expanded", "macos")).toBe(false);
    expect(frameAt("sticker-picker", 0).stickerPicker).toEqual({ tab: "recents", progress: 0 });
    expect(frameAt("sticker-picker", 380).stickerPicker!.progress).toBe(1);
  });
  test("the sticker carry is a pure function of one scalar over the three measured phases", () => {
    const scenario = scenarioFor("sticker-drag");
    expect(scenario.duration).toBe(frameworkMotion.stickerDrag);
    // 500 lift + 1137.5 shrink + 910 land. The checkpoints have to include both phase boundaries or
    // the shrink and the landing are never sampled apart.
    expect(scenario.checkpoints).toContain(500);
    expect(scenario.checkpoints).toContain(1638);
    const at = (t: number) => frameAt("sticker-drag", t).stickerPicker!.drag!;
    expect(at(0)).toEqual({ id: "e-joy", to: { x: 150, y: 300 }, progress: 0 });
    expect(at(2548).progress).toBe(1);
    const climb = scenario.checkpoints.map(t => at(t).progress);
    expect(climb).toEqual([...climb].sort((a, b) => a - b));
    // The sheet is settled throughout: only the carry moves.
    expect(frameAt("sticker-drag", 1100).stickerPicker!.progress).toBe(1);
    expect(scenarioRuns("sticker-drag", "macos")).toBe(false);
  });
  test("the Tapback Details platter names four reactors over two kinds", () => {
    expect(scenarioFor("tapback-details").duration).toBe(unverifiedMotion.tapbackDetails);
    const frame = frameAt("tapback-details", 200);
    expect(frame.tapbackDetails).toEqual({ id: "gc4", progress: 1 });
    const reactions = frame.messages.find(message => message.id === "gc4")!.reactions!;
    expect(reactions).toHaveLength(4);
    // Every reactor is named, because a "who reacted" platter with anonymous rows says nothing.
    expect(reactions.every(reaction => Boolean(reaction.by))).toBe(true);
    expect(reactions.filter(reaction => reaction.type === "love")).toHaveLength(3);
    expect(reactions.filter(reaction => reaction.type === "like")).toHaveLength(1);
    // Exactly one is yours, which is the cell that carries Remove Tapback.
    expect(reactions.filter(reaction => reaction.byMe)).toHaveLength(1);
    expect(frameAt("tapback-details", 0).tapbackDetails!.progress).toBe(0);
    expect(scenarioRuns("tapback-details", "macos")).toBe(false);
  });
  test("status lines are their own kind of row, and one of them arrives", () => {
    const lines = frameAt("group-events", 0).messages.filter(message => message.system);
    expect(lines).toHaveLength(4);
    // The sentence comes from the event, so nothing keeps a second copy of it to drift.
    expect(lines.every(line => line.text === "")).toBe(true);
    // Two consecutive lines is the case that used to render at twice the gap.
    const messages = frameAt("group-events", 0).messages;
    const first = messages.findIndex(message => message.system);
    expect(messages[first + 1].system).toBeDefined();
    // One line with no actor, so it is the first-person form and emphasises "You".
    expect(lines.some(line => !("actor" in line.system!) || line.system!.actor === undefined)).toBe(true);
    expect(scenarioFor("group-event-arrival").duration).toBe(unverifiedMotion.systemArrival);
    expect(frameAt("group-event-arrival", 0).systemArrival).toEqual({ id: "new-system", progress: 0 });
    expect(frameAt("group-event-arrival", 130).systemArrival!.progress).toBeCloseTo(0.5, 6);
    expect(frameAt("group-event-arrival", 260).systemArrival!.progress).toBe(1);
    expect(frameAt("group-event-arrival", 0).messages.at(-1)!.id).toBe("new-system");
  });
  test("a group frame always names the same three people", () => {
    for (const id of ["group-chat", "group-events", "group-event-arrival", "tapback-details", "group-details"] as const) {
      expect(frameAt(id, 0).group).toEqual({ name: "Design Crit", participants: ["Alex Morgan", "Jamie Chen", "Sam Rivera"] });
    }
  });
  /**
   * The pane's crossfade is derived by `MacMessagesApp` from a real change of the selected
   * conversation rather than stated the way `screenTransition` states its `from`, so only the two
   * ends of this one are checkpointed. Both of them have to be real, different conversations.
   */
  test("the conversation switch names both ends and seeks the crossfade", () => {
    expect(scenarioFor("switch-conversation").duration).toBe(unverifiedMotion.conversationSwitch);
    expect(scenarioFor("switch-conversation").checkpoints).toEqual([0, unverifiedMotion.conversationSwitch]);
    const before = frameAt("switch-conversation", 0);
    const after = frameAt("switch-conversation", 140);
    expect(before.conversationSwitch).toEqual({ from: "alex", to: "alex", progress: 0 });
    expect(after.conversationSwitch).toEqual({ from: "alex", to: "design", progress: 1 });
    expect(before.group).toBeUndefined();
    expect(after.group?.name).toBe("Design Crit");
    expect(before.messages.map(message => message.id)).not.toEqual(after.messages.map(message => message.id));
    expect(scenarioRuns("switch-conversation", "ios")).toBe(false);
  });
});
