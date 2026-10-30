'use client';

import { help } from '../help';
import { useMyNews } from '../hooks/use-news';
import { LoginGate } from './LoginGate';
import { NewsList } from './NewsList';

function List() {
  const posts = useMyNews({ enabled: true });
  return <NewsList query={posts} empty={help.mine.empty} showReview />;
}

/** /news/mine: the member's own posts with their review status. */
export function MyNews() {
  return <LoginGate>{() => <List />}</LoginGate>;
}
