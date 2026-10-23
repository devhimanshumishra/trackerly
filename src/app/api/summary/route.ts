import { NextResponse } from "next/server";
import { getDay, settings, secs } from "@/lib/state";
import { dayKey } from "@/lib/day";

// Groq free tier: sirf button dabane pe 1 call
export async function POST() {
  const s = await settings();
  const day = await getDay(dayKey(), s.template);
  if (!day.sessions.length) return NextResponse.json({ error: "Pehle kuch code kar le" }, { status: 400 });

  const log = day.sessions
    .map((x: any) => `- ${Math.round((+new Date(x.end) - +new Date(x.start)) / 60000)} min: ${x.note || "(no note)"}`)
    .join("\n");
  const list = day.checklist.map((c: any) => `${c.done ? "[x]" : "[ ]"} ${c.title}`).join("\n");

  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.4,
      max_tokens: 250,
      messages: [
        { role: "system", content: "You write a short Hinglish end-of-day summary for a developer's coding log. Max 4 lines: what got done, then one honest line on what to do tomorrow. No fluff, no emojis." },
        { role: "user", content: `Goal ${s.goalHours}h, done ${(secs(day) / 3600).toFixed(1)}h.\nSessions:\n${log}\nChecklist:\n${list}` },
      ],
    }),
  });
  const j: any = await r.json();
  const text = j.choices?.[0]?.message?.content;
  if (!text) return NextResponse.json({ error: j.error?.message || "AI failed" }, { status: 502 });
  day.ai = text;
  await day.save();
  return NextResponse.json({ ai: text });
}
