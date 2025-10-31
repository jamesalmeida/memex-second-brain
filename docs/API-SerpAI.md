# Account API
Account API allows you to check the number of searches you made in this month, your plan's monthly limit, your plan's monthly searches left, your account's hourly throughput limit, and if you have an account with no monthly plan then you can also check the remaining credits. Account API is free of charge, and using it will not be counted toward your monthly quota.

You can query https://serpapi.com/account.json using a GET request with these parameters:

## API Parameters
api_key

Required

Parameter is your SerpApi private key. You should be able to retrieve it inside the 'Your Account' tab.

## API Examples
Account API example
GET


https://serpapi.com/account?api_key=SECRET_API_KEY
                
## JSON Example

{
  "account_id": "5ac54d6adefb2f1dba1663f5",
  "api_key": "SECRET_API_KEY",
  "account_email": "demo@serpapi.com",
  "plan_id": "bigdata",
  "plan_name": "Big Data Plan",
  "plan_monthly_price": 250.0,
  "searches_per_month": 30000,
  "plan_searches_left": 5958,
  "extra_credits": 0,
  "total_searches_left": 5958,
  "this_month_usage": 24042,
  "last_hour_searches": 42,
  "account_rate_limit_per_hour": 6000
}



## YouTube Video API
YouTube Video API allows scraping video details (description, view count, related videos, comments, replies, etc.).

- Endpoint: `/search?engine=youtube_video` (GET)
- Base: `https://serpapi.com/search?engine=youtube_video`

### API Parameters
- v (optional): Video ID

### Localization
- gl (optional): Country (e.g., us, uk, fr)
- hl (optional): Language (e.g., en, es, fr)

### Pagination
- next_page_token (optional): Token for pagination of related videos/comments/replies. One of:
  - related_videos_next_page_token
  - comments_next_page_token
  - comments_sorting_token.token
  - replies_next_page_token

### SerpAPI Parameters
- engine (required): `youtube_video`
- no_cache (optional): Bypass cache (cached requests are free and last ~1h). Mutually exclusive with `async`.
- async (optional): Submit and retrieve later via Searches Archive API. Mutually exclusive with `no_cache`.
- zero_trace (optional, enterprise): Skip storing search parameters/metadata.
- api_key (required): SerpAPI key.
- output (optional): `json` (default) or `html`.
- json_restrictor (optional): Restrict fields for smaller responses.

### API Results
JSON output includes structured data for video results. A search status is accessible via `search_metadata.status`.

### HTML Results
No HTML response (only prettified text files via `search_metadata.prettify_html_file`).

### JSON response example
{
  ...
}

---

## YouTube Video Transcript API
YouTube Video Transcript API allows scraping video transcripts with timing, chapters and language details.

- Endpoint: `/search?engine=youtube_video_transcript`
- Base: `https://serpapi.com/search.json?engine=youtube_video_transcript&v=VIDEO_ID`

### API Parameters
- v (required): Video ID (e.g., youtu.be/VIDEO_ID or youtube.com/watch?v=VIDEO_ID)

### Localization
- language_code (optional): Language code, e.g., `en`, `es-ES`, `zh-Hans`. Defaults to English or first available if the requested language is not present.

### Advanced Parameters
- title (optional): Retrieve a specific transcript by title
- type (optional): Transcript type, e.g., `asr` for auto-generated

### SerpAPI Parameters
- engine (required): `youtube_video_transcript`
- no_cache (optional): Bypass cache (mutually exclusive with `async`)
- async (optional): Submit and retrieve later via Searches Archive API (mutually exclusive with `no_cache`)
- zero_trace (optional, enterprise)
- api_key (required)
- output (optional)
- json_restrictor (optional)

### API Results
JSON output includes a transcript which may be:
- Flat array of `transcript` items with `start_ms`, `end_ms`, and `snippet`, or
- `transcript.segments` array with `start_ms`, `end_ms`, and `text`/`snippet`

### HTML Results
No HTML response (prettified files available via metadata links).

### API Example
`https://serpapi.com/search.json?engine=youtube_video_transcript&v=Gk8gB5VACZw&type=asr`

### Integration via JavaScript
const { getJson } = require("serpapi");

getJson({
  engine: "youtube_video_transcript",
  v: "Gk8gB5VACZw",
  type: "asr",
  api_key: "<REDACTED>"
}, (json) => {
  console.log(json);
});

### JSON Response Example
{
  ...
}