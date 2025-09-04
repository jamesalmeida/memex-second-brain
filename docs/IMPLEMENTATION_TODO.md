# Memex Implementation TODO

## Overview
This document tracks the implementation progress of the Memex: Second Brain mobile app. We're following a UI-first approach, building components with mock data before connecting to the backend.

## Phase 1: Documentation & Planning ✅
- [x] Create this TODO document
- [ ] Update PRD to reflect expanding card pattern instead of modal

## Phase 2: Mock Data & Utilities
- [ ] Create mock data generator (`src/utils/mockData.ts`)
  - [ ] Generate sample items for all content types (bookmark, youtube, x, github, etc.)
  - [ ] Generate sample spaces with different colors
  - [ ] Include realistic metadata (titles, descriptions, thumbnails, dates)
  - [ ] Helper functions for different data states (loading, error, empty)

## Phase 3: Core UI Components

### ItemCard Component (`src/components/ItemCard.tsx`)
- [ ] Basic card structure with thumbnail and title
- [ ] Type-specific rendering:
  - [ ] Bookmark: favicon + domain
  - [ ] YouTube: video thumbnail + duration badge
  - [ ] X/Twitter: tweet preview + profile pic
  - [ ] GitHub: repo stats (stars, forks)
  - [ ] Image: thumbnail preview
  - [ ] Note: text preview
  - [ ] Article: reading time estimate
- [ ] Dark mode support
- [ ] Press handler for expansion
- [ ] Long-press handler for quick actions
- [ ] Loading/placeholder state

### SpaceCard Component (`src/components/SpaceCard.tsx`)
- [ ] Card with space name and description
- [ ] Color-coded background or border
- [ ] Item count badge
- [ ] Last updated timestamp
- [ ] Dark mode support
- [ ] Press handler for navigation

### ExpandedItemView Component (`src/components/ExpandedItemView.tsx`)
- [ ] Full-screen expanded view structure
- [ ] Hero animation setup:
  - [ ] Track original card position
  - [ ] Animate from card to full screen
  - [ ] Reverse animation on close
- [ ] Content sections:
  - [ ] Header with close (X) button
  - [ ] Hero image/thumbnail (shared element)
  - [ ] Title and metadata
  - [ ] Full content in ScrollView
  - [ ] Action buttons bar (Edit, Archive, Delete, Share, Chat)
  - [ ] Tags section
  - [ ] Space assignment
- [ ] Gesture handling:
  - [ ] Swipe down to close
  - [ ] Tap X to close
- [ ] Dark mode support

## Phase 4: Screen Updates

### Home Screen (`app/(tabs)/index.tsx`)
- [ ] Replace placeholder with FlatList
- [ ] Two-column grid layout
- [ ] Render ItemCards with mock data
- [ ] Search bar UI (non-functional initially)
- [ ] Floating Action Button (FAB) for add
- [ ] Pull-to-refresh gesture
- [ ] Empty state UI
- [ ] Loading state
- [ ] Integration with ExpandedItemView

### Spaces Screen (`app/(tabs)/spaces.tsx`)
- [ ] Replace placeholder with FlatList/ScrollView
- [ ] Grid layout for SpaceCards
- [ ] Render SpaceCards with mock data
- [ ] FAB for creating new space
- [ ] Empty state UI
- [ ] Loading state

### Space Detail Screen (`app/space/[id].tsx`)
- [ ] Create new screen file
- [ ] Setup routing with space ID parameter
- [ ] Space header with info and color
- [ ] Filtered item grid (same as home but filtered)
- [ ] Back navigation
- [ ] Edit space option
- [ ] Chat with space button

## Phase 5: Animation System
- [ ] Install react-native-reanimated
- [ ] Create animation utilities:
  - [ ] Position tracking for cards
  - [ ] Shared element transition helper
  - [ ] Spring animations for smooth feel
  - [ ] Gesture handler integration
- [ ] Test performance on:
  - [ ] iOS simulator
  - [ ] Android emulator
  - [ ] Physical devices

## Phase 6: Save Functionality

### AddItemSheet Completion
- [ ] URL input field with validation
- [ ] Text input for notes
- [ ] Image picker integration
- [ ] File upload support
- [ ] Content type auto-detection
- [ ] Space selection dropdown
- [ ] Save to store (initially local)
- [ ] Error handling and validation
- [ ] Success feedback

### Metadata Service (`src/services/metadataService.ts`)
- [ ] URL parsing and validation
- [ ] Content type detection from URL patterns:
  - [ ] YouTube URLs
  - [ ] Twitter/X URLs
  - [ ] GitHub URLs
  - [ ] General website detection
- [ ] Mock metadata extraction (for now)
- [ ] Placeholder for real API integration

## Phase 7: State Management Integration
- [ ] Connect ItemCards to itemsStore
- [ ] Connect SpaceCards to spacesStore
- [ ] Implement offline queue for saves
- [ ] Add optimistic updates
- [ ] Error recovery

## Phase 8: Backend Integration
- [ ] Supabase connection for items
- [ ] Supabase connection for spaces
- [ ] Real metadata extraction APIs
- [ ] Image upload to Supabase Storage
- [ ] Sync offline queue

## Phase 9: Share Extensions & Intents
- [ ] iOS Share Extension setup
- [ ] Android Intent handling
- [ ] Chrome Extension API endpoint

## Phase 10: Advanced Features
- [ ] Chat functionality with items/spaces
- [ ] Search implementation with Fuse.js
- [ ] Filters by content type
- [ ] Archive functionality
- [ ] Bulk operations

## Testing Checklist
- [ ] All components render in light mode
- [ ] All components render in dark mode
- [ ] Animations are smooth (60fps)
- [ ] Gestures work correctly
- [ ] Empty states display properly
- [ ] Error states handle gracefully
- [ ] Offline mode works
- [ ] Data persists correctly

## Performance Targets
- [ ] Grid scrolling at 60fps
- [ ] Card expansion < 300ms
- [ ] Image loading with placeholders
- [ ] Memory usage optimized for large lists

## Known Issues & Bugs
- None yet (project just starting)

## Notes
- Starting with mock data to establish UI/UX
- Prioritizing visual polish before backend
- Using expanding card pattern (like App Store) instead of modal
- Bottom sheets will slide over expanded cards for additional actions

---
Last Updated: [Will be updated as we progress]