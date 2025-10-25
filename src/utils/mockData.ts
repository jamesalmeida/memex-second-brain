// Generate empty state messages
export const getEmptyStateMessage = (context: 'home' | 'space' | 'search') => {
  const messages = {
    home: {
      title: 'No items yet',
      subtitle: 'Start saving bookmarks, notes, and content to build your second brain!',
    },
    space: {
      title: 'This space is empty',
      subtitle: 'Add items to this space to keep them organized.',
    },
    search: {
      title: 'No results found',
      subtitle: 'Try adjusting your search or filters.',
    },
  };

  return messages[context];
};
