import type { StepContext, Step } from './types';
import { Step01DetectType } from './steps/Step01DetectType';
import { Step02ParseLinkedom } from './steps/Step02ParseLinkedom';
import { Step03EnrichYouTube } from './steps/Step03EnrichYouTube';
import { Step03bEnrichX } from './steps/Step03bEnrichX';

const STEPS: Step[] = [
  Step01DetectType,
  Step02ParseLinkedom,
  Step03EnrichYouTube,
  Step03bEnrichX,
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


