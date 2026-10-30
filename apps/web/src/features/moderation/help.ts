import type {
  ContentAction,
  ModeratableContentType,
  ContentStatus,
  ReportReason,
  ReportStatus,
} from '@ruet-chottor/shared';

const nouns: Record<ModeratableContentType, string> = {
  'chat.message': 'message',
  'news.post': 'post',
};

// All guidance text for reporting and the moderation queue (CLAUDE.md §8). Keep it short and plain.
export const help = {
  report: {
    button: 'Report',
    buttonLabel: (type: ModeratableContentType) => `Report this ${nouns[type]}`,
    reported: 'You reported this',
    title: (type: ModeratableContentType) => `Report this ${nouns[type]}`,
    description: 'Tell the moderators what is wrong. They will review it and act if needed.',
    reason: 'Reason',
    needReason: 'Pick a reason',
    note: 'Note (optional)',
    notePlaceholder: 'Anything that helps the moderators understand',
    submit: 'Send report',
    cancel: 'Cancel',
    sent: 'Thanks. The moderators will take a look.',
    tipLabel: 'About reports',
  },
  reasons: {
    spam: 'Spam or advertising',
    harassment: 'Harassment or bullying',
    violence: 'Violence or threats',
    misinformation: 'False information',
    inappropriate: 'Inappropriate content',
    scam: 'Scam or fraud',
    other: 'Something else',
  } satisfies Record<ReportReason, string>,
  queue: {
    title: 'Reports',
    description:
      'Content members reported. Review each item, then hide, remove, restore or dismiss.',
    status: 'Show',
    statuses: {
      open: 'Open',
      actioned: 'Acted on',
      dismissed: 'Dismissed',
    } satisfies Record<ReportStatus, string>,
    loading: 'Loading reports…',
    empty: 'Nothing to review. Reported content appears here.',
    error: 'Could not load the reports.',
    retry: 'Try again',
    loadMore: 'Show more',
    reports: (n: number) => (n === 1 ? '1 report' : `${n} reports`),
    by: (name: string) => `by ${name}`,
    unknownAuthor: 'a deleted account',
    gone: 'This item no longer exists.',
    open: 'Review',
    firstReported: 'First reported',
  },
  item: {
    title: 'Reported item',
    description: 'Only the reported item is shown here, never the rest of a private conversation.',
    back: 'All reports',
    author: 'Author',
    authorLink: 'Open the author’s admin page (warn, suspend or ban)',
    status: 'Status',
    reports: 'Reports',
    history: 'Actions taken',
    noHistory: 'No actions yet.',
    reporter: (name: string) => `Reported by ${name}`,
    notFound: 'There are no reports for this item.',
  },
  contentStatus: {
    visible: 'Visible',
    hidden: 'Hidden',
    removed: 'Removed',
  } satisfies Record<ContentStatus, string>,
  actions: {
    hide: {
      button: 'Hide',
      title: 'Hide this item?',
      body: 'Members no longer see it; its author sees that a moderator hid it. You can restore it later.',
    },
    remove: {
      button: 'Remove',
      title: 'Remove this item?',
      body: 'For clear rule breaks. Members no longer see it. It stays in the records and can be restored.',
    },
    restore: {
      button: 'Restore',
      title: 'Restore this item?',
      body: 'It becomes visible to members again.',
    },
    dismiss: {
      button: 'Dismiss reports',
      title: 'Dismiss the open reports?',
      body: 'Use this when nothing is wrong. If the item was hidden automatically, it becomes visible again.',
    },
  } satisfies Record<ContentAction, { button: string; title: string; body: string }>,
  reasonField: 'Reason for this action',
  reasonPlaceholder: 'e.g. Repeated scam links',
  confirm: 'Confirm',
  cancel: 'Cancel',
  tips: {
    report: {
      'chat.message':
        'Reports are anonymous to the author. Moderators see only this message, not the rest of the chat.',
      'news.post':
        'Reports are anonymous to the author. A moderator reviews the post and acts if needed.',
    } satisfies Record<ModeratableContentType, string>,
    autoHide:
      'Items reported by several different members are hidden automatically until a moderator decides.',
    reason:
      'Saved in the moderation log, so other staff can see why. The author is not told the reason.',
  },
} as const;
