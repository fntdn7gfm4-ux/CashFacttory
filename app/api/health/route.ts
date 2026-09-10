import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ status: "ok", mode: "paper", liveTrading: false, timestamp: new Date().toISOString() });
}
