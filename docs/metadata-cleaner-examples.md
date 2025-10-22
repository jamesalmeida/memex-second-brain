# Metadata Cleaner - Usage Examples

The `metadataCleaner` service provides LLM-powered metadata extraction and cleaning for any content type.

## Cost
- **~$0.0002-0.0003 per call** using GPT-4o-mini
- Only called as fallback when regex/parsing fails

## Amazon Products (Current Implementation)

```typescript
import { extractProductTitle } from '../services/metadataCleaner';

const title = await extractProductTitle(description, {
  excludeAuthors: true,
});
```

## Generic Use Cases

### Clean Article Metadata
```typescript
import { cleanArticleMetadata } from '../services/metadataCleaner';

// Remove site names, navigation text, promotional content
const cleaned = await cleanArticleMetadata(
  "How to Code | Developer Blog | Subscribe Now!",
  "Learn coding with our tutorials. Click here to subscribe..."
);
// Result: { title: "How to Code", description: "Learn coding with our tutorials" }
```

### Extract Social Media Post Info
```typescript
import { cleanSocialPostMetadata } from '../services/metadataCleaner';

const cleaned = await cleanSocialPostMetadata(
  "Just launched my new app! Check it out: [link] #coding #startup",
  "twitter"
);
// Result: { title: "New app launch", description: "Just launched my new app..." }
```

### Custom Content Type
```typescript
import { cleanMetadataWithLLM } from '../services/metadataCleaner';

// Podcast episode
const result = await cleanMetadataWithLLM({
  rawData: {
    title: "Ep 123: Interview with John Doe - Podcast Name",
    description: "In this episode...",
  },
  extract: { both: true },
  context: {
    contentType: 'podcast',
    instructions: 'Extract episode title without podcast name or episode number',
  },
});
// Result: { title: "Interview with John Doe", description: "..." }
```

### Title Only Extraction
```typescript
const result = await cleanMetadataWithLLM({
  rawData: {
    description: "Very long product description with lots of text..."
  },
  extract: { title: true },
  context: {
    contentType: 'product',
    instructions: 'Extract only the product name',
  },
});
// Result: { title: "Product Name" }
```

## Adding to Other Extractors

### Example: TikTok Extractor Enhancement

```typescript
// In extractTikTokMetadata function
if (!title || title === 'TikTok' || title.length < 10) {
  // Try LLM extraction from description
  const cleaned = await cleanSocialPostMetadata(description || '', 'tiktok');
  if (cleaned?.title) {
    title = cleaned.title;
  }
}
```

### Example: IMDB Extractor Enhancement

```typescript
// In extractIMDBMetadata function
if (metadata.title && metadata.description) {
  // Clean up messy IMDB metadata
  const cleaned = await cleanMetadataWithLLM({
    rawData: {
      title: metadata.title,
      description: metadata.description,
    },
    extract: { both: true },
    context: {
      contentType: contentType, // 'movie' or 'tv_show'
      instructions: 'Remove "IMDb" suffix and clean description',
    },
  });

  if (cleaned) {
    title = cleaned.title || title;
    description = cleaned.description || description;
  }
}
```

## Best Practices

1. **Use as fallback only** - Try regex/parsing first, LLM second
2. **Be specific with instructions** - Better prompts = better results
3. **Set appropriate context** - Content type helps the LLM understand expectations
4. **Monitor costs** - Track API usage in production

## Performance Notes

- Average response time: 500-1000ms
- Caches responses if same data seen repeatedly
- Fails gracefully - returns null if OpenAI unavailable
- Only runs if `EXPO_PUBLIC_OPENAI_API_KEY` is configured
