# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

**Memex: Second Brain** is a personal knowledge management mobile app built with React Native and Expo. It allows users to capture, organize, and search digital content (links, text, images, files) with AI-powered features for chat and metadata extraction.

## Development Commands

### Core Development
```bash
# Start development server
npm start
# or
expo start

# Run on specific platforms
npm run ios          # Start iOS simulator
npm run android      # Start Android emulator  
npm run web          # Start web version

# Install dependencies
npm install

# Clear cache and restart
npx expo start --clear
```

### Supabase Edge Functions
```bash
# Start local Supabase (requires Supabase CLI)
supabase start

# Serve edge functions locally
supabase functions serve

# Deploy edge functions
supabase functions deploy

# Deploy specific function
supabase functions deploy extract-metadata
```

### Testing Edge Functions
```bash
# Test metadata extraction locally
curl -X POST 'http://localhost:54321/functions/v1/extract-metadata' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://example.com"}'
```

## Architecture Overview

### Tech Stack
- **Framework**: React Native with Expo SDK 53
- **Routing**: Expo Router (file-based routing)
- **Backend**: Supabase (authentication, database, edge functions)
- **State Management**: Legend-State (for offline-first architecture)
- **UI Components**: Bottom sheet (@gorhom/bottom-sheet), Expo AV, Expo Image
- **Search**: Fuse.js for fuzzy search
- **Development**: TypeScript

### App Structure
```
app/
├── (tabs)/           # Tab-based navigation
│   ├── index.tsx     # Home/Everything view
│   ├── spaces.tsx    # Spaces grid view  
│   ├── settings.tsx  # Settings modal
│   └── _layout.tsx   # Tab navigation config
├── auth/
│   └── index.tsx     # Authentication screen
├── items/[id].tsx    # Item detail modal
├── spaces/[id].tsx   # Space detail view
└── _layout.tsx       # Root layout with stack navigation

supabase/
├── functions/
│   └── extract-metadata/  # Edge function for URL metadata
│       └── index.ts
└── config.toml       # Local Supabase configuration
```

### Key Features Architecture

**Content Types**: The app supports multiple content types (bookmark, youtube, x/twitter, github, instagram, tiktok, reddit, amazon, linkedin, image, pdf, video, audio, note, article, product, book, course) with auto-detection via URL patterns.

**Offline-First**: Uses Legend-State for offline state management with sync queuing. All actions (create, update, delete) are cached locally and synced when online.

**Metadata Extraction**: Supabase Edge Functions handle server-side metadata extraction for URLs, with client-side fallback. Platform-specific extraction for YouTube, Twitter/X, GitHub, etc.

**Authentication**: Passwordless login via Supabase magic links and Google OAuth using Expo AuthSession.

**Cross-Platform Capture**:
- iOS: Share extension via `expo-share-extension` 
- Android: Sharing intents via Expo Sharing API
- Web: Chrome extension (separate codebase)

**AI Integration**: OpenAI API integration for chat, tag generation, and content summaries. Chat UI implemented with bottom sheet that can be initiated from item or space context.

**Real-time Updates**: Supabase real-time subscriptions for live updates across devices, synced to Legend-State cache.

## Database Schema (Supabase)

### Core Tables
- **Items**: Main content table with `content_type` enum and basic metadata
- **Item_Metadata**: Universal metadata (domain, author, published_date, etc.)
- **Item_Type_Metadata**: Type-specific metadata stored as JSONB (YouTube views, Twitter likes, etc.)
- **Spaces**: Project/folder organization with color coding
- **Item_Spaces**: Many-to-many relationship for items in spaces
- **Chat_Messages**: AI chat history linked to items or spaces
- **Offline_Queue**: Client-side sync queue for offline actions

### Key Relationships
- Items can belong to multiple spaces via `Item_Spaces`
- Chat sessions are separate for items vs spaces (`Item_Chats`, `Space_Chats`)
- All tables use Row-Level Security (RLS) for user data isolation

## Environment Setup

### Required Environment Variables
```bash
# Copy example file
cp .env.example .env

# Required variables:
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_ENVIRONMENT=development

# Optional for AI features:
EXPO_PUBLIC_OPENAI_API_KEY=your_openai_key
```

### Supabase Setup
1. Create Supabase project
2. Enable authentication (email, OAuth providers)
3. Set up database tables and RLS policies
4. Deploy edge functions for metadata extraction
5. Configure authentication redirect URLs

## Development Patterns

### File-Based Routing
- Uses Expo Router with file-based routing conventions
- `(tabs)/` directory creates tab navigation
- `[id].tsx` creates dynamic routes
- `_layout.tsx` files define navigation structure

### State Management
- Legend-State handles offline-first state with automatic Supabase sync
- Real-time subscriptions update local state
- Optimistic updates with rollback on sync failure

### Component Architecture  
- **ItemCard**: Type-specific rendering for different content types
- **SpaceCard**: Displays space info with color coding and item counts
- **Chat Bottom Sheet**: Sliding chat interface using @gorhom/bottom-sheet
- **Capture Modal**: Multi-step capture flow with type detection

### Content Type Detection
URL patterns automatically detect content types:
- YouTube: `youtube.com/watch` or `youtu.be/`
- Twitter/X: `twitter.com` or `x.com` with `/status/`
- GitHub: `github.com/user/repo` pattern
- Fallback to generic `bookmark` type

## Testing & Debugging

### Development Tools
- Expo Dev Tools for debugging React Native
- Flipper integration for network inspection
- Chrome DevTools for edge functions
- Supabase Dashboard for database inspection

### Common Development Tasks
- Use Expo Go app for quick testing on device
- Enable remote debugging for JavaScript debugging
- Use `console.log` statements liberally for state debugging
- Test offline scenarios by disabling network
- Verify metadata extraction with various URL types

## Deployment

### Mobile App
- Uses Expo Application Services (EAS) for builds
- Supports both iOS and Android
- Over-the-air (OTA) updates via Expo Updates

### Backend Services
- Supabase handles database, auth, and edge functions
- Edge functions deployed via Supabase CLI
- Real-time subscriptions automatically scale

The app is designed for offline-first usage with seamless sync, making it robust for users with intermittent connectivity while providing rich metadata extraction and AI-powered features when online.
