"use client";
import useSWR from "swr";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityCalendar } from "react-activity-calendar";

type View = "dashboard" | "focus" | "checklist" | "consistency";

const get = (u: string) => fetch(u).then((r) => r.json());
const post = (u: string, b: any) =>
  fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());
const pad = (n: number) => String(n).padStart(2, "0");
const hms = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(Math.floor(s % 60))}`;
const hm = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};
const wd = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
const longDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

// subjects <-> editable text ("Project 2h", "C++ 90m", "Reading" = no target)
const fmtTarget = (m: number) => (m % 60 === 0 ? `${m / 60}h` : `${m}m`);
const subjectsToText = (list: any[]) =>
  list.map((s) => (s.targetMin ? `${s.name} ${fmtTarget(s.targetMin)}` : s.name)).join("\n");
const textToSubjects = (t: string) =>
  t.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^(.*?)\s+(\d+(?:\.\d+)?)\s*(h|m)$/i);
    if (!m) return { name: l, targetMin: 0 };
    const n = parseFloat(m[2]);
    return { name: m[1].trim(), targetMin: Math.round(m[3].toLowerCase() === "h" ? n * 60 : n) };
  });

function beep(ctx: AudioContext | null) {
  if (!ctx) return;
  try {
    ctx.resume();
    [0, 0.4, 0.8].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    });
  } catch {}
}

function notify(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const n = new Notification(title, { body, requireInteraction: true } as any);
  n.onclick = () => {
    window.focus();
    n.close();
  };
}

const R = 88;
const C = 2 * Math.PI * R;
const card = "rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur";

const Svg = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
    {children}
  </svg>
);

const NAV: { id: View; label: string; icon: ReactNode }[] = [
  {
    id: "dashboard", label: "Dashboard",
    icon: (<Svg><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></Svg>),
  },
  {
    id: "focus", label: "Focus",
    icon: (<Svg><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></Svg>),
  },
  {
    id: "checklist", label: "Checklist",
    icon: (<Svg><path d="M9 6h11M9 12h11M9 18h11" /><path d="M3.5 6l1.5 1.5L7 5M3.5 12l1.5 1.5L7 11M3.5 18l1.5 1.5L7 17" /></Svg>),
  },
  {
    id: "consistency", label: "Consistency",
    icon: (<Svg><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M3 9h18M8 2v4M16 2v4" /></Svg>),
  },
];

const TITLES: Record<View, string> = {
  dashboard: "Dashboard",
  focus: "Focus",
  checklist: "Daily Checklist",
  consistency: "Consistency",
};

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={card}>
      <div className="text-[11px] font-medium uppercase tracking-widest text-neutral-500">{label}</div>
      <div
        className={`mt-2 text-3xl font-semibold tabular-nums ${
          accent ? "bg-gradient-to-r from-amber-200 to-orange-400 bg-clip-text text-transparent" : ""
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}

function CheckRow({ title, done, onClick }: { title: string; done: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={done}
      className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition ${
        done ? "border-emerald-500/30 bg-emerald-500/10" : "border-white/10 bg-white/[0.02] hover:border-white/25"
      }`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
          done ? "border-emerald-400 bg-emerald-400" : "border-neutral-600"
        }`}
      >
        <svg
          viewBox="0 0 24 24" fill="none" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"
          className={`h-3.5 w-3.5 stroke-neutral-950 transition-opacity ${done ? "opacity-100" : "opacity-0"}`}
        >
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      </span>
      <span className={`flex-1 ${done ? "text-neutral-500 line-through" : "text-neutral-100"}`}>{title}</span>
    </button>
  );
}

