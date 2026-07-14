import type { Id } from '@beegreat/backend/convex/_generated/dataModel';
import { router, useLocalSearchParams, type Href } from 'expo-router';

import { AddBookmarkSheet } from '@/components/mind/add-bookmark-sheet';

export default function AddBookmarkScreen() {
  const { url } = useLocalSearchParams<{ url?: string }>();

  const handleSaved = (bookmarkId: Id<'bookmarks'>) => {
    router.replace(`/mind/${bookmarkId}` as Href);
  };

  return <AddBookmarkSheet initialUrl={url} onSaved={handleSaved} />;
}
