# Supabase Edge Functions

This directory contains Supabase Edge Functions that handle server-side processing for the Memex app.

## Functions

### `extract-metadata`
Extracts metadata from URLs including:
- Title, description, thumbnail
- Content type detection
- Platform-specific metadata (YouTube, Twitter, GitHub, etc.)
- HTML parsing and Open Graph data

**Usage:**
```typescript
const { data, error } = await supabase.functions.invoke('extract-metadata', {
  body: {
    url: 'https://example.com/article',
    contentType: 'article' // optional
  }
});
```

## Deployment

### Prerequisites
1. Install Supabase CLI: `npm install -g supabase`
2. Login to Supabase: `supabase login`
3. Link to your project: `supabase link --project-ref YOUR_PROJECT_REF`

### Deploy Functions
```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy extract-metadata

# Deploy with environment variables
supabase functions deploy extract-metadata --env-file .env.local
```

### Local Development
```bash
# Start local Supabase
supabase start

# Serve functions locally
supabase functions serve

# Test function locally
curl -X POST 'http://localhost:54321/functions/v1/extract-metadata' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://example.com"}'
```

## Environment Variables

Create a `.env.local` file for local development:

```env
# External API Keys (for enhanced metadata extraction)
YOUTUBE_API_KEY=your_youtube_api_key
TWITTER_BEARER_TOKEN=your_twitter_bearer_token
GITHUB_TOKEN=your_github_token
```

## Security

- All functions require authentication via Supabase JWT
- Row Level Security (RLS) is enforced on database operations
- Functions validate input and sanitize URLs

## Error Handling

Functions return structured error responses:
```json
{
  "error": "Error message",
  "details": "Additional context"
}
```

Fallback to client-side processing if Edge Functions fail.
