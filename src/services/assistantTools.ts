import { db, supabase } from './supabase';
import { Item, AssistantMemory, MemoryKind } from '../types';
import { API } from '../constants';

// Tool definitions for OpenAI function calling
export const ASSISTANT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_items',
      description: "Search the user's saved items in Memex by title, description, content, or tags. Use this when the user asks about things they've saved.",
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query to find relevant saved items',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 5, max: 10)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_memory',
      description: 'Save a memory about the user for future reference. Use this when the user shares preferences, facts about themselves, information about people in their life, or important tasks/projects.',
      parameters: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['preference', 'person', 'fact', 'task', 'project', 'general'],
            description: 'The type of memory: preference (user likes/dislikes), person (someone in their life), fact (info about user), task (things to do), project (ongoing projects), general (other)',
          },
          title: {
            type: 'string',
            description: 'Short title for the memory (max 100 chars)',
          },
          body: {
            type: 'string',
            description: 'Detailed content of the memory',
          },
          importance: {
            type: 'number',
            description: 'Importance score from 0 to 1 (default: 0.5)',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional tags for categorizing the memory',
          },
        },
        required: ['kind', 'title', 'body'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_memories',
      description: "Search the assistant's memories about the user. Use this before answering personal questions to recall relevant context.",
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query to find relevant memories',
          },
          kind: {
            type: 'string',
            enum: ['preference', 'person', 'fact', 'task', 'project', 'general'],
            description: 'Optional: filter by memory type',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 5, max: 10)',
          },
        },
        required: ['query'],
      },
    },
  },
];

// Tool execution handlers
export const toolHandlers = {
  // Search user's saved items
  search_items: async (args: { query: string; limit?: number }): Promise<string> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return JSON.stringify({ error: 'User not authenticated' });
      }

      const limit = Math.min(args.limit || 5, 10);
      const { data, error } = await db.searchItems(user.id, args.query, limit, 0);

      if (error) {
        console.error('[AssistantTools] Error searching items:', error);
        return JSON.stringify({ error: 'Failed to search items' });
      }

      if (!data || data.length === 0) {
        return JSON.stringify({
          message: 'No items found matching the query',
          items: []
        });
      }

      // Format items for the assistant
      const formattedItems = data.map((item: any) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        content_type: item.content_type,
        description: item.desc?.substring(0, 200),
        tags: item.tags,
        created_at: item.created_at,
      }));

      return JSON.stringify({
        message: `Found ${formattedItems.length} item(s)`,
        items: formattedItems,
      });
    } catch (error) {
      console.error('[AssistantTools] Error in search_items:', error);
      return JSON.stringify({ error: 'An error occurred while searching items' });
    }
  },

  // Create a new memory
  create_memory: async (args: {
    kind: MemoryKind;
    title: string;
    body: string;
    importance?: number;
    tags?: string[];
  }): Promise<string> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return JSON.stringify({ error: 'User not authenticated' });
      }

      const { data, error } = await supabase
        .from('assistant_memories')
        .insert({
          user_id: user.id,
          kind: args.kind,
          title: args.title.substring(0, 100),
          body: args.body,
          importance: Math.min(Math.max(args.importance || 0.5, 0), 1),
          tags: args.tags || [],
        })
        .select()
        .single();

      if (error) {
        console.error('[AssistantTools] Error creating memory:', error);
        return JSON.stringify({ error: 'Failed to create memory' });
      }

      console.log('[AssistantTools] Created memory:', data.id, data.title);
      return JSON.stringify({
        success: true,
        message: `Memory saved: "${args.title}"`,
        memory_id: data.id,
      });
    } catch (error) {
      console.error('[AssistantTools] Error in create_memory:', error);
      return JSON.stringify({ error: 'An error occurred while creating memory' });
    }
  },

  // Search memories
  search_memories: async (args: {
    query: string;
    kind?: MemoryKind;
    limit?: number;
  }): Promise<string> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return JSON.stringify({ error: 'User not authenticated' });
      }

      const limit = Math.min(args.limit || 5, 10);

      // Build query
      let query = supabase
        .from('assistant_memories')
        .select('*')
        .eq('user_id', user.id)
        .order('importance', { ascending: false })
        .order('updated_at', { ascending: false })
        .limit(limit);

      // Add kind filter if specified
      if (args.kind) {
        query = query.eq('kind', args.kind);
      }

      // Add text search
      // Use ilike for basic search (full-text search would be better but requires proper setup)
      query = query.or(`title.ilike.%${args.query}%,body.ilike.%${args.query}%`);

      const { data, error } = await query;

      if (error) {
        console.error('[AssistantTools] Error searching memories:', error);
        return JSON.stringify({ error: 'Failed to search memories' });
      }

      if (!data || data.length === 0) {
        return JSON.stringify({
          message: 'No memories found matching the query',
          memories: [],
        });
      }

      // Format memories for the assistant
      const formattedMemories = data.map((memory: AssistantMemory) => ({
        kind: memory.kind,
        title: memory.title,
        body: memory.body,
        importance: memory.importance,
        tags: memory.tags,
        created_at: memory.created_at,
      }));

      return JSON.stringify({
        message: `Found ${formattedMemories.length} memory/memories`,
        memories: formattedMemories,
      });
    } catch (error) {
      console.error('[AssistantTools] Error in search_memories:', error);
      return JSON.stringify({ error: 'An error occurred while searching memories' });
    }
  },
};

// Execute a tool by name
export async function executeTool(
  name: string,
  args: Record<string, any>
): Promise<string> {
  const handler = toolHandlers[name as keyof typeof toolHandlers];
  if (!handler) {
    return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
  return handler(args);
}

// System prompt for the assistant with tools
export const ASSISTANT_SYSTEM_PROMPT_WITH_TOOLS = `You are a helpful AI assistant for Memex, a personal knowledge management app. The user saves bookmarks, articles, videos, and notes to their Memex.

You have access to the following tools:

1. **search_items**: Search the user's saved items in Memex. Use this when the user asks about:
   - Things they've saved or bookmarked
   - Specific content they might have stored
   - Questions that might be answered by their saved content

2. **create_memory**: Save important information about the user for future conversations. Use this when:
   - The user explicitly says "remember that..." or "you should know..."
   - The user shares significant preferences (e.g., "I prefer X over Y")
   - The user mentions people in their life with context
   - The user discusses ongoing projects or goals

3. **search_memories**: Search your memories about the user. Use this:
   - Before answering personal questions about the user
   - When the user references something they told you before
   - To provide personalized responses based on known preferences

Guidelines:
- Be helpful, concise, and conversational
- When searching items, summarize what you found in a natural way
- When creating memories, confirm what you're remembering
- Don't create duplicate memories about the same thing
- If you don't find relevant items or memories, say so honestly
- Always prioritize the user's privacy and handle their data respectfully

Current time: {{CURRENT_TIME}}`;
