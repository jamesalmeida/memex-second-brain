// Repo Map Service for Code Architect Mode
// Generates a structured overview of the codebase for AI context

export interface FileInfo {
  path: string;
  type: 'component' | 'service' | 'store' | 'type' | 'screen' | 'hook' | 'util' | 'config' | 'other';
  description?: string;
  exports?: string[];
  dependencies?: string[];
}

export interface RepoMapSection {
  name: string;
  description: string;
  files: FileInfo[];
}

export interface RepoMap {
  projectName: string;
  description: string;
  techStack: string[];
  structure: RepoMapSection[];
  keyPatterns: string[];
}

// Static repo map for Memex - this provides context about the codebase structure
export const MEMEX_REPO_MAP: RepoMap = {
  projectName: 'Memex: Second Brain',
  description: 'A React Native Expo knowledge management app that allows users to save, organize, and interact with various types of content using AI assistance.',

  techStack: [
    'React Native (Expo)',
    'TypeScript',
    'Legend State (reactive state management)',
    'Supabase (backend/auth/database)',
    'OpenAI API (chat/tools)',
    'Expo Router (file-based navigation)',
    'React Native Reanimated (animations)',
  ],

  structure: [
    {
      name: 'App Screens',
      description: 'Main application screens using Expo Router file-based routing',
      files: [
        { path: 'app/(tabs)/index.tsx', type: 'screen', description: 'Everything grid - main content view' },
        { path: 'app/(tabs)/assistant.tsx', type: 'screen', description: 'AI Assistant chat tab' },
        { path: 'app/(tabs)/spacesGrid.tsx', type: 'screen', description: 'Spaces grid (reserved for future)' },
        { path: 'app/(tabs)/_layout.tsx', type: 'config', description: 'Tab layout with sliding views' },
        { path: 'app/auth/', type: 'screen', description: 'Authentication screens' },
      ],
    },
    {
      name: 'Components',
      description: 'Reusable UI components',
      files: [
        { path: 'src/components/AssistantChat.tsx', type: 'component', description: 'Main AI chat interface with tool support' },
        { path: 'src/components/ChatSheet.tsx', type: 'component', description: 'Item-level chat bottom sheet' },
        { path: 'src/components/BottomNavigation.tsx', type: 'component', description: 'Tab navigation bar' },
        { path: 'src/components/ItemCard.tsx', type: 'component', description: 'Card component for items' },
        { path: 'src/components/SpaceCard.tsx', type: 'component', description: 'Card component for spaces' },
      ],
    },
    {
      name: 'State Management',
      description: 'Legend State observable stores for reactive state',
      files: [
        { path: 'src/stores/assistant.ts', type: 'store', description: 'Assistant conversations and messages' },
        { path: 'src/stores/items.ts', type: 'store', description: 'User items (bookmarks, notes, etc.)' },
        { path: 'src/stores/spaces.ts', type: 'store', description: 'User spaces/projects' },
        { path: 'src/stores/theme.ts', type: 'store', description: 'Theme preferences (dark/light mode)' },
        { path: 'src/stores/auth.ts', type: 'store', description: 'Authentication state' },
        { path: 'src/stores/aiSettings.ts', type: 'store', description: 'AI model and settings' },
      ],
    },
    {
      name: 'Services',
      description: 'Business logic and external API integrations',
      files: [
        { path: 'src/services/openai.ts', type: 'service', description: 'OpenAI chat completions with tool support' },
        { path: 'src/services/assistantTools.ts', type: 'service', description: 'Tool definitions and handlers for assistant' },
        { path: 'src/services/memorySchema.ts', type: 'service', description: 'Memory schema definition for architect mode' },
        { path: 'src/services/supabase.ts', type: 'service', description: 'Supabase client and database operations' },
        { path: 'src/services/syncService.ts', type: 'service', description: 'Offline sync and queue management' },
        { path: 'src/services/youtube.ts', type: 'service', description: 'YouTube metadata/transcripts' },
        { path: 'src/services/metadata.ts', type: 'service', description: 'URL metadata extraction' },
      ],
    },
    {
      name: 'Types',
      description: 'TypeScript type definitions',
      files: [
        { path: 'src/types/index.ts', type: 'type', description: 'Core data types (Item, Space, etc.)' },
        { path: 'src/types/database.ts', type: 'type', description: 'Supabase database types' },
      ],
    },
    {
      name: 'Configuration',
      description: 'App configuration and constants',
      files: [
        { path: 'src/constants/index.ts', type: 'config', description: 'App constants, colors, storage keys' },
        { path: 'app.json', type: 'config', description: 'Expo app configuration' },
      ],
    },
  ],

  keyPatterns: [
    'State Management: All stores use Legend State observables with a consistent pattern (observable, actions, computed)',
    'AsyncStorage: Data persistence uses direct AsyncStorage calls with JSON serialization',
    'Theme Support: All components must support both light and dark modes using themeStore.isDarkMode',
    'Tool Calling: OpenAI function calling with agentic loop pattern (max 5 rounds)',
    'Navigation: Expo Router file-based routing with tab navigation',
    'Authentication: Supabase Auth with session persistence',
    'Error Handling: Console logging with emoji prefixes for easy filtering',
  ],
};

