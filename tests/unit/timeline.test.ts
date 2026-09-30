import { describe, expect, test } from "bun:test";
import {
  conversation, conversationList, detailsCollapseTravel, frameAt, frameworkMotion, iosConversations,
  macConversations, nativeMotion, scenarioRuns, scenarios, unreadConversationList, unverifiedMotion,
  viewerPhotos, type Platform, type ScenarioId,
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
   * There are two exemptions and both are the same real reason: the surface's only motion is an
   * infinite CSS loop the component owns, not a state this file states, so the scene is identical at
   * every checkpoint and the harness pins the animation to the checkpoint's own time instead. Each
   * runs exactly one turn of its loop, so its first and last frames *should* match.
   *
   * - `typing`: the dots, one full `typingLoopMs`.
   * - `effect-invisible-ink`: the cover's specks, one full `im-ink-drift` (5200 ms). The bubble
   *   itself does not move at all — `bubbleEffectDuration` is 0 for this effect — so there is no
   *   second thing here that ought to have been threaded through `frameAt` and was not.
   *
   * Nothing else may join this list without the same kind of reason.
   */
  test("a timed scenario's first and last checkpoints are different frames", () => {
    const componentClock = new Set(["typing", "effect-invisible-ink"]);
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
  test("the photo viewer opens on a tile, continuously pages and holds the drop", () => {
    const open = scenarioFor("photo-viewer");
    expect(open.duration).toBe(frameworkMotion.photoViewer);
    // `id` is the message that was TAPPED — "ph2", the third of the run — and `index` counts photos
    // in the whole run rather than in that message. The viewer pages across messages: measured in
    // ChatKit, its item list is every chat item sharing the tapped one's `layoutGroupIdentifier`.
    expect(frameAt("photo-viewer", 0).photoViewer).toEqual({ id: "ph2", index: 2, progress: 0 });
    expect(frameAt("photo-viewer", 150).photoViewer!.progress).toBeCloseTo(0.5, 6);
    expect(frameAt("photo-viewer", 300).photoViewer!.progress).toBe(1);
    // Five photos, as five messages — the shape a send of five actually takes. `pageWindow` has two
    // either side of the tapped one, and the run is what the viewer pages over.
    const run = frameAt("photo-viewer", 0).messages.filter(message => message.id.startsWith("ph"));
    expect(run).toHaveLength(viewerPhotos.length);
    expect(run.every(message => message.images?.length === 1)).toBe(true);
    expect(viewerPhotos.length).toBeGreaterThan(4);
    // Intermediate checkpoints hold the strip between photos instead of jumping between two stills.
    expect(frameAt("photo-viewer-page", 0).photoViewer!.index).toBe(1);
    expect(frameAt("photo-viewer-page", 149).photoViewer!.index).toBe(1);
    expect(frameAt("photo-viewer-page", 150).photoViewer!.index).toBe(1);
    expect(frameAt("photo-viewer-page", 150).photoViewer!.pageOffset).toBe(-0.5);
    expect(frameAt("photo-viewer-page", 300).photoViewer!.index).toBe(2);
    expect(frameAt("photo-viewer-page", 300).photoViewer!.pageOffset).toBe(0);
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
    // `details-open` runs on both shells now. It used to be Mac-only, which left the phone's
    // one-to-one details screen with no moving checkpoint at all — the group case had
    // `group-details-open` and the 1:1 case had nothing, so no visual baseline ever caught it
    // mid-presentation. The scenario is as long as the phone's entrance, and each shell reads its
    // own field off the frame, so the Mac's shorter slide still settles inside it.
    expect(scenarioFor("details-open").duration).toBe(unverifiedMotion.detailsOpen);
    expect(frameAt("details-open", 180).details!.progress).toBeCloseTo(0.5, 6);
    expect(frameAt("details-open", 360).details!.progress).toBe(1);
    expect(frameAt("details-open", 150).detailsPane!.progress).toBeCloseTo(0.5, 6);
    expect(frameAt("details-open", 300).detailsPane!.progress).toBe(1);
    expect(frameAt("details-photos", 0).detailsPane!.tab).toBe("photos");
    expect(scenarioRuns("details-open", "ios")).toBe(true);
    expect(scenarioRuns("details-photos", "ios")).toBe(false);
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

  /**
   * iOS select mode. One `--ios-sel-t` drives the whole surface — the circles, the row shift, the ✕
   * and the toolbar-for-composer swap — so the only thing a frame has to state is that one number
   * and which messages are ticked.
   */
  test("select mode enters on its own timeline and leaves through it backwards", () => {
    // Settled: the mode is on with no number handed to it, which is what "not seeking" means here.
    expect(frameAt("select-mode", 0).selectMode).toEqual({ selected: ["m6"] });
    expect(scenarioFor("select-mode-enter").duration).toBe(unverifiedMotion.selectModeEnter);
    expect(scenarioFor("select-mode-exit").duration).toBe(unverifiedMotion.selectModeExit);
    expect(frameAt("select-mode-enter", 0).selectMode).toEqual({ selected: ["m6"], progress: 0 });
    expect(frameAt("select-mode-enter", 130).selectMode!.progress).toBeCloseTo(0.5, 6);
    expect(frameAt("select-mode-enter", 260).selectMode!.progress).toBe(1);
    // The exit counts the same table DOWN, and the mode is still stated at the far end: dropping it
    // is what unmounts the surface, and an unmounted surface has no exit left to watch.
    expect(frameAt("select-mode-exit", 0).selectMode).toEqual({ selected: ["m6"], progress: 1 });
    expect(frameAt("select-mode-exit", 100).selectMode!.progress).toBeCloseTo(0.5, 6);
    expect(frameAt("select-mode-exit", 200).selectMode).toEqual({ selected: ["m6"], progress: 0 });
    // Exactly one message ticked in every frame of all three, which is the state the capture holds.
    for (const id of ["select-mode", "select-mode-enter", "select-mode-exit"] as const) {
      expect(frameAt(id, 0).selectMode!.selected).toEqual(["m6"]);
      // A mode is an iOS idea. The Mac selects with a click and has nothing to enter.
      expect(scenarioRuns(id, "macos")).toBe(false);
      expect(frameAt(id, 0).selectedMessageIds).toBeUndefined();
    }
  });
  /**
   * The Mac's own selection, which is a different mechanism and not a mode: always on, clicked into.
   * `select-all` is ⌘A — every message in display order, which is the one frame that puts the wash on
   * an incoming row, an outgoing one, a cluster's middle and its tail at once.
   */
  test("the Mac selects by click and by ⌘A, and never enters a mode", () => {
    expect(frameAt("selected-message", 0).selectedMessageIds).toEqual(["m3", "m5"]);
    const all = frameAt("select-all", 0);
    expect(all.selectedMessageIds).toEqual(all.messages.map(message => message.id));
    expect(all.selectedMessageIds!.length).toBe(conversation.length);
    for (const id of ["selected-message", "select-all"] as const) {
      expect(scenarioRuns(id, "ios")).toBe(false);
      expect(frameAt(id, 0).selectMode).toBeUndefined();
    }
  });
  /**
   * The two per-tile states a photo balloon can be in. Both are flags on the image rather than on the
   * message, because native draws both on the photo: a group of four can hold one of each.
   */
  test("a photo group states its Live Photo and its undownloaded tile per tile", () => {
    const tiles = frameAt("photo-states", 0).messages.find(message => message.id === "ph-states")!.images!;
    expect(tiles).toHaveLength(4);
    expect(tiles.filter(tile => tile.livePhoto)).toHaveLength(1);
    expect(tiles.filter(tile => tile.pending)).toHaveLength(1);
    // Never the same tile: a badge over a placeholder would announce a photo that is not there.
    expect(tiles.some(tile => tile.livePhoto && tile.pending)).toBe(false);
    // Two plain tiles to read the other two against, and the group is incoming, which is the ground
    // the download label's `--im-incoming-text` is drawn for.
    expect(tiles.filter(tile => !tile.livePhoto && !tile.pending)).toHaveLength(2);
    expect(frameAt("photo-states", 0).messages.find(message => message.id === "ph-states")!.direction).toBe("incoming");
    // The copy and the badge both differ by idiom, so this one runs on both shells.
    expect(scenarioRuns("photo-states", "ios") && scenarioRuns("photo-states", "macos")).toBe(true);
  });
  /**
   * The macOS sidebar's search now recolours the characters that matched, and only in the preview
   * line — ChatKit annotates `summaryLabel` and never the name. The two scenarios are the two halves
   * of that: "sam" matches a NAME (so its row shows no emphasis at all) and a group row's sender
   * prefix; "ou" falls inside three previews, one of them the selected row's.
   */
  test("the sidebar's two search scenarios cover a name match and an in-word preview match", () => {
    expect(frameAt("sidebar-search", 0).sidebarSearch).toBe("sam");
    expect(frameAt("sidebar-search-match", 0).sidebarSearch).toBe("ou");
    for (const id of ["sidebar-search", "sidebar-search-match"] as const) {
      expect(frameAt(id, 0).screen).toBe("list");
      expect(scenarioRuns(id, "ios")).toBe(false);
      // Non-empty in both, which is what draws the ✕ that no capture holds.
      expect(frameAt(id, 0).sidebarSearch!.length).toBeGreaterThan(0);
    }
    // "ou" has to be mid-word in the fixture previews or the scenario proves nothing about ranges.
    const previews = conversationList.map(item => item.preview);
    const inWord = previews.filter(preview => /\w ou|ou\w|\wou/i.test(preview) && /ou/i.test(preview));
    expect(inWord.length).toBeGreaterThanOrEqual(3);
    // And one of the rows it leaves standing must be the selected one, which is where the annotation
    // takes the white the name takes. `alex` is what the preview selects for a non-group frame.
    expect(conversationList.find(item => item.id === "alex")!.preview.toLowerCase()).toContain("ou");
  });
  /**
   * The unread scenario, and the fixture behind it. Both lists have drawn an unread dot since they
   * were written and neither had ever drawn one, because no fixture in this repo had ever set the
   * field: `conversationList` had six rows and not one of them was unread, so a screenshot of this
   * kit showed a Messages list in which nothing was ever unread. These are the checks that make that
   * a failing test rather than a missing pixel.
   */
  test("the unread scenario puts unread rows, a count and a selection in front of both lists", () => {
    const frame = frameAt("list-unread", 0);
    expect(frame.screen).toBe("list");
    expect(frame.conversations).toBe(unreadConversationList);
    // macOS shows the sidebar beside a transcript, so the scene also says which row is selected, and
    // it is an unread one: the white-on-selection dot is the one behaviour the platforms disagree on.
    expect(frame.selectedConversation).toBe("design");
    const selected = unreadConversationList.find(item => item.id === frame.selectedConversation)!;
    expect(selected.unread).toBeTruthy();
    // And the pane behind it is that same conversation, so the row, the header and the transcript
    // name one thing rather than three.
    expect(frame.group?.name).toBe("Design Crit");
    // It runs on both shells, because the two draw the state differently.
    expect(scenarioRuns("list-unread", "ios") && scenarioRuns("list-unread", "macos")).toBe(true);

    // Every case the two lists distinguish is in the fixture, and a read row is there to read the
    // rest against.
    expect(unreadConversationList.some(item => item.unread === true)).toBe(true);
    expect(unreadConversationList.some(item => typeof item.unread === "number")).toBe(true);
    expect(unreadConversationList.some(item => item.unread && item.muted)).toBe(true);
    expect(unreadConversationList.some(item => item.unread && item.pinned)).toBe(true);
    expect(unreadConversationList.some(item => item.unread && (item.members?.length ?? 0) > 1)).toBe(true);
    expect(unreadConversationList.some(item => !item.unread)).toBe(true);
  });
  /**
   * The regression net for the bug that cost the dot its existence. `preview.tsx` used to copy the
   * fixture into each shell field by field, naming five keys and dropping everything else in
   * silence — so `unread` reached neither list however the fixture was written. The copy now lives
   * in `scenarios.ts` as `iosConversations` / `macConversations`, and this holds those two to the
   * fixture's own keys: a field added to `ListFixture` that neither derivation carries fails here.
   */
  test("every field of a list fixture reaches one of the two lists", () => {
    const ios = iosConversations(unreadConversationList);
    const mac = macConversations(unreadConversationList);
    expect(ios).toHaveLength(unreadConversationList.length);
    expect(mac).toHaveLength(unreadConversationList.length);

    const carried = new Set([...Object.keys(ios[0]), ...Object.keys(mac[0]), ...Object.keys(mac[1])]);
    for (const key of Object.keys(unreadConversationList[1])) {
      expect(`${key}: ${carried.has(key) ? "carried" : "dropped"}`).toBe(`${key}: carried`);
    }

    // iOS takes a boolean, so a count reaches it as a plain dot; macOS keeps the number to announce.
    for (const [index, row] of unreadConversationList.entries()) {
      expect(ios[index].unread).toBe(!!row.unread);
      expect(mac[index].unread).toBe(row.unread);
      expect(mac[index].pinned).toBe(row.pinned);
      expect(mac[index].muted).toBe(row.muted);
    }
    // The iOS list has no notion of a sender, so a group row's prefix is composed into the preview —
    // which is exactly what the shared fixture bakes in by hand for the same row.
    const group = unreadConversationList.findIndex(item => (item.members?.length ?? 0) > 1);
    expect(ios[group].preview).toBe(`${unreadConversationList[group].sender}: ${unreadConversationList[group].preview}`);
    expect(mac[group].preview).toBe(unreadConversationList[group].preview);
    expect(mac[group].sender).toBe(unreadConversationList[group].sender);
  });
  /**
   * The shared fixture stays read on purpose. It is what every other scenario's sidebar and list is
   * screenshotted against, so an unread dot in here would move a hundred baselines that have nothing
   * to do with unread — `list-unread` carries its own rows instead.
   */
  test("the shared conversation fixture is entirely read, and every frame starts from it", () => {
    expect(conversationList.every(item => !item.unread)).toBe(true);
    expect(iosConversations(conversationList).every(item => item.unread === false)).toBe(true);
    for (const scenario of scenarios) {
      if (scenario.id === "list-unread") continue;
      expect(`${scenario.id}: ${frameAt(scenario.id, 0).conversations === conversationList ? "shared" : "its own"}`).toBe(`${scenario.id}: shared`);
    }
  });
  /** The macOS inspector's participant row, which only a group has anybody to draw. */
  test("the inspector on a group names the same three people the transcript does", () => {
    const frame = frameAt("details-group", 0);
    expect(frame.screen).toBe("details");
    expect(frame.detailsPane).toEqual({ open: true, progress: 1 });
    expect(frame.group).toEqual({ name: "Design Crit", participants: ["Alex Morgan", "Jamie Chen", "Sam Rivera"] });
    // The one-to-one inspector is `details`, and it has nobody to list.
    expect(frameAt("details", 0).group).toBeUndefined();
    expect(scenarioRuns("details-group", "ios")).toBe(false);
  });
});

/**
 * The effects, which are the one group where the scenarios had been running invented durations.
 * Every number here is either a row of `references/ios/motion/effects.md` (the three bubble effects)
 * or the component's own unmeasured choice, named as such (the eight screen effects).
 */
describe("the effects", () => {
  /**
   * `bubbleEffectDuration` in `message-effects.tsx` is 640 / 1230 / 3000 / 0, measured off 60 fps
   * recordings. The scenarios used to run 700 / 900 / 800 / 1200 — four numbers with nothing behind
   * them — and Gentle's 800 was the one that mattered: the component animates for three seconds, so
   * everything from the overshoot's hold onwards had no checkpoint on it.
   */
  test("the three bubble timelines run their measured durations", () => {
    expect(nativeMotion.bubbleEffect).toEqual({ slam: 640, loud: 1230, gentle: 3000, "invisible-ink": 0 });
    for (const kind of ["slam", "loud", "gentle"] as const) {
      const scenario = scenarioFor(`effect-${kind}`);
      expect(`${kind}: ${scenario.duration}`).toBe(`${kind}: ${nativeMotion.bubbleEffect[kind]}`);
      expect(frameAt(`effect-${kind}`, 0).effect).toEqual({ id: "m6", progress: 0, bubble: kind });
      expect(frameAt(`effect-${kind}`, scenario.duration).effect!.progress).toBe(1);
      // Nothing past the end: a checkpoint over the duration would seek a frame that does not exist.
      expect(frameAt(`effect-${kind}`, scenario.duration + 500).effect!.progress).toBe(1);
    }
  });
  /**
   * Each of these times is a row of the recording table, and the whole point of the re-timing is that
   * a checkpoint now lands on one. Slam's 233 is its first unclipped frame and 300 is the slam
   * itself; Loud's 450 is the 2.35 peak; Gentle's 533, 1250, 1983 and 2583 are the overshoot, the far
   * end of the hold and the two samples of the long relaxation — all four unreachable at 800 ms.
   */
  test("every bubble checkpoint is a measured frame of the recording", () => {
    const measured: Record<"slam" | "loud" | "gentle", number[]> = {
      slam: [233, 267, 300, 467, 633],
      loud: [83, 283, 450, 783, 1033, 1233],
      gentle: [200, 533, 1250, 1983, 2583],
    };
    for (const kind of ["slam", "loud", "gentle"] as const) {
      const scenario = scenarioFor(`effect-${kind}`);
      // The settle is the one checkpoint that is the duration rather than a frame time: two of the
      // three recordings run a frame or two past their own duration (Slam settles at 633, Gentle at
      // 3083), and the scenario has to end on the duration, not on the recording's last frame.
      const inner = scenario.checkpoints.slice(1, -1);
      expect(`${kind}: ${inner.join(",")}`).toBe(`${kind}: ${inner.filter(time => measured[kind].includes(time)).join(",")}`);
      expect(inner.length).toBeGreaterThanOrEqual(3);
    }
    // Gentle is the specific regression: the four inner checkpoints past the old 800 ms ceiling.
    expect(scenarioFor("effect-gentle").checkpoints.filter(time => time > 800).length).toBeGreaterThanOrEqual(4);
  });
  /**
   * Invisible Ink has no timeline of its own, so it states no fraction to seek. Its duration is one
   * turn of the cover's `im-ink-drift` loop and the harness pins that loop to each checkpoint.
   */
  test("Invisible Ink is a state with a component clock, not a seekable curve", () => {
    expect(nativeMotion.bubbleEffect["invisible-ink"]).toBe(0);
    const scenario = scenarioFor("effect-invisible-ink");
    expect(scenario.duration).toBe(unverifiedMotion.inkDrift);
    for (const time of scenario.checkpoints) {
      const frame = frameAt("effect-invisible-ink", time);
      // Constant: nothing about the bubble moves, so nothing about the frame does either.
      expect(frame.effect).toEqual({ id: "m6", progress: 1, bubble: "invisible-ink" });
      // The message carries the marker, which is what makes the list draw the cover at all.
      expect(frame.messages.find(message => message.id === "m6")!.effect).toBe("invisible-ink");
    }
  });
  /**
   * Eight screen effects, and until now only three of them had a scenario. The order is the Screen
   * tab's own (`references/ios/motion/effects.md`: eight page dots, and swiping past the eighth goes
   * nowhere), and every duration is `screenEffectDuration`'s.
   */
  test("all eight screen effects have a scenario at their own duration", () => {
    const kinds = Object.keys(unverifiedMotion.screenEffect) as Array<keyof typeof unverifiedMotion.screenEffect>;
    expect(kinds).toEqual(["echo", "spotlight", "balloons", "confetti", "love", "lasers", "fireworks", "celebration"]);
    for (const kind of kinds) {
      const scenario = scenarioFor(`effect-${kind}`);
      const duration = unverifiedMotion.screenEffect[kind];
      expect(`${kind}: ${scenario.duration}`).toBe(`${kind}: ${duration}`);
      expect(frameAt(`effect-${kind}`, 0).effect).toEqual({ id: "m6", progress: 0, screen: kind });
      expect(frameAt(`effect-${kind}`, duration / 2).effect!.progress).toBeCloseTo(0.5, 6);
      expect(frameAt(`effect-${kind}`, duration).effect!.progress).toBe(1);
      // A screen effect is a screen effect on both shells; neither is `only`.
      expect(scenarioRuns(`effect-${kind}`, "ios") && scenarioRuns(`effect-${kind}`, "macos")).toBe(true);
    }
    // The scenario table lists them in the Screen tab's order, so the workbench's sidebar reads the
    // way the phone's rail does.
    const listed = scenarios.filter(scenario => scenario.group === "Effects" && kinds.some(kind => scenario.id === `effect-${kind}`));
    expect(listed.map(scenario => String(scenario.id))).toEqual(kinds.map(kind => `effect-${kind}`));
  });
  /**
   * Each screen effect brackets its own fullest pose — the fraction `screen-effects.tsx` paints and
   * holds under `prefers-reduced-motion`. Nothing about these animations is measured, so this is the
   * only claim the checkpoints can honestly make: they sample the effect at its peak rather than at
   * an arbitrary third of a clock.
   */
  test("each screen effect has a checkpoint at the pose it holds under reduced motion", () => {
    const fullest: Record<string, number> = {
      echo: 0.5, spotlight: 0.5, balloons: 0.62, confetti: 0.5,
      love: 0.55, lasers: 0.5, fireworks: 0.45, celebration: 0.5,
    };
    // The three that predate this pass keep the checkpoints their baselines were taken at, so they
    // are held to the looser claim: a checkpoint within a tenth of the peak, not on it.
    const preexisting = new Set(["confetti", "love", "fireworks"]);
    for (const [kind, peak] of Object.entries(fullest)) {
      const scenario = scenarioFor(`effect-${kind}` as ScenarioId);
      const target = peak * scenario.duration;
      const nearest = scenario.checkpoints.reduce((best, time) => (Math.abs(time - target) < Math.abs(best - target) ? time : best));
      const tolerance = preexisting.has(kind) ? 0.1 * scenario.duration : 5;
      expect(`${kind}: ${Math.abs(nearest - target) <= tolerance ? "brackets" : `${nearest} vs ${target}`}`).toBe(`${kind}: brackets`);
    }
  });
});
