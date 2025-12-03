// Memory Schema Definition for Assistant
// This defines the structure of memory types and their fields

export interface MemoryFieldSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  constraints?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    enum?: string[];
    itemType?: string;
  };
}

export interface MemoryKindSchema {
  kind: string;
  description: string;
  examples: string[];
  suggestedFields: string[];
  useCases: string[];
}

export interface MemorySchemaDefinition {
  version: string;
  description: string;
  baseFields: MemoryFieldSchema[];
  kinds: MemoryKindSchema[];
  recommendations: {
    maxMemoriesPerKind: number;
    importanceThresholds: {
      low: number;
      medium: number;
      high: number;
      critical: number;
    };
    autoArchiveAfterDays: number;
    deduplicationStrategy: string;
  };
}

// The actual memory schema definition
export const MEMORY_SCHEMA: MemorySchemaDefinition = {
  version: '1.0.0',
  description: 'Schema for assistant memories - stores user preferences, facts, people, tasks, projects, and general information',

  baseFields: [
    {
      name: 'id',
      type: 'string',
      description: 'Unique identifier (UUID)',
      required: true,
    },
    {
      name: 'user_id',
      type: 'string',
      description: 'Reference to the user who owns this memory',
      required: true,
    },
    {
      name: 'kind',
      type: 'string',
      description: 'The type/category of memory',
      required: true,
      constraints: {
        enum: ['preference', 'person', 'fact', 'task', 'project', 'general'],
      },
    },
    {
      name: 'title',
      type: 'string',
      description: 'Short title for the memory',
      required: true,
      constraints: {
        minLength: 1,
        maxLength: 100,
      },
    },
    {
      name: 'body',
      type: 'string',
      description: 'Detailed content of the memory',
      required: true,
      constraints: {
        minLength: 1,
        maxLength: 5000,
      },
    },
    {
      name: 'importance',
      type: 'number',
      description: 'Importance score from 0 to 1',
      required: false,
      constraints: {
        min: 0,
        max: 1,
      },
    },
    {
      name: 'tags',
      type: 'array',
      description: 'Optional tags for categorizing the memory',
      required: false,
      constraints: {
        itemType: 'string',
      },
    },
    {
      name: 'created_at',
      type: 'string',
      description: 'Timestamp when the memory was created',
      required: true,
    },
    {
      name: 'updated_at',
      type: 'string',
      description: 'Timestamp when the memory was last updated',
      required: true,
    },
  ],

  kinds: [
    {
      kind: 'preference',
      description: 'User preferences, likes, dislikes, and personal choices',
      examples: [
        'Prefers dark mode interfaces',
        'Likes coffee over tea',
        'Favors TypeScript over JavaScript',
        'Prefers concise responses',
      ],
      suggestedFields: ['category', 'strength'],
      useCases: [
        'Personalizing recommendations',
        'Adjusting communication style',
        'Filtering content based on preferences',
      ],
    },
    {
      kind: 'person',
      description: 'Information about people in the user\'s life',
      examples: [
        'Sarah - wife, works as a nurse',
        'John - colleague, expert in machine learning',
        'Mom - lives in Seattle, birthday March 15',
      ],
      suggestedFields: ['relationship', 'contact_info', 'birthday', 'notes'],
      useCases: [
        'Providing context about relationships',
        'Remembering important dates',
        'Understanding social context in conversations',
      ],
    },
    {
      kind: 'fact',
      description: 'Facts about the user themselves',
      examples: [
        'Works as a software engineer at Acme Corp',
        'Lives in San Francisco',
        'Has 2 cats named Luna and Shadow',
        'Allergic to shellfish',
      ],
      suggestedFields: ['category', 'verified'],
      useCases: [
        'Personalizing responses',
        'Providing relevant context',
        'Avoiding inappropriate suggestions',
      ],
    },
    {
      kind: 'task',
      description: 'Tasks, to-dos, and action items',
      examples: [
        'Need to renew passport before June',
        'Call dentist to schedule cleaning',
        'Review quarterly report by Friday',
      ],
      suggestedFields: ['due_date', 'priority', 'status', 'recurrence'],
      useCases: [
        'Tracking pending items',
        'Providing reminders',
        'Understanding current workload',
      ],
    },
    {
      kind: 'project',
      description: 'Ongoing projects and long-term goals',
      examples: [
        'Building a personal finance app',
        'Learning Spanish',
        'Home renovation - kitchen remodel',
      ],
      suggestedFields: ['status', 'milestones', 'deadline', 'collaborators'],
      useCases: [
        'Tracking progress on goals',
        'Providing relevant suggestions',
        'Understanding context for related questions',
      ],
    },
    {
      kind: 'general',
      description: 'General information that doesn\'t fit other categories',
      examples: [
        'Mentioned interest in hiking last week',
        'Asked about vegetarian recipes',
        'Discussed travel plans to Japan',
      ],
      suggestedFields: [],
      useCases: [
        'Catching miscellaneous information',
        'Building general user profile',
        'Providing conversation continuity',
      ],
    },
  ],

  recommendations: {
    maxMemoriesPerKind: 100,
    importanceThresholds: {
      low: 0.25,
      medium: 0.5,
      high: 0.75,
      critical: 0.9,
    },
    autoArchiveAfterDays: 365,
    deduplicationStrategy: 'merge_similar_titles',
  },
};

// Schema evolution proposals interface
export interface SchemaEvolutionProposal {
  id: string;
  type: 'add_kind' | 'add_field' | 'modify_field' | 'add_constraint' | 'remove_field';
  description: string;
  rationale: string;
  impact: 'low' | 'medium' | 'high';
  migration: {
    required: boolean;
    steps?: string[];
  };
  proposed: {
    kind?: string;
    field?: MemoryFieldSchema;
    modification?: Partial<MemoryFieldSchema>;
  };
}

// Helper to generate schema summary for the assistant
export function getSchemaOverview(): string {
  const kinds = MEMORY_SCHEMA.kinds.map(k => `- **${k.kind}**: ${k.description}`).join('\n');
  const fields = MEMORY_SCHEMA.baseFields.map(f =>
    `- \`${f.name}\` (${f.type}${f.required ? ', required' : ''}): ${f.description}`
  ).join('\n');

  return `# Memory Schema v${MEMORY_SCHEMA.version}

## Description
${MEMORY_SCHEMA.description}

## Memory Kinds
${kinds}

## Base Fields
${fields}

## Recommendations
- Max memories per kind: ${MEMORY_SCHEMA.recommendations.maxMemoriesPerKind}
- Auto-archive after: ${MEMORY_SCHEMA.recommendations.autoArchiveAfterDays} days
- Deduplication: ${MEMORY_SCHEMA.recommendations.deduplicationStrategy}
`;
}

// Helper to get detailed info about a specific kind
export function getKindDetails(kindName: string): string | null {
  const kind = MEMORY_SCHEMA.kinds.find(k => k.kind === kindName);
  if (!kind) return null;

  return `# Memory Kind: ${kind.kind}

## Description
${kind.description}

## Examples
${kind.examples.map(e => `- ${e}`).join('\n')}

## Suggested Additional Fields
${kind.suggestedFields.length > 0 ? kind.suggestedFields.map(f => `- ${f}`).join('\n') : '(none)'}

## Use Cases
${kind.useCases.map(u => `- ${u}`).join('\n')}
`;
}
