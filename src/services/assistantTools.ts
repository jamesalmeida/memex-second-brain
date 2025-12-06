import { db, supabase } from './supabase';
import { Item, AssistantMemory, MemoryKind } from '../types';
import { API } from '../constants';
import { MEMORY_SCHEMA, getSchemaOverview, getKindDetails, SchemaEvolutionProposal } from './memorySchema';
import {
  MEMEX_REPO_MAP,
  generateRepoMapMarkdown,
  generateCodeContext,
  generateCodingAgentPrompt,
  formatCodingAgentPromptMarkdown,
} from './repoMap';

// Tool definitions for OpenAI function calling
export const ASSISTANT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_items',
      description: "Search the user's saved items in Memex by title, description, content, or tags. Returns item data that can be displayed as interactive cards. Use this when the user asks about things they've saved.",
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
          display_as_cards: {
            type: 'boolean',
            description: 'If true, the items will be displayed as interactive cards in the chat (default: true)',
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

// Architect mode tools (Phase 4)
export const ARCHITECT_TOOLS = [
  ...ASSISTANT_TOOLS,
  {
    type: 'function' as const,
    function: {
      name: 'inspect_memory_schema',
      description: 'Inspect the current memory schema definition. Use this to understand the structure, fields, and memory kinds available.',
      parameters: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            enum: ['preference', 'person', 'fact', 'task', 'project', 'general'],
            description: 'Optional: get detailed info about a specific memory kind',
          },
          include_full_schema: {
            type: 'boolean',
            description: 'If true, return the complete JSON schema definition',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'inspect_memory_stats',
      description: 'Get statistics about the user\'s memories. Use this to understand usage patterns and identify areas for schema evolution.',
      parameters: {
        type: 'object',
        properties: {
          group_by: {
            type: 'string',
            enum: ['kind', 'importance', 'month', 'tags'],
            description: 'How to group the statistics (default: kind)',
          },
          include_samples: {
            type: 'boolean',
            description: 'Include sample memory titles for each group',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'propose_schema_evolution',
      description: 'Generate a schema evolution proposal based on current usage patterns and user needs. Only use in architect mode when explicitly requested.',
      parameters: {
        type: 'object',
        properties: {
          evolution_type: {
            type: 'string',
            enum: ['add_kind', 'add_field', 'modify_field', 'add_constraint'],
            description: 'Type of schema evolution to propose',
          },
          target_kind: {
            type: 'string',
            description: 'The memory kind to modify (for add_field, modify_field)',
          },
          proposal_description: {
            type: 'string',
            description: 'Description of the proposed change',
          },
          rationale: {
            type: 'string',
            description: 'Why this change would be beneficial',
          },
        },
        required: ['evolution_type', 'proposal_description', 'rationale'],
      },
    },
  },
  // Phase 5: Code Architect Tools
  {
    type: 'function' as const,
    function: {
      name: 'inspect_repo_map',
      description: 'Get an overview of the codebase structure, tech stack, and key patterns. Use this to understand the project before generating code.',
      parameters: {
        type: 'object',
        properties: {
          section: {
            type: 'string',
            enum: ['all', 'screens', 'components', 'stores', 'services', 'types', 'config'],
            description: 'Which section to inspect (default: all)',
          },
          format: {
            type: 'string',
            enum: ['markdown', 'concise', 'json'],
            description: 'Output format (default: markdown)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'generate_coding_prompt',
      description: 'Generate a structured coding task prompt with context, guidelines, and expected output format. Use this when the user asks for code changes.',
      parameters: {
        type: 'object',
        properties: {
          task: {
            type: 'string',
            description: 'Description of the coding task to accomplish',
          },
          relevant_files: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of file paths that are relevant to this task',
          },
          additional_context: {
            type: 'string',
            description: 'Any additional context about requirements or constraints',
          },
        },
        required: ['task', 'relevant_files'],
      },
    },
  },
];

// Tool execution handlers
export const toolHandlers = {
  // Search user's saved items
  search_items: async (args: { query: string; limit?: number; display_as_cards?: boolean }): Promise<string> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return JSON.stringify({ error: 'User not authenticated' });
      }

      const limit = Math.min(args.limit || 5, 10);
      const displayAsCards = args.display_as_cards !== false; // Default to true
      const { data, error } = await db.searchItems(user.id, args.query, limit, 0);

      if (error) {
        console.error('[AssistantTools] Error searching items:', error);
        return JSON.stringify({ error: 'Failed to search items' });
      }

      if (!data || data.length === 0) {
        return JSON.stringify({
          message: 'No items found matching the query',
          items: [],
          display_as_cards: false,
        });
      }

      // For display: Store full items in a special marker that AssistantChat can extract
      // For API: Return only minimal summary data to avoid token bloat
      const minimalItems = data.map((item: any) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        content_type: item.content_type,
        created_at: item.created_at,
      }));

      const result = {
        message: `Found ${data.length} item(s)`,
        items: minimalItems,
        display_as_cards: displayAsCards,
        // Special marker for AssistantChat to extract full items
        __full_items__: data,
      };

      return JSON.stringify(result);
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

  // Inspect memory schema (Phase 4)
  inspect_memory_schema: async (args: {
    kind?: MemoryKind;
    include_full_schema?: boolean;
  }): Promise<string> => {
    try {
      if (args.kind) {
        const kindDetails = getKindDetails(args.kind);
        if (!kindDetails) {
          return JSON.stringify({ error: `Unknown memory kind: ${args.kind}` });
        }
        return JSON.stringify({
          success: true,
          kind: args.kind,
          details: kindDetails,
        });
      }

      if (args.include_full_schema) {
        return JSON.stringify({
          success: true,
          schema: MEMORY_SCHEMA,
        });
      }

      // Default: return overview
      return JSON.stringify({
        success: true,
        overview: getSchemaOverview(),
        version: MEMORY_SCHEMA.version,
      });
    } catch (error) {
      console.error('[AssistantTools] Error in inspect_memory_schema:', error);
      return JSON.stringify({ error: 'An error occurred while inspecting schema' });
    }
  },

  // Inspect memory stats (Phase 4)
  inspect_memory_stats: async (args: {
    group_by?: 'kind' | 'importance' | 'month' | 'tags';
    include_samples?: boolean;
  }): Promise<string> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return JSON.stringify({ error: 'User not authenticated' });
      }

      const groupBy = args.group_by || 'kind';

      // Fetch all memories for the user
      const { data: memories, error } = await supabase
        .from('assistant_memories')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[AssistantTools] Error fetching memories for stats:', error);
        return JSON.stringify({ error: 'Failed to fetch memory statistics' });
      }

      if (!memories || memories.length === 0) {
        return JSON.stringify({
          message: 'No memories found',
          total_count: 0,
          stats: {},
        });
      }

      let stats: Record<string, { count: number; samples?: string[] }> = {};

      switch (groupBy) {
        case 'kind':
          memories.forEach((m: AssistantMemory) => {
            if (!stats[m.kind]) {
              stats[m.kind] = { count: 0, samples: [] };
            }
            stats[m.kind].count++;
            if (args.include_samples && stats[m.kind].samples!.length < 3) {
              stats[m.kind].samples!.push(m.title);
            }
          });
          break;

        case 'importance':
          const buckets = ['low (0-0.25)', 'medium (0.25-0.5)', 'high (0.5-0.75)', 'critical (0.75-1)'];
          buckets.forEach(b => stats[b] = { count: 0, samples: [] });
          memories.forEach((m: AssistantMemory) => {
            let bucket: string;
            if (m.importance <= 0.25) bucket = buckets[0];
            else if (m.importance <= 0.5) bucket = buckets[1];
            else if (m.importance <= 0.75) bucket = buckets[2];
            else bucket = buckets[3];
            stats[bucket].count++;
            if (args.include_samples && stats[bucket].samples!.length < 3) {
              stats[bucket].samples!.push(m.title);
            }
          });
          break;

        case 'month':
          memories.forEach((m: AssistantMemory) => {
            const month = m.created_at.substring(0, 7); // YYYY-MM
            if (!stats[month]) {
              stats[month] = { count: 0, samples: [] };
            }
            stats[month].count++;
            if (args.include_samples && stats[month].samples!.length < 3) {
              stats[month].samples!.push(m.title);
            }
          });
          break;

        case 'tags':
          memories.forEach((m: AssistantMemory) => {
            const tags = m.tags || ['(untagged)'];
            tags.forEach(tag => {
              if (!stats[tag]) {
                stats[tag] = { count: 0, samples: [] };
              }
              stats[tag].count++;
              if (args.include_samples && stats[tag].samples!.length < 3) {
                stats[tag].samples!.push(m.title);
              }
            });
          });
          break;
      }

      // Remove samples if not requested
      if (!args.include_samples) {
        Object.values(stats).forEach(s => delete s.samples);
      }

      return JSON.stringify({
        success: true,
        total_count: memories.length,
        group_by: groupBy,
        stats,
        oldest_memory: memories[memories.length - 1]?.created_at,
        newest_memory: memories[0]?.created_at,
      });
    } catch (error) {
      console.error('[AssistantTools] Error in inspect_memory_stats:', error);
      return JSON.stringify({ error: 'An error occurred while fetching statistics' });
    }
  },

  // Propose schema evolution (Phase 4)
  propose_schema_evolution: async (args: {
    evolution_type: 'add_kind' | 'add_field' | 'modify_field' | 'add_constraint';
    target_kind?: string;
    proposal_description: string;
    rationale: string;
  }): Promise<string> => {
    try {
      const proposal: SchemaEvolutionProposal = {
        id: `proposal_${Date.now()}`,
        type: args.evolution_type,
        description: args.proposal_description,
        rationale: args.rationale,
        impact: args.evolution_type === 'add_kind' ? 'medium' : 'low',
        migration: {
          required: args.evolution_type !== 'add_field',
          steps: args.evolution_type === 'add_kind'
            ? [
                'Add new kind to MemoryKind type',
                'Update MEMORY_SCHEMA with new kind definition',
                'Add database migration if needed',
                'Update UI to support new kind',
              ]
            : args.evolution_type === 'add_field'
            ? [
                'Add field to MemoryFieldSchema',
                'Update database schema (optional)',
                'Handle field in tool handlers',
              ]
            : [
                'Review existing data for compatibility',
                'Create migration plan',
                'Update schema definition',
                'Migrate existing records',
              ],
        },
        proposed: {
          kind: args.target_kind,
        },
      };

      // Format as markdown for readability
      const output = `
## Schema Evolution Proposal

**ID:** ${proposal.id}
**Type:** ${proposal.type}
**Impact:** ${proposal.impact}

### Description
${proposal.description}

### Rationale
${proposal.rationale}

### Migration Required
${proposal.migration.required ? 'Yes' : 'No'}

${proposal.migration.steps ? `### Migration Steps
${proposal.migration.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}` : ''}

---
*Note: This is a proposal only. Implementation requires manual changes to the codebase.*
`;

      return JSON.stringify({
        success: true,
        proposal,
        formatted_output: output,
      });
    } catch (error) {
      console.error('[AssistantTools] Error in propose_schema_evolution:', error);
      return JSON.stringify({ error: 'An error occurred while generating proposal' });
    }
  },

  // Inspect repo map (Phase 5)
  inspect_repo_map: async (args: {
    section?: 'all' | 'screens' | 'components' | 'stores' | 'services' | 'types' | 'config';
    format?: 'markdown' | 'concise' | 'json';
  }): Promise<string> => {
    try {
      const section = args.section || 'all';
      const format = args.format || 'markdown';

      // Map section names to structure section names
      const sectionMap: Record<string, string> = {
        screens: 'App Screens',
        components: 'Components',
        stores: 'State Management',
        services: 'Services',
        types: 'Types',
        config: 'Configuration',
      };

      if (format === 'json') {
        if (section === 'all') {
          return JSON.stringify({
            success: true,
            repo_map: MEMEX_REPO_MAP,
          });
        }

        const sectionData = MEMEX_REPO_MAP.structure.find(
          s => s.name === sectionMap[section]
        );
        return JSON.stringify({
          success: true,
          section,
          data: sectionData || null,
        });
      }

      if (format === 'concise') {
        return JSON.stringify({
          success: true,
          context: generateCodeContext(),
        });
      }

      // Default: markdown format
      if (section === 'all') {
        return JSON.stringify({
          success: true,
          markdown: generateRepoMapMarkdown(),
        });
      }

      // Specific section markdown
      const sectionData = MEMEX_REPO_MAP.structure.find(
        s => s.name === sectionMap[section]
      );

      if (!sectionData) {
        return JSON.stringify({ error: `Unknown section: ${section}` });
      }

      let md = `## ${sectionData.name}\n\n`;
      md += `${sectionData.description}\n\n`;
      md += `| File | Type | Description |\n`;
      md += `|------|------|-------------|\n`;
      sectionData.files.forEach(file => {
        md += `| \`${file.path}\` | ${file.type} | ${file.description || '-'} |\n`;
      });

      return JSON.stringify({
        success: true,
        section,
        markdown: md,
      });
    } catch (error) {
      console.error('[AssistantTools] Error in inspect_repo_map:', error);
      return JSON.stringify({ error: 'An error occurred while inspecting repo map' });
    }
  },

  // Generate coding prompt (Phase 5)
  generate_coding_prompt: async (args: {
    task: string;
    relevant_files: string[];
    additional_context?: string;
  }): Promise<string> => {
    try {
      const prompt = generateCodingAgentPrompt(
        args.task,
        args.relevant_files,
        args.additional_context
      );

      const markdown = formatCodingAgentPromptMarkdown(prompt);

      return JSON.stringify({
        success: true,
        prompt,
        formatted_output: markdown,
      });
    } catch (error) {
      console.error('[AssistantTools] Error in generate_coding_prompt:', error);
      return JSON.stringify({ error: 'An error occurred while generating coding prompt' });
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

   IMPORTANT: When you call search_items, the items will automatically be displayed as interactive cards in the chat. In your response:
   - Simply introduce the items naturally (e.g., "Here are some items you saved recently:")
   - Do NOT list out the items in your text response - they will appear as cards
   - The user can tap on these cards to view the full item details

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
- When searching items, introduce them with a brief sentence, then let the cards display
- When creating memories, confirm what you're remembering
- Don't create duplicate memories about the same thing
- If you don't find relevant items or memories, say so honestly
- Always prioritize the user's privacy and handle their data respectfully

Current time: {{CURRENT_TIME}}`;

// System prompt for architect mode (Phase 4 & 5)
export const ARCHITECT_SYSTEM_PROMPT = `You are the Memex Architect - an expert system for analyzing and evolving the memory schema and codebase of a personal knowledge management app.

You have access to all standard assistant tools plus specialized architect tools:

## Standard Tools
1. **search_items**: Search the user's saved items
2. **create_memory**: Save memories about the user
3. **search_memories**: Search existing memories

## Schema Architect Tools (Phase 4)
4. **inspect_memory_schema**: View the current memory schema definition
   - Get an overview of all memory kinds and fields
   - Deep-dive into specific memory kinds
   - Export the full JSON schema

5. **inspect_memory_stats**: Analyze memory usage patterns
   - Group by kind, importance, month, or tags
   - Identify trends and gaps in the schema
   - Find areas that need new memory kinds

6. **propose_schema_evolution**: Generate formal proposals for schema changes
   - Add new memory kinds
   - Add fields to existing kinds
   - Modify field constraints
   - Suggest improvements based on usage patterns

## Code Architect Tools (Phase 5)
7. **inspect_repo_map**: Get an overview of the codebase structure
   - View all sections or focus on specific areas (screens, components, stores, services, types, config)
   - Choose format: markdown (detailed), concise (quick reference), or json (raw data)
   - Understand tech stack and key patterns

8. **generate_coding_prompt**: Create structured prompts for coding tasks
   - Generates context-aware coding instructions
   - Includes relevant files, guidelines, and expected output format
   - Perfect for delegating to external coding tools

## Architect Mode Guidelines

When in architect mode:
1. **Analyze before proposing**: Use inspect tools to understand current state
2. **Be conservative**: Only propose changes with clear benefits
3. **Consider migrations**: Remember that schema changes may require data migration
4. **Document rationale**: Explain why each change improves the system
5. **Follow patterns**: Use inspect_repo_map to understand existing code patterns
6. **Generate actionable prompts**: When creating coding tasks, be specific and complete

## Response Format
When generating proposals or code tasks:
- Use clear markdown formatting
- Include code snippets for TypeScript types when relevant
- Provide migration steps if changes affect existing data
- Rate the impact (low/medium/high) of each proposal
- For coding prompts, specify all files that need to be modified

Remember: You're helping design and evolve a system that stores personal, important information. Changes should be thoughtful and well-justified.

Current time: {{CURRENT_TIME}}`;

// Helper to detect architect mode from message
export function isArchitectCommand(message: string): boolean {
  const trimmed = message.trim().toLowerCase();
  return trimmed.startsWith('/architect') || trimmed.startsWith('/arch');
}

// Extract the actual message after /architect command
export function extractArchitectMessage(message: string): string {
  const trimmed = message.trim();
  if (trimmed.toLowerCase().startsWith('/architect')) {
    return trimmed.substring('/architect'.length).trim();
  }
  if (trimmed.toLowerCase().startsWith('/arch')) {
    return trimmed.substring('/arch'.length).trim();
  }
  return trimmed;
}
