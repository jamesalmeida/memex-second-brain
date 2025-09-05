import { Item, Space, ItemMetadata, ContentType } from '../types';

// Generate random IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// Generate random date within last 30 days
const generateRecentDate = () => {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * 30));
  return date.toISOString();
};

// Sample data arrays
const bookmarkTitles = [
  'React Native Best Practices',
  'Understanding TypeScript Generics',
  'The Complete Guide to Expo',
  'Modern CSS Techniques',
  'JavaScript Performance Tips',
];

const youtubeTitles = [
  'Building a Mobile App in 2024',
  'React Native vs Flutter',
  'Advanced Animation Techniques',
  'State Management Deep Dive',
  'Expo Router Tutorial',
];

const twitterContent = [
  'Just shipped a new feature! The expanding card animations are looking smooth 🚀',
  'TIL: React Native Reanimated 3 has some amazing performance improvements',
  'Working on a personal knowledge management app. The UX is coming together nicely!',
  'TypeScript saved me hours of debugging today. Strong typing FTW!',
];

const githubRepos = [
  { name: 'facebook/react-native', stars: 112000, forks: 23000, language: 'JavaScript' },
  { name: 'expo/expo', stars: 28000, forks: 4000, language: 'TypeScript' },
  { name: 'microsoft/TypeScript', stars: 94000, forks: 12000, language: 'TypeScript' },
  { name: 'vercel/next.js', stars: 118000, forks: 25000, language: 'JavaScript' },
];

const noteTitles = [
  'Meeting Notes - Product Roadmap',
  'Ideas for New Features',
  'Bug List and Priorities',
  'Architecture Decision Records',
  'User Feedback Summary',
];

const spaceNames = [
  { name: 'Work Projects', color: '#FF6B6B', desc: 'Current work initiatives and tasks' },
  { name: 'Learning', color: '#4ECDC4', desc: 'Tutorials, courses, and educational content' },
  { name: 'Inspiration', color: '#45B7D1', desc: 'Design ideas and creative references' },
  { name: 'Research', color: '#96CEB4', desc: 'Articles and papers for deep dives' },
  { name: 'Side Projects', color: '#FFEAA7', desc: 'Personal projects and experiments' },
];

const thumbnails = {
  youtube: [
    'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    'https://i.ytimg.com/vi/9bZkp7q19f0/maxresdefault.jpg',
  ],
  article: [
    'https://picsum.photos/400/300?random=1',
    'https://picsum.photos/400/300?random=2',
    'https://picsum.photos/400/300?random=3',
  ],
  default: 'https://picsum.photos/400/300?random=',
};

// Generate mock items
export const generateMockItems = (count: number = 20): Item[] => {
  const items: Item[] = [];
  const contentTypes: ContentType[] = [
    'bookmark', 'youtube', 'x', 'github', 'note', 'article', 'image'
  ];

  for (let i = 0; i < count; i++) {
    const contentType = contentTypes[Math.floor(Math.random() * contentTypes.length)];
    let item: Item = {
      id: generateId(),
      user_id: 'mock-user-id',
      title: '',
      content_type: contentType,
      created_at: generateRecentDate(),
      updated_at: generateRecentDate(),
      is_archived: false,
      isMockData: true,
    };

    // Set content based on type
    switch (contentType) {
      case 'bookmark':
        item.title = bookmarkTitles[Math.floor(Math.random() * bookmarkTitles.length)];
        item.url = `https://example.com/article-${i}`;
        item.desc = 'A comprehensive guide to modern web development practices and patterns.';
        item.thumbnail_url = thumbnails.article[Math.floor(Math.random() * thumbnails.article.length)];
        break;

      case 'youtube':
        item.title = youtubeTitles[Math.floor(Math.random() * youtubeTitles.length)];
        item.url = `https://youtube.com/watch?v=video${i}`;
        item.desc = 'An in-depth tutorial covering advanced concepts and real-world examples.';
        item.thumbnail_url = thumbnails.youtube[Math.floor(Math.random() * thumbnails.youtube.length)];
        break;

      case 'x':
        item.title = 'Tweet from @developer';
        item.content = twitterContent[Math.floor(Math.random() * twitterContent.length)];
        item.url = `https://x.com/developer/status/${i}`;
        item.thumbnail_url = `https://picsum.photos/100/100?random=${i}`;
        break;

      case 'github':
        const repo = githubRepos[Math.floor(Math.random() * githubRepos.length)];
        item.title = repo.name;
        item.url = `https://github.com/${repo.name}`;
        item.desc = `⭐ ${repo.stars.toLocaleString()} · 🍴 ${repo.forks.toLocaleString()} · ${repo.language}`;
        break;

      case 'note':
        item.title = noteTitles[Math.floor(Math.random() * noteTitles.length)];
        item.content = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
        break;

      case 'article':
        item.title = `Article: ${bookmarkTitles[Math.floor(Math.random() * bookmarkTitles.length)]}`;
        item.url = `https://blog.example.com/post-${i}`;
        item.desc = 'An insightful article exploring cutting-edge techniques and industry trends.';
        item.thumbnail_url = thumbnails.article[Math.floor(Math.random() * thumbnails.article.length)];
        item.raw_text = 'Full article text would go here...';
        break;

      case 'image':
        item.title = `Image ${i + 1}`;
        item.thumbnail_url = `https://picsum.photos/400/400?random=${i}`;
        item.desc = 'A beautiful image captured in high resolution.';
        break;
    }

    items.push(item);
  }

  return items;
};

// Generate mock spaces - DEPRECATED: We're not using mock spaces anymore
// export const generateMockSpaces = (): Space[] => {
//   return spaceNames.map((space, index) => ({
//     id: `demo-${generateId()}`,
//     user_id: 'mock-user-id',
//     name: space.name,
//     desc: space.desc,
//     color: space.color,
//   }));
// };

// Generate mock metadata for an item
export const generateMockMetadata = (item: Item): ItemMetadata => {
  const domains: Record<ContentType, string> = {
    bookmark: 'example.com',
    youtube: 'youtube.com',
    x: 'x.com',
    github: 'github.com',
    instagram: 'instagram.com',
    tiktok: 'tiktok.com',
    reddit: 'reddit.com',
    amazon: 'amazon.com',
    linkedin: 'linkedin.com',
    image: 'images.app',
    pdf: 'docs.app',
    video: 'videos.app',
    audio: 'audio.app',
    note: 'notes.app',
    article: 'blog.example.com',
    product: 'store.app',
    book: 'books.app',
    course: 'learn.app',
  };

  return {
    item_id: item.id,
    domain: domains[item.content_type] || 'example.com',
    author: `Author ${Math.floor(Math.random() * 100)}`,
    username: `user${Math.floor(Math.random() * 1000)}`,
    profile_image: `https://picsum.photos/50/50?random=${item.id}`,
    published_date: generateRecentDate(),
  };
};

// Get items for a specific space (randomly assign 5-10 items)
export const getItemsForSpace = (spaceId: string, allItems: Item[]): Item[] => {
  const itemCount = Math.floor(Math.random() * 6) + 5; // 5-10 items
  const shuffled = [...allItems].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(itemCount, allItems.length));
};

// Get count of items in a space
export const getSpaceItemCount = (spaceId: string): number => {
  return Math.floor(Math.random() * 15) + 5; // 5-20 items
};

// Generate loading placeholder items
export const generateLoadingItems = (count: number = 6): Partial<Item>[] => {
  return Array(count).fill(null).map((_, i) => ({
    id: `loading-${i}`,
    title: '',
    content_type: 'bookmark' as ContentType,
  }));
};

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