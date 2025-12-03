# Memex Assistant Implementation Plan

This document outlines the implementation plan for adding an AI Assistant layer to the Memex app.

## Overview

The Memex Assistant is a separate layer that provides:
- A dedicated Chat tab for conversing with a personal AI assistant
- Tools for searching the user's saved items (Everything DB)
- Memory capabilities for storing and recalling user preferences and facts
- Future: Architect mode for schema evolution and code generation

## Architecture

### Separation of Concerns

**Memex Core:**
- Items: URLs, transcripts, image descriptions, tags, etc.
- "Everything" grid UI
- Existing item-level chat (ChatSheet)

**Memex Assistant:**
- Chat UI in dedicated tab
- OpenAI function calling with tools
- Tools: `search_items`, `create_memory`, `search_memories`
- Extra logic for "architect mode" (future)

---

## Implementation Phases

### Phase 1: Add Chat Tab (Basic Chatbot)

**Status: COMPLETED**

- [x] Explore existing codebase structure
- [x] Create this implementation plan document
- [x] Rename `app/(tabs)/spaces.tsx` to `app/(tabs)/spacesGrid.tsx`
- [x] Create new `app/(tabs)/assistant.tsx` for the Chat tab
- [x] Create `src/components/AssistantChat.tsx` component
- [x] Create `src/stores/assistant.ts` for assistant state management
- [x] Update `BottomNavigation.tsx` to switch between Everything/Chat views
- [x] Update `_layout.tsx` to include the new assistant screen

**Goal:** Users can chat with a basic AI assistant that doesn't yet have tools.

### Phase 2: Search Items Tool

**Status: COMPLETED**

- [x] Create `src/services/assistantTools.ts` for tool definitions
- [x] Implement `search_items` tool that searches the user's saved items
- [x] Extend `openai.ts` with function calling support
- [x] Create `createChatCompletionWithTools()` method in openai.ts
- [x] Update assistant chat to use tools
- [x] Add system prompt explaining available tools

**Tool Definition:**
```typescript
{
  name: "search_items",
  description: "Search the user's saved items in Memex by title, description, content, or tags",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query to find relevant items"
      },
      limit: {
        type: "number",
        description: "Maximum number of results to return (default: 5)"
      }
    },
    required: ["query"]
  }
}
```

### Phase 3: Assistant Memories

**Status: COMPLETED**

- [x] Add `assistant_memories` table type to `src/types/database.ts`
- [x] Add `AssistantMemory` interface to `src/types/index.ts`
- [x] Create Supabase migration for `assistant_memories` table
- [x] Implement `create_memory` tool in `assistantTools.ts`
- [x] Implement `search_memories` tool in `assistantTools.ts`
- [x] Update system prompt to explain memory usage

**Database Schema:** (see `supabase/migrations/20251203_create_assistant_memories.sql`)
```sql
CREATE TABLE assistant_memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('preference', 'person', 'fact', 'task', 'project', 'general')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  importance FLOAT DEFAULT 0.5,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Tool Definitions:**
```typescript
{
  name: "create_memory",
  description: "Save a memory about the user (preferences, facts, people they mention, etc.)",
  parameters: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["preference", "person", "fact", "task", "project", "general"] },
      title: { type: "string", description: "Short title for the memory" },
      body: { type: "string", description: "Detailed content of the memory" },
      importance: { type: "number", description: "Importance score 0-1" },
      tags: { type: "array", items: { type: "string" } }
    },
    required: ["kind", "title", "body"]
  }
}

{
  name: "search_memories",
  description: "Search the assistant's memories about the user",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      kind: { type: "string", enum: ["preference", "person", "fact", "task", "project", "general"] },
      limit: { type: "number", description: "Max results (default: 5)" }
    },
    required: ["query"]
  }
}
```

### Phase 4: Memory Schema Inspection

**Status: COMPLETED**

- [x] Create memory schema JSON definition (`src/services/memorySchema.ts`)
- [x] Implement `inspect_memory_schema` tool
- [x] Implement `inspect_memory_stats` tool
- [x] Add `/architect` command mode (prefix with `/architect` or `/arch`)
- [x] Generate schema evolution proposals (`propose_schema_evolution` tool)

**New Files:**
- `src/services/memorySchema.ts` - Schema definition with types, kinds, and evolution proposals

**New Tools:**
```typescript
{
  name: "inspect_memory_schema",
  description: "Inspect the current memory schema definition",
  parameters: {
    kind: { type: "string", description: "Optional: specific kind to inspect" },
    include_full_schema: { type: "boolean", description: "Return complete JSON schema" }
  }
}

{
  name: "inspect_memory_stats",
  description: "Get statistics about the user's memories",
  parameters: {
    group_by: { type: "string", enum: ["kind", "importance", "month", "tags"] },
    include_samples: { type: "boolean", description: "Include sample titles" }
  }
}

