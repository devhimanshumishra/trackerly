"use client";
import useSWR from "swr";
import { useEffect, useState } from "react";
import { ActivityCalendar } from "react-activity-calendar";

const get = (u: string) => fetch(u).then((r) => r.json());
const post = (u: string, b: any) =>
  fetch(u, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(b),
  }).then((r) => r.json());
const pad = (n: number) => String(n).padStart(2, "0");
const hms = (s: number) =>
  `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(Math.floor(s % 60))}`;
const hm = (s: number) => {
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
};
const wd = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });

const card = "rounded-3xl border border-neutral-800 bg-neutral-900/60 p-5";
const R = 88;
const C = 2 * Math.PI * R;

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className={card}>
      <div className="text-xs uppercase tracking-wide text-neutral-400">
        {label}
      </div>
      <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}

function CheckRow({
  title,
  done,
  onClick,
}: {
  title: string;
  done: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={done}
      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
        done
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-neutral-800 bg-neutral-900 hover:border-neutral-600"
      }`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${
          done ? "border-emerald-500 bg-emerald-500" : "border-neutral-600"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-4 w-4 stroke-neutral-950 transition-opacity ${done ? "opacity-100" : "opacity-0"}`}
        >
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      </span>
      <span className={`flex-1 ${done ? "text-neutral-500 line-through" : ""}`}>
        {title}
      </span>
    </button>
  );
}

