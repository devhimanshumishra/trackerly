import { NextResponse } from "next/server";
import { getDay, settings } from "@/lib/state";
import { dayKey } from "@/lib/day";

export async function POST(req: Request) {
  const b = await req.json();
  const s = await settings();
  const day = await getDay(dayKey(), s.template);
  if (typeof b.toggle === "number" && day.checklist[b.toggle]) {
    day.checklist[b.toggle].done = !day.checklist[b.toggle].done;
    await day.save();
  }
  if (Array.isArray(b.template)) {
    const t = b.template.map((x: string) => x.trim()).filter(Boolean);
    s.template = t;
    await s.save();
    const done = new Set(day.checklist.filter((c: any) => c.done).map((c: any) => c.title));
    day.checklist = t.map((title: string) => ({ title, done: done.has(title) }));
    await day.save();
  }
  return NextResponse.json({ ok: true });
}
