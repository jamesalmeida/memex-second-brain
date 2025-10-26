# Memex: Second Brain - Product Requirements Document (PRD)

## 1. Product Overview
**Name**: Memex: Second Brain  
**Description**: A personal knowledge management tool for capturing, organizing, and searching digital content (links, text, images, files) in an intelligent inbox with spaces (projects/folders), tags, and metadata extraction. Supports cross-platform capture via Chrome extension (web) and iOS Sharesheet/Android Intent (mobile). Users can chat with an LLM about individual items or spaces, using content as context.  
**Target Users**: Researchers, creators, and individuals managing digital content.  
**Key Goals**: Secure authentication; intuitive and fast content capture and triage; AI chats with saved items to absorb content faster. Cross-platform consistency (web to mobile); offline-first support; seamless integration with Chrome extension and mobile Sharesheet.  
**Platforms**:  
- Mobile: This app is for iOS/Android via React Native + Expo.  
- Web: Next.js, Vercel-hosted. (Not this repo yet but will later work on Web to connect to same DB).  
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
- Initially juswt email and password login.
- Eventaully add more login options:
  - Passwordless login via Supabase magic links (email OTP).  
  - Google OAuth sign-in (using Expo AuthSession for native OAuth flow).  
  - Apple sign-in 
- Auto-redirect to home screen on auth success; to login screen on failure or session expiry.  
- User ID display and copy functionality for Chrome extension integration.  
- Sign-out clears local session (Legend-State and AsyncStorage).  
- Offline: Display cached user profile (via Legend-State); prompt login on connectivity for API actions.

### 2.2 Dashboard & Views
- **Home/Everything Grid View**: Displays all items in a scrollable two-column grid (FlatList). Features:  
  - Search bar for fuzzy search (title, desc, tags, metadata).  
  - Filter by content type (e.g., bookmark, YouTube).  
  - Floating action button (FAB) for quick capture.  
  - Offline: Show cached items via Legend-State; queue new items for sync.  
- **Chat View**: Swiping over from space to chat will initiate or continue a previous chat with all items from that space as context.
- **Space Grid View**: Filtered item grid for a specific space. Includes:  
  - Swiping from Everything Grid scrolls into Space grid while also updating the HeaderBar to show selected Space. Scrolling the HeaderBar and tapping a Space auto scrolls to that Space.
  - To initiate AI chat with space content as context the user can use NativeTab in the BottomNavigation to slide over to Chat-mode with that space.  
  - Offline: Cached space items; queue edits.  
- **Item Detail Expanded Card**: Full-screen expanding card animation for item details (title, content, metadata, media). Features:  
  - Expands from grid position to full screen with hero animation (like iOS App Store)  
  - Smooth reverse animation back to original grid position on close  
  - Swipe-down to dismiss  
  - Actions: Edit title/desc/metadata, archive, delete, move to another space  
  - Initiate AI chat with item content as context (via bottom sheet that slides over the expanded card)  
  - Download media (if applicable) or open external URL  
  - Offline: View cached details; queue edits/deletes  
- **Settings Modal**: Displays user email/ID, theme toggle (light/dark), sign-out, and more options.
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
- **Tag Management**:
  - Access via "Manage Tags" button in drawer menu (below Settings).
  - Bottom sheet UI displays all unique tags with usage counts (sorted by frequency).
  - **Edit Tag**: Rename a tag across all items. If the new tag name already exists, prompts to merge (all items with old tag receive new tag, duplicates removed).
  - **Delete Tag**: Remove tag from all items with confirmation dialog showing item count.
  - Tag updates sync to all affected items via `itemsActions.updateItemWithSync()`.
  - Full dark mode support; follows existing bottom sheet patterns.
  - Empty state displayed when no tags exist.  
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
  - Fields: `id` (UUID, PK), `user_id` (UUID, FK to Users), `title` (text), `url` (text, nullable), `content_type` (enum: bookmark, youtube, youtube_short, x, github, instagram, facebook, threads, tiktok, reddit, amazon, linkedin, image, pdf, video, audio, podcast, note, article, product, book, course, movie, tv_show), `content` (text, nullable), `desc` (text, nullable), `thumbnail_url` (text, nullable), `raw_text` (text, nullable), `tags` (text[], nullable), `created_at` (timestamp), `updated_at` (timestamp), `is_archived` (boolean).  
  - Note: `tags` field is a TEXT array for categorization and search with GIN index for efficient array operations.  
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
- **Image_Descriptions**:  
  - Fields: `id` (UUID, PK), `item_id` (UUID, FK to Items), `image_url` (text), `description` (text), `model` (text), `fetched_at` (timestamp), `created_at` (timestamp), `updated_at` (timestamp).  
  - Purpose: Stores AI-generated descriptions of images to provide context for AI chat.  
  - Unique constraint on (`item_id`, `image_url`) - one description per image URL per item.  
