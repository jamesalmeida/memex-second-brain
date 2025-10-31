import type { StepContext, Step } from './types';
import { Step01_DetectType } from './steps/Step01_DetectType';
import { Step02_DetectTypeAI } from './steps/Step02_DetectTypeAI';
import { Step03_ParseLinkedom } from './steps/Step03_ParseLinkedom';
import { Step04_1_EnrichYouTube } from './steps/Step04_1_EnrichYouTube';
import { Step04_2_EnrichX } from './steps/Step04_2_EnrichX';
import { Step04_3_EnrichReddit } from './steps/Step04_3_EnrichReddit';
import { Step04_1a_EnrichYouTube_SerpAPI } from './steps/Step04_1a_EnrichYouTube_SerpAPI';
import { Step04_4_EnrichSerpApiGeneric } from './steps/Step04_4_EnrichSerpApiGeneric';
import { Step04_5_EnrichAmazon } from './steps/Step04_5_EnrichAmazon';
import { Step04_6_EnrichMovie } from './steps/Step04_6_EnrichMovie';
// import { Step99_Finalize } from './steps/Step99_Finalize';

// Order: Detect type first (URL patterns), then AI fallback, then linkedom fallback for generic bookmarks, then enrichers
const STEPS: Step[] = [
  Step01_DetectType,
  Step02_DetectTypeAI,
  Step03_ParseLinkedom,
  Step04_1a_EnrichYouTube_SerpAPI,
  Step04_1_EnrichYouTube,
  Step04_2_EnrichX,
  Step04_3_EnrichReddit,
  Step04_4_EnrichSerpApiGeneric,
  Step04_5_EnrichAmazon,
  Step04_6_EnrichMovie,
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


