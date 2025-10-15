import type { StepContext, Step } from './types';
import { Step01ParseLinkedom } from './steps/Step01ParseLinkedom';
import { Step02DetectType } from './steps/Step02DetectType';
import { Step04EnrichYouTube } from './steps/Step04EnrichYouTube';
import { Step04bEnrichX } from './steps/Step04bEnrichX';
import { Step03DetectTypeAI } from './steps/Step03DetectTypeAI';

// Order: Always parse with Linkedom first (fallbacks), then heuristics, then optional AI, then enrichers
const STEPS: Step[] = [
  Step01ParseLinkedom,
  Step02DetectType,
  Step03DetectTypeAI,
  Step04EnrichYouTube,
  Step04bEnrichX,
];

export async function runPipeline(ctx: StepContext) {
  for (const step of STEPS) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await step(ctx);
    } catch (error) {
      console.error('[pipeline] Step error:', error);
    }
  }
}


