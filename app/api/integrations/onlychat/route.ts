import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAssocie } from "@/lib/api-auth";
import { saveOnlyChatConfig } from "@/lib/onlychat";

const schema = z.object({
  url: z.url({ protocol: /^https$/, message: "Adresse invalide (elle doit commencer par https://)." }),
  // Empty = keep the key already saved.
  apiKey: z.string().trim().max(500).optional(),
});

/** Saves the OnlyChat connection. The API key is write-only: it is never sent back to the browser. */
export async function PUT(request: Request) {
  const auth = await requireApiAssocie();
  if (auth instanceof NextResponse) return auth;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Données invalides." }, { status: 400 });
  }
  await saveOnlyChatConfig(parsed.data.url, parsed.data.apiKey || undefined);
  return NextResponse.json({ ok: true });
}
