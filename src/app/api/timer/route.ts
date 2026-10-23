import { NextResponse } from "next/server";
import { getDay, settings } from "@/lib/state";
import { dayKey } from "@/lib/day";

export async function POST(req: Request) {
  const { action, note = "" } = await req.json();
  const s = await settings();
  if (action === "start" && !s.running) s.running = { start: new Date() };
  if (action === "stop" && s.running) {
    const start = new Date(s.running.start);
    const day = await getDay(dayKey(start), s.template);
    day.sessions.push({ start, end: new Date(), note });
    await day.save();
    s.running = null;
  }
  s.markModified("running");
  await s.save();
  return NextResponse.json({ ok: true });
}
