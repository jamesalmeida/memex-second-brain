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
    - **Archive**: Moves item to archive (soft archive with `is_archived=true`)
    - **Delete**: Soft-deletes item (tombstone pattern with `is_deleted=true`)
    - **Move to Space**: Opens SpaceSelectorModal to reassign item to different space
  - **Configuration**:
    - Users can customize which 3 actions appear in menu via "Configure Action Button" in drawer
    - Default actions: Chat, Share, Archive
    - Selection range: 1-3 actions (enforced by ActionMenuConfigModal)
    - Configuration stored in `User_Settings.ui_radial_actions` and syncs across devices
    - ActionMenuConfigModal displays all 5 available actions with descriptions, icons, and selection indicators
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
  - Fields: `id` (UUID, PK), `item_id` (UUID, FK to Items), `transcript` (text), `platform` (text: youtube, x, tiktok, instagram, reddit, etc.), `language` (text, default 'en'), `duration` (integer, seconds), `fetched_at` (timestamp), `created_at` (timestamp), `updated_at` (timestamp).  
  - Purpose: Stores transcripts for videos from various platforms.  
  - Unique constraint on `item_id` - one transcript per video item.  
- **Spaces**:
  - Fields: `id` (UUID, PK), `user_id` (UUID, FK to Users), `name` (text), `desc` (text, nullable), `description` (text, nullable), `color` (text, default '#007AFF'), `item_count` (integer, default 0), `order_index` (integer, nullable), `is_archived` (boolean, default false), `archived_at` (timestamp, nullable), `is_deleted` (boolean, default false), `deleted_at` (timestamp, nullable), `created_at` (timestamp), `updated_at` (timestamp).
  - Note: `description` is an alternative field for `desc`; `item_count` is denormalized for performance.
  - Note: `order_index` is the **single source of truth** for space ordering across all devices. When spaces are manually reordered via drag-and-drop, the new `order_index` values are synced to Supabase and propagated to other devices via real-time updates. The UI always displays spaces sorted by their `order_index` value.
  - Note: Archiving a space automatically archives all items within it (tracked via `Item.auto_archived`).
  - Note: Soft-delete fields (`is_deleted`, `deleted_at`) enable tombstone-based sync for reliable cross-device deletion.
- **User_Settings**:
  - Fields: `id` (UUID, PK), `user_id` (UUID, FK to Users, unique), `theme_dark_mode` (boolean, default false), `ai_chat_model` (text, default 'gpt-4o-mini'), `ai_metadata_model` (text, default 'gpt-4o-mini'), `ai_auto_transcripts` (boolean, default false), `ai_auto_image_descriptions` (boolean, default false), `ui_x_video_muted` (boolean, default true), `ui_autoplay_x_videos` (boolean, default true), `ui_radial_actions` (text[], default ['chat', 'share', 'archive']), `created_at` (timestamp), `updated_at` (timestamp).
  - Purpose: Cloud-synced user preferences that persist across devices and app reinstalls. Replaces device-specific AsyncStorage for global settings.
  - One settings row per user (enforced by unique constraint on `user_id`).
  - Settings categories:
    - Theme: `theme_dark_mode` - Light/dark mode preference
    - AI: `ai_chat_model`, `ai_metadata_model`, `ai_auto_transcripts`, `ai_auto_image_descriptions` - AI model selection and automation preferences
    - UI: `ui_x_video_muted`, `ui_autoplay_x_videos`, `ui_radial_actions` - Video playback and quick action menu preferences
  - Radial Action Menu Configuration:
    - `ui_radial_actions` stores an ordered array of up to 3 action IDs that appear in the long-press radial menu
    - Available actions: 'chat' (open AI chat), 'share' (share item URL), 'archive' (move to archive), 'delete' (soft delete item), 'move' (move to different space)
    - Default actions: ['chat', 'share', 'archive']
    - Users configure via "Configure Action Button" option in drawer menu
    - Configuration modal (ActionMenuConfigModal) allows selecting 1-3 actions with visual ordering indicators
    - Changes sync instantly across devices via Supabase real-time updates
  - Synced on app launch, login, and during manual sync operations.
  - Changes are optimistically updated locally then synced to Supabase.
  - Falls back to legacy AsyncStorage if cloud sync unavailable (offline mode).
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
- **Offline_Queue** (client-side, Legend-State, mirrored in Supabase):  
  - Fields: `id` (UUID, PK), `user_id` (UUID, FK to Users), `action_type` (enum: create_item, update_item, delete_item, create_capture), `payload` (JSONB), `created_at` (timestamp), `status` (enum: pending, synced, failed).  
  - JSONB `payload` examples:  
    - Create item: `{ "title": "...", "url": "...", "content_type": "bookmark" }`  
    - Update item: `{ "item_id": "...", "title": "...", "desc": "..." }`  
  - Purpose: Tracks offline actions for reliable sync with Supabase.  