export default function Page() {
  const { data, mutate } = useSWR("/api/state", get, {
    refreshInterval: 15000,
  }); // phone/laptop sync
  const [now, setNow] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [tpl, setTpl] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    // Read the current time only on the client to avoid prerender-time values.
    setNow(Date.now());

    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!data) return <p className="p-6 text-neutral-400">Loading…</p>;

  const act = async (url: string, body: any) => {
    setBusy(true);
    setErr("");
    const r = await post(url, body);
    if (r.error) setErr(r.error);
    await mutate();
    setBusy(false);
    return r;
  };

  const run = data.running;
  const live =
    run && now !== null
      ? Math.max(0, Math.floor((now - new Date(run.start).getTime()) / 1000))
      : 0;
  const total = data.todaySecs + live;
  const goal = data.goalHours * 3600;
  const pct = Math.min(100, (total / goal) * 100);
  const doneCount = data.checklist.filter((c: any) => c.done).length;

  // last 7 din (aaj ke bar mein chalta session bhi jud jata hai)
  const week = data.heat.slice(-7).map((h: any, i: number, a: any[]) => ({
    ...h,
    min: h.count + (i === a.length - 1 ? live / 60 : 0),
  }));
  const weekSecs = week.reduce((s: number, d: any) => s + d.min * 60, 0);
  const maxMin = Math.max(data.goalHours * 60, ...week.map((d: any) => d.min));
  const goalLine = ((data.goalHours * 60) / maxMin) * 100;

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4 pb-16">
      <header className="flex items-end justify-between px-1 pt-2">
        <h1 className="text-xl font-bold">Code Tracker</h1>
        <span className="text-sm text-neutral-500">{data.date}</span>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Current streak"
          value={`${data.streak.current} din`}
          sub="5h + checklist"
        />
        <Stat label="Best streak" value={`${data.streak.longest} din`} />
        <Stat label="Aaj" value={hm(total)} sub={`goal ${data.goalHours}h`} />
        <Stat
          label="Last 7 din"
          value={hm(weekSecs)}
          sub={`roz avg ${hm(weekSecs / 7)}`}
        />
      </div>

      {/* Last 7 days chart */}
      <section className={card}>
        <h2 className="mb-4 font-semibold">Last 7 din</h2>
        <div className="relative h-36">
          <div
            className="absolute inset-x-0 border-t border-dashed border-neutral-600"
            style={{ bottom: `${goalLine}%` }}
          >
            <span className="absolute -top-4 right-0 text-[10px] text-neutral-500">
              {data.goalHours}h
            </span>
          </div>
          <div className="relative flex h-full items-end gap-2 sm:gap-4">
            {week.map((d: any) => (
              <div
                key={d.date}
                className="flex h-full flex-1 flex-col justify-end"
              >
                <div
                  className={`w-full rounded-t-lg transition-all ${d.min >= data.goalHours * 60 ? "bg-emerald-500" : "bg-blue-500"}`}
                  style={{
                    height: `${d.min > 0 ? Math.max(2, (d.min / maxMin) * 100) : 0}%`,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex gap-2 sm:gap-4">
          {week.map((d: any) => (
            <div
              key={d.date}
              className="flex-1 text-center text-xs text-neutral-400"
            >
              {wd(d.date)}
              <div className="text-[10px] text-neutral-600">
                {hm(d.min * 60)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Timer */}
        <section className={card}>
          <h2 className="mb-3 text-center font-semibold">Aaj ka focus</h2>
          <div className="relative mx-auto h-56 w-56">
            <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
              <circle
                cx="100"
                cy="100"
                r={R}
                fill="none"
                stroke="#262626"
                strokeWidth="12"
              />
              <circle
                cx="100"
                cy="100"
                r={R}
                fill="none"
                stroke={pct >= 100 ? "#22c55e" : "#3b82f6"}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - pct / 100)}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-mono text-4xl font-bold tabular-nums">
                {hms(total)}
              </div>
              <div className="mt-1 text-xs text-neutral-400">
                {Math.round(pct)}% of {data.goalHours}h
              </div>
              {run && (
                <div className="mt-2 font-mono text-xs text-emerald-400">
                  session {hms(live)}
                </div>
              )}
            </div>
          </div>

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="kya kiya? (stop karte time save hoga)"
            className="mt-4 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm outline-none focus:border-neutral-600"
          />
          <button
            disabled={busy}
            onClick={async () => {
              await act("/api/timer", { action: run ? "stop" : "start", note });
              if (run) setNote("");
            }}
            className={`mt-3 w-full rounded-xl py-3.5 font-semibold transition disabled:opacity-60 ${
              run
                ? "bg-red-600 hover:bg-red-500"
                : "bg-emerald-600 hover:bg-emerald-500"
            }`}
          >
            {run ? "Stop" : "Start"}
          </button>

          {data.sessions.length > 0 && (
            <div className="mt-4">
              {data.sessions.map((s: any, i: number) => (
                <div
                  key={i}
                  className="flex justify-between border-t border-neutral-800 py-2 text-sm"
                >
                  <span className="text-neutral-300">{s.note || "—"}</span>
                  <span className="font-mono text-neutral-500">
                    {hm((+new Date(s.end) - +new Date(s.start)) / 1000)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Checklist + AI */}
        <div className="space-y-4">
          <section className={card}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">
                Checklist{" "}
                <span className="ml-1 text-sm font-normal text-neutral-500">
                  {doneCount}/{data.checklist.length}
                </span>
              </h2>
              <button
                className="text-xs text-neutral-400 hover:text-neutral-200"
                onClick={() => {
                  setTpl(data.template.join("\n"));
                  setEditing(!editing);
                }}
              >
                {editing ? "cancel" : "edit"}
              </button>
            </div>

            {editing ? (
              <>
                <textarea
                  value={tpl}
                  onChange={(e) => setTpl(e.target.value)}
                  rows={6}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm outline-none"
                />
                <button
                  className="mt-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium"
                  onClick={async () => {
                    await act("/api/checklist", { template: tpl.split("\n") });
                    setEditing(false);
                  }}
                >
                  Save (har item nayi line mein)
                </button>
              </>
            ) : (
              <div className="space-y-2">
                {data.checklist.map((c: any, i: number) => (
                  <CheckRow
                    key={i}
                    title={c.title}
                    done={c.done}
                    onClick={() => act("/api/checklist", { toggle: i })}
                  />
                ))}
              </div>
            )}
          </section>

          <section className={card}>
            <button
              disabled={busy}
              onClick={() => act("/api/summary", {})}
              className="w-full rounded-xl border border-neutral-700 py-2.5 text-sm hover:bg-neutral-800 disabled:opacity-60"
            >
              ✨ AI day summary
            </button>
            {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
            {data.ai && (
              <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-300">
                {data.ai}
              </p>
            )}
          </section>
        </div>
      </div>

      {/* Heatmap */}
      <section className={`${card} overflow-x-auto`}>
        <h2 className="mb-3 font-semibold">Consistency</h2>
        <ActivityCalendar
          data={data.heat}
          colorScheme="dark"
          blockSize={12}
          showWeekdayLabels={false}
          theme={{
            dark: ["#1f2937", "#1e3a8a", "#2563eb", "#16a34a", "#22c55e"],
          }}
        />
        <p className="mt-2 text-xs text-neutral-500">
          dark green = 5h + checklist done
        </p>
      </section>
    </main>
  );
}