export default function Page() {
  const { data, mutate } = useSWR("/api/state", get, { refreshInterval: 15000 }); // keeps devices in sync
  const [view, setView] = useState<View>("dashboard");
  const [now, setNow] = useState(0); // 0 at prerender; real time is set in the browser only
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tpl, setTpl] = useState("");
  const [subject, setSubject] = useState("");
  const [editingSub, setEditingSub] = useState(false);
  const [subText, setSubText] = useState("");
  const [perm, setPerm] = useState("granted");
  const [done, setDone] = useState<{ subject: string; next: string | null } | null>(null);
  const [err, setErr] = useState("");
  const audio = useRef<AudioContext | null>(null);
  const fired = useRef("");

  const act = async (url: string, body: any) => {
    setBusy(true);
    setErr("");
    const r = await post(url, body);
    if (r.error) setErr(r.error);
    await mutate();
    setBusy(false);
    return r;
  };

  const unlockAudio = () => {
    try {
      audio.current ??= new (window.AudioContext || (window as any).webkitAudioContext)();
      audio.current.resume();
    } catch {}
  };

  const askPerm = async () => {
    unlockAudio();
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === "granted") notify("Reminders are on", "You'll be notified when a subject target is reached.");
  };

  const startSession = (name: string) => {
    unlockAudio();
    setSubject(name);
    setDone(null);
    act("/api/timer", { action: "start", subject: name });
  };

  // 1-second tick from a Web Worker: not throttled when the window is in the background
  useEffect(() => {
    setNow(Date.now());
    const w = new Worker(URL.createObjectURL(new Blob(["setInterval(()=>postMessage(0),1000)"], { type: "text/javascript" })));
    w.onmessage = () => setNow(Date.now());
    return () => w.terminate();
  }, []);

  useEffect(() => {
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
  }, []);

  // elapsed session time in the tab title
  useEffect(() => {
    if (!data) return;
    const r = data.running;
    document.title = r
      ? `${hms(Math.max(0, (now - new Date(r.start).getTime()) / 1000))} · ${r.subject || "Focus"}`
      : "Code Tracker";
  }, [data, now]);

  // subject target reached -> sound + notification + auto-stop
  useEffect(() => {
    if (!data?.running || !now) return;
    const r = data.running;
    const sub = data.subjects.find((x: any) => x.name === r.subject);
    if (!sub || !sub.targetMin) return;
    const left = sub.targetMin * 60 - sub.secs;
    if (left <= 0) return;
    if ((now - new Date(r.start).getTime()) / 1000 < left) return;
    const key = String(r.start);
    if (fired.current === key) return;
    fired.current = key;
    const next =
      data.subjects.find((x: any) => x.name !== sub.name && x.targetMin && x.secs < x.targetMin * 60)?.name ?? null;
    notify(
      `${sub.name} target reached (${fmtTarget(sub.targetMin)})`,
      next ? `Time to switch to ${next}.` : "All subject targets are done for today."
    );
    beep(audio.current);
    (async () => {
      await act("/api/timer", { action: "stop", note });
      setNote("");
      setDone({ subject: sub.name, next });
    })();
  }, [now, data]);

  if (!data)
    return <div className="flex min-h-screen items-center justify-center bg-[#07070a] text-neutral-500">Loading…</div>;

  const run = data.running;
  const live = run ? Math.max(0, Math.floor((now - new Date(run.start).getTime()) / 1000)) : 0;
  const total = data.todaySecs + live;
  const goal = data.goalHours * 3600;
  const pct = Math.min(100, (total / goal) * 100);
  const doneCount = data.checklist.filter((c: any) => c.done).length;
  const sel = subject && data.subjects.some((x: any) => x.name === subject) ? subject : data.subjects[0]?.name;
  const rs = run ? data.subjects.find((x: any) => x.name === run.subject) : null;
  const leftSecs = rs && rs.targetMin && rs.secs < rs.targetMin * 60 ? rs.targetMin * 60 - rs.secs - live : null;

  // last 7 days (today's bar includes the running session)
  const week = data.heat.slice(-7).map((h: any, i: number, a: any[]) => ({
    ...h,
    min: h.count + (i === a.length - 1 ? live / 60 : 0),
  }));
  const weekSecs = week.reduce((s: number, d: any) => s + d.min * 60, 0);
  const maxMin = Math.max(data.goalHours * 60, ...week.map((d: any) => d.min));
  const goalLine = ((data.goalHours * 60) / maxMin) * 100;
  const goalDays = data.heat.filter((h: any) => h.level === 4).length;
  const activeDays = data.heat.filter((h: any) => h.level > 0).length;

  const ring = (big: boolean) => (
    <div className={`relative mx-auto ${big ? "h-72 w-72" : "h-48 w-48"}`}>
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="ringg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <circle
          cx="100" cy="100" r={R} fill="none"
          stroke={pct >= 100 ? "#10b981" : "url(#ringg)"}
          strokeWidth="10" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className={`font-mono font-semibold tabular-nums ${big ? "text-5xl" : "text-3xl"}`}>{hms(total)}</div>
        <div className="mt-1 text-xs text-neutral-400">{Math.round(pct)}% of {data.goalHours}h goal</div>
        {run && (
          <div className="mt-2 flex items-center gap-1.5 font-mono text-xs text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            {run.subject || "Focus"} · {hms(live)}
          </div>
        )}
        {leftSecs !== null && leftSecs > 0 && (
          <div className="mt-1 text-[11px] text-neutral-500">{hm(leftSecs)} until reminder</div>
        )}
      </div>
    </div>
  );

  const controls = () => (
    <>
      <div className="mt-5 flex flex-wrap gap-2">
        {data.subjects.map((s: any) => {
          const active = (run ? run.subject : sel) === s.name;
          const t = s.targetMin * 60;
          return (
            <button
              key={s.name}
              disabled={!!run}
              onClick={() => setSubject(s.name)}
              className={`rounded-xl border px-3 py-2 text-sm transition disabled:cursor-default ${
                active
                  ? "border-indigo-400/60 bg-indigo-500/15 text-white"
                  : "border-white/10 text-neutral-400 hover:border-white/25 disabled:opacity-40 disabled:hover:border-white/10"
              }`}
            >
              {s.name}
              <span className="ml-2 font-mono text-xs opacity-70">
                {hm(s.secs)}
                {t ? ` / ${hm(t)}` : ""}
                {t && s.secs >= t ? " ✓" : ""}
              </span>
            </button>
          );
        })}
      </div>
      {!run && (
        <button
          className="mt-2 text-xs text-neutral-500 hover:text-neutral-300"
          onClick={() => {
            setSubText(subjectsToText(data.subjects));
            setEditingSub(!editingSub);
          }}
        >
          {editingSub ? "Cancel" : "Edit subjects"}
        </button>
      )}
      {editingSub && !run && (
        <div className="mt-2">
          <textarea
            value={subText}
            onChange={(e) => setSubText(e.target.value)}
            rows={5}
            className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm outline-none focus:border-indigo-400/60"
          />
          <p className="mt-1 text-xs text-neutral-500">One per line: "Project 2h" or "C++ 90m". No time means no target.</p>
          <button
            className="mt-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium hover:bg-indigo-400"
            onClick={async () => {
              const r = await act("/api/subjects", { subjects: textToSubjects(subText) });
              if (!r.error) setEditingSub(false);
            }}
          >
            Save subjects
          </button>
        </div>
      )}
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What did you work on? (saved when the session stops)"
        className="mt-4 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none transition focus:border-indigo-400/60"
      />
      <button
        disabled={busy}
        onClick={async () => {
          if (run) {
            await act("/api/timer", { action: "stop", note });
            setNote("");
          } else if (sel) {
            startSession(sel);
          }
        }}
        className={`mt-3 w-full rounded-xl py-3.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60 ${
          run
            ? "bg-gradient-to-r from-rose-500 to-red-600 shadow-red-900/30"
            : "bg-gradient-to-r from-indigo-500 to-emerald-500 shadow-indigo-900/30"
        }`}
      >
        {run ? "Stop session" : `Start ${sel || "session"}`}
      </button>
    </>
  );

  const sessionsList = () =>
    data.sessions.length === 0 ? (
      <p className="text-sm text-neutral-500">No sessions yet today.</p>
    ) : (
      <div>
        {data.sessions.map((s: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-3 border-t border-white/5 py-2.5 text-sm first:border-0">
            <span className="text-neutral-300">
              <span className="text-neutral-500">{s.subject || "General"}</span> · {s.note || "Untitled session"}
            </span>
            <span className="font-mono text-neutral-500">{hm((+new Date(s.end) - +new Date(s.start)) / 1000)}</span>
          </div>
        ))}
      </div>
    );

  const checklistCard = () => (
    <section className={card}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">
          Today's checklist{" "}
          <span className="ml-1 text-sm font-normal text-neutral-500">
            {doneCount}/{data.checklist.length}
          </span>
        </h2>
        <button
          className="rounded-lg px-2 py-1 text-xs text-neutral-400 hover:bg-white/5 hover:text-neutral-100"
          onClick={() => {
            setTpl(data.template.join("\n"));
            setEditing(!editing);
          }}
        >
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>
      {editing ? (
        <>
          <textarea
            value={tpl}
            onChange={(e) => setTpl(e.target.value)}
            rows={6}
            className="w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm outline-none focus:border-indigo-400/60"
          />
          <button
            className="mt-3 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium hover:bg-indigo-400"
            onClick={async () => {
              await act("/api/checklist", { template: tpl.split("\n") });
              setEditing(false);
            }}
          >
            Save (one item per line)
          </button>
        </>
      ) : data.checklist.length === 0 ? (
        <p className="text-sm text-neutral-500">No items yet. Click Edit to add your daily checklist.</p>
      ) : (
        <div className="space-y-2">
          {data.checklist.map((c: any, i: number) => (
            <CheckRow key={i} title={c.title} done={c.done} onClick={() => act("/api/checklist", { toggle: i })} />
          ))}
        </div>
      )}
    </section>
  );

  const chart = () => (
    <>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-semibold">Last 7 days</h2>
        <span className="text-xs text-neutral-500">Dashed line = {data.goalHours}h goal</span>
      </div>
      <div className="relative h-44">
        <div className="absolute inset-x-0 border-t border-dashed border-white/20" style={{ bottom: `${goalLine}%` }} />
        <div className="relative flex h-full items-end gap-3 sm:gap-5">
          {week.map((d: any) => (
            <div key={d.date} className="flex h-full flex-1 flex-col justify-end">
              <div
                className={`w-full rounded-t-lg bg-gradient-to-t transition-all duration-500 ${
                  d.min >= data.goalHours * 60 ? "from-emerald-600 to-emerald-300" : "from-indigo-600 to-indigo-300"
                }`}
                style={{ height: `${d.min > 0 ? Math.max(2, (d.min / maxMin) * 100) : 0}%` }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex gap-3 sm:gap-5">
        {week.map((d: any) => (
          <div key={d.date} className="flex-1 text-center text-xs text-neutral-400">
            {wd(d.date)}
            <div className="text-[10px] text-neutral-600">{hm(d.min * 60)}</div>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="relative min-h-screen bg-[#07070a] text-neutral-100 lg:pl-64">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 75% -10%, rgba(99,102,241,0.18), transparent), radial-gradient(40% 30% at 0% 100%, rgba(16,185,129,0.10), transparent)",
        }}
      />

      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-white/10 bg-black/40 p-5 backdrop-blur-xl lg:flex">
        <div className="mb-8 flex items-center gap-3 px-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 text-sm font-bold">
            {"</>"}
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">Code Tracker</div>
            <div className="text-[11px] text-neutral-500">Daily focus & streaks</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setView(n.id)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                view === n.id ? "bg-white/10 text-white" : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
              }`}
            >
              {n.icon}
              {n.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span className={`h-2 w-2 rounded-full ${run ? "animate-pulse bg-emerald-400" : "bg-neutral-600"}`} />
            {run ? `${run.subject || "Session"} running` : "Idle"}
          </div>
          <div className="mt-1 font-mono text-lg">{run ? hms(live) : hm(total)}</div>
          <div className="text-xs text-neutral-500">{data.streak.current} day streak</div>
        </div>
      </aside>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-white/10 bg-[#0b0b10]/95 backdrop-blur lg:hidden">
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => setView(n.id)}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] ${
              view === n.id ? "text-white" : "text-neutral-500"
            }`}
          >
            {n.icon}
            {n.label}
          </button>
        ))}
      </nav>

      <main className="relative z-10 mx-auto max-w-5xl space-y-5 p-5 pb-28 lg:p-10">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">{TITLES[view]}</h1>
          <p className="mt-1 text-sm text-neutral-500">{longDate(data.date)}</p>
        </header>

        {err && <p className="text-sm text-red-400">{err}</p>}

        {perm === "default" && (
          <div className={`${card} flex items-center justify-between gap-4`}>
            <p className="text-sm text-neutral-300">Turn on notifications to get a reminder when a subject target is reached.</p>
            <button onClick={askPerm} className="shrink-0 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium hover:bg-indigo-400">
              Enable
            </button>
          </div>
        )}
        {perm === "denied" && (
          <p className="text-xs text-neutral-500">
            Notifications are blocked. Allow them for this site in the browser settings and in macOS System Settings → Notifications.
          </p>
        )}

        {done && (
          <div className={`${card} border-emerald-500/30 bg-emerald-500/10`}>
            <div className="font-semibold">{done.subject} target reached</div>
            <p className="mt-1 text-sm text-neutral-300">
              Session saved. {done.next ? `Up next: ${done.next}.` : "All subject targets are done for today."}
            </p>
            <div className="mt-3 flex gap-2">
              {done.next && (
                <button
                  onClick={() => startSession(done.next!)}
                  className="rounded-lg bg-gradient-to-r from-indigo-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-white"
                >
                  Start {done.next}
                </button>
              )}
              <button onClick={() => setDone(null)} className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/5">
                Dismiss
              </button>
            </div>
          </div>
        )}

        {view === "dashboard" && (
          <>
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              <Stat label="Current streak" value={`${data.streak.current} days`} sub="Goal + checklist" accent />
              <Stat label="Best streak" value={`${data.streak.longest} days`} />
              <Stat label="Today" value={hm(total)} sub={`Goal ${data.goalHours}h`} />
              <Stat label="Last 7 days" value={hm(weekSecs)} sub={`Avg ${hm(weekSecs / 7)} / day`} />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <section className={`${card} lg:col-span-2`}>{chart()}</section>
              <section className={card}>
                <h2 className="mb-4 text-center font-semibold">Today's focus</h2>
                {ring(false)}
                {controls()}
              </section>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {checklistCard()}
              <section className={card}>
                <h2 className="mb-3 font-semibold">Today's sessions</h2>
                {sessionsList()}
              </section>
            </div>
          </>
        )}

        {view === "focus" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className={card}>
              <h2 className="mb-5 text-center font-semibold">Today's focus</h2>
              {ring(true)}
              {controls()}
            </section>
            <div className="space-y-4">
              <section className={card}>
                <h2 className="mb-3 font-semibold">Today's sessions</h2>
                {sessionsList()}
              </section>
              <section className={card}>
                <h2 className="mb-3 font-semibold">AI day summary</h2>
                <button
                  disabled={busy}
                  onClick={() => act("/api/summary", {})}
                  className="w-full rounded-xl border border-white/15 py-2.5 text-sm hover:bg-white/5 disabled:opacity-60"
                >
                  Generate summary
                </button>
                {data.ai && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-neutral-300">{data.ai}</p>}
              </section>
            </div>
          </div>
        )}

        {view === "checklist" && (
          <>
            <section className={card}>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-neutral-400">Progress</span>
                <span className="font-mono">{doneCount} of {data.checklist.length} done</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500"
                  style={{ width: `${data.checklist.length ? (doneCount / data.checklist.length) * 100 : 0}%` }}
                />
              </div>
            </section>
            {checklistCard()}
          </>
        )}

        {view === "consistency" && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Stat label="Current streak" value={`${data.streak.current} days`} accent />
              <Stat label="Best streak" value={`${data.streak.longest} days`} />
              <Stat label="Goal days (6 mo)" value={String(goalDays)} sub={`${activeDays} active days`} />
            </div>
            <section className={`${card} overflow-x-auto`}>
              <h2 className="mb-4 font-semibold">Last 6 months</h2>
              <ActivityCalendar
                data={data.heat}
                colorScheme="dark"
                blockSize={13}
                showWeekdayLabels={false}
                theme={{ dark: ["#1a1a22", "#312e81", "#4f46e5", "#059669", "#34d399"] }}
              />
              <p className="mt-3 text-xs text-neutral-500">Brightest green = goal hit and checklist completed.</p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
