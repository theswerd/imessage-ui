"use client";

import { IosStatusBar } from "@/registry/imessage/ios-status-bar";
import { IosNavBar } from "@/registry/imessage/ios-nav-bar";
import { IosComposer } from "@/registry/imessage/ios-composer";
import { IosConversationList, type IosConversation } from "@/registry/imessage/ios-conversation-list";
import { IosNewMessageSheet } from "@/registry/imessage/ios-new-message-sheet";

export type ChromeScene = "conversation" | "composer-text" | "list" | "new-message";

/** Fixture strings are the ones visible in the captures so the pixel diff compares like with like. iOS formats times with a narrow no-break space. */
const conversations: IosConversation[] = [
  { id: "ja", name: "+1 (888) 555-1212", initials: "JA", preview: "Every detail, down to the last bubble.", time: "1:48 AM" },
  { id: "kb", name: "+1 (555) 564-8583", initials: "KB", preview: "Every detail, down to the last bubble.", time: "1:48 AM" },
];

const pasteText = "It’s all in the little details. ✨ A longer message should wrap naturally without stretching the conversation.";

export function IosChromeScene({ scene, theme }: { scene: ChromeScene; theme: "light" | "dark" }) {
  const dark = theme === "dark";
  const frame = { width: 402, height: 874, position: "relative", overflow: "hidden", background: dark ? "#000000" : "#ffffff" } as const;
  if (scene === "list") {
    return (
      <div data-testid="lab" className={theme} style={frame}>
        <IosConversationList conversations={conversations} />
        <IosStatusBar time="1:57" className="absolute left-0 top-0" />
      </div>
    );
  }
  if (scene === "new-message") {
    return (
      <div data-testid="lab" className={theme} style={frame}>
        <IosStatusBar time="1:58" className="absolute left-0 top-0" />
        <IosNewMessageSheet caret>
          <IosComposer placeholder="" />
        </IosNewMessageSheet>
      </div>
    );
  }
  return (
    <div data-testid="lab" className={theme} style={frame}>
      <IosStatusBar time={dark ? "1:45" : "1:48"} className="absolute left-0 top-0" />
      <IosNavBar name="+1 (888) 555-1212" initials="JA" className="absolute left-0 top-[54px]" />
      <IosComposer className="absolute bottom-0 left-0" defaultValue={scene === "composer-text" ? pasteText : ""} />
    </div>
  );
}
