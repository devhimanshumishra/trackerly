import { NextResponse } from "next/server";
import { settings } from "@/lib/state";

export async function POST(req: Request) {
  const { subjects } = await req.json();
  const seen = new Set<string>();
  const clean: { name: string; targetMin: number }[] = [];
  for (const x of Array.isArray(subjects) ? subjects : []) {
    const name = String(x?.name || "").trim().slice(0, 30);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    clean.push({ name, targetMin: Math.max(0, Math.min(1440, Math.round(Number(x?.targetMin) || 0))) });
  }
  if (!clean.length) return NextResponse.json({ error: "Add at least one subject." }, { status: 400 });
  const s = await settings();
  s.subjects = clean.slice(0, 12);
  await s.save();
  return NextResponse.json({ ok: true });
}
