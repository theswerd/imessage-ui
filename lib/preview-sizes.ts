// Preview viewports, not additional measured native-device references.
export const previewSizes = {
  auto: { label: "Auto", width: 402, height: 680 },
  compact: { label: "Compact", width: 375, height: 667 },
  standard: { label: "Standard", width: 402, height: 874 },
  large: { label: "Large", width: 440, height: 956 },
} as const;

export type PreviewSize = keyof typeof previewSizes;
