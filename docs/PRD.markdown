# Memex: Second Brain - Product Requirements Document (PRD)

## 1. Product Overview
**Name**: Memex: Second Brain  
**Description**: A personal knowledge management tool for capturing, organizing, and searching digital content (links, text, images, files) in an intelligent inbox with spaces (projects/folders), tags, and metadata extraction. Supports cross-platform capture via Chrome extension (web) and iOS Sharesheet/Android Intent (mobile). Users can chat with an LLM about individual items or spaces, using content as context.  
**Target Users**: Researchers, creators, and individuals managing digital content.  
**Key Goals**: Secure authentication; intuitive content capture and triage; cross-platform consistency (web to mobile); offline-first support; seamless integration with Chrome extension and mobile Sharesheet.  
**Platforms**:  
- Current: Web (Next.js, Vercel-hosted).  
- Rebuild: Mobile (iOS/Android via React Native + Expo).  
- Integration: Chrome extension (via API); iOS Sharesheet (via `expo-share-extension`); Android Intent.  
**Tech Constraints for Rebuild**:  
- React Native with Expo for cross-platform mobile development.  
- Expo Router for file-based navigation (stack and tab-based).  
- Supabase for authentication, database, and storage.  
- Legend-State for offline-first state management and sync with Supabase.  
- No server-side rendering; client-side state management with React hooks and Legend-State.  
- iOS Sharesheet via `expo-share-extension` with custom UI; Android Intent via Expo Sharing API.

## 2. Core Features

### 2.1 Authentication
- Passwordless login via Supabase magic links (email OTP).  
- Google OAuth sign-in (using Expo AuthSession for native OAuth flow).  
- Auto-redirect to home screen on auth success; to login screen on failure or session expiry.  
- User ID display and copy functionality for Chrome extension integration.  
- Sign-out clears local session (Legend-State and AsyncStorage).  
- Offline: Display cached user profile (via Legend-State); prompt login on connectivity for API actions.

### 2.2 Dashboard & Views
- **Home/Everything View**: Displays all items in a scrollable two-column grid (FlatList). Features:  
  - Search bar for fuzzy search (title, desc, tags, metadata).  
  - Filter by content type (e.g., bookmark, YouTube).  
  - Floating action button (FAB) for quick capture.  
  - Offline: Show cached items via Legend-State; queue new items for sync.  
- **Spaces View**: Grid of space cards (name, description, color, item count). Tap to navigate to space-detail view.  
- **Space-Detail View**: Filtered item grid for a specific space. Includes:  
  - Back navigation to home/spaces.  
  - Option to initiate AI chat with space content as context (via bottom sheet).  
  - Offline: Cached space items; queue edits.  
- **Item Detail Expanded Card**: Full-screen expanding card animation for item details (title, content, metadata, media). Features:  
  - Expands from grid position to full screen with hero animation (like iOS App Store)  
  - Smooth reverse animation back to original grid position on close  
  - Swipe-down or tap X to dismiss  
  - Actions: Edit title/desc/metadata, archive, delete, move to another space  
  - Initiate AI chat with item content as context (via bottom sheet that slides over the expanded card)  
  - Download media (if applicable) or open external URL  
  - Offline: View cached details; queue edits/deletes  
- **Settings Modal**: Displays user email/ID, theme toggle (light/dark), sign-out.  
- **Search**: Global fuzzy search across items (client-side via Fuse.js, using Legend-State cache offline).  
- **Infinite Scroll/Pagination**: Load 20 items per page using FlatList’s `onEndReached`. Cache in Legend-State for offline access.  
- **Real-Time Updates**: Supabase real-time subscriptions for item changes (add/update/delete) when online, synced to Legend-State.  
- **Empty States**: Custom UI for no items or no search results, with offline messaging (e.g., “No cached items”).