- **Video_Transcripts**:  
  - Fields: `id` (UUID, PK), `item_id` (UUID, FK to Items), `transcript` (text), `platform` (text: youtube, x, tiktok, instagram, reddit, etc.), `language` (text, default 'en'), `duration` (integer, seconds), `fetched_at` (timestamp), `created_at` (timestamp), `updated_at` (timestamp).  
  - Purpose: Stores transcripts for videos from various platforms.  
  - Unique constraint on `item_id` - one transcript per video item.  
- **Spaces**:  
  - Fields: `id` (UUID, PK), `user_id` (UUID, FK to Users), `name` (text), `desc` (text, nullable), `description` (text, nullable), `color` (text, default '#007AFF'), `item_count` (integer, default 0), `order_index` (integer, nullable), `created_at` (timestamp), `updated_at` (timestamp).  
  - Note: `description` is an alternative field for `desc`; `item_count` is denormalized for performance; `order_index` enables custom space ordering.  
- **Item_Spaces**:  
  - Fields: `item_id` (UUID, PK/FK to Items), `space_id` (UUID, PK/FK to Spaces), `created_at` (timestamp).  
  - Purpose: Enables items to belong to multiple spaces (future-proof).  
- **Item_Chats**:  
  - Fields: `id` (UUID, PK), `item_id` (UUID, FK to Items), `user_id` (UUID, FK to Users), `title` (text, nullable), `created_at` (timestamp), `updated_at` (timestamp).  
  - Purpose: Dedicated table for item-based chat sessions. `title` allows naming conversations; `updated_at` is auto-updated via trigger when messages are added.  
- **Space_Chats**:  
  - Fields: `id` (UUID, PK), `space_id` (UUID, FK to Spaces), `user_id` (UUID, FK to Users), `title` (text, nullable), `created_at` (timestamp), `updated_at` (timestamp).  
  - Purpose: Dedicated table for space-based chat sessions. `title` allows naming conversations; `updated_at` is auto-updated via trigger when messages are added.  
- **Chat_Messages**:  
  - Fields: `id` (UUID, PK), `chat_id` (UUID, FK to Item_Chats or Space_Chats), `chat_type` (enum: item, space), `role` (enum: user, system, assistant), `content` (text), `metadata` (JSONB, default '{}'), `created_at` (timestamp).  
  - Purpose: Links to either `Item_Chats` or `Space_Chats` for clear relationships. `metadata` stores AI model info, token usage, and timestamps.  
- **Offline_Queue** (client-side, Legend-State, mirrored in Supabase):  
  - Fields: `id` (UUID, PK), `user_id` (UUID, FK to Users), `action_type` (enum: create_item, update_item, delete_item, create_capture), `payload` (JSONB), `created_at` (timestamp), `status` (enum: pending, synced, failed).  
  - JSONB `payload` examples:  
    - Create item: `{ "title": "...", "url": "...", "content_type": "bookmark" }`  
    - Update item: `{ "item_id": "...", "title": "...", "desc": "..." }`  
  - Purpose: Tracks offline actions for reliable sync with Supabase.  
- **Performance Indexes**:  
  - Items: `idx_items_user_id`, `idx_items_content_type`, `idx_items_created_at`, `idx_items_is_archived`, `idx_items_tags` (GIN on tags array).  
  - Spaces: `idx_spaces_user_id`, `idx_spaces_user_order` (user_id, order_index).  
  - Item_Spaces: `idx_item_spaces_item_id`, `idx_item_spaces_space_id`.  
  - Chat_Messages: `idx_chat_messages_chat_id`, `idx_chat_messages_created_at`, `idx_chat_messages_chat_id_created_at`, `idx_chat_messages_chat_type`, `idx_chat_messages_metadata` (GIN on JSONB).  
  - Video_Transcripts: `idx_video_transcripts_item_id`, `idx_video_transcripts_created_at`, `idx_video_transcripts_platform`.  
  - Image_Descriptions: `idx_image_descriptions_item_id`, `idx_image_descriptions_created_at`.  
  - Offline_Queue: `idx_offline_queue_user_id`, `idx_offline_queue_status`.

