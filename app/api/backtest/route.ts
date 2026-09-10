import { NextResponse } from "next/server";
import { runBacktest } from "@/lib/backtest";
import { BotConfig } from "@/lib/types";

export async function POST(request: Request) {
  const config = await request.json() as BotConfig;
  if (!config?.platform || !config?.strategy || !config?.risk) {
    return NextResponse.json({ error: "Configuração inválida" }, { status: 400 });
  }
  return NextResponse.json(runBacktest(config));
}