### 2.3 Item Management
- **Item Types**: Bookmark, YouTube, X (Twitter), GitHub, Instagram, TikTok, Reddit, Amazon, LinkedIn, image, PDF, video, audio, note, article, product, book, course. Auto-detected via URL patterns or metadata.  
- **Item Data**: See [Data Models](#3-data-models-supabase-schema) for details.  
- **Actions**:  
  - **Create**: Via FAB, Sharesheet/Intent, or Chrome extension. Auto-detect type and fetch metadata (online only).  
  - **Update**: Edit title, desc, or metadata; refresh metadata from source (online only).  
  - **Delete/Archive**: Soft-delete (archive flag) or permanent delete. Queue offline actions in Legend-State.  
  - **Move**: Reassign to another space via `Item_Spaces` table; queue offline.  
- **Metadata Extraction**:  
  - On create/refresh: Fetch title, desc, thumbnail, and type-specific data (e.g., YouTube views, X likes).  
  - Services: `urlMetadataService` (scraping/API), YouTube.js, X API.  
  - Offline: Store minimal data (e.g., URL, title) with “pending” UI (e.g., loading spinner or badge); queue metadata refresh for online sync.  
- **Media Handling**:  
  - Display images/videos in cards (Expo AV for video playback).  
  - Show transcripts for videos (if cached).  
  - Download media via Expo FileSystem (store locally for offline access).

### 2.4 Capture/Save
- **Quick Capture**:  
  - In-app: FAB opens modal to paste URL/text or upload image. Auto-detects type and triggers metadata extraction.  
  - Mobile:  
    - **iOS Sharesheet**: Use `expo-share-extension` for custom UI with options:  
      - Save directly (no space assigned).  
      - Select existing space from dropdown (fetched from Supabase or cached in Legend-State).  
      - Post-MVP: Create new space (text input, color picker).  
      - Handle URLs, text, images, videos, files.  
      - Authentication via shared app group (Supabase JWT persisted).  
    - **Android Intent**: Use Expo Sharing API to capture URLs, text, or images; same save options as Sharesheet.  
    - Offline: Queue captures in Legend-State with minimal data (e.g., URL, text); sync on reconnect; show “pending” UI for incomplete items.  
- **Chrome Extension**:  
  - Saves page/selection (URL, title, text) via `POST /api/capture`.  
  - Requires user ID header for authentication.  
  - Auto-detects content type and triggers metadata refresh.  
  - Sync: App pulls changes via Supabase real-time subscriptions on launch/foreground, cached in Legend-State.  
- **API Endpoint**: `POST /api/capture` (create item with optional metadata/space_id).

### 2.5 Search & Filtering
- Fuzzy search on title, desc, tags, and metadata (client-side via Fuse.js, using Legend-State cache offline).  
- Filter by content type (dynamically generated from unique item types).  
- Offline: Search/filter cached items only.

### 2.6 Chat/Intelligence
- **Item/Space Chat**:  
  - Initiate from item detail or space detail via bottom sheet UI (using `@gorhom/bottom-sheet`).  
  - Bottom sheet covers prior UI (item detail or space grid); swipe down to dismiss and return to previous view.  
  - Context: Item content or all space items passed to OpenAI API (abstracted for future models like Grok or Llama).  
  - Save chat messages (role: user/system/assistant, content) in Supabase and Legend-State.  
  - Mobile: Handle keyboard dismissal (auto-adjust view) and scrollable chat history.  
  - Offline: Disable chat (requires API); show cached chat history.  
- **AI Integration**:  
  - OpenAI API for tags, summaries (e.g., TL;DR for transcripts), and chat responses.  
  - Abstract API calls via configuration to support future models.  
  - Endpoints: `POST /api/chat/initiate` (start session), `POST /api/chat/save` (add message).  
- **UX**: Clear context indication (e.g., “Chatting about [item title/space name]”) in bottom sheet header.

### 2.7 Integrations & Tools
- **X/Twitter API**: Extract metadata (tweets, videos); handle rate limits with Legend-State persistence.  
- **YouTube API**: Fetch metadata/transcripts via youtubei.js; support video downloads (Expo FileSystem).  
- **Other Services**:  
  - Jina AI for content type detection (if needed).  
  - OpenAI for tags/summaries/chat.  
  - Cheerio for HTML parsing (server-side).  
- **Chrome Extension**: Reuses existing web extension; mobile app consumes same `/api/capture` endpoint.  
- **Mobile Sharing**: iOS Sharesheet via `expo-share-extension`; Android Intent via Expo Sharing API.

## 3. Data Models (Supabase Schema)
- **Users**:  
  - Managed by Supabase auth.  
  - Fields: `id` (UUID, PK), `email` (text).  
- **Items**:  
  - Fields: `id` (UUID, PK), `user_id` (UUID, FK to Users), `title` (text), `url` (text, nullable), `content_type` (enum: bookmark, youtube, x, github, instagram, tiktok, reddit, amazon, linkedin, image, pdf, video, audio, note, article, product, book, course), `content` (text, nullable), `desc` (text, nullable), `thumbnail_url` (text, nullable), `raw_text` (text, nullable), `created_at` (timestamp), `updated_at` (timestamp), `is_archived` (boolean).  
- **Item_Metadata**:  
  - Fields: `item_id` (UUID, PK/FK to Items), `domain` (text, nullable), `author` (text, nullable), `username` (text, nullable), `profile_image` (text, nullable), `published_date` (date, nullable).  
  - Purpose: Stores universal metadata applicable to most content types.  
- **Item_Type_Metadata**:  
  - Fields: `item_id` (UUID, PK/FK to Items), `content_type` (enum, matches Items.content_type), `data` (JSONB).  
  - JSONB `data` examples:  
    - YouTube: `{ "video_url": "...", "views": 123, "duration": "PT5M30S", "transcript": "..." }`  
    - X/Twitter: `{ "likes": 456, "retweets": 78, "replies": 12, "video_url": "..." }`  
    - GitHub: `{ "stars": 789, "forks": 123, "language": "JavaScript" }`  
  - Purpose: Stores type-specific metadata in JSONB, keeping `Item_Metadata` clean.  
- **Spaces**:  
  - Fields: `id` (UUID, PK), `user_id` (UUID, FK to Users), `name` (text), `desc` (text, nullable), `color` (text).  
- **Item_Spaces**:  
  - Fields: `item_id` (UUID, PK/FK to Items), `space_id` (UUID, PK/FK to Spaces), `created_at` (timestamp).  
  - Purpose: Enables items to belong to multiple spaces (future-proof).  
- **Item_Chats**:  
  - Fields: `id` (UUID, PK), `item_id` (UUID, FK to Items), `user_id` (UUID, FK to Users), `created_at` (timestamp).  
  - Purpose: Dedicated table for item-based chat sessions.  
- **Space_Chats**:  
  - Fields: `id` (UUID, PK), `space_id` (UUID, FK to Spaces), `user_id` (UUID, FK to Users), `created_at` (timestamp).  
  - Purpose: Dedicated table for space-based chat sessions.  
- **Chat_Messages**:  
  - Fields: `id` (UUID, PK), `chat_id` (UUID, FK to Item_Chats or Space_Chats), `chat_type` (enum: item, space), `role` (enum: user, system, assistant), `content` (text), `created_at` (timestamp).  
  - Purpose: Links to either `Item_Chats` or `Space_Chats` for clear relationships.  
- **Offline_Queue** (client-side, Legend-State, mirrored in Supabase):  
  - Fields: `id` (UUID, PK), `user_id` (UUID, FK to Users), `action_type` (enum: create_item, update_item, delete_item, create_capture), `payload` (JSONB), `created_at` (timestamp), `status` (enum: pending, synced, failed).  
  - JSONB `payload` examples:  
    - Create item: `{ "title": "...", "url": "...", "content_type": "bookmark" }`  
    - Update item: `{ "item_id": "...", "title": "...", "desc": "..." }`  
  - Purpose: Tracks offline actions for reliable sync with Supabase.

## 4. UI/UX Requirements
- **Navigation**:  
  - Expo Router for file-based navigation.  
  - Bottom tab navigator: Home (Everything), Spaces, Settings.  
  - Stack navigator for Space Detail, Capture (modal), and Chat (bottom sheet).  
  - Item Detail uses expanding card animation (not modal) with hero transitions.  
- **Layouts**:  
  - Mobile: Bottom tab bar; FAB for capture; expanding cards for item detail; modals for capture; bottom sheet for chat.  
  - Tablet: Optional split-screen layout (e.g., spaces list + item grid).  
- **Components**:  
  - **ItemCard**: Type-specific UI (e.g., YouTube video overlay, X video player using Expo AV).  
  - **SpaceCard**: Displays name, desc, color, item count.  
  - **Modals**: Capture, New Space, Settings (dismiss via swipe or button).  
  - **ExpandedItemView**: Full-screen card expansion with hero animation, gesture dismissal, and action buttons.  
  - **Chat Bottom Sheet**: `@gorhom/bottom-sheet` for sliding chat UI; covers prior view; swipe-down to dismiss.  
  - **VideoPlayer**: Expo AV with autoplay, mute, loop, and lazy loading.  
- **iOS Sharesheet** (via `expo-share-extension`):  
  - Custom UI with buttons/dropdown for:  
    - Save directly (no space).  
    - Select existing space (fetched from Supabase or Legend-State cache).  
    - Post-MVP: Create new space (text input, color picker).  
  - Handle URLs, text, images, videos, files.  
  - Offline: Queue saves in Legend-State; sync on reconnect.  
- **Themes**: Light/dark toggle (stored in Legend-State, respects system preference).  
- **Responsive Design**:  
  - Mobile: Two-column FlatList grid; touch-friendly interactions.  
  - Tablet: Adjust grid columns based on screen width.  
- **Performance**:  
  - Infinite scroll with FlatList (20 items/page).  
  - Cache items/metadata in Legend-State for offline access and optimized refetching (using `supabase-cache-helpers` for delta updates).  
  - Lazy-load images/videos using Expo Image/Expo AV.  
  - Real-time updates via Supabase subscriptions (synced to Legend-State).  
- **Accessibility**:  
  - Main app: Support VoiceOver (iOS) and TalkBack (Android), dynamic type scaling, high-contrast colors, minimum 48x48 dp touch areas.  
  - iOS Sharesheet: Limited accessibility due to `expo-share-extension` dynamic type scaling conflict (version as of Sep 2025); prioritize `accessibilityLabel` and `accessibilityHint` for buttons but defer full dynamic type support until resolved upstream.  
  - Test with VoiceOver/TalkBack for core flows (navigation, capture, item viewing).

## 5. APIs & Endpoints
- **Auth**:  
  - `/auth/callback`: Handle magic link/OAuth redirect (Expo AuthSession for mobile).  
- **Items**:  
  - `GET/POST /api/items`: List, create, or search items (cached in Legend-State).  
  - `POST /api/refresh-metadata`: Update item metadata (online only).  
- **Capture**:  
  - `POST /api/capture`: Create item from URL/text/image.  
  - `POST /api/chrome-extension/save`: Extension-specific capture.  
- **Chat**:  
  - `POST /api/chat/initiate`: Start chat session (OpenAI, abstracted for future models).  
  - `POST /api/chat/save`: Save chat message.  
- **Metadata**:  
  - `POST /api/extract-metadata`: General metadata extraction.  
  - `POST /api/youtube-metadata`: YouTube-specific metadata.  
  - `POST /api/refresh-metadata`: Refresh item metadata.  
- **Tools**:  
  - `POST /api/transcript`: Fetch YouTube transcript.  
  - `POST /api/download-video`: Download video (store via Expo FileSystem).  
  - `POST /api/get-download-url`: Get temporary download URL.  
  - `POST /api/summarize-transcript`: Generate summary (OpenAI).  
  - `POST /api/generate-tags`: Generate tags (OpenAI).  
  - `GET /api/x-api-status`: Check X API rate limits.  
- **Offline Handling**:  
  - Queue API requests in Legend-State.  
  - Retry on reconnect with exponential backoff (handled by Legend-State sync).

## 6. Non-Functional Requirements
- **Security**:  
  - Supabase Row-Level Security (RLS) ensures user-owned data isolation.  
  - API endpoints require auth tokens (Supabase JWT).  
  - Secure local storage (Legend-State with AsyncStorage encryption for sensitive data).  
- **Performance/Scale**:  
  - Cache items and metadata in Legend-State for fast offline access and delta refetching (`supabase-cache-helpers`).  
  - Paginate API calls (20 items/page).  
  - Optimize battery usage (e.g., limit background sync, lazy-load media).  
  - Real-time updates via Supabase subscriptions (debounced, synced to Legend-State).  
- **Error Handling**:  
  - Graceful fallback for metadata extraction failures (save item with basic data, mark “pending”).  
  - Network errors: Queue actions in Legend-State; notify user (e.g., “Action will sync when online”).  
  - Crash reporting: Defer Sentry integration to post-MVP; log errors locally for debugging.  
- **Analytics**:  
  - Defer Sentry for crash reporting and analytics (screen views, button taps).  
  - Post-MVP: Integrate `@sentry/react-native` for mobile-specific telemetry.  
- **Deployment**:  
  - Expo EAS for iOS/Android builds and updates.  
  - Supabase for backend (same as web).  
  - Vercel for API hosting (unchanged from web).  
- **Offline Support**:  
  - Cache items, spaces, and chat history in Legend-State.  
  - Queue create/update/delete/capture actions in `Offline_Queue` for sync.  
  - Disable AI chat and metadata refresh when offline; show “pending” UI for incomplete items.  
- **Testing**:  
  - Unit tests for components (React Testing Library).  
  - E2E tests for auth, capture, and navigation (Detox or similar).  
  - Manual testing for Sharesheet/Intent, offline scenarios, and accessibility.

## 7. Later Nice-to-Have To-Dos
- **Export/Import Data**:  
  - **Export**: Provide two CSV export options:  
    - Lean: URLs, titles, and space (blank if unassigned).  
    - Comprehensive: Full metadata for all items.  
  - **Import**: Accept CSV files (lean or comprehensive) to reconstruct items in Supabase, with validation to prevent duplicates or errors.  
  - Implementation: Use libraries like `papaparse` for CSV handling; defer to post-MVP due to complexity.  
- **iOS Sharesheet Space Creation**: Add option to create new space (text input for name, color picker) in `expo-share-extension` UI.  
- **Additional AI Models**: Integrate other LLMs (e.g., Grok, Llama) alongside OpenAI, leveraging abstracted API layer.  
- **Sentry Analytics**: Integrate `@sentry/react-native` for crash reporting, screen views, and user interaction tracking.