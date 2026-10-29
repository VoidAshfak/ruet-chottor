// All guidance text for the home page (CLAUDE.md §8). Keep it short and plain.
export const help = {
  page: {
    title: 'Welcome to RUET Chottor',
    description: 'One place for RUET students to find people, talk, and use campus services.',
  },
  tips: {
    sections:
      'Sections are added one at a time. A section marked "Coming soon" is still being built.',
  },
  status: {
    loading: 'Checking which sections are available…',
    offline: 'Could not reach the server, so all sections are shown as coming soon.',
    available: 'Open',
    comingSoon: 'Coming soon',
  },
  intro: [
    {
      title: 'Welcome to RUET Chottor',
      body: '"Chottor" means campus square. This is the online version: one place for the whole RUET community.',
    },
    {
      title: 'One section at a time',
      body: 'New sections like messaging, news and the bus schedule will appear here as they are released.',
    },
    {
      title: 'Look for the (i) icons',
      body: 'Not sure what something does? Hover over or tap the (i) icon next to it for a short explanation.',
    },
  ],
} as const;
