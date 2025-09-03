# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a React Native Expo application called "Memex: Second Brain" - a knowledge management app that allows users to save and organize various types of content (bookmarks, notes, images, etc.) into spaces/projects.

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
The app uses Supabase PostgreSQL with:
- `items` table: Stores all content items with fields like title, content, url, content_type, space_id
- `spaces` table: Organizes items into projects/collections
- Row Level Security (RLS) policies ensure users only access their own data
- Offline queue system for syncing changes when reconnected

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

## Environment Variables
Required in `.env` or `.env.local`:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Testing Considerations
- Test both light and dark modes
- Verify offline functionality works correctly
- Check auth flow including sign up, sign in, and session persistence
- Ensure data syncs properly when coming back online