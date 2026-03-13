import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";
import { TravelData, TravelRecord, defaultData } from "@/lib/travel-data";

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  return Redis.fromEnv();
}

function keyForTrip(tripId: string): string {
  const safeTripId = tripId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return `travel-agent:trip:${safeTripId || "default"}`;
}

function parseTripId(req: NextRequest): string {
  const url = new URL(req.url);
  return (url.searchParams.get("tripId") || "default").trim();
}

function isTravelData(value: unknown): value is TravelData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<TravelData>;
  return (
    Array.isArray(data.places) &&
    Array.isArray(data.budgetItems) &&
    Array.isArray(data.members) &&
    Array.isArray(data.expenses) &&
    Array.isArray(data.itinerary) &&
    typeof data.baseCurrency === "string"
  );
}

export async function GET(req: NextRequest) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json(
      { error: "Storage is not configured. Set Upstash Redis env vars." },
      { status: 503 },
    );
  }

  const tripId = parseTripId(req);
  const key = keyForTrip(tripId);
  const record = await redis.get<TravelRecord>(key);

  return NextResponse.json({ record: record ?? null });
}

export async function PUT(req: NextRequest) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json(
      { error: "Storage is not configured. Set Upstash Redis env vars." },
      { status: 503 },
    );
  }

  const tripId = parseTripId(req);
  const body = await req.json();

  if (!isTravelData(body)) {
    return NextResponse.json({ error: "Invalid payload shape." }, { status: 400 });
  }

  const key = keyForTrip(tripId);
  const payload: TravelRecord = {
    ...defaultData(),
    ...body,
    updatedAt: Date.now(),
  };

  await redis.set(key, payload);
  return NextResponse.json({ record: payload });
}

