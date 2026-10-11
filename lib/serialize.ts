import { NextResponse } from "next/server";

/** Recursively converts BigInt values (e.g. Prisma's *Minor fields) to Number so the result is JSON-serializable. */
export function serializeBigInts<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? Number(v) : v)));
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(serializeBigInts(data), init);
}