{
  name: "propose_schema_evolution",
  description: "Generate a schema evolution proposal",
  parameters: {
    evolution_type: { type: "string", enum: ["add_kind", "add_field", "modify_field", "add_constraint"] },
    target_kind: { type: "string", description: "Kind to modify" },
    proposal_description: { type: "string", description: "Description of the change" },
    rationale: { type: "string", description: "Why this change is beneficial" }
  }
}
```

### Phase 5: Code Architect Mode

**Status: COMPLETED**

- [x] Export repo map for context (`src/services/repoMap.ts`)
- [x] Generate coding agent prompts
- [x] Implement `inspect_repo_map` tool
- [x] Implement `generate_coding_prompt` tool

**New Files:**
- `src/services/repoMap.ts` - Codebase structure definition and prompt generation

**New Tools:**
```typescript
{
  name: "inspect_repo_map",
  description: "Get an overview of the codebase structure",
  parameters: {
    section: { type: "string", enum: ["all", "screens", "components", "stores", "services", "types", "config"] },
    format: { type: "string", enum: ["markdown", "concise", "json"] }
  }
}

{
  name: "generate_coding_prompt",
  description: "Create structured prompts for coding tasks",
  parameters: {
    task: { type: "string", description: "Coding task description" },
    relevant_files: { type: "array", items: { type: "string" } },
    additional_context: { type: "string", description: "Additional requirements" }
  }
}
```

---

## File Structure

```
src/
├── components/
│   ├── AssistantChat.tsx        # Main chat component with /architect support
│   └── ChatSheet.tsx            # Existing item-level chat
├── services/
│   ├── openai.ts                # Extended with function calling
│   ├── assistantTools.ts        # Tool definitions and handlers (8 tools)
│   ├── memorySchema.ts          # Memory schema definition (Phase 4)
│   └── repoMap.ts               # Codebase structure for architect mode (Phase 5)
├── stores/
│   └── assistant.ts             # Assistant chat state with AsyncStorage persistence
└── types/
    ├── index.ts                 # Extended with AssistantMemory, MemoryKind types
    └── database.ts              # Extended with assistant_memories table

app/(tabs)/
├── _layout.tsx                  # Updated for sliding views
├── index.tsx                    # Everything tab (unchanged)
├── assistant.tsx                # Chat tab screen
└── spacesGrid.tsx               # Renamed from spaces.tsx (for future use)

supabase/migrations/
└── 20251203_create_assistant_memories.sql  # Memory table migration
```

---

## Key Design Decisions

### 1. Reusing Components
- The `AssistantChat` component shares styling and patterns with `ChatSheet`
- Message bubbles, typing indicators, and input UI are consistent
- The main difference is context: ChatSheet has item context, AssistantChat uses tools

### 2. State Management
- Using Legend State with the same observable pattern as other stores
- Assistant messages persisted to AsyncStorage
- Tool calls logged for debugging

### 3. Tool Execution
- Tools execute client-side (no separate backend endpoint needed)
- OpenAI function calling determines when to use tools
- Agentic loop handles multiple tool calls in sequence (max 5 rounds)
- Tool results are inserted into conversation and sent back to OpenAI

### 4. System Prompt
The system prompt (in `assistantTools.ts`) explains:
- Available tools and when to use them
- Guidelines for memory creation
- How to handle search results
- Privacy and data handling expectations

---

## Progress Tracking

Last updated: 2025-12-03

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 | COMPLETED | Chat tab setup with basic UI |
| Phase 2 | COMPLETED | search_items tool with function calling |
| Phase 3 | COMPLETED | Memory system with create/search tools |
| Phase 4 | COMPLETED | Schema inspection with /architect mode |
| Phase 5 | COMPLETED | Code architect with repo map and coding prompts |

---

## Usage Guide

### Basic Assistant Usage
1. Run the Supabase migration: `supabase db push` or apply `20251203_create_assistant_memories.sql`
2. Navigate to the Chat tab in the app
3. Try asking the assistant to search your saved items or remember something about you

### Architect Mode
Prefix any message with `/architect` or `/arch` to enter architect mode:

**Schema Analysis:**
- `/architect Show me memory stats` - View memory usage patterns
- `/architect Inspect the memory schema` - See current schema definition
- `/architect Propose a new memory kind for recipes` - Get schema evolution proposals

**Code Analysis:**
- `/architect Show me the codebase structure` - View repo map
- `/architect Generate a coding prompt for adding a new feature` - Create structured coding task

### Available Tools Summary

| Tool | Mode | Description |
|------|------|-------------|
| `search_items` | Both | Search user's saved items |
| `create_memory` | Both | Save memories about the user |
| `search_memories` | Both | Search existing memories |
| `inspect_memory_schema` | Architect | View memory schema definition |
| `inspect_memory_stats` | Architect | Memory usage statistics |
| `propose_schema_evolution` | Architect | Schema change proposals |
| `inspect_repo_map` | Architect | Codebase structure overview |
| `generate_coding_prompt` | Architect | Create coding task prompts |

---

## Future Enhancements

Potential improvements:
- Add more specialized tools (calendar, reminders, etc.)
- Improve search with semantic/embedding-based retrieval
- Add voice input/output support
- Implement memory archival and cleanup
- Add export/import for memories
- Integrate with external coding tools (Claude Code, Cursor, etc.)
