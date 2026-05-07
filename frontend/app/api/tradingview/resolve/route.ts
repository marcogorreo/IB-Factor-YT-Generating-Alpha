import { NextResponse } from "next/server";

import { resolveTradingViewSymbolLoose } from "@/app/lib/openfigi-tradingview-resolve";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const result = await resolveTradingViewSymbolLoose(q);
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "private, max-age=86400",
    },
  });
}
