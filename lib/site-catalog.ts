import { catalog } from "./catalog";

// Every public component has a working preview. Internal dependencies stay in the registry.
export const siteComponents = [
  ["ios-messages-app", "Overview"],
  ["ios-conversation-list", "Conversation list"],
  ["ios-details", "Contact view"],
  ["message-bubble", "Message bubbles"],
  ["tapback", "Tapbacks"],
  ["message-image", "Photos"],
  ["link-preview", "Link previews"],
  ["message-audio", "Voice messages"],
  ["typing-indicator", "Typing indicator"],
  ["ios-composer", "Composer"],
  ["message-attachment", "Attachments"],
  ["image-viewer", "Photo viewer"],
  ["avatar", "Avatars"],
  ["date-separator", "Date separators"],
] as const;

export const siteCatalog = catalog.filter(item => siteComponents.some(([name]) => name === item.name));
export const componentSearchItems = siteComponents.map(([name, title]) => ({ name, title }));
export function componentHref(name: string) {
  return name === "ios-messages-app" ? "/components" : `/components/${name}`;
}
