import { NextResponse } from "next/server";
import { requireApiAssocie } from "@/lib/api-auth";
import { callOnlyChat, OnlyChatError } from "@/lib/onlychat";

type Creator = { id: string; name: string; platform: "onlyfans" | "telegram" };

const PLATFORMS = ["onlyfans", "telegram"] as const;
type Platform = (typeof PLATFORMS)[number];
const isPlatform = (v: unknown): v is Platform => PLATFORMS.includes(v as Platform);

/**
 * Finds the creators in list_creators' answer, e.g. { creators: { telegram: { data: [...] }, onlyfans: {...} } }.
 * The platform is either a field of each creator or the key the list sits under.
 */
function extractCreators(result: unknown): Creator[] {
  const creators: Creator[] = [];
  const visit = (value: unknown, platform: Platform | null, depth: number) => {
    if (depth > 5 || value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value as Array<Record<string, unknown>>) {
        const id = item?.id ?? item?.creatorId;
        const itemPlatform = isPlatform(item?.platform) ? item.platform : platform;
        if (typeof id === "string" && itemPlatform) {
          creators.push({ id, platform: itemPlatform, name: String(item.name ?? item.displayName ?? item.username ?? id) });
        }
      }
      return;
    }
    for (const [key, v] of Object.entries(value)) visit(v, isPlatform(key) ? key : platform, depth + 1);
  };
  visit(result, null, 0);
  return creators;
}

/** Read-only check: lists the creators and their revenue over the last 7 days. Writes nothing anywhere. */
export async function POST() {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;

  try {
    const creatorsResult = await callOnlyChat("list_creators", { pageSize: 100 });
    const creators = extractCreators(creatorsResult);

    const stats: Record<string, unknown> = {};
    for (const platform of ["onlyfans", "telegram"] as const) {
      const ids = creators.filter((c) => c.platform === platform).map((c) => c.id);
      if (ids.length === 0) continue;
      stats[platform] = await callOnlyChat("get_stats", { platform, creatorIds: ids, timezone: "Indian/Antananarivo" });
    }

    return NextResponse.json({ creators, stats, raw: { creators: creatorsResult } });
  } catch (e) {
    const message = e instanceof OnlyChatError ? e.message : "Erreur inattendue pendant le test.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
