import type { StepContext, Step } from './types';
import { Step01_ParseLinkedom } from './steps/Step01_ParseLinkedom';
import { Step02_DetectType } from './steps/Step02_DetectType';
import { Step03_DetectTypeAI } from './steps/Step03_DetectTypeAI';
import { Step04_1_EnrichYouTube } from './steps/Step04_1_EnrichYouTube';
import { Step04_2_EnrichX } from './steps/Step04_2_EnrichX';
import { Step04_3_EnrichReddit } from './steps/Step04_3_EnrichReddit';
import { Step04_1a_EnrichYouTube_SerpAPI } from './steps/Step04_1a_EnrichYouTube_SerpAPI';
import { Step04_4_EnrichSerpApiGeneric } from './steps/Step04_4_EnrichSerpApiGeneric';
// import { Step99_Finalize } from './steps/Step99_Finalize';

// Order: Always parse with Linkedom first (fallbacks), then heuristics, then optional AI, then enrichers
const STEPS: Step[] = [
  Step01_ParseLinkedom,
  Step02_DetectType,
  Step03_DetectTypeAI,
  Step04_1a_EnrichYouTube_SerpAPI,
  Step04_1_EnrichYouTube,
  Step04_2_EnrichX,
  Step04_3_EnrichReddit,
  Step04_4_EnrichSerpApiGeneric,
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


