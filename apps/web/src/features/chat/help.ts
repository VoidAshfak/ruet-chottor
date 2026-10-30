import { CHAT_LIMITS } from '@ruet-chottor/shared';

// All guidance text for messaging (CLAUDE.md §8). Keep it short and plain.
export const help = {
  page: {
    title: 'Messages',
    description: 'Chat one-to-one or in groups with other RUET members, in real time.',
  },
  thread: {
    title: 'Conversation',
    description: 'Messages arrive instantly while this page is open.',
  },
  list: {
    heading: 'Your conversations',
    newGroup: 'New group',
    loading: 'Loading conversations…',
    empty:
      'No conversations yet. Open someone’s profile or the Directory and press “Message”, or start a group.',
    error: 'Could not load your conversations.',
    retry: 'Try again',
    loadMore: 'Show more',
    noMessages: 'No messages yet',
    you: 'You',
    deleted: 'Message deleted',
    unread: (n: number) =>
      n > CHAT_LIMITS.unreadDisplayMax ? `${CHAT_LIMITS.unreadDisplayMax}+` : String(n),
    unreadLabel: (n: number) => `${n} unread`,
    groupLabel: (members: number) => `Group · ${members} members`,
  },
  messages: {
    loading: 'Loading messages…',
    empty: 'Say hello! Messages you send appear here.',
    error: 'Could not load messages.',
    older: 'Show older messages',
    loadingOlder: 'Loading…',
    deleted: 'Message deleted',
    unknownSender: 'Deleted account',
    sending: 'Sending…',
    failed: 'Not sent.',
    retry: 'Retry',
    delete: 'Delete',
    deleteLabel: 'Delete this message',
    confirmDelete: {
      title: 'Delete this message?',
      body: 'It will show as “Message deleted” for everyone in this chat. This cannot be undone.',
      confirm: 'Delete',
      cancel: 'Keep it',
    },
    typing: (names: string[]) =>
      names.length === 1 ? `${names[0]} is typing…` : `${names.length} people are typing…`,
  },
  composer: {
    label: 'Message',
    placeholder: 'Write a message',
    send: 'Send',
    counter: (used: number) => `${used}/${CHAT_LIMITS.messageMaxLength}`,
    suspended: 'Your account is suspended, so you cannot send messages.',
  },
  connection: {
    reconnecting: 'Reconnecting… New messages will appear when you are back online.',
    tipLabel: 'About live messages',
  },
  group: {
    create: {
      title: 'New group',
      description: `Pick a name and up to ${CHAT_LIMITS.groupMaxMembers - 1} members. You can add more later.`,
      name: 'Group name',
      namePlaceholder: 'e.g. CSE 21 thesis',
      members: 'Members',
      search: 'Search members by name or roll',
      selected: (n: number) => (n === 1 ? '1 selected' : `${n} selected`),
      submit: 'Create group',
      cancel: 'Cancel',
      noResults: 'No members match.',
      needMember: 'Add at least one member',
      membersTipLabel: 'About group members',
      needsDirectory: 'Member search needs the Directory section, which is switched off.',
    },
    manage: {
      button: 'Group settings',
      title: 'Group settings',
      description: 'Rename the group, add or remove members, or leave.',
      rename: 'Rename',
      save: 'Save name',
      add: 'Add members',
      addSubmit: 'Add',
      members: 'Members',
      owner: 'Owner',
      remove: 'Remove',
      removeLabel: (name: string) => `Remove ${name} from the group`,
      leave: 'Leave group',
      confirmRemove: (name: string) => ({
        title: `Remove ${name}?`,
        body: 'They will stop getting messages from this group and cannot read new ones.',
        confirm: 'Remove',
      }),
      confirmLeave: {
        title: 'Leave this group?',
        body: 'You will stop getting its messages. Someone in the group can add you back.',
        confirm: 'Leave',
      },
      cancel: 'Cancel',
      close: 'Close',
    },
  },
  startChat: {
    button: 'Message',
    starting: 'Opening…',
    label: (name: string) => `Send a message to ${name}`,
  },
  back: 'All conversations',
  notFound: 'This conversation does not exist, or you are no longer in it.',
  loginNeeded: 'Log in to read and send messages.',
  login: 'Log in',
  tips: {
    connection:
      'Messages are saved first, then delivered live. If you lose connection, they load as soon as you are back.',
    groupMembers:
      'Only the group owner can rename the group and add or remove people. Anyone can leave.',
    newMembers: 'People you add see messages sent after they joined, not older ones.',
    deleted:
      'Deleted messages are hidden from everyone, but moderators can still review them if reported.',
  },
  intro: [
    {
      title: 'Chat with anyone at RUET',
      body: 'Press “Message” on a profile or in the Directory to start a one-to-one chat.',
    },
    {
      title: 'Groups for classes and teams',
      body: 'Start a group, name it, and add up to 49 people. The creator manages the group.',
    },
    {
      title: 'Be kind',
      body: 'Spam and harassment lead to warnings, suspensions or bans. Messages are rate-limited.',
    },
  ],
} as const;