## 4. UI/UX Requirements
- **Navigation**:  
  - Expo Router for file-based navigation.  
  - HeaderBar horizontally scrolls Space names to let user tap or swipe to change Everything Grid to specific Space grids
  - Bottom tab navigator: Home (Everything), Chats.  
  - Stack navigator for Capture (modal), and Chat (bottom sheet).  
  - Item Detail uses expanding card animation (not modal) with hero transitions.
- **Layouts**:  
  - Mobile: Filter Button; Bottom tab bar; FAB for capture; bottom sheet for item details, new item captures, item chats, settings; ContextMenu for Filter; Drawer for organizing Spaces and opening settings.   
  - Tablet: Optional Drawer stays open or hides. Grid defaults to being 4 columns rather than 2 like mobile.   
- **Components**:
  - **ItemCard**: Type-specific UI (e.g., YouTube video overlay, X video player using Expo AV).
  - **Bottom Sheets**: Expanded Items, Capture, New Space, Edit Space, Settings, Tag Manager, Item Chats (dismiss via swipe or button). `@gorhom/bottom-sheet` for sliding chat UI; covers prior view; swipe-down to dismiss.
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

## 5. APIs & Architecture
The app uses an **offline-first architecture** with Supabase for backend data, direct client-side API calls for external services, and Legend-State for local state management.

### 5.1 Authentication (`src/services/supabase.ts`)
- **Supabase Auth SDK** - Direct SDK calls, no REST endpoints:
  - `auth.signUp(email, password)` - Create new account
  - `auth.signIn(email, password)` - Sign in with credentials
  - `auth.signOut()` - Sign out user
  - `auth.getSession()` - Get current session
  - `auth.getCurrentUser()` - Get current user
  - `auth.onAuthStateChange(callback)` - Listen for auth state changes
- **OAuth Callbacks**: Handled via Expo AuthSession for mobile OAuth flows (`app/auth/callback.tsx`)

### 5.2 Database Operations (`src/services/supabase.ts`)
All data operations use **Supabase Client SDK** via the `db` helper object:

- **Items**:
  - `db.getItems(userId, limit, offset)` - Fetch user's items with metadata
  - `db.searchItems(userId, query, limit, offset)` - Search items by title/content/tags
  - `db.createItem(item)` - Create new item
  - `db.updateItem(id, updates)` - Update item fields
  - `db.deleteItem(id)` - Delete item
  
- **Spaces**:
  - `db.getSpaces(userId)` - Fetch user's spaces with item counts
  - `db.createSpace(space)` - Create new space
  
- **Video Transcripts**:
  - `db.getVideoTranscript(itemId)` - Get transcript for item
  - `db.getVideoTranscriptsByPlatform(platform)` - Get transcripts by platform (YouTube, X, etc.)
  - `db.saveVideoTranscript(transcript)` - Save/upsert transcript
  - `db.deleteVideoTranscript(itemId)` - Delete transcript
  
- **Image Descriptions**:
  - `db.saveImageDescription(description)` - Save AI-generated image description
  - `db.deleteImageDescription(itemId, imageUrl?)` - Delete image description(s)
  
- **Chat**:
  - `db.getChatMessages(chatId, chatType)` - Get chat messages for item or space
  - `db.createChatMessage(message)` - Save chat message

### 5.3 Supabase Edge Functions
- **`POST /functions/v1/extract-metadata`** (`supabase/functions/extract-metadata/index.ts`):
  - General metadata extraction for URLs
  - Request: `{ url: string, contentType?: string }`
  - Response: `{ title, description, thumbnail_url, domain, author, published_date, content_type }`
  - Supports: YouTube, Twitter/X, GitHub, generic web pages

### 5.4 External APIs (Client-Side)
All external API calls are made directly from the client (`src/services/` and `src/config/api.ts`):

- **OpenAI API** (`src/services/openai.ts`):
  - `openai.createChatCompletion(messages, options)` - Chat completions
  - `openai.generateTags(content, contentType)` - Auto-generate tags
  - `openai.summarizeContent(content, contentType)` - Generate summaries
  - `openai.chatWithContext(context, userMessage, previousMessages)` - Context-aware chat
  - `openai.chatWithContextEnhanced(...)` - Enhanced chat with metadata
  - `openai.describeImage(imageUrl, options)` - Vision API for image descriptions
  - `openai.fetchAvailableModels()` - Get available models