// Generate a markdown summary of the repo map
export function generateRepoMapMarkdown(): string {
  const map = MEMEX_REPO_MAP;

  let md = `# ${map.projectName}\n\n`;
  md += `${map.description}\n\n`;

  md += `## Tech Stack\n`;
  map.techStack.forEach(tech => {
    md += `- ${tech}\n`;
  });
  md += '\n';

  md += `## Project Structure\n\n`;
  map.structure.forEach(section => {
    md += `### ${section.name}\n`;
    md += `${section.description}\n\n`;
    md += `| File | Type | Description |\n`;
    md += `|------|------|-------------|\n`;
    section.files.forEach(file => {
      md += `| \`${file.path}\` | ${file.type} | ${file.description || '-'} |\n`;
    });
    md += '\n';
  });

  md += `## Key Patterns\n\n`;
  map.keyPatterns.forEach(pattern => {
    md += `- ${pattern}\n`;
  });

  return md;
}

// Generate a concise context string for AI prompts
export function generateCodeContext(): string {
  const map = MEMEX_REPO_MAP;

  let context = `Project: ${map.projectName}\n`;
  context += `Stack: ${map.techStack.join(', ')}\n\n`;

  context += `Key Files:\n`;
  map.structure.forEach(section => {
    section.files.slice(0, 3).forEach(file => {
      context += `- ${file.path}: ${file.description}\n`;
    });
  });

  context += `\nPatterns:\n`;
  map.keyPatterns.slice(0, 4).forEach(pattern => {
    context += `- ${pattern}\n`;
  });

  return context;
}

// Generate a coding agent prompt for a specific task
export interface CodingAgentPrompt {
  task: string;
  context: string;
  files_to_modify: string[];
  guidelines: string[];
  output_format: string;
}

export function generateCodingAgentPrompt(
  task: string,
  relevantFiles: string[],
  additionalContext?: string
): CodingAgentPrompt {
  const map = MEMEX_REPO_MAP;

  // Find file descriptions for relevant files
  const fileDescriptions = relevantFiles.map(filePath => {
    for (const section of map.structure) {
      const file = section.files.find(f => f.path === filePath);
      if (file) {
        return `- ${file.path}: ${file.description}`;
      }
    }
    return `- ${filePath}`;
  });

  return {
    task,
    context: `${map.description}\n\nTech Stack: ${map.techStack.join(', ')}\n\n${additionalContext || ''}`,
    files_to_modify: relevantFiles,
    guidelines: [
      'Follow existing patterns in the codebase',
      'Use TypeScript with proper type annotations',
      'Support both light and dark mode themes',
      'Use Legend State for any new state management',
      'Handle errors gracefully with console logging',
      'Write clean, readable code without over-engineering',
      'Test both iOS and Android if making UI changes',
    ],
    output_format: `
## Changes Required

For each file that needs modification:

### [filename]
\`\`\`typescript
// Code changes with clear comments
\`\`\`

### Testing
- Steps to verify the changes work correctly
`,
  };
}

// Format a coding agent prompt as markdown
export function formatCodingAgentPromptMarkdown(prompt: CodingAgentPrompt): string {
  let md = `# Coding Task\n\n`;
  md += `## Task\n${prompt.task}\n\n`;
  md += `## Context\n${prompt.context}\n\n`;
  md += `## Files to Modify\n`;
  prompt.files_to_modify.forEach(f => {
    md += `- \`${f}\`\n`;
  });
  md += `\n## Guidelines\n`;
  prompt.guidelines.forEach(g => {
    md += `- ${g}\n`;
  });
  md += `\n## Expected Output Format\n`;
  md += prompt.output_format;

  return md;
}