- **Performance Indexes**:
  - Items: `idx_items_user_id`, `idx_items_content_type`, `idx_items_created_at`, `idx_items_is_archived`, `idx_items_is_deleted`, `idx_items_space_id`, `idx_items_tags` (GIN on tags array).
  - Spaces: `idx_spaces_user_id`, `idx_spaces_user_order` (user_id, order_index), `idx_spaces_is_deleted`, `idx_spaces_is_archived`.
  - User_Settings: `idx_user_settings_user_id` (unique).
  - Item_Spaces (deprecated): `idx_item_spaces_item_id`, `idx_item_spaces_space_id`.
  - Chat_Messages: `idx_chat_messages_chat_id`, `idx_chat_messages_created_at`, `idx_chat_messages_chat_id_created_at`, `idx_chat_messages_chat_type`, `idx_chat_messages_metadata` (GIN on JSONB).
  - Video_Transcripts: `idx_video_transcripts_item_id`, `idx_video_transcripts_created_at`, `idx_video_transcripts_platform`.
  - Image_Descriptions: `idx_image_descriptions_item_id`, `idx_image_descriptions_created_at`.
  - Offline_Queue: `idx_offline_queue_user_id`, `idx_offline_queue_status`.
- **Database Migrations**:
  - `20251024_add_soft_delete_to_spaces.sql` - Adds soft-delete fields to spaces table
  - `20251024_add_archive_and_simplify_spaces.sql` - Adds archive fields to items/spaces, migrates to one-space-per-item, adds `Items.space_id`
  - `20251024_enable_realtime.sql` - Enables Supabase real-time replication for items and spaces tables
  - `20251027_add_tldr_and_notes_to_items.sql` - Adds `tldr` and `notes` fields to items table for AI summaries and user annotations
  - `20251028_create_user_settings.sql` - Creates `user_settings` table for cloud-synced user preferences (theme, AI models, UI preferences)
  - Note: Archive functionality requires `is_archived`, `archived_at`, and `auto_archived` fields added in `20251024_add_archive_and_simplify_spaces.sql`

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
  - **TagManagerSheet**: Bottom sheet for managing all tags. Features:
    - Accessible via "Manage Tags" button in drawer (below Settings)
    - Lists all tags with item counts sorted alphabetically
    - Inline editing: tap edit icon to modify tag name
    - Delete functionality: tap delete icon, confirm via alert
    - Tag merging: editing a tag to an existing name triggers merge confirmation
    - Updates sync to all items immediately via itemsActions.updateItemWithSync
    - 82% screen height (matches SettingsSheet)
    - Covers bottom navigation when open
    - Empty state for no tags
    - Loading overlay during tag operations
    - Full theme support (light/dark mode)
  - **SpaceSelectorModal**: Modal-based UI for selecting item's space. Features:
    - Single-select with radio buttons (one space per item)
    - "Everything (No Space)" option at top
    - Scrollable list of active spaces
    - Auto-closes on selection
    - Matches TagsManagerModal styling pattern
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
  - **Archive View**: Special view for managing archived items. Features:
    - Accessed via Archive tab in HeaderBar or Archive space in DrawerContent
    - Shows all archived items (both manually archived and auto-archived) in flat grid
    - Empty state: "No archived items - Items you archive will appear here"
    - Items display archived date in expanded view footer: "Archived on [date]" or "Auto-archived on [date]"
    - Unarchive button replaces Archive button in expanded item view (MaterialIcons "unarchive" icon)
    - Long-press context menu includes "Unarchive" option
    - Full-screen loading overlay during archive/unarchive operations with "Archiving..." or "Unarchiving..." message
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

