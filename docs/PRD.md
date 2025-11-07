# Memex: Second Brain - Product Requirements Document (PRD)

## Table of Contents
1. [Product Overview](#1-product-overview)
2. [Core Features](#2-core-features)
   - 2.1 [Authentication](#21-authentication)
   - 2.2 [Dashboard & Views](#22-dashboard--views)
   - 2.3 [Item Management](#23-item-management)
   - 2.4 [Capture/Save](#24-capturesave)
   - 2.5 [Search & Filtering](#25-search--filtering)
   - 2.6 [Chat/Intelligence](#26-chatintelligence)
   - 2.7 [Integrations & Tools](#27-integrations--tools)
   - 2.8 [iOS Share Extension](#28-ios-share-extension)
3. [Data Models (Supabase Schema)](#3-data-models-supabase-schema)
4. [UI/UX Requirements](#4-uiux-requirements)
5. [APIs & Architecture](#5-apis--architecture)
   - 5.1 [Authentication](#51-authentication-srcservicessupabasets)
   - 5.2 [Database Operations](#52-database-operations-srcservicessupabasets-and-srcservicessyncoperationsts)
   - 5.3 [Supabase Edge Functions](#53-supabase-edge-functions)
   - 5.4 [External APIs (Client-Side)](#54-external-apis-client-side)
   - 5.5 [Sync Service & Offline Handling](#55-sync-service--offline-handling-srcservicessyncservicets)
   - 5.6 [Real-time Cross-Device Sync](#56-real-time-cross-device-sync-srcservicesrealtimesyncts)
   - 5.7 [ItemView Component Architecture](#57-itemview-component-architecture)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Later Nice-to-Have To-Dos](#7-later-nice-to-have-to-dos)

---

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
- **Radial Action Menu**: Quick access to item actions via long-press gesture on item cards. Features:
  - **Activation**: Long-press (200ms) on any item card in grid view
  - **Visual Feedback**:
    - Card scales to 1.05x and rotates 2° during long-press
    - Radial menu buttons animate outward from touch point
    - Full-screen dark overlay appears behind menu
    - Floating clone of item card appears at original position with glow effect
  - **Interaction**:
    - User drags finger to desired action button (without lifting)
    - Hovered button scales to 1.3x and changes color for immediate visual feedback
    - Release finger to execute hovered action
    - Cancel by releasing without hovering any button
  - **Available Actions**:
    - **Chat**: Opens AI chat with item as context (expands item card + opens chat sheet)
    - **Share**: Opens native share sheet with item URL and title
    - **Archive**: Moves item to archive (soft archive with `is_archived=true`). Dynamically becomes "Unarchive" when long-pressing an archived item.
    - **Unarchive**: Restores archived item to active state (sets `is_archived=false`, `auto_archived=false`). Automatically replaces "Archive" button when item is archived (both manually archived and auto-archived from space archive).
    - **Delete**: Soft-deletes item (tombstone pattern with `is_deleted=true`), requires confirmation alert
    - **Move to Space**: Opens SpaceSelectorModal to reassign item to different space
  - **Configuration**:
    - Users can customize which 3 actions appear in menu via "Configure Action Button" in drawer
    - Default actions: Chat, Share, Archive
    - Selection range: 1-3 actions (enforced by ActionMenuConfigModal)
    - Configuration stored in `User_Settings.ui_radial_actions` and syncs across devices
    - ActionMenuConfigModal displays all 5 configurable actions (Chat, Share, Archive/Unarchive, Delete, Move) with descriptions, icons, and selection indicators
    - Note: Archive and Unarchive are treated as one configurable action that dynamically switches based on item state
  - **Implementation**:
    - Context: `RadialMenuContext` manages menu state, touch tracking, and action execution
    - Wrapper: `RadialActionMenu` component wraps each item card with touch responders
    - Overlay: `RadialMenuOverlay` renders full-screen modal with buttons and floating card clone
    - Components: `src/contexts/RadialMenuContext.tsx`, `src/components/items/RadialActionMenu.tsx`, `src/components/ActionMenuConfigModal.tsx`
  - **Performance**:
    - Buttons positioned dynamically based on touch location (left/right side of screen)
    - Arc angle: 110° centered 45° from touch point (upper-right if left side, upper-left if right side)
    - Button radius: 80px from touch point
    - Haptic feedback on menu open, button hover, and action execution
  - **Offline**: All actions queue for sync when offline (archive, delete, move use sync service)  
- **Settings Modal**: Displays user email/ID, theme toggle (light/dark), sign-out, and more options.
- **Admin Sheet** (`AdminSheet.tsx`): Developer/admin panel accessible via drawer menu. Features:
  - **Access Control**: Only visible to users with `user_settings.is_admin = true`
    - Admin button appears in drawer menu when user has admin privileges
    - Checked via `isAdminComputed()` from `adminCheck.ts` (reads from `userSettingsStore`)
    - Reactive: button automatically shows/hides when admin status changes
  - **AI Automation (Global Settings)**: System-wide toggles that apply to ALL users:
    - Auto-generate transcripts - Automatically extract video transcripts when new items are added
    - Auto-generate image descriptions - Automatically generate AI descriptions for images
    - Auto-generate TLDR - Automatically generate AI summaries after item pipeline completion
    - Settings stored in `admin_settings` table (single global row)
    - Managed by `adminSettingsStore` with cloud sync
  - **YouTube Source Preferences**: Toggle between `youtubei.js` and `SerpAPI` for:
    - YouTube enrichment (metadata extraction)
    - YouTube transcripts (timestamped vs plain text)
    - Settings stored in `admin_settings` table globally
  - **SerpAPI Status Section**: Displays comprehensive account information from SerpAPI Account API:
    - Account ID, email, plan name, monthly price
    - Monthly limit, current usage, searches left
    - Extra credits, last hour searches, hourly rate limit
    - Auto-refreshes when sheet opens for real-time data
    - Manual refresh button for on-demand updates
  - **UI Debug Tools**: Test toast notifications, etc.
  - Implementation: `src/components/AdminSheet.tsx`, `src/stores/adminSettings.ts`, `src/utils/adminCheck.ts`
- **Search**: Global fuzzy search across items (client-side via Fuse.js, using Legend-State cache offline).  
- **Infinite Scroll/Pagination**: Load 20 items per page using FlatList’s `onEndReached`. Cache in Legend-State for offline access.  
- **Real-Time Updates**: Supabase real-time subscriptions for item changes (add/update/delete) when online, synced to Legend-State.  
- **Empty States**: Custom UI for no items or no search results, with offline messaging (e.g., “No cached items”).

### 2.3 Item Management
- **Item Types**: Bookmark, YouTube, X (Twitter), GitHub, Instagram, TikTok, Reddit, Amazon, LinkedIn, image, PDF, video, audio, note, article, product, book, course. Auto-detected via URL patterns or metadata.
- **Item Data**: See [Data Models](#3-data-models-supabase-schema) for details.
  - **TLDR**: AI-generated summary of item content using full context (description, transcript, images, metadata). Generated via OpenAI on demand and stored in `Items.tldr` field.
  - **Notes**: User's personal notes and annotations about the item. Stored in `Items.notes` field as free-form text.
- **Space Assignment**: Each item belongs to exactly ONE space (or none). Managed via `Items.space_id` field.
  - Users select space via modal UI (SpaceSelectorModal component)
  - "Everything (No Space)" option available for unassigned items
  - Space changes sync instantly across devices via real-time subscriptions
- **Actions**:
  - **Create**: Via FAB, Sharesheet/Intent, or Chrome extension. Auto-detect type and fetch metadata (online only).
  - **Update**: Edit title, desc, or metadata; refresh metadata from source (online only).
  - **Archive**: Mark item as archived (`is_archived=true`, `archived_at` timestamp). Archived items hidden from main views but retained in database.
    - Manual archive: User explicitly archives an item via archive button in ItemView or context menu
    - Auto-archive: Item automatically archived when parent space is archived (tracked via `auto_archived=true` flag)
    - Archive syncs to Supabase immediately, propagates to other devices via real-time subscriptions
    - Unarchive: Restore archived item to active state. Auto-archived items can be selectively restored when parent space is unarchived.
    - **UX**: ItemView sheet closes immediately when user triggers archive/unarchive; LoadingModal displays in background during operation; toast notification confirms success/failure
  - **Space Archive**: Archive entire space and all items within it
    - User confirms via alert: "Archive [space name]? This will also archive all X item(s) inside."
    - All items in space marked with `is_archived=true`, `archived_at` timestamp, and `auto_archived=true`
    - Space marked with `is_archived=true` and `archived_at` timestamp
    - Changes sync to Supabase and propagate instantly to other devices
    - Archived spaces hidden from drawer, header tabs, and all space selectors
  - **Delete**: Soft-delete using tombstone pattern (`is_deleted=true`, `deleted_at` timestamp).
    - Items marked as deleted are retained locally for cross-device sync reliability
    - Prevents "resurrection bug" where offline devices re-upload deleted items
    - UI filters out deleted items automatically
    - **UX**: ItemView sheet closes immediately when user triggers delete; LoadingModal displays in background during operation; toast notification confirms success/failure
  - **Move**: Reassign to different space by updating `Items.space_id` field. Queue offline.
  - **Space Deletion**: When deleting a space with items, user chooses:
    - "Move to Everything" - Sets `space_id=null` for all items in space
    - "Delete All" - Soft-deletes the space and all items within it
- **Metadata Extraction**:
  - On create/refresh: Fetch title, desc, thumbnail, and type-specific data (e.g., YouTube views, X likes).
  - Services: `urlMetadataService` (scraping/API), YouTube.js, X API.
  - Offline: Store minimal data (e.g., URL, title) with "pending" UI (e.g., loading spinner or badge); queue metadata refresh for online sync.
- **Media Handling**:
  - Display images/videos in cards (Expo AV for video playback).
  - Show transcripts for videos (if cached).
  - **YouTube Transcript Display** (`YouTubeItemView.tsx`):
    - Toggle between timestamped segments (from SerpAPI) and plain text views
    - Timestamped view shows each segment with `[mm:ss]` prefix
    - Plain text view extracts text from segments or displays stored transcript
    - Copy transcript to clipboard and export as SRT format
  - Download media via Expo FileSystem (store locally for offline access).
  - **Multi-Image Support**: Items can have multiple images stored in `Item_Type_Metadata.data.image_urls[]` array:
    - Display as horizontal carousel with pagination dots when 2+ images exist
    - Carousel supports swipe gesture to navigate between images
    - Long-press context menu on any image provides:
      - "View Full Screen" - Opens image in full-screen viewer
      - "Copy Image" - Copies the actual image to device clipboard/pasteboard (not just URL)
      - "Copy Image URL" - Copies image URL to clipboard
      - "Share Image" - Opens native share sheet to share the actual image file to other apps
      - "Save to Device" - Downloads image to device photo library
      - "Add Another Image" - Opens ImageUploadModal to add additional image
      - "Remove Image" - Deletes the currently displayed image from carousel
    - Delete removes only the current image being viewed (tracked by carousel index)
    - Single image displays with add/remove options via long-press menu
    - **YouTube Thumbnail Actions**: YouTube item thumbnails also support the full set of image actions including copy/share image directly
    - Implemented in: YouTubeItemView, NoteItemView, DefaultItemView, XItemView, RedditItemView, MovieTVItemView
    - Images managed via `itemTypeMetadataActions.addImageUrl()` and `itemTypeMetadataActions.removeImageUrl()`
    - Copy/Share functionality downloads image to cache, performs operation, then cleans up cached file automatically

### 2.4 Capture/Save
- **Quick Capture**:
  - In-app: FAB opens AddItemSheet modal (via `@gorhom/bottom-sheet`) to paste URL/text or upload image
    - Space selection via dropdown showing active spaces only (excludes archived/deleted)
    - Items created with `space_id` field set directly (one-space-per-item model)
    - Auto-detects content type and triggers metadata extraction pipeline
    - Pipeline preserves `space_id` during enrichment steps
  - Mobile:
    - **iOS Sharesheet**: Use `expo-share-extension` for custom UI with options:
      - Save directly (no space assigned).
      - Select existing space from dropdown (fetched from Supabase or cached in Legend-State).
      - Post-MVP: Create new space (text input, color picker).
      - Handle URLs, text, images, videos, files.
      - Authentication via shared app group (Supabase JWT persisted).
    - **Android Intent**: Use Expo Sharing API to capture URLs, text, or images; same save options as Sharesheet.
    - Offline: Queue captures in Legend-State with minimal data (e.g., URL, text); sync on reconnect; show "pending" UI for incomplete items.
- **Chrome Extension**:
  - Saves page/selection (URL, title, text) via `POST /api/capture`.
  - Requires user ID header for authentication.
  - Auto-detects content type and triggers metadata refresh.
  - Sync: App pulls changes via Supabase real-time subscriptions on launch/foreground, cached in Legend-State.
- **API Endpoint**: `POST /api/capture` (create item with optional metadata/space_id).
- **Space Assignment on Creation**: Items created via AddItemSheet include `space_id` in the initial item object, which is uploaded to Supabase via `syncOperations.uploadItem()` to ensure the space assignment persists across devices from the moment of creation.

### 2.5 Search & Filtering
- Fuzzy search on title, desc, tags, and metadata (client-side via Fuse.js, using Legend-State cache offline).
- Filter by content type (single selection - dynamically generated from unique item types).
- Filter by tags (multi-select - user can select multiple tags to filter items).
- **Filter Pills UI**: Active filters are displayed as dismissible pills above the item grid (below HeaderBar):
  - Content type filter shown as a pill with the type name
  - Each selected tag shown as an individual pill
  - Each pill has an X button to remove that specific filter
  - Pills are horizontally scrollable if they exceed screen width
  - Pills only appear when filters are active
  - Styled consistently with theme (light/dark mode support)
- **Tag Management**: Users can manage all tags via Tag Manager bottom sheet:
  - Access via "Manage Tags" button in drawer (below Settings button)
  - View all tags with item counts
  - Edit tag names (inline editing with save/cancel)
  - Delete tags (removes from all items after confirmation)
  - **Tag Merging**: When editing a tag to a name that already exists, user is prompted to merge:
    - All items with old tag are updated to use the existing tag
    - Duplicate tags are automatically removed from items
    - Confirmation alert before merge operation
  - Bottom sheet uses same 82% height as Settings sheet
  - Covers bottom navigation when open
- Offline: Search/filter cached items only.

### 2.6 Chat/Intelligence
- **Item/Space Chat**:  
  - Initiate from item detail or space detail via bottom sheet UI (using `@gorhom/bottom-sheet`).  
  - Bottom sheet covers prior UI (item detail or space grid); swipe down to dismiss and return to previous view.  
  - Context: Item content or all space items passed to OpenAI API (abstracted for future models like Grok or Llama).  
  - **Timestamped Transcripts**: For videos with SerpAPI transcripts, AI chat context prefers timestamped segments over plain text to enable LLM to reference specific timestamps (e.g., "at 3:45, the speaker mentions..."). Segments formatted as `[mm:ss] text` in context.
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
- **Mobile Sharing**: iOS Sharesheet via `expo-share-extension` (see Section 2.8 for complete implementation); Android Intent via Expo Sharing API.

### 2.8 iOS Share Extension
Comprehensive documentation for the iOS Share Extension implementation using `expo-share-extension` v5.0.1.

**Processing Architecture**: The share extension uses a **pending items processing flow** where items are saved to a `pending_items` table and processed asynchronously via database triggers and Edge Functions. This provides fast extension dismissal (~1-2 seconds) while heavy metadata extraction and AI processing happens in the background. The main app displays a processing banner and receives real-time updates via Supabase Realtime subscriptions.

#### Architecture Overview
- **Package**: `expo-share-extension` v5.0.1 - Enables sharing content from other iOS apps into Memex
- **Entry Points**:
  - Main app: `/index.js` → expo-router
  - Share extension: `/index.share.js` → ShareExtension component
- **Component**: `/src/components/ShareExtension.tsx` - Main React Native UI
- **Metro Config**: `/metro.config.js` - Uses `withShareExtension()` wrapper for dual-bundle support
- **Bundle ID**: `com.jamesalmeida.memex.ShareExtension`

#### Polyfills & Dependencies
The share extension requires these polyfills in `index.share.js`:
- `event-target-polyfill` - Event handling compatibility
- `web-streams-polyfill` - Streams API support
- `text-encoding-polyfill` - TextEncoder/TextDecoder
- `react-native-url-polyfill` - URL parsing
- `base-64` - Base64 encoding/decoding (btoa/atob)

#### Authentication Sharing via Keychain Access Groups
Uses iOS Keychain with Access Groups to securely share Supabase credentials between main app and share extension.

**Configuration**:
- **Team ID**: `WZRRA4NFBY`
- **Access Group**: `$(AppIdentifierPrefix)com.jamesalmeida.memex` (resolves to `WZRRA4NFBY.com.jamesalmeida.memex`)
- **Storage Key**: `supabase.session.min`
- **Package**: `expo-secure-store` v15.0.7 with `accessGroup` option

**Stored Credentials** (`SharedAuthData` interface):
```typescript
{
  access_token: string;    // Supabase JWT
  refresh_token: string;   // For token refresh
  user_id: string;         // User UUID
  expires_at?: number;     // Unix timestamp
}
```

**Implementation Files**:
- `/src/services/sharedAuth.ts` - Save/read/clear auth from Keychain
- `/src/config/keychain.ts` - Configuration constants
- `/ios/Memex/Memex.entitlements` - Main app entitlements
- `/ios/MemexShareExtension/MemexShareExtension.entitlements` - Extension entitlements

**Entitlements Configuration** (both files):
```xml
<key>com.apple.security.application-groups</key>
<array>
  <string>group.com.jamesalmeida.memex</string>
</array>
<key>keychain-access-groups</key>
<array>
  <string>$(AppIdentifierPrefix)com.jamesalmeida.memex</string>
</array>
```

**Authentication Flow**:
1. **Main App** (saves auth):
   - User signs in via Supabase Auth
   - `saveSharedAuth(session)` called in `useAuth.ts` (lines 142, 236)
   - Minimal session data stored in Keychain (2048-byte limit)
   - Also triggered on token refresh and app launch with existing session
2. **Share Extension** (reads auth):
   - `getSharedAuth()` called on initialization
   - Reads credentials from shared Keychain
   - Validates token expiration (60-second buffer)
   - Returns null if missing or expired
3. **Sign Out** (clears auth):
   - `clearSharedAuth()` called in `clearAuthState()` function
   - Removes credentials from Keychain
   - Extension loses access immediately

#### User Experience & Auto-Save Flow

**UI Dimensions**:
- Height: 520px (configured in app.json)
- Background: White/dark theme aware
- Layout: Scrollable with header, preview, space selector, footer

**Flow Timeline**:
1. User taps Share → Memex (< 1s)
2. Extension opens, theme and auth state loaded (< 1s)
3. **Auto-save timer starts** (1 second countdown if authenticated)
4. Item saved to `pending_items` table (lightweight database insert)
5. Success banner appears: "✓ Saved successfully!" (800ms)
6. Extension auto-dismisses (total: ~1-2 seconds from open to close)
7. **Background**: Database trigger invokes Edge Function for metadata extraction and processing

**Why This is Fast**:
- No heavy metadata extraction in extension (happens server-side)
- Single lightweight database INSERT to `pending_items` table
- Extension closes immediately after saving, doesn't wait for processing
- Processing happens asynchronously via database triggers and Edge Functions

**Auto-Save Implementation** (`ShareExtension.tsx` lines 121-135):
```typescript
useEffect(() => {
  if (!isLoading && hasKeychainAuth && !autoSaveTriggered && !showSuccess) {
    console.log('[ShareExtension] Auto-save timer starting (1s)...');
    const timer = setTimeout(async () => {
      console.log('[ShareExtension] Auto-save triggered');
      await handleSave();
      setAutoSaveTriggered(true);
    }, 1000); // 1 second delay
    setAutoSaveTimer(timer);
    return () => clearTimeout(timer);
  }
}, [isLoading, hasKeychainAuth, autoSaveTriggered, showSuccess]);
```

**User Actions**:
- **Cancel Button**: Visible when authenticated; clears auto-save timer and closes immediately
- **Space Selector**: Tap to select space for item (pauses auto-save, shows Save button)
- **Open Memex Button**: Shown when not authenticated; launches main app via `openHostApp('/')`

#### Pending Items Processing Architecture

The share extension uses a **two-stage processing flow** for optimal performance:

**Stage 1: Share Extension** (1-2 seconds)
- Lightweight database INSERT to `pending_items` table
- Minimal data: `user_id`, `url`, `space_id`, `content`
- Fast extension dismissal without waiting for metadata extraction

**Stage 2: Background Processing** (async)
- Database trigger fires on INSERT to `pending_items`
- Trigger invokes Edge Function via `pg_net` HTTP POST
- Edge Function extracts metadata, generates tags, creates final item
- Updates `pending_items.status`: `pending` → `processing` → `completed`/`failed`

**Database Table Schema** (`pending_items`):
```sql
CREATE TABLE pending_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  url TEXT,
  space_id UUID REFERENCES spaces(id),
  content TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pending_items_status ON pending_items(status);
CREATE INDEX idx_pending_items_user_id ON pending_items(user_id);
CREATE INDEX idx_pending_items_created_at ON pending_items(created_at);
```

**Database Trigger** (`process_pending_item_trigger`):
- Fires on INSERT to `pending_items` table
- Uses `pg_net.http_post()` to invoke Edge Function
- Passes item data as JSON payload
- Non-blocking (doesn't slow down INSERT operation)

**Edge Function** (`process-pending-item`):
- Receives pending item from database trigger
- Updates status to `'processing'`
- Runs metadata extraction pipeline (same as main app)
- Creates final item in `items` table with all metadata
- Updates `pending_items.status` to `'completed'` or `'failed'`
- Sets `error_message` if processing fails

**Implementation Files**:
- Database migration: `supabase/migrations/20250206_create_pending_items.sql`
- Trigger migration: `supabase/migrations/20250206_pending_items_trigger.sql`
- Edge Function: `supabase/functions/process-pending-item/index.ts`
- Share Extension save: `src/components/ShareExtension.tsx` lines 174-247

#### Direct Supabase Sync (Primary Path)

When Keychain auth is available, the extension saves directly to Supabase `pending_items` table without opening the main app.

**Flow** (`ShareExtension.tsx` lines 174-247):
1. Get auth from Keychain: `getSharedAuth()`
2. Create temporary Supabase client with `persistSession: false`
3. Set session: `await supabase.auth.setSession({ access_token, refresh_token })`
4. Create pending item object with minimal data:
   ```typescript
   {
     user_id: authData.user_id,
     url: urlToSave || '',
     space_id: selectedSpaceId,
     content: contentToSave
   }
   ```
5. Insert to `pending_items`: `await supabase.from('pending_items').insert(pendingItem)`
6. On success: Show success banner → Auto-dismiss after 800ms
7. On error: Fall back to MMKV queue
8. **Background**: Database trigger invokes Edge Function for processing

**Benefits**:
- **Fast extension dismissal** (~1-2 seconds vs 3-6 seconds previously)
- **No blocking metadata extraction** in extension
- **Background processing** via database triggers and Edge Functions
- **Real-time updates** propagate processing status to all devices
- **Automatic retries** on failure (Edge Function can retry)
- **No duplicate items** (single source of truth in database)

#### MMKV Queue Fallback (Offline Path)

When direct sync fails or auth is unavailable, items are queued in MMKV storage shared via App Groups.

**Configuration**:
- **App Group ID**: `group.com.jamesalmeida.memex`
- **Queue Key**: `shared-items-queue`
- **Storage**: MMKV with `appGroupId` support (iOS only)
- **File**: `/src/services/sharedItemQueue.ts`

**Queue Used When**:
- No Keychain auth available
- Supabase session setup fails
- Network error during insert
- User not signed in

**Queue Flow**:
1. **Share Extension** (adds to queue):
   ```typescript
   newItem.user_id = authData?.user_id || 'pending';
   await addItemToSharedQueue(newItem);
   ```
2. **Main App** (imports queue):
   - Called in `useAuth.ts` during initial session (lines 164-185)
   - `getItemsFromSharedQueue()` reads all queued items
   - Updates `user_id` if 'pending'
   - Syncs each item: `itemsActions.addItemWithSync(item)`
   - Clears queue: `clearSharedQueue()`

**MMKV Initialization**:
- Lazy initialization (only when first accessed)
- Requires JSI (JavaScript Interface) - not available in Metro dev mode
- Error handling: Logs warning but doesn't crash ("⚠️ MMKV queue not available (dev mode - this is OK)")
- Graceful fallback: Primary path is Keychain auth; queue is safety net

#### Real-time Processing Updates

The main app receives processing status updates via Supabase Realtime subscriptions and displays visual feedback.

**Supabase Realtime Subscription** (`realtimeSync.ts` lines 257-351):
- Subscribes to `pending_items` table with WebSocket connection
- Filters events by `user_id` for security and performance
- Listens for INSERT, UPDATE events (no DELETE needed)
- Configuration: `ALTER PUBLICATION supabase_realtime ADD TABLE pending_items`

**Event Handling**:
1. **INSERT (new pending item)**:
   - Adds item to `pendingItemsStore` with `addedAt` timestamp
   - Triggers processing banner to slide down
   - Logs: `📡 [RealtimeSync] Pending item change received: INSERT pending`

2. **UPDATE (status=processing)**:
   - Updates status in `pendingItemsStore`
   - Banner continues showing "Processing X items..."
   - Logs: `📡 [RealtimeSync] Pending item change received: UPDATE processing`

3. **UPDATE (status=completed)**:
   - Calculates time elapsed since `addedAt`
   - Enforces 500ms minimum display time for smooth UX
   - Removes item from store after delay: `await pendingItemsActions.remove(id)`
   - Banner slides up when `processingCount` reaches 0
   - Logs: `✅ [RealtimeSync] Pending item completed` → `⏱️ Banner displayed for Xms, waiting Yms before removal`

4. **UPDATE (status=failed)**:
   - Shows error toast notification with `error_message`
   - Removes failed item after 5 seconds
   - Logs: `❌ [RealtimeSync] Pending item failed: {error_message}`

**Local Store Management** (`pendingItems.ts`):
- **Store**: `pendingItemsStore` with `items` array and `isLoading` flag
- **Interface**: `PendingItemDisplay` with fields: `id`, `url`, `status`, `error_message`, `created_at`, `user_id`, `addedAt`, `completed_item_id`
- **Persistence**: Synced to AsyncStorage at key `@memex_pending_items`
- **Cleanup**: Removes stale items on load (>10min old or completed/failed)
- **Minimum Display Time**: Tracks `addedAt` timestamp to enforce 500ms visibility

**Error Handling**:
- Defensive checks before removing items (verify item exists)
- Try/catch blocks prevent crashes from AsyncStorage failures
- Graceful fallback if real-time connection drops (manual sync fills gaps)

#### Processing Banner UI

The main app displays a processing banner at the top of the home screen when items are being processed.

**Visual Design**:
- **Location**: Home screen, positioned between HeaderBar/FilterPills and content grid
- **Layout**: Full-width banner with centered text
- **Height**: 40px when visible, 0px when hidden
- **Colors**:
  - Light mode: Background `#FFF9E6` (cream), Text `#F57C00` (orange), Border `#FFE082` (light orange)
  - Dark mode: Background `#332800` (dark brown), Text `#FFB74D` (light orange), Border `#665000` (brown)
- **Typography**: 13px font, 500 weight, center-aligned
- **Text**: "Processing X items..." (or "Processing 1 item..." singular)

**Animation**:
- **Slide Down** (when `processingCount` becomes > 0):
  - Animates height from 0 to 40px over 300ms
  - Easing: `Easing.out(Easing.ease)` for smooth deceleration
  - Sets `showBanner` state to true
  - Records `bannerShowTimestamp` for minimum display time calculation

- **Slide Up** (when `processingCount` becomes 0):
  - Enforces 500ms minimum display time
  - Calculates delay: `Math.max(0, 500 - timeElapsed)`
  - Waits for delay, then animates height from 40px to 0 over 300ms
  - Easing: `Easing.in(Easing.ease)` for smooth acceleration
  - Sets `showBanner` state to false after animation completes
  - Uses `runOnJS()` to safely update state from animation callback

**Implementation** (`index.tsx` lines 358-395):
```typescript
// Count processing items
const processingCount = useMemo(() => {
  return pendingItems.filter(p => p.status === 'pending' || p.status === 'processing').length;
}, [pendingItems]);

// Animated banner height with minimum display time
const bannerHeight = useSharedValue(0);
const [showBanner, setShowBanner] = useState(false);
const bannerShowTimestamp = useRef<number | null>(null);

useEffect(() => {
  if (processingCount > 0) {
    // Show banner
    if (!showBanner) {
      setShowBanner(true);
      bannerShowTimestamp.current = Date.now();
      bannerHeight.value = withTiming(40, {
        duration: 300,
        easing: Easing.out(Easing.ease),
      });
    }
  } else if (showBanner) {
    // Hide banner with minimum display time (500ms)
    const elapsed = bannerShowTimestamp.current ? Date.now() - bannerShowTimestamp.current : 500;
    const delay = Math.max(0, 500 - elapsed);

    setTimeout(() => {
      bannerHeight.value = withTiming(0, {
        duration: 300,
        easing: Easing.in(Easing.ease),
      }, () => {
        // After animation completes, hide the component
        runOnJS(setShowBanner)(false);
      });
    }, delay);
  }
}, [processingCount, showBanner]);
```

**UX Benefits**:
- **No flashing**: 500ms minimum display prevents banner from appearing/disappearing too quickly
- **Smooth animations**: 300ms transitions feel natural and polished
- **Real-time feedback**: Users see processing status immediately when items are shared
- **Non-blocking**: Banner doesn't prevent interaction with the app
- **Clear messaging**: Simple text indicates number of items being processed

#### UI Components & States

**Authenticated State** (`hasKeychainAuth = true`):
- Content preview with metadata
- Cancel button (aborts auto-save timer)
- Space selector dropdown (optional, pauses auto-save)
- Auto-save countdown (2 seconds)
- Success banner → auto-dismiss

**Not Authenticated State** (`hasKeychainAuth = false`):
- Warning banner: "Please sign in to save items"
- Content preview (read-only)
- "Open Memex to Sign In" button (calls `openHostApp('/')`)
- No auto-save or Save button

**Loading State**:
- Activity indicator with "Loading..." text
- Theme-aware spinner color
- Displayed during metadata extraction

**Error State**:
- Red error text
- Close button
- Manual dismissal only

**Success State**:
- Green banner: "✓ Saved successfully!"
- Displayed for 1 second before auto-dismiss
- Replaces other UI elements

#### app.json Configuration

```json
{
  "plugins": [
    ["expo-share-extension", {
      "activationRules": [
        { "type": "url", "max": 1 },
        { "type": "text" },
        { "type": "image", "max": 3 },
        { "type": "video", "max": 1 },
        { "type": "file", "max": 3 }
      ],
      "excludedPackages": [
        "expo-dev-client",
        "expo-splash-screen",
        "expo-updates",
        "expo-font"
      ],
      "backgroundColor": {
        "red": 255,
        "green": 255,
        "blue": 255,
        "alpha": 1
      },
      "height": 520
    }]
  ]
}
```

**Activation Rules**:
- URLs: Single URL sharing (most common)
- Text: Plain text content (converted to notes if not URL)
- Images: Up to 3 images simultaneously
- Videos: Single video sharing
- Files: Up to 3 files

**Excluded Packages**:
- Development tools excluded to reduce bundle size
- Fonts excluded (use system fonts)
- Splash screen unnecessary in extension
- Updates handled by main app

#### Theme Support

**Dark Mode**:
- Loaded via `themeActions.loadThemePreference()`
- Reads from `userSettingsStore` (cloud-synced)
- All UI components have dark variants
- Consistent with main app theme

**Colors**:
- Light mode: White background, black text, #007AFF accent
- Dark mode: Black background, white text, #0A84FF accent
- Success: Green (#D4EDDA light, #1B4332 dark)
- Warning: Yellow (#FFF3CD light, #4A4220 dark)
- Error: Red (#FF3B30 light, #FF453A dark)

#### Performance & Optimization

**Bundle Size**:
- Separate bundle from main app (only includes necessary code)
- Excluded packages reduce size (~30% smaller than main app)
- Polyfills loaded on-demand

**Metadata Extraction**:
- Runs in background during preview display
- Non-blocking UI (shows preview with loading states)
- Cached in local state (no persistence in extension)

**Network Efficiency**:
- Single API call per save (metadata extraction OR Supabase insert)
- No polling or real-time subscriptions in extension
- Minimal battery impact

**Memory Management**:
- Extension unloads immediately after dismissal
- No state persistence between launches
- MMKV provides memory-efficient queue storage

#### Error Handling & Reliability

**Graceful Degradation**:
1. **Metadata extraction fails** → Save with minimal data (URL + title)
2. **Keychain auth unavailable** → Fall back to queue
3. **Supabase insert fails** → Fall back to queue
4. **Network offline** → Queue for later sync
5. **MMKV unavailable (dev mode)** → Log warning, primary path still works

**User Feedback**:
- Loading states during operations
- Success banner on completion
- Error messages for failures
- Toast notifications in main app after queue import

**Data Integrity**:
- Tombstone pattern prevents data loss
- Queue ensures items never lost even if extension crashes
- Main app retry logic for failed syncs
- Real-time sync provides redundancy

#### Testing Considerations

**Manual Testing**:
- Share from Safari, X, YouTube, Instagram, Reddit, Notes
- Test with auth (auto-save) and without auth (queue)
- Verify metadata extraction for all content types
- Test Cancel button during auto-save countdown
- Verify space selection (when enabled)
- Test offline scenarios (airplane mode)

**Edge Cases**:
- Invalid URLs → Converted to notes
- Expired Keychain auth → Falls back to queue
- Network timeout during metadata extraction → Saves minimal data
- MMKV unavailable (dev mode) → Primary path unaffected

**Device Testing**:
- Test on physical device (JSI not available in simulator dev mode)
- Verify Keychain access on clean install
- Test after main app uninstall/reinstall
- Verify entitlements properly applied in build

#### Known Limitations

**Expo Constraints**:
- No access to native iOS Share Extension API directly
- Limited customization of system share sheet
- Height is fixed (no dynamic sizing)
- Cannot preview shared content before extension opens

**Development Mode**:
- MMKV JSI not available in Metro bundler (expected)
- Keychain works correctly
- Queue fallback logs warnings but functions properly

**iOS Restrictions**:
- Share extensions have memory limits (stricter than main app)
- Background execution limited
- Cannot play media or open external URLs
- Must close after save completes

## 3. Data Models (Supabase Schema)
- **Users**:  
  - Managed by Supabase auth.  
  - Fields: `id` (UUID, PK), `email` (text).  
- **Items**:
  - Fields: `id` (UUID, PK), `user_id` (UUID, FK to Users), `title` (text), `url` (text, nullable), `content_type` (enum: bookmark, youtube, youtube_short, x, github, instagram, facebook, threads, tiktok, reddit, amazon, linkedin, image, pdf, video, audio, podcast, note, article, product, book, course, movie, tv_show), `content` (text, nullable), `desc` (text, nullable), `thumbnail_url` (text, nullable), `raw_text` (text, nullable), `tags` (text[], nullable), `tldr` (text, nullable), `notes` (text, nullable), `space_id` (UUID, nullable, FK to Spaces), `is_archived` (boolean, default false), `archived_at` (timestamp, nullable), `auto_archived` (boolean, default false), `is_deleted` (boolean, default false), `deleted_at` (timestamp, nullable), `created_at` (timestamp), `updated_at` (timestamp).
  - Note: `tags` field is a TEXT array for categorization and search with GIN index for efficient array operations.
  - Note: `tldr` field stores AI-generated summary of item content (description, transcript, images, metadata) generated on-demand via OpenAI `summarizeContent()` using full context from `buildItemContext()`.
  - Note: `notes` field stores user's personal notes and annotations about the item as free-form text.
  - Note: `space_id` replaces the many-to-many `Item_Spaces` relationship - each item now belongs to exactly ONE space (or none if null).
  - Note: `auto_archived` tracks if an item was automatically archived when its parent space was archived, enabling selective restoration.  
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
  - Fields: `id` (UUID, PK), `item_id` (UUID, FK to Items), `transcript` (text), `platform` (text: youtube, x, tiktok, instagram, reddit, etc.), `language` (text, default 'en'), `duration` (integer, seconds), `segments` (JSONB, nullable), `fetched_at` (timestamp), `created_at` (timestamp), `updated_at` (timestamp).  
  - Purpose: Stores transcripts for videos from various platforms.  
  - Note: `segments` field stores timestamped transcript data as JSONB array: `[{"startMs": number, "endMs": number, "text": string}]`. Used by SerpAPI for YouTube transcripts to enable toggle between timestamped and plain text views. Preferred by AI chat context for timestamp references.
  - Unique constraint on `item_id` - one transcript per video item.  
- **Spaces**:
  - Fields: `id` (UUID, PK), `user_id` (UUID, FK to Users), `name` (text), `desc` (text, nullable), `description` (text, nullable), `color` (text, default '#007AFF'), `item_count` (integer, default 0), `order_index` (integer, nullable), `is_archived` (boolean, default false), `archived_at` (timestamp, nullable), `is_deleted` (boolean, default false), `deleted_at` (timestamp, nullable), `created_at` (timestamp), `updated_at` (timestamp).
  - Note: `description` is an alternative field for `desc`; `item_count` is denormalized for performance.
  - Note: `order_index` is the **single source of truth** for space ordering across all devices. When spaces are manually reordered via drag-and-drop, the new `order_index` values are synced to Supabase and propagated to other devices via real-time updates. The UI always displays spaces sorted by their `order_index` value.
  - Note: Archiving a space automatically archives all items within it (tracked via `Item.auto_archived`).
  - Note: Soft-delete fields (`is_deleted`, `deleted_at`) enable tombstone-based sync for reliable cross-device deletion.
- **User_Settings**:
  - Fields: `id` (UUID, PK), `user_id` (UUID, FK to Users, unique), `theme_dark_mode` (boolean, default false), `ai_chat_model` (text, default 'gpt-4o-mini'), `ai_metadata_model` (text, default 'gpt-4o-mini'), `ui_x_video_muted` (boolean, default true), `ui_autoplay_x_videos` (boolean, default true), `ui_radial_actions` (jsonb, default '["chat", "share", "archive"]'::jsonb), `is_admin` (boolean, default false), `created_at` (timestamp), `updated_at` (timestamp).
  - Purpose: Cloud-synced user preferences that persist across devices and app reinstalls. Replaces device-specific AsyncStorage for global settings.
  - One settings row per user (enforced by unique constraint on `user_id`).
  - Settings categories:
    - Theme: `theme_dark_mode` - Light/dark mode preference
    - AI: `ai_chat_model`, `ai_metadata_model` - AI model selection for chat and metadata extraction (Note: AI automation preferences like auto-transcripts and auto-image-descriptions are now global admin settings in the admin_settings table)
    - UI: `ui_x_video_muted`, `ui_autoplay_x_videos`, `ui_radial_actions` - Video playback and quick action menu preferences
    - Admin: `is_admin` - Admin flag for accessing admin panel (set manually via Supabase Dashboard)
  - Radial Action Menu Configuration:
    - `ui_radial_actions` stores an ordered array of up to 3 action IDs that appear in the long-press radial menu
    - Available actions: 'chat' (open AI chat), 'share' (share item URL), 'archive' (move to archive / unarchive if already archived), 'delete' (soft delete item), 'move' (move to different space)
    - Default actions: ['chat', 'share', 'archive']
    - Note: When user configures 'archive', the menu automatically shows 'unarchive' button when long-pressing an archived item (both `is_archived=true` and `auto_archived=true` cases)
    - Users configure via "Configure Action Button" option in drawer menu
    - Configuration modal (ActionMenuConfigModal) allows selecting 1-3 actions with visual ordering indicators
    - Changes sync instantly across devices via Supabase real-time updates
  - Admin Access Control:
    - `is_admin` flag controls access to AdminSheet (developer/admin panel)
    - Set to `true` manually via Supabase Dashboard SQL: `UPDATE user_settings SET is_admin = true WHERE user_id = '...'`
    - Admin button appears in drawer menu when `is_admin = true`
    - Loads automatically with userSettings on login (no separate role fetching required)
    - Reactive: DrawerContent automatically shows/hides Admin button when admin status changes
  - Synced on app launch, login, and during manual sync operations.
  - Changes are optimistically updated locally then synced to Supabase.
  - Falls back to legacy AsyncStorage if cloud sync unavailable (offline mode).
- **Admin_Settings**:
  - Fields: `id` (UUID, PK, fixed as '00000000-0000-0000-0000-000000000001'::uuid), `auto_generate_transcripts` (boolean, default false), `auto_generate_image_descriptions` (boolean, default false), `auto_generate_tldr` (boolean, default false), `youtube_source` (text, default 'youtubei'), `youtube_transcript_source` (text, default 'youtubei'), `created_at` (timestamp), `updated_at` (timestamp).
  - Purpose: **Global admin settings** that apply to ALL users system-wide (not per-user). Controls AI automation behavior and API preferences for metadata extraction.
  - Single row table: Uses fixed UUID to ensure only one settings row exists globally.
  - Settings categories:
    - AI Automation (Global): Settings that control automatic AI processing for all newly added items
      - `auto_generate_transcripts` - Automatically extract transcripts for video content when items are added
      - `auto_generate_image_descriptions` - Automatically generate AI descriptions for images when items are added
      - `auto_generate_tldr` - Automatically generate AI summaries (TLDR) for new items after pipeline completion
    - YouTube Data Sources: API/library preferences for YouTube metadata extraction
      - `youtube_source` - Source for YouTube enrichment metadata ('youtubei' or 'serpapi')
      - `youtube_transcript_source` - Source for YouTube transcripts ('youtubei' or 'serpapi')
  - Access Control: Only users with `user_settings.is_admin = true` can view/modify via AdminSheet
  - State Management: Managed by `adminSettingsStore` (`src/stores/adminSettings.ts`) with cloud sync
  - Loading: Auto-loads on user login via `useAuth` hook after userSettings
  - Usage: Pipeline steps and enrichment services check these flags to determine whether to auto-run AI operations
  - RLS Policies: Only admins can read/write (checked via `user_settings.is_admin` column)
- **Pending_Items**:
  - Fields: `id` (UUID, PK), `user_id` (UUID, FK to Users), `url` (text, nullable), `space_id` (UUID, FK to Spaces, nullable), `content` (text, nullable), `status` (text, default 'pending', CHECK status IN ('pending', 'processing', 'completed', 'failed')), `error_message` (text, nullable), `retry_count` (integer, default 0), `created_at` (timestamp).
  - Purpose: **Temporary table for iOS Share Extension processing**. Items saved from Share Extension are inserted here, then processed asynchronously via database triggers and Edge Functions. Once processing completes, the final item is created in `items` table and the pending_items record is removed.
  - Processing Flow:
    1. Share Extension inserts minimal data (`user_id`, `url`, `space_id`, `content`) with `status='pending'`
    2. Database trigger fires on INSERT, invokes Edge Function via `pg_net.http_post()`
    3. Edge Function updates `status` to `'processing'`, extracts metadata, generates tags
    4. Edge Function creates final item in `items` table with all metadata
    5. Edge Function updates `status` to `'completed'` or `'failed'` (with `error_message`)
    6. Main app receives real-time updates via Supabase Realtime subscriptions
    7. Main app displays processing banner and removes completed/failed items after delay
  - Real-time Sync: Enabled via `ALTER PUBLICATION supabase_realtime ADD TABLE pending_items` to notify main app of status changes
  - Indexes: `idx_pending_items_status` (status), `idx_pending_items_user_id` (user_id), `idx_pending_items_created_at` (created_at)
  - RLS Policies: Users can read/write their own pending items only (WHERE user_id = auth.uid())
  - Service Role: Full access for Edge Function processing (bypasses RLS)
  - Cleanup: Pending items table is ephemeral - completed/failed items removed by main app, stale items (>10min old) cleaned up on app launch
  - Migration: Created in `supabase/migrations/20250206_create_pending_items.sql`
  - Trigger: `process_pending_item_trigger()` function created in `supabase/migrations/20250206_pending_items_trigger.sql`
- **Item_Spaces** (DEPRECATED):
  - Fields: `item_id` (UUID, PK/FK to Items), `space_id` (UUID, PK/FK to Spaces), `created_at` (timestamp).
  - **Status**: Deprecated in favor of `Items.space_id`. This table is no longer used for new data but remains for historical records.
  - Migration: Existing data was migrated to `Items.space_id` (keeping first space per item), completed in migration `20251024_add_archive_and_simplify_spaces.sql`.  
- **Item_Chats**:  
  - Fields: `id` (UUID, PK), `item_id` (UUID, FK to Items), `user_id` (UUID, FK to Users), `title` (text, nullable), `created_at` (timestamp), `updated_at` (timestamp).  
  - Purpose: Dedicated table for item-based chat sessions. `title` allows naming conversations; `updated_at` is auto-updated via trigger when messages are added.  
- **Space_Chats**:  
  - Fields: `id` (UUID, PK), `space_id` (UUID, FK to Spaces), `user_id` (UUID, FK to Users), `title` (text, nullable), `created_at` (timestamp), `updated_at` (timestamp).  
  - Purpose: Dedicated table for space-based chat sessions. `title` allows naming conversations; `updated_at` is auto-updated via trigger when messages are added.  
- **Chat_Messages**:  
  - Fields: `id` (UUID, PK), `chat_id` (UUID, FK to Item_Chats or Space_Chats), `chat_type` (enum: item, space), `role` (enum: user, system, assistant), `content` (text), `metadata` (JSONB, default '{}'), `created_at` (timestamp).  
  - Purpose: Links to either `Item_Chats` or `Space_Chats` for clear relationships. `metadata` stores AI model info, token usage, and timestamps.  
- **API_Usage_Tracking**:  
  - Fields: `id` (UUID, PK), `user_id` (UUID, FK to Users), `api_name` (text), `operation_type` (text), `item_id` (UUID, FK to Items, nullable), `created_at` (timestamp).  
  - Purpose: Tracks API operations that count against monthly quotas (SerpAPI, etc.) for usage monitoring. Used by `apiUsageTracking` store and displayed in `AdminSheet`.  
  - Constraints: `api_name` must be one of ('serpapi'), `operation_type` validated based on `api_name`.  
  - Policies: Users can read/insert their own records only (append-only for data integrity).  
- **Offline_Queue** (client-side, Legend-State, mirrored in Supabase):  
  - Fields: `id` (UUID, PK), `user_id` (UUID, FK to Users), `action_type` (enum: create_item, update_item, delete_item, create_capture), `payload` (JSONB), `created_at` (timestamp), `status` (enum: pending, synced, failed).  
  - JSONB `payload` examples:  
    - Create item: `{ "title": "...", "url": "...", "content_type": "bookmark" }`  
    - Update item: `{ "item_id": "...", "title": "...", "desc": "..." }`  
  - Purpose: Tracks offline actions for reliable sync with Supabase.  
- **Performance Indexes**:
  - Items: `idx_items_user_id`, `idx_items_content_type`, `idx_items_created_at`, `idx_items_is_archived`, `idx_items_is_deleted`, `idx_items_space_id`, `idx_items_tags` (GIN on tags array).
  - Spaces: `idx_spaces_user_id`, `idx_spaces_user_order` (user_id, order_index), `idx_spaces_is_deleted`, `idx_spaces_is_archived`.
  - User_Settings: `idx_user_settings_user_id` (unique), `idx_user_settings_is_admin` (partial WHERE is_admin = true).
  - Admin_Settings: No indexes needed (single row table).
  - Item_Spaces (deprecated): `idx_item_spaces_item_id`, `idx_item_spaces_space_id`.
  - Chat_Messages: `idx_chat_messages_chat_id`, `idx_chat_messages_created_at`, `idx_chat_messages_chat_id_created_at`, `idx_chat_messages_chat_type`, `idx_chat_messages_metadata` (GIN on JSONB).
  - Video_Transcripts: `idx_video_transcripts_item_id`, `idx_video_transcripts_created_at`, `idx_video_transcripts_platform`, `idx_video_transcripts_segments` (GIN on JSONB, partial WHERE segments IS NOT NULL).
  - Image_Descriptions: `idx_image_descriptions_item_id`, `idx_image_descriptions_created_at`.
  - API_Usage_Tracking: `idx_api_usage_user_id`, `idx_api_usage_api_name`, `idx_api_usage_created_at`, `idx_api_usage_user_api_date` (user_id, api_name, created_at), `idx_api_usage_item_id`.
  - Offline_Queue: `idx_offline_queue_user_id`, `idx_offline_queue_status`.
- **Database Migrations**:
  - `20251024_add_soft_delete_to_spaces.sql` - Adds soft-delete fields to spaces table
  - `20251024_add_archive_and_simplify_spaces.sql` - Adds archive fields to items/spaces, migrates to one-space-per-item, adds `Items.space_id`
  - `20251024_enable_realtime.sql` - Enables Supabase real-time replication for items and spaces tables
  - `20251027_add_tldr_and_notes_to_items.sql` - Adds `tldr` and `notes` fields to items table for AI summaries and user annotations
  - `20251028_create_user_settings.sql` - Creates `user_settings` table for cloud-synced user preferences (theme, AI models, UI preferences)
  - `20251030_add_ui_radial_actions.sql` - Adds `ui_radial_actions` column to `user_settings` table for configurable radial action menu
  - `20250131_add_segments_to_video_transcripts.sql` - Adds `segments` JSONB column to `video_transcripts` table for timestamped transcript data from SerpAPI
  - `20250201_create_api_usage_tracking.sql` - Creates `api_usage_tracking` table for monitoring API quota usage (SerpAPI, etc.)
  - `20251101_create_admin_settings.sql` - Creates `admin_settings` table for global system-wide admin settings (AI automation, YouTube sources)
  - `20251101_add_is_admin_to_user_settings.sql` - Adds `is_admin` boolean column to `user_settings` for admin access control
  - `20251101_cleanup_user_roles.sql` - Drops obsolete `user_roles` table and `is_admin()` function (abandoned approach)
  - Note: Archive functionality requires `is_archived`, `archived_at`, and `auto_archived` fields added in `20251024_add_archive_and_simplify_spaces.sql`
  - Note: Admin system uses simplified approach with `user_settings.is_admin` column instead of separate roles table

## 4. UI/UX Requirements
- **Navigation**:
  - Expo Router for file-based navigation.
  - HeaderBar horizontally scrolls Space names to let user tap or swipe to change Everything Grid to specific Space grids
  - **Archive Space Tab**: Special tab always positioned at the end of HeaderBar (after all active spaces):
    - Pill-shaped design with rounded corners (borderRadius: 20)
    - Muted background (light: rgba(245,245,245,0.8), dark: rgba(55,55,55,0.5))
    - Archive icon from MaterialIcons instead of space color
    - Non-scrollable - always visible at end of tab list
    - Tapping navigates to Archive view showing all archived items
  - Bottom tab navigator: Home (Everything), Chats.
  - Stack navigator for Capture (modal), and Chat (bottom sheet).
  - Item Detail uses expanding card animation (not modal) with hero transitions.
- **Layouts**:
  - Mobile: Filter Button; Bottom tab bar; FAB for capture; bottom sheet for item details, new item captures, item chats, settings; ContextMenu for Filter; Drawer for organizing Spaces and opening settings.
  - **DrawerContent**: Displays active spaces with Archive space at bottom:
    - Archive space shown below all active spaces with archive icon (non-draggable)
    - Archive space has no 3-dot menu (cannot be edited/deleted)
    - Slightly muted opacity (0.8) to distinguish from regular spaces
    - Tapping navigates to Archive view
  - Tablet: Optional Drawer stays open or hides. Grid defaults to being 4 columns rather than 2 like mobile.   
- **Components**:
  - **Context Menus**: All three-dot context menus in the app use `ContextMenu` from `@expo/ui/swift-ui` for consistent native behavior and styling:
    - Implementation pattern: Wrap trigger button in `Host` component, use `ContextMenu.Trigger` and `ContextMenu.Items` with `Button` components
    - Reference implementation: [DrawerContent.tsx:325-348](src/components/DrawerContent.tsx#L325-L348)
    - Used in: DrawerContent (space menu), ChatSheet (chat actions menu)
    - Provides native iOS/Android menu animations, better accessibility, and consistent UX
  - **ItemCard**: Type-specific UI (e.g., YouTube video overlay, X video player using Expo AV).
  - **FilterPills**: Displays active filters as dismissible pills above the item grid. Features:
    - Positioned between HeaderBar and grid content
    - Shows content type filter and selected tags as individual pills
    - Each pill has an X button to remove that specific filter
    - Horizontal ScrollView for overflow handling
    - Only renders when filters are active
    - Integrates with filterStore for reactive updates
    - Full theme support (light/dark mode)
  - **Bottom Sheets**: Expanded Items, Capture, New Space, Edit Space, Settings, Tag Manager, Item Chats (dismiss via swipe or button). `@gorhom/bottom-sheet` for sliding chat UI; covers prior view; swipe-down to dismiss.
  - **ChatSheet**: Bottom sheet for item/space AI chat with three-dot context menu in header:
    - Header displays "AI Chat" title, model name, and three-dot menu button
    - Context menu uses native `ContextMenu` from `@expo/ui/swift-ui` (same as DrawerContent)
    - Menu options: Export Chat, Share Chat, Clear Chat (destructive role)
    - All menu actions provide haptic feedback and toast notifications
    - Full light/dark theme support with proper contrast ratios
    - Clear Chat requires confirmation dialog before deleting messages
  - **ManageTagsModal**: Modal for managing all tags globally. Features:
    - Accessible via "Manage Tags" button in drawer (below Settings)
    - Lists all tags with item counts sorted alphabetically
    - Inline editing: tap edit icon to modify tag name
    - Delete functionality: tap delete icon, confirm via alert
    - Tag merging: editing a tag to an existing name triggers merge confirmation
    - Updates sync to all items immediately via itemsActions.updateItemWithSync
    - Uses BaseModal component (consistent with other modals)
    - Covers bottom navigation when open
    - Empty state for no tags
    - Loading overlay during tag operations
    - Full theme support (light/dark mode)
  - **SpaceSelectorModal**: Modal-based UI for selecting item's space. Features:
    - Single-select with radio buttons (one space per item)
    - "Everything (No Space)" option at top
    - Scrollable list of active spaces
    - Auto-closes on selection
    - Matches ItemTagsModal styling pattern
    - Dark mode support
  - **ContentTypeSelectorModal**: Modal-based UI for changing item's content type. Features:
    - Single-select with radio buttons (bookmark, note, YouTube, X, etc.)
    - Scrollable list of all available content types with icons
    - Auto-closes on selection and syncs to Supabase
    - Triggers "Refresh Metadata?" alert after type change (for URL-based items)
    - Consistent modal pattern matching SpaceSelectorModal
    - Dark mode support
    - Used in: DefaultItemView, YouTubeItemView, XItemView, RedditItemView
  - **VideoPlayer**: Expo AV with autoplay, mute, loop, and lazy loading.
  - **ItemView Components**: All item detail views (DefaultItemView, YouTubeItemView, XItemView, NoteItemView, RedditItemView) are reactive to store updates and automatically refresh when item data changes on other devices.
  - **LoadingModal** (`src/components/LoadingModal.tsx`): Reusable loading overlay component for indicating ongoing operations:
    - **Purpose**: Provides consistent loading feedback across the app for operations like archiving, deleting, refreshing metadata
    - **Props**:
      - `visible: boolean` - Controls modal visibility
      - `text?: string` - Customizable loading text (default: "Loading...")
      - `isDarkMode: boolean` - Theme support
    - **Design**:
      - Full-screen semi-transparent overlay (95% opacity)
      - Centered card with ActivityIndicator and text
      - Absolute positioning (zIndex: 1000) to overlay parent component
      - Smooth animations for appearance/disappearance
      - Shadow/elevation for depth
    - **Usage**:
      - ExpandedItemView: Shows during archive/unarchive/delete/refresh operations
      - ItemViewFooter: Integrated for delete and refresh button feedback
      - All ItemView components: Pass through `isDeleting` and `isRefreshing` props
    - **Behavior**:
      - ItemView sheet closes immediately when user triggers delete/archive action
      - LoadingModal remains visible in background until operation completes
      - Toast notification appears after successful operation
      - Error toast shown if operation fails
    - **User Experience**: Non-blocking - allows user to return to browsing immediately while operation completes in background
  - **Archive View**: Special view for managing archived items. Features:
    - Accessed via Archive tab in HeaderBar or Archive space in DrawerContent
    - Shows all archived items (both manually archived and auto-archived) in flat grid
    - Empty state: "No archived items - Items you archive will appear here"
    - Items display archived date in expanded view footer: "Archived on [date]" or "Auto-archived on [date]"
    - Unarchive button replaces Archive button in expanded item view (MaterialIcons "unarchive" icon)
    - Long-press context menu includes "Unarchive" option
    - Uses LoadingModal during archive/unarchive operations with appropriate text
    - Success toast notification: "Item archived successfully" or "Item unarchived successfully"
    - Error toast on failure: "Failed to archive item" or "Failed to unarchive item"
    - Items disappear from Archive view immediately after unarchiving
    - Supports all filtering options (content type, tags, sort order)
  - **Toast System** (`src/contexts/ToastContext.tsx` and `src/components/Toast.tsx`): Global toast notification system for non-blocking user feedback:
    - **Context Provider**: `ToastProvider` wraps the app to provide global toast access via `useToast()` hook
    - **Toast Types**: `success` (green), `error` (red), `warning` (orange), `info` (blue)
    - **Auto-dismiss**: Toasts automatically dismiss after 2.5 seconds (configurable)
    - **Stacking**: Multiple toasts stack vertically with 70px spacing
    - **Animation**: Spring-based slide-in from top with fade
    - **Theme Support**: Adapts colors for light/dark mode
    - **Usage Examples**:
      - Archive/unarchive operations: "Item archived successfully"
      - Image operations: "Image saved to your photo library", "Image updated successfully"
      - Clipboard operations: "URL copied to clipboard", "Note copied to clipboard"
      - Metadata refresh: "Metadata refreshed successfully"
      - Sync operations: "Synced X items successfully"
      - AI operations: "Generated X new tags", "Loaded X models"
    - **Implementation**: Success/info messages use toasts; errors, confirmations, and destructive actions still use Alert dialogs
    - **Files Using Toasts**: ItemViewFooter, all ItemView components (YouTube, Default, Reddit, X, Note, MovieTV), ImageWithActions, SettingsSheet, ChatSheet
  - **Legal & Licenses** (`react-native-legal`): Integrated package for displaying open source license information:
    - **Location**: Accessible via "Legal & Licenses" row in Settings sheet's About section
    - **Icon**: MaterialIcons "gavel" icon for visual consistency
    - **Functionality**: Opens native screen showing all npm package licenses used in the app
    - **Implementation**: Uses `openSettings()` from `react-native-legal` package
    - **Theme Support**: Row adapts to light/dark mode like other settings rows
    - **Error Handling**: Catches and displays error alert if unable to open legal screen
    - **Package**: [`react-native-legal`](https://github.com/callstackincubator/react-native-legal) from Callstack Incubator
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

### 5.2 Database Operations (`src/services/supabase.ts` and `src/services/syncOperations.ts`)
All data operations use **Supabase Client SDK** via the `db` helper object and `syncOperations`:

- **Items** (`src/services/supabase.ts`):
  - `db.getItems(userId, limit, offset)` - Fetch user's items with metadata
  - `db.searchItems(userId, query, limit, offset)` - Search items by title/content/tags
  - `db.createItem(item)` - Create new item (supports all fields including `space_id`, `is_archived`, `auto_archived`)
  - `db.updateItem(id, updates)` - Partial update of item fields using spread operator
  - `db.deleteItem(id)` - Delete item

- **Items** (`src/services/syncOperations.ts`):
  - `syncOperations.uploadItem(item, userId)` - Upload complete item to Supabase (includes `space_id` for proper space assignment)
  - `syncOperations.updateItem(itemId, updates)` - Update item with partial changes (used by pipeline and manual updates)

- **Spaces** (`src/services/supabase.ts` and `src/services/syncOperations.ts`):
  - `db.getSpaces(userId)` - Fetch user's spaces with item counts
  - `db.createSpace(space)` - Create new space
  - `syncOperations.updateSpace(space)` - Update space including archive state (`is_archived`, `archived_at`) and order
  - `syncOperations.softDeleteSpace(spaceId)` - Soft-delete space using tombstone pattern
  
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

- **`POST /functions/v1/process-pending-item`** (`supabase/functions/process-pending-item/index.ts`):
  - **Purpose**: Processes pending items from iOS Share Extension asynchronously
  - **Trigger**: Invoked automatically by database trigger when item inserted into `pending_items` table
  - **Invocation Method**: Database trigger uses `pg_net.http_post()` to call Edge Function (not direct HTTP call from client)
  - **Request** (from database trigger):
    ```typescript
    {
      pending_item_id: string,  // UUID of pending item to process
      user_id: string,           // User UUID
      url?: string,              // URL to extract metadata from
      space_id?: string,         // Space UUID (optional)
      content?: string           // Plain text content (for notes)
    }
    ```
  - **Processing Flow**:
    1. Validates request and pending item exists
    2. Updates `pending_items.status` to `'processing'`
    3. Runs metadata extraction pipeline (same as main app):
       - URL type detection via `Step01_DetectType`
       - AI type detection via `Step02_DetectTypeAI` (if needed)
       - Linkedom HTML parsing via `Step03_ParseLinkedom` (fallback)
       - Platform-specific enrichment via `Step04_*` enrichers
    4. Generates AI tags via OpenAI (if enabled in admin settings)
    5. Creates final item in `items` table with all metadata:
       ```typescript
       {
         user_id, url, space_id, content,
         title, desc, thumbnail_url, content_type,
         tags, created_at, updated_at
       }
       ```
    6. Creates related records in `item_metadata`, `item_type_metadata` (if applicable)
    7. Updates `pending_items.status` to `'completed'` on success
    8. On error: Updates `pending_items.status` to `'failed'` with `error_message`
  - **Response**: `{ success: boolean, item_id?: string, error?: string }`
  - **Error Handling**:
    - Catches all exceptions and updates pending item with error details
    - Increments `retry_count` for potential automatic retries
    - Logs errors to Supabase Edge Function logs for debugging
  - **Real-time Updates**: Status changes in `pending_items` table trigger Supabase Realtime events to main app
  - **Security**: Uses service role key to bypass RLS for database operations
  - **Performance**: Runs asynchronously without blocking Share Extension, typically completes in 2-5 seconds
  - **Implementation Files**:
    - Edge Function: `supabase/functions/process-pending-item/index.ts`
    - Database trigger: `supabase/migrations/20250206_pending_items_trigger.sql`
    - Trigger function: `process_pending_item_trigger()` uses `pg_net.http_post()`

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

- **SerpAPI** (`src/services/serpapi.ts`):
  - Account API (free, does not count toward quota): `GET https://serpapi.com/account.json?api_key=...`
    - Returns: `account_id`, `account_email`, `plan_id`, `plan_name`, `plan_monthly_price`, `searches_per_month`, `plan_searches_left`, `extra_credits`, `total_searches_left`, `this_month_usage`, `last_hour_searches`, `account_rate_limit_per_hour`
    - Auto-refreshes when opening `AdminSheet` to display real-time usage data
    - Manual refresh button available in AdminSheet UI
  - YouTube Video API (`GET https://serpapi.com/search?engine=youtube_video&v=VIDEO_ID`):
    - Extracts video metadata (title, description, view count, duration, etc.)
    - Used by `Step04_1a_EnrichYouTube_SerpAPI` for enrichment (conditional on user preference)
  - YouTube Transcript API (`GET https://serpapi.com/search?engine=youtube_video_transcript&v=VIDEO_ID`):
    - Returns **timestamped segments** with `start_ms`, `end_ms`, and `text`/`snippet`
    - Also provides fallback plain text transcript
    - Segments stored in `video_transcripts.segments` (JSONB array)
    - Used for AI chat context (preferred over plain text when available) to enable timestamp references
    - Toggle between timestamped and plain text views in `YouTubeItemView.tsx`
  - Environment variable: `EXPO_PUBLIC_SERPAI_API_KEY`
  - Config entry in `src/config/api.ts` under `API_CONFIG.SERPAPI`
  - User preferences in `AdminSheet.tsx`:
    - **YouTube Enrichment Source**: Toggle between `youtubei.js` or `SerpAPI`
    - **YouTube Transcript Source**: Toggle between `youtubei.js` or `SerpAPI`
    - Preferences stored in `adminSettingsStore` (cloud-synced) and read via `adminSettingsComputed`
  - Pipeline enrichment:
    - `Step04_1a_EnrichYouTube_SerpAPI` (conditional on user preference) enriches YouTube metadata via SerpAPI
    - `Step04_4_EnrichSerpApiGeneric` enriches supported sites (e.g., eBay, Yelp, Apple App Store)
    - Supported content types: `ebay`, `yelp`, `app_store`
  - API usage tracking (`src/services/apiUsageTracking.ts` and `src/stores/apiUsageTracking.ts`):
    - Tracks all SerpAPI operations that count against quota (enrichment, transcripts)
    - Stores records in `api_usage_tracking` table (PostgreSQL)
    - Local caching in Legend-State for offline access
    - Operations tracked: `youtube_enrichment`, `youtube_transcript`, `ebay_product`, `yelp_business`, `app_store`
    - Note: Account API calls are free and not tracked

### 5.6 Client-side URL Parsing (Linkedom)
- For basic saves on mobile, the app fetches the target URL directly on-device and parses HTML using `linkedom` (`src/services/linkedomParser.ts`).
- Extracted fields:
  - title → stored in `items.title`
  - description → stored in `items.desc`
  - lead image → stored in `items.thumbnail_url`
  - full HTML → stored in `items.content` (for offline viewing)
- This reduces reliance on AI for simple metadata and speeds up saves.
- If a site blocks fetch or lacks metadata, we save a minimal item and skip enrichment. Premium AI enrichments remain available but are not invoked for basic saves.

#### Metadata Extraction Pipeline Architecture
The metadata extraction pipeline (`src/services/pipeline/`) has been reorganized to optimize performance and reliability. The pipeline runs sequentially through these steps:

**Pipeline Step Order:**
1. **Step01_DetectType** (formerly Step02) - Fast URL pattern-based content type detection
2. **Step02_DetectTypeAI** (formerly Step03) - AI fallback for ambiguous URLs
3. **Step03_ParseLinkedom** (formerly Step01) - HTML parsing fallback for generic content
4. **Step04_*** - Specialized enrichment steps for specific content types

**Key Design Decisions:**

**Why Type Detection First:**
- URL pattern matching is instant (no HTTP fetch required) and works offline
- Critical for URLs like Amazon product pages that would otherwise be blocked by linkedom (HTML too large or anti-bot protection)
- Ensures correct content type before attempting metadata extraction
- Examples: YouTube URLs → `youtube`, Amazon URLs → `product`, X/Twitter URLs → `x`

**Linkedom as Fallback:**
- Linkedom parsing moved to Step03 to run AFTER type detection succeeds
- Only runs for content types WITHOUT specialized enrichers (Step04)
- Skips if `content_type` already has a dedicated enrichment step
- Prevents redundant HTTP fetches and HTML parsing
- Content types with specialized enrichers: `youtube`, `x`, `reddit`, `ebay`, `yelp`, `app_store`, `note`
- Content types using linkedom fallback: `bookmark`, `product`, `amazon`, `instagram`, `movie`, `article`, etc.

**Invalid URL Handling:**
- Step01_DetectType validates URL format using `new URL()` try-catch
- Invalid URLs are immediately converted to notes:
  - Set `content_type` to `note`
  - Set `title` to empty string
  - Set `desc` to the original pasted text (preserves user input)
  - Clear `url`, `thumbnail_url`, and `content` fields
- Subsequent pipeline steps skip notes automatically
- Ensures user input is never lost, even if it's not a URL

**Why This Order Matters:**
- **Original Problem**: Amazon product URLs were saved as "unknown" type with no metadata
- **Root Cause**: Step01_ParseLinkedom ran first, failed on Amazon's large HTML, converted item to 'note' before type detection could run
- **Solution**: Detect type FIRST from URL pattern (instant), then use linkedom as fallback only when needed
- **Result**: Amazon URLs correctly detected as 'product', linkedom extracts metadata successfully, no specialized enricher conflicts

**Systematic Missing Enricher Pattern Discovered:**
After fixing the pipeline order, a systematic issue was identified: certain content types were correctly detected by Step01 but lacked Step04 enrichers, causing metadata to appear only after manual refresh. The refresh worked because it called `extractURLMetadata` which had specialized extractors, but the initial pipeline run had no enrichment step.

**Affected Platforms & Fixes:**
- **Amazon Products** (`product` type): Added Step04_5_EnrichAmazon - extracts title, description, product images (supports short URLs like a.co)
- **IMDb Movies/TV** (`movie`, `tv_show` types): Added Step04_6_EnrichMovie - extracts poster images, descriptions, cast info
- **TikTok Videos** (`tiktok` type): Added Step04_7_EnrichTikTok - extracts author, title, description, video thumbnails
- **Reddit Videos**: Added video player support to RedditItemView and RedditItemCard components for proper video playback

All platforms now receive complete metadata on first save without requiring manual refresh.

**Implementation Details:**
- Pipeline controller: `src/services/pipeline/runPipeline.ts`
- Step files: `src/services/pipeline/steps/Step0*.ts`
- Each step can skip execution based on item state (e.g., skip if `content_type` already set)
- Steps communicate via item updates stored in Legend-State and synced to Supabase
- All steps handle offline scenarios gracefully (queue for later processing)

**Step04 Enrichers (Platform-Specific Metadata Extraction):**
- `Step04_1a_EnrichYouTube_SerpAPI` - YouTube metadata via SerpAPI (conditional on user preference)
- `Step04_1_EnrichYouTube` - YouTube metadata via youtubei.js
- `Step04_2_EnrichX` - X/Twitter posts with media and engagement metrics
- `Step04_3_EnrichReddit` - Reddit posts with videos, images, and community data
- `Step04_4_EnrichSerpApiGeneric` - eBay products, Yelp businesses, Apple App Store apps
- `Step04_5_EnrichAmazon` - Amazon products including short URLs (a.co, amzn.to)
- `Step04_6_EnrichMovie` - IMDb movies and TV shows with posters and cast
- `Step04_7_EnrichTikTok` - TikTok videos with author and thumbnail data

**Content Types with Specialized Enrichers:**
Step03_ParseLinkedom skips these types: `['youtube', 'x', 'reddit', 'ebay', 'yelp', 'app_store', 'product', 'movie', 'tv_show', 'tiktok', 'note']`

### 5.5 Sync Service & Offline Handling (`src/services/syncService.ts`)
The app uses an **offline-first architecture** with automatic sync and real-time updates:

- **Local Storage**: Legend-State stores backed by AsyncStorage
  - Items, Spaces, ItemSpaces (deprecated), ItemMetadata, ItemTypeMetadata, VideoTranscripts
  - All data cached locally for offline access
  - Tombstones (soft-deleted items/spaces) retained for cross-device sync reliability

- **Sync Operations** (`syncService.ts`):
  - `syncService.syncToCloud()` - Full bidirectional sync (spaces → items → metadata → transcripts)
  - `syncService.uploadItem(item, userId)` - Upload single item
  - `syncService.updateItem(itemId, updates)` - Update item online/offline
  - `syncService.deleteItem(itemId)` - Soft-delete item (tombstone)
  - `syncService.uploadSpace(space, userId)` - Upload space
  - `syncService.updateSpace(space)` - Update space
  - `syncService.deleteSpace(spaceId)` - Soft-delete space (tombstone)
  - `syncService.uploadVideoTranscript(transcript)` - Upload transcript
  - `syncService.deleteVideoTranscript(itemId)` - Delete transcript
  - **Update Detection**: Compares `updated_at` timestamps and `space_id` changes to download modified items (not just new ones)

- **Tombstone-Based Deletion Sync**:
  - Items and spaces marked as deleted (`is_deleted=true`, `deleted_at` timestamp) instead of being removed
  - Prevents "resurrection bug" where offline devices re-upload deleted content
  - Sync detects remote deletions and marks local items/spaces as deleted
  - UI automatically filters out deleted items/spaces (using `activeSpaces()` and filtered item queries)
  - Tombstones retained indefinitely for sync reliability (optional cleanup can be added later)

- **Archive Sync** (`src/stores/items.ts`, `src/stores/spaces.ts`):
  - **Item Archive**: `itemsActions.archiveItemWithSync(itemId, autoArchived)` - Archives individual items with optional auto-archive flag
  - **Space Archive**: `spacesActions.archiveSpaceWithSync(spaceId)` - Archives space and all items within it
    - Calls `itemsActions.bulkArchiveItemsInSpace(spaceId)` to archive all items
    - Each item marked with `is_archived=true`, `archived_at` timestamp, and `auto_archived=true`
    - Items synced to Supabase individually with all archive fields
    - Space synced with `is_archived=true` and `archived_at` via `syncOperations.updateSpace()`
  - **Space Unarchive**: `spacesActions.unarchiveSpaceWithSync(spaceId)` - Unarchives space and selectively restores auto-archived items
  - **Item Unarchive**: `itemsActions.unarchiveItemWithSync(itemId)` - Restores archived item to active state
    - Sets `is_archived=false`, clears `archived_at` and `auto_archived`
    - Syncs to Supabase via `syncOperations.updateItem()`
    - Triggers real-time update to remove from Archive view on all devices
  - **UI Filtering**: All views use `spacesComputed.activeSpaces()` to exclude archived/deleted spaces; items filtered with `!item.is_archived && !item.is_deleted`
  - **Archive View**: Special filter shows `item.is_archived === true` items; accessible via `SPECIAL_SPACES.ARCHIVE_ID` constant from `src/constants/index.ts`
  - **Loading States**: Archive/unarchive operations show full-screen overlay with "Archiving..." or "Unarchiving..." message to prevent interaction during sync
  - **Toast Notifications**: Success/error toasts displayed after archive/unarchive operations via global `ToastContext`

- **Sync Status Tracking** (`src/stores/syncStatus.ts`):
  - Tracks sync state via `isSyncing` flag in syncStatusStore
  - Updated by syncService listeners throughout sync operations
  - **Initial Sync UI Feedback**: When user signs in and sync is in progress:
    - EmptyState component checks `syncStatusStore.isSyncing.get()`
    - If syncing with no local items, displays "Syncing from database - Please standby while we load your items..."
    - Provides user feedback during initial data load from Supabase
    - Automatically switches to standard empty state once sync completes
  - Status exposed to UI via reactive Legend-State observers

- **Offline Queue** (`src/stores/offlineQueue.ts`):
  - Queues all write operations when offline
  - Automatically processes queue on reconnect
  - Supports: create_item, update_item, delete_item, save_video_transcript, delete_video_transcript

- **Network Detection**:
  - Periodic connection checks (every 30 seconds)
  - Online/offline status tracking
  - Automatic sync trigger when coming online

- **Conflict Resolution**:
  - Newest-wins strategy based on `updated_at` timestamps
  - Bi-directional sync with merge logic
  - Tombstone pattern prevents data resurrection
  - Real-time updates provide instant conflict detection

### 5.6 Real-time Cross-Device Sync (`src/services/realtimeSync.ts`)
The app implements **instant cross-device synchronization** using Supabase real-time subscriptions:

- **WebSocket Subscriptions** (`realtimeSync.ts`):
  - Subscribes to PostgreSQL changes on `items` and `spaces` tables
  - Listens for INSERT, UPDATE, and DELETE events filtered by user ID
  - Automatically starts on user sign-in, stops on sign-out
  - Provides instant updates (typically 1-2 seconds) when changes occur on other devices

- **Event Handling**:
  - **INSERT**: Adds new items/spaces to local store if they don't exist
  - **UPDATE**: Updates existing items/spaces with latest data from server (Supabase is source of truth)
    - Handles `space_id` changes for item reassignment
    - Handles `order_index` changes for space reordering (automatically re-sorts local array when order changes)
    - Updates all fields including metadata, archive state, etc.
  - **DELETE**: Marks items/spaces as deleted locally (soft-delete/tombstone)

- **Local Store Updates**:
  - Updates AsyncStorage with new data
  - Updates Legend-State stores (items, spaces)
  - Triggers reactive UI updates via store observers
  - Maintains filtered views (excludes deleted/archived items)

- **Integration with useAuth Hook** (`src/hooks/useAuth.ts`):
  - Real-time sync starts automatically on SIGNED_IN and INITIAL_SESSION events
  - Stops on SIGNED_OUT to clean up subscriptions
  - Runs alongside manual sync for redundancy

- **Reliability & Fallback**:
  - Real-time provides **fast path** for instant updates (99% of cases)
  - Manual sync provides **safety net** for missed events:
    - Offline scenarios (device was offline when change occurred)
    - Network hiccups or WebSocket interruptions
    - App backgrounded (mobile OS may suspend connections)
    - Supabase service interruptions
  - Tombstone pattern ensures correct state even if events are missed
  - Combination of real-time + manual sync provides both speed and reliability

- **Database Configuration**:
  - Requires real-time replication enabled for `items` and `spaces` tables
  - Configured via migration `20251024_enable_realtime.sql`
  - Uses Supabase's built-in publication `supabase_realtime`

- **Performance**:
  - WebSocket connection is persistent and lightweight
  - Events are filtered server-side by user ID (no unnecessary data transfer)
  - Updates batched and debounced to prevent UI thrashing
  - Minimal battery impact (single WebSocket vs periodic polling)

## 5.7 ItemView Component Architecture

The ItemView rendering system has been refactored to use reusable components, reducing code duplication and improving maintainability across different content types.

### Component Location
All reusable ItemView components are located in `src/components/itemViews/components/` with a barrel export in `index.ts` for convenient imports.

### Reusable Components

#### Core Components
1. **SectionHeader** (`SectionHeader.tsx`)
   - Standardized section label headers used across all itemViews
   - Props: `label`, `isDarkMode`, `rightElement`, `onPress`, `style`
   - Consistent uppercase styling with proper spacing

2. **ItemViewTitle** (`ItemViewTitle.tsx`)
   - Inline editable title component
   - Wraps `InlineEditableText` with consistent styling
   - Props: `value`, `onSave`, `isDarkMode`, `placeholder`, `style`

3. **ItemViewDescription** (`ItemViewDescription.tsx`)
   - Inline editable description with optional section label
   - Supports collapsible text with "Show More" functionality
   - Props: `value`, `onSave`, `isDarkMode`, `placeholder`, `showLabel`, `label`, `maxLines`, `collapsible`, `collapsedLines`, `showMoreThreshold`

4. **ItemViewTldr** (`ItemViewTldr.tsx`)
   - AI-powered summary generation with editable text (formerly `TldrSection`)
   - Generates concise summaries using OpenAI
   - Props: See existing TldrSection documentation

5. **ItemViewNotes** (`ItemViewNotes.tsx`)
   - User notes with inline editing (formerly `NotesSection`)
   - Supports multi-line text input
   - Props: See existing NotesSection documentation

6. **ItemViewFooter** (`ItemViewFooter.tsx`)
   - Footer with action buttons (refresh, copy URL, share, archive/unarchive, delete)
   - Displays creation and archive timestamps
   - Props: `item`, `onRefresh`, `onShare`, `onArchive`, `onUnarchive`, `onDelete`, `isRefreshing`, `isDeleting`, `isDarkMode`

#### Interactive Components
7. **ActionButton** (`ActionButton.tsx`)
   - Standardized action button with variants (primary, secondary, danger)
   - Supports disabled state and loading indicators
   - Props: `label`, `onPress`, `disabled`, `isDarkMode`, `variant`, `style`, `textStyle`

8. **ExpandableContent** (`ExpandableContent.tsx`)
   - Collapsible content display with expand/collapse toggle
   - Optional copy button and statistics footer (chars, words, read time)
   - Props: `content`, `isDarkMode`, `showByDefault`, `expandLabel`, `collapseLabel`, `onCopy`, `showCopyButton`, `showStats`, `maxHeight`

9. **GenerateableContentSection** (`GenerateableContentSection.tsx`)
   - Toggle between "Generate" button and content display
   - Animated transitions using Reanimated
   - Props: `label`, `content`, `isGenerating`, `isDarkMode`, `onGenerate`, `onCopy`, `generateLabel`, `generatingLabel`, `expandLabel`, `collapseLabel`, `showByDefault`, `showStats`, `buttonOpacity`, `contentOpacity`

10. **SelectorDropdown** (`SelectorDropdown.tsx`)
    - Generic dropdown selector component (used for spaces, content types, thumbnails)
    - Supports color indicators and icons
    - Props: `label`, `selectedLabel`, `placeholder`, `onPress`, `isDarkMode`, `icon`, `colorIndicator`

11. **MetadataBadges** (`MetadataBadges.tsx`)
    - Renders conditional badges (spoilers, NSFW, locked, pinned, etc.)
    - Configurable colors and icons per badge
    - Props: `badges` (array of Badge objects with `label`, `icon`, `backgroundColor`, `textColor`, `show`)

#### Content-Specific Components
12. **ImageDescriptionsSection** (`ImageDescriptionsSection.tsx`)
    - Complete section for generating and displaying AI image descriptions
    - Integrates with `imageDescriptionsStore` for state management
    - Auto-expands after generation with animated transitions
    - Props: `itemId`, `isDarkMode`, `onGenerate`, `showToast`
    - Used in: DefaultItemView, XItemView, RedditItemView

13. **TranscriptSection** (`TranscriptSection.tsx`)
    - Flexible transcript component supporting both YouTube and X/Twitter styles
    - Features:
      - Optional timestamp display (YouTube-style)
      - Optional SRT export (YouTube-style)
      - Plain text view for simpler implementations (X-style)
      - Statistics footer (chars, words, reading time)
      - Copy to clipboard functionality
    - Props: `transcript`, `segments`, `isDarkMode`, `isGenerating`, `onGenerate`, `showToast`, `enableTimestamps`, `enableSrtExport`
    - Used in: YouTubeItemView (with timestamps & SRT), XItemView (plain text only)

### ItemView Files
All ItemView components are located in `src/components/itemViews/`:
- **DefaultItemView.tsx** - Generic bookmarks and general items
- **NoteItemView.tsx** - Note content type
- **YouTubeItemView.tsx** - YouTube videos with transcript support
- **XItemView.tsx** - X/Twitter posts with videos and image descriptions
- **RedditItemView.tsx** - Reddit posts with engagement metrics and video playback support
  - Integrates video player via HeroMediaSection with autoplay (muted) and play button overlay
  - Retrieves video URLs from `itemTypeMetadataComputed.getVideoUrl()`
  - Supports both video posts and image carousel posts
- **MovieTVItemView.tsx** - Movies/TV shows with simplified features

**Item Card Components** (Grid view):
All ItemCard components are located in `src/components/items/`:
- **RedditItemCard.tsx** - Includes video player support with play button overlay
  - Displays video first if available, falls back to images
  - Uses expo-video for autoplay (muted) in grid view

### Usage Pattern
ItemViews import components using the barrel export:
```typescript
import {
  ItemViewTitle,
  ItemViewDescription,
  ItemViewTldr,
  ItemViewNotes,
  ItemViewFooter,
  SectionHeader,
  ActionButton,
  SelectorDropdown,
  ImageDescriptionsSection,
  TranscriptSection,
} from './components';
```

### Benefits
- **Reduced Duplication**: ~7,000 lines of duplicated code eliminated
- **Consistency**: Uniform styling and behavior across all itemViews
- **Maintainability**: Changes to shared UI patterns only require updating one component
- **Extensibility**: Easy to add new itemView types by composing existing components
- **Type Safety**: Shared TypeScript interfaces ensure proper prop usage

### Design Patterns
- All components support dark mode via `isDarkMode` prop
- Consistent spacing (sections: `marginBottom: 20`, labels: `marginBottom: 8`)
- Standardized color palette (primary: `#007AFF` light, `#0A84FF` dark)
- Unified border radius (`8` or `12` depending on component)
- Animated transitions using react-native-reanimated for smooth UX

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
- **Archived Spaces View**: Add dedicated view to manage archived spaces (currently only items are shown in Archive view).

