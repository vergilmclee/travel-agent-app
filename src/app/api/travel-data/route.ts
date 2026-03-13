import { Redis } from "@upstash/redis";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
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

function safeTripId(tripId: string): string {
  return tripId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "default";
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

function localFilePath(tripId: string): string {
  return path.join(process.cwd(), ".data", "trips", `${safeTripId(tripId)}.json`);
}

async function readLocalRecord(tripId: string): Promise<TravelRecord | null> {
  try {
    const content = await readFile(localFilePath(tripId), "utf8");
    const parsed = JSON.parse(content) as TravelRecord;
    return parsed;
  } catch {
    return null;
  }
}

async function writeLocalRecord(tripId: string, record: TravelRecord): Promise<void> {
  const filePath = localFilePath(tripId);
  const dirPath = path.dirname(filePath);
  await mkdir(dirPath, { recursive: true });

  const tmpPath = `${filePath}.${Date.now()}.tmp`;
  await writeFile(tmpPath, JSON.stringify(record), "utf8");
  await rename(tmpPath, filePath);
}

export async function GET(req: NextRequest) {
  const redis = getRedis();
  const tripId = parseTripId(req);

  if (redis) {
    try {
      const key = keyForTrip(tripId);
      const record = await redis.get<TravelRecord>(key);
      return NextResponse.json({ record: record ?? null, storage: "redis" });
    } catch {
      // Fall through to local file storage.
    }
  }

  const record = await readLocalRecord(tripId);
  return NextResponse.json({ record, storage: "file" });
}

export async function PUT(req: NextRequest) {
  const redis = getRedis();
  const tripId = parseTripId(req);
  const body = await req.json();

  if (!isTravelData(body)) {
    return NextResponse.json({ error: "Invalid payload shape." }, { status: 400 });
  }

  const payload: TravelRecord = {
    ...defaultData(),
    ...body,
    updatedAt: Date.now(),
  };

  if (redis) {
    try {
      const key = keyForTrip(tripId);
      await redis.set(key, payload);
      return NextResponse.json({ record: payload, storage: "redis" });
    } catch {
      // Fall through to local file storage.
    }
  }

  await writeLocalRecord(tripId, payload);
  return NextResponse.json({ record: payload, storage: "file" });
}
