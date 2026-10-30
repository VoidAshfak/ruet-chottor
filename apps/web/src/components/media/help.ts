// Guidance text for the shared media components (CLAUDE.md §8).
export const help = {
  add: 'Add photos or videos',
  addLabel: (max: number) => `Add photos or videos (up to ${max})`,
  remove: 'Remove',
  removeLabel: (name: string) => `Remove ${name}`,
  uploading: (percent: number) => `Uploading… ${percent}%`,
  checking: 'Checking…',
  retry: 'Try again',
  limitReached: (max: number) => `You can add up to ${max} files.`,
  tipLabel: 'About photos and videos',
  tip: 'Files upload straight to our media service and appear with your post. Photos are stored without their location data.',
  imageAlt: (n: number) => `Attached image ${n}`,
  video: (n: number) => `Attached video ${n}`,
} as const;
