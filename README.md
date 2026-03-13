## Travel Agent App

Mobile-first travel planner with:

- Saved places with Google Maps and Amap links
- Budgeting with currency conversion
- Group expense split and settlements
- Itinerary management
- Shared cloud sync across devices (agent + phone) using `tripId`

## Local Development

Run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Shared Sync Setup

The app supports two storage modes:

- `Redis mode` (recommended for cloud deploy): Upstash Redis
- `Local file mode` (for Mac-as-server): files under `/.data/trips`

To use Redis mode, configure Upstash Redis in Vercel and locally:

1. Create an Upstash Redis database (or add Redis integration in Vercel).
2. Set environment variables:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. In the app, use the same `Trip ID` on both devices.

Without these env vars, the API automatically uses local file mode (`/.data/trips/*.json`).
This is ideal when you run the app on your Mac and connect from iPhone via Meshnet.

## API

- `GET /api/travel-data?tripId=<id>`
- `PUT /api/travel-data?tripId=<id>`

The server stores one shared JSON record per `tripId`, with `updatedAt` for polling updates.

## Deploy

Deploy to Vercel:

```bash
npx vercel
npx vercel --prod
```
