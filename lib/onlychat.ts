import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/secret";

const URL_KEY = "onlychat.url";
const API_KEY_KEY = "onlychat.apiKey";

export async function getOnlyChatConfig(): Promise<{ url: string | null; apiKey: string | null }> {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: [URL_KEY, API_KEY_KEY] } } });
  const url = rows.find((r) => r.key === URL_KEY)?.value ?? null;
  const stored = rows.find((r) => r.key === API_KEY_KEY)?.value;
  return { url, apiKey: stored ? decryptSecret(stored) : null };
}

/** The API key is only replaced when a new one is given, so the form never has to show it back. */
export async function saveOnlyChatConfig(url: string, apiKey?: string) {
  await prisma.$transaction([
    prisma.appSetting.upsert({ where: { key: URL_KEY }, update: { value: url }, create: { key: URL_KEY, value: url } }),
    ...(apiKey
      ? [
          prisma.appSetting.upsert({
            where: { key: API_KEY_KEY },
            update: { value: encryptSecret(apiKey) },
            create: { key: API_KEY_KEY, value: encryptSecret(apiKey) },
          }),
        ]
      : []),
  ]);
}

export class OnlyChatError extends Error {}

type ToolResult = { content?: Array<{ type: string; text?: string }>; structuredContent?: unknown; isError?: boolean };

/**
 * Calls one tool of the OnlyChat MCP server and returns its result, parsed as JSON when it is JSON. The key is sent
 * the two usual ways (Bearer token and X-API-Key header) since the server's expected scheme isn't documented here.
 */
export async function callOnlyChat(tool: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const { url, apiKey } = await getOnlyChatConfig();
  if (!url || !apiKey) throw new OnlyChatError("Renseignez d'abord l'adresse et la clé API OnlyChat.");

  let endpoint: URL;
  try {
    endpoint = new URL(url);
  } catch {
    throw new OnlyChatError("L'adresse OnlyChat n'est pas une URL valide.");
  }

  const transport = new StreamableHTTPClientTransport(endpoint, {
    requestInit: { headers: { Authorization: `Bearer ${apiKey}`, "X-API-Key": apiKey } },
  });
  const client = new Client({ name: "onlybudget", version: "1.0.0" });
  try {
    await client.connect(transport);
    const result = (await client.callTool({ name: tool, arguments: args })) as ToolResult;
    const text = result.content?.find((c) => c.type === "text")?.text ?? "";
    if (result.isError) throw new OnlyChatError(text || `OnlyChat a refusé l'appel ${tool}.`);
    if (result.structuredContent !== undefined) return result.structuredContent;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch (e) {
    if (e instanceof OnlyChatError) throw e;
    const message = e instanceof Error ? e.message : String(e);
    if (/401|403|unauthori[sz]ed|forbidden/i.test(message)) throw new OnlyChatError("OnlyChat refuse la clé API : vérifiez-la.");
    throw new OnlyChatError(`Connexion à OnlyChat impossible : ${message.slice(0, 200)}`);
  } finally {
    await client.close().catch(() => {});
  }
}
