# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a React Native Expo application called "Memex: Second Brain" - a knowledge management app that allows users to save and organize various types of content (bookmarks, notes, images, etc.) into spaces/projects so they can utilize AI to organize and absorb their saved items more efficiently and better filter out the noise from the content thats actually worth reading, watching, or listening to. 

## PRD Document
Refer to the PRD document found in `./docs/PRD.markdown` and update it as needed when we add, change, or remove something mentioned inside of the PRD.

**Key PRD Sections:**
- **Section 3**: Complete data models and Supabase schema
- **Section 5**: APIs & Architecture - detailed documentation of:
  - Authentication (Supabase Auth SDK)
  - Database operations (Supabase Client SDK)
  - Supabase Edge Functions
  - External APIs (OpenAI, Twitter, YouTube, AssemblyAI, Instagram, Reddit)
  - Sync service and offline handling 

## Key Commands
```bash
# Start development server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android

# Run tests (if configured)
npm test

# Build for production
eas build --platform ios
eas build --platform android

# Deploy updates
eas update
```

## Architecture

### State Management
The app uses Legend State (`@legendapp/state`) for reactive state management. All stores are located in `src/stores/` and follow a consistent pattern:
- Each store exports the observable state, actions, and computed values
- Stores persist to AsyncStorage where appropriate
- The main stores are: `authStore`, `themeStore`, `itemsStore`, `spacesStore`, `offlineQueueStore`

### Authentication
Authentication is handled via Supabase with:
- Email/password authentication
- Session persistence in AsyncStorage
- Protected routes using Expo Router's file-based routing
- Auth state is managed globally and checked on app startup

### Theme System
The app supports light/dark mode with:
- Theme preference stored in AsyncStorage
- Global theme state in `themeStore`
- Components use `useObservable(themeStore.isDarkMode)` to react to theme changes
- All screens must implement both light and dark styles

### Database Schema
The app uses Supabase PostgreSQL with an offline-first architecture. For complete schema details, see **PRD Section 3**.

Key tables: `items`, `spaces`, `item_spaces`, `item_metadata`, `item_type_metadata`, `video_transcripts`, `image_descriptions`, `chat_messages`, `item_chats`, `space_chats`.

All operations use the Supabase Client SDK via `src/services/supabase.ts` - see **PRD Section 5.2** for complete API documentation.

### API Architecture
The app uses an **offline-first architecture**. For complete details, see **PRD Section 5**.

**Key services** (`src/services/`):
- `supabase.ts` - Database operations via Supabase Client SDK
- `syncService.ts` - Offline sync, queue management, conflict resolution
- `openai.ts` - Chat completions, tag generation, image descriptions
- `youtube.ts` - Video metadata and transcripts via youtubei.js
- `twitter.ts` - Tweet data via Twitter API v2
- `assemblyai.ts` - Video transcription for X/Twitter videos
- `instagram.ts` - Post metadata via Meta oEmbed API
- `reddit.ts` - Post data via Reddit JSON API
- `metadata.ts` - General URL metadata extraction

**Supabase Edge Functions**: `extract-metadata` for general URL scraping

### Navigation Structure
Using Expo Router with file-based routing:
- `/app/_layout.tsx` - Root layout handling auth state
- `/app/auth/` - Authentication screens
- `/app/(tabs)/` - Main app tabs (Home, Spaces, Settings)
- Tab navigation is theme-aware

## Development Patterns

### Adding New Features
1. Create the UI component in appropriate location
2. Add state management in relevant store if needed
3. Ensure dark mode support from the start
4. Test offline functionality where applicable
5. Add proper TypeScript types in `src/types/`

### Working with Stores
Always follow the established pattern:
```typescript
export const someStore = observable(initialState);
export const someActions = {
  async doSomething() {
    someStore.property.set(value);
  }
};
```

### Theme Implementation
When creating new screens/components:
```typescript
const isDarkMode = useObservable(themeStore.isDarkMode);
// Apply conditional styles: style={[styles.base, isDarkMode && styles.dark]}
```

### iPad/Tablet Support
The app includes responsive design for iPad with device-specific features:
- **Device Detection**: Use `useDeviceType()` hook from `src/utils/device.ts` to get device info
- **Persistent Drawer**: iPad landscape mode shows a 280px split-view drawer by default
- **Dynamic Grid**: Grid columns adjust automatically based on measured container width:
  - Measure container width using `onLayout` to get actual available space
  - Container width is automatically reduced by drawer in split-view mode (flex layout)
  - Uses `getGridColumns(containerWidth)` to calculate columns
  - Target column counts:
    - iPad Landscape with drawer: 3 columns
    - iPad Landscape without drawer: 4 columns
    - iPad Portrait: 3 columns
    - Mobile: 2 columns
  - Minimum 240px per column for good UX
  - Supports iPadOS multitasking/windowing with adaptive column counts
- **Toggle Behavior**: Hamburger menu button toggles drawer visibility in iPad landscape mode
- When implementing new grid views:
  - Use `onLayout` to measure actual container width
  - Pass measured width to `getGridColumns()` for column calculation
  - Use `key` prop on FlashList to force re-render when columns change

## Environment Variables
Required in `.env` or `.env.local`:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_ENVIRONMENT`
- `EXPO_PUBLIC_OPENAI_API_KEY`
- `EXPO_PUBLIC_JINA_AI_API_KEY`
- `EXPO_PUBLIC_X_API_KEY`
- `EXPO_PUBLIC_X_API_KEY_SECRET`
- `EXPO_PUBLIC_X_BEARER_TOKEN`
- `EXPO_PUBLIC_X_ACCESS_TOKEN`
- `EXPO_PUBLIC_X_ACCESS_TOKEN_SECRET`
- `EXPO_PUBLIC_ASSEMBLYAI_API_KEY`
- `EXPO_PUBLIC_META_ACCESS_TOKEN` (for Instagram oEmbed API)

## Testing Considerations
- Test both light and dark modes
- Verify offline functionality works correctly
- Check auth flow including sign up, sign in, and session persistence
- Ensure data syncs properly when coming back online

## Version Control
- After making changes always include a short commit message that the user could choose to use to commit that work if they are ready to do it themselves manually. 