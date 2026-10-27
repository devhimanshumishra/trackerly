import { db } from "./db";
import { DayM, SettingsM, DEFAULT_SUBJECTS } from "./models";
import { addDays, dayKey } from "./day";

export async function settings() {
  await db();
  const s = (await SettingsM.findOneAndUpdate(
    { key: "main" }, { $setOnInsert: { key: "main" } }, { upsert: true, new: true }
  )) as any;
  if (!s.subjects || s.subjects.length === 0) {
    s.subjects = DEFAULT_SUBJECTS;
    await s.save();
  }
  return s;
}

export async function getDay(date: string, tpl: string[]) {
  await db();
  return (await DayM.findOneAndUpdate(
    { date },
    { $setOnInsert: { date, sessions: [], checklist: tpl.map((title) => ({ title, done: false })) } },
    { upsert: true, new: true }
  )) as any;
}

export const secs = (d: any) =>
  d.sessions.reduce((a: number, s: any) => a + (+new Date(s.end) - +new Date(s.start)) / 1000, 0);

export async function buildState() {
  const s = await settings();
  const today = dayKey();
  const day = await getDay(today, s.template);
  const all = (await DayM.find().sort({ date: 1 }).lean()) as any[];
  const by = new Map(all.map((d) => [d.date, d]));
  const goal = s.goalHours * 3600;
  const ok = (d: any) => !!d && secs(d) >= goal && d.checklist.every((c: any) => c.done);

  // current streak (if today isn't complete yet, count from yesterday)
  let k = today;
  if (!ok(by.get(k))) k = addDays(k, -1);
  let current = 0;
  while (ok(by.get(k))) { current++; k = addDays(k, -1); }

  let longest = 0, run = 0, prev = "";
  for (const d of all) {
    if (!ok(d)) continue;
    run = prev && addDays(prev, 1) === d.date ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d.date;
  }

  const heat = [];
  for (let i = 182; i >= 0; i--) {
    const date = addDays(today, -i);
    const d = by.get(date);
    const sc = d ? secs(d) : 0;
    const r = sc / goal;
    heat.push({ date, count: Math.round(sc / 60), level: sc === 0 ? 0 : r < 0.5 ? 1 : r < 1 ? 2 : ok(d) ? 4 : 3 });
  }

  // today's finished time per subject
  const bySub = new Map<string, number>();
  for (const x of day.sessions) {
    const key = x.subject || "General";
    bySub.set(key, (bySub.get(key) || 0) + (+new Date(x.end) - +new Date(x.start)) / 1000);
  }
  const subjects = s.subjects.map((x: any) => ({
    name: x.name, targetMin: x.targetMin || 0, secs: bySub.get(x.name) || 0,
  }));

  return {
    date: today, goalHours: s.goalHours, running: s.running, todaySecs: secs(day),
    sessions: day.sessions, checklist: day.checklist, template: s.template, ai: day.ai,
    subjects, streak: { current, longest }, heat,
  };
}