- **Twitter/X API v2** (`src/services/twitter.ts`):
  - `fetchTweetData(tweetId)` - Get tweet with author, metrics, media, quoted tweets
  - `extractTweetId(url)` - Extract tweet ID from URL
  - `getVideoUrlFromMetadata(metadata)` - Extract video URL from tweet
  - `getXVideoTranscript(videoUrl, onProgress?)` - Transcribe X videos via AssemblyAI

- **YouTube** (`src/services/youtube.ts`):
  - Uses `youtubei.js` library (no API key required)
  - `extractYouTubeData(url)` - Get video metadata (title, description, thumbnail, author, duration, view count)
  - `getYouTubeTranscript(videoId)` - Get video transcript with language detection
  - Supports regular videos and YouTube Shorts

- **AssemblyAI API** (`src/services/assemblyai.ts`):
  - `transcribeVideo(videoUrl, onProgress?)` - Transcribe video audio to text
  - `submitTranscription(videoUrl)` - Submit video for transcription
  - `getTranscriptionStatus(transcriptId)` - Poll transcription status
  - Used for X/Twitter videos and other video content

- **Instagram oEmbed API** (`src/services/instagram.ts`):
  - `fetchInstagramData(url)` - Get post metadata via Meta's oEmbed endpoint
  - `extractInstagramPostId(url)` - Extract post ID from URL
  - Returns: caption, author, media info, embed HTML

- **Reddit JSON API** (`src/services/reddit.ts`):
  - `fetchRedditPostData(url)` - Get post data (no auth required)
  - Returns: title, selftext, author, subreddit, images, videos, metrics, flair
  - Supports: regular posts, gallery posts, video posts, share links

- **Jina.ai URL Scraping** (`src/config/api.ts`):
  - Configured for general URL content extraction
  - Fallback for unsupported content types

### 5.6 Client-side URL Parsing (Linkedom)
- For basic saves on mobile, the app fetches the target URL directly on-device and parses HTML using `linkedom` (`src/services/linkedomParser.ts`).
- Extracted fields:
  - title → stored in `items.title`
  - description → stored in `items.desc`
  - lead image → stored in `items.thumbnail_url`
  - full HTML → stored in `items.content` (for offline viewing)
- This reduces reliance on AI for simple metadata and speeds up saves.
- If a site blocks fetch or lacks metadata, we save a minimal item and skip enrichment. Premium AI enrichments remain available but are not invoked for basic saves.

#### Invalid URL Handling
- When the pasted input is not a valid URL, `parseUrlWithLinkedom` signals an invalid state. In that case, `Step01_ParseLinkedom` converts the item into a note:
  - Set `content_type` to `note`
  - Set `title` to an empty string
  - Set `desc` to the original pasted text
  - Clear `url`, `thumbnail_url`, and parsed HTML `content`
  - Subsequent detection/enrichment steps naturally skip because the item is no longer a `bookmark`

### 5.5 Sync Service & Offline Handling (`src/services/syncService.ts`)
The app uses an **offline-first architecture** with automatic sync:

- **Local Storage**: Legend-State stores backed by AsyncStorage
  - Items, Spaces, ItemSpaces, ItemMetadata, ItemTypeMetadata, VideoTranscripts
  - All data cached locally for offline access

- **Sync Operations** (`syncService.ts`):
  - `syncService.syncToCloud()` - Full bidirectional sync (spaces → items → metadata → transcripts)
  - `syncService.uploadItem(item, userId)` - Upload single item
  - `syncService.updateItem(itemId, updates)` - Update item online/offline
  - `syncService.deleteItem(itemId)` - Delete item online/offline
  - `syncService.uploadSpace(space, userId)` - Upload space
  - `syncService.updateSpace(space)` - Update space
  - `syncService.deleteSpace(spaceId)` - Delete space
  - `syncService.addItemToSpace(itemId, spaceId)` - Create relationship
  - `syncService.removeItemFromSpace(itemId, spaceId)` - Remove relationship
  - `syncService.uploadVideoTranscript(transcript)` - Upload transcript
  - `syncService.deleteVideoTranscript(itemId)` - Delete transcript

- **Offline Queue** (`src/stores/offlineQueue.ts`):
  - Queues all write operations when offline
  - Automatically processes queue on reconnect
  - Supports: create_item, update_item, delete_item, add_item_to_space, remove_item_from_space, save_video_transcript, delete_video_transcript

- **Network Detection**:
  - Periodic connection checks (every 30 seconds)
  - Online/offline status tracking
  - Automatic sync trigger when coming online

- **Conflict Resolution**:
  - Newest-wins strategy based on `updated_at` timestamps
  - Bi-directional sync with merge logic
  - Orphaned data cleanup utilities

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