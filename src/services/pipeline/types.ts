import type { Item } from '../../types';

export interface StepContext {
  itemId: string;
  url: string;
  preferences?: {
    youtubeSource?: 'youtubei' | 'serpapi';
  };
}

export interface StepResult {
  updates?: Partial<Item>;
}

export type Step = (ctx: StepContext) => Promise<StepResult | void>;


