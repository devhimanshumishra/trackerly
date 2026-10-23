import { NextResponse } from "next/server";
import { buildState } from "@/lib/state";

export async function GET() {
  return NextResponse.json(await buildState());
}
