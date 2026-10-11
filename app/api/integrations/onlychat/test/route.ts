import { NextResponse } from "next/server";
import { requireApiAssocie } from "@/lib/api-auth";
import { callOnlyChat, OnlyChatError } from "@/lib/onlychat";

type Creator = { id: string; name: string; platform: "onlyfans" | "telegram" };

/** Finds the list of creators in list_creators' answer, whatever it is wrapped in. */
function extractCreators(result: unknown): Creator[] {
  const lists: unknown[] = [];
  const visit = (value: unknown, depth: number) => {
    if (depth > 3 || value === null || typeof value !== "object") return;
    if (Array.isArray(value)) lists.push(value);
    else Object.values(value).forEach((v) => visit(v, depth + 1));
  };
  visit(result, 0);
  const creators: Creator[] = [];
  for (const list of lists as Array<Array<Record<string, unknown>>>) {
    for (const item of list) {
      const id = item?.id ?? item?.creatorId;
      const platform = item?.platform;
      if (typeof id === "string" && (platform === "onlyfans" || platform === "telegram")) {
        creators.push({ id, platform, name: String(item.name ?? item.displayName ?? item.username ?? id) });
      }
    }
  }
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
