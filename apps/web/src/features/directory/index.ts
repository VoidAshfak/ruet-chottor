// Public API of the directory feature. Other code imports only from here (CLAUDE.md §4).
export { DirectorySearch } from './components/DirectorySearch';
export { help as directoryHelp } from './help';
// Member search for other features, e.g. picking group members in chat.
export { useDirectory } from './hooks/use-directory';
