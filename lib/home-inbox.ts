import type { IosConversation } from "@/registry/imessage/ios-conversation-list";
import type { Message } from "@/registry/imessage/message-list";
import { showcasePhotos } from "./showcase";

export type DemoThread = { contact: IosConversation; messages: Message[] };
const now = Date.UTC(2026, 8, 29, 16, 41);

export const homeInbox: DemoThread[] = [
  {
    contact: { id: "jamie", name: "Jamie Lee", initials: "JL", preview: "Briefly. The Wi-Fi was terrible.", time: "9:41 AM" },
    messages: [
      { id: "jamie-photo", direction: "incoming", text: "", kind: "image", images: [showcasePhotos[0]], sentAt: now - 60_000 },
      { id: "jamie-1", direction: "outgoing", text: "Wait. You went outside?", sentAt: now - 40_000 },
      { id: "jamie-2", direction: "incoming", text: "Briefly. The Wi-Fi was terrible.", sentAt: now - 20_000, reactions: [{ type: "laugh", byMe: true }] },
    ],
  },
  {
    contact: { id: "freestyle", name: "Freestyle guy", photo: "/showcase/freestyle.png", preview: "More VMs? Say less. ☁️", time: "9:40 AM", unread: true },
    messages: [
      { id: "freestyle-1", direction: "outgoing", text: "I need more VMs.", sentAt: now - 240_000 },
      { id: "freestyle-2", direction: "incoming", text: "How many are we talking?", sentAt: now - 220_000 },
      { id: "freestyle-3", direction: "outgoing", text: "Yes.", sentAt: now - 200_000 },
      { id: "freestyle-4", direction: "incoming", text: "Say less. ☁️", sentAt: now - 180_000 },
      { id: "freestyle-link", direction: "incoming", text: "https://www.freestyle.sh", kind: "link", link: { url: "https://www.freestyle.sh", title: "More VMs? Right this way.", image: "/showcase/freestyle-og.png" }, sentAt: now - 160_000 },
    ],
  },
  {
    contact: { id: "openwork", name: "OpenWork", photo: "/showcase/openwork.png", preview: "I found 12 files named final.", time: "9:38 AM", unread: true },
    messages: [
      { id: "openwork-1", direction: "outgoing", text: "Can you organize my Downloads folder?", sentAt: now - 300_000 },
      { id: "openwork-2", direction: "incoming", text: "I found 12 files named final.", sentAt: now - 270_000 },
      { id: "openwork-3", direction: "outgoing", text: "They were all final at the time.", sentAt: now - 240_000 },
      { id: "openwork-4", direction: "incoming", text: "Let's give them a fresh start.", sentAt: now - 210_000, reactions: [{ type: "laugh", byMe: true }] },
      { id: "openwork-link", direction: "incoming", text: "https://openworklabs.com", kind: "link", link: { url: "https://openworklabs.com", title: "OpenWork. Put your agent to work.", image: "/showcase/openwork-og.png" }, sentAt: now - 180_000 },
    ],
  },
  {
    contact: { id: "hexclank", name: "Hexclank", photo: "/showcase/hexclave.svg", preview: "Three. You can stop refreshing.", time: "9:36 AM", unread: true },
    messages: [
      { id: "hexclank-1", direction: "outgoing", text: "Any new signups?", sentAt: now - 420_000 },
      { id: "hexclank-2", direction: "incoming", text: "Three. You can stop refreshing.", sentAt: now - 390_000 },
      { id: "hexclank-3", direction: "outgoing", text: "That was my cardio.", sentAt: now - 360_000, reactions: [{ type: "laugh", byMe: true }] },
      { id: "hexclank-4", direction: "incoming", text: "I'll text you the highlights.", sentAt: now - 330_000 },
      { id: "hexclank-link", direction: "incoming", text: "https://hexclank.com", kind: "link", link: { url: "https://hexclank.com", title: "Hexclank. Your product, one text away.", image: "/showcase/hexclank-preview.svg" }, sentAt: now - 300_000 },
    ],
  },
  {
    contact: { id: "mom", name: "Mom", initials: "M", preview: "Is the cloud wearing a jacket?", time: "9:32 AM", unread: true },
    messages: [
      { id: "mom-1", direction: "incoming", text: "What do you actually do at work?", sentAt: now - 660_000 },
      { id: "mom-2", direction: "outgoing", text: "I put computers in the cloud.", sentAt: now - 640_000 },
      { id: "mom-3", direction: "incoming", text: "Is the cloud wearing a jacket?", sentAt: now - 620_000 },
      { id: "mom-4", direction: "incoming", text: "It gets cold up there.", sentAt: now - 600_000, reactions: [{ type: "love", byMe: true }] },
    ],
  },
  {
    contact: { id: "agent", name: "My agent", initials: "AI", preview: "Small update: I have 47 tabs open.", time: "9:24 AM" },
    messages: [
      { id: "agent-1", direction: "outgoing", text: "Can you fix one tiny bug?", sentAt: now - 1_200_000 },
      { id: "agent-2", direction: "incoming", text: "Absolutely. Should be quick.", sentAt: now - 1_180_000 },
      { id: "agent-3", direction: "incoming", text: "Small update: I have 47 tabs open.", sentAt: now - 1_160_000 },
      { id: "agent-4", direction: "outgoing", text: "You’re really becoming one of us.", sentAt: now - 1_140_000, status: "read" },
    ],
  },
  {
    contact: { id: "snacks", name: "Snack committee", initials: "SC", preview: "This meeting could’ve been a croissant.", time: "Yesterday", members: [{ name: "Alex", initials: "A" }, { name: "Sam", initials: "S" }, { name: "Jamie", initials: "J" }] },
    messages: [
      { id: "snacks-1", direction: "incoming", sender: "Alex", senderInitials: "A", text: "Emergency meeting.", sentAt: now - 86_400_000 },
      { id: "snacks-2", direction: "incoming", sender: "Sam", senderInitials: "S", text: "We’re out of snacks.", sentAt: now - 86_380_000 },
      { id: "snacks-3", direction: "outgoing", text: "This meeting could’ve been a croissant.", sentAt: now - 86_360_000, status: "delivered" },
    ],
  },
];
