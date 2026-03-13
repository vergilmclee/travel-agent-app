"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Place = {
  id: string;
  name: string;
  note: string;
  address: string;
  lat: string;
  lng: string;
};

type BudgetItem = {
  id: string;
  label: string;
  amount: number;
  currency: Currency;
};

type Expense = {
  id: string;
  title: string;
  amount: number;
  paidBy: string;
  participants: string[];
};

type ItineraryItem = {
  id: string;
  day: string;
  time: string;
  activity: string;
  note: string;
};

type Currency = "USD" | "EUR" | "HKD" | "JPY" | "CNY" | "GBP";
type TravelData = {
  places: Place[];
  budgetItems: BudgetItem[];
  members: string[];
  expenses: Expense[];
  itinerary: ItineraryItem[];
  baseCurrency: Currency;
};

const CURRENCIES: Currency[] = ["USD", "EUR", "HKD", "JPY", "CNY", "GBP"];
const TO_USD_RATE: Record<Currency, number> = {
  USD: 1,
  EUR: 1.09,
  HKD: 0.128,
  JPY: 0.0068,
  CNY: 0.139,
  GBP: 1.27,
};

const inputClass =
  "w-full rounded-xl border border-[#cdd7e2] bg-white/80 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#0b5a7d] focus:ring-2 focus:ring-[#8ad6f7]";
const buttonClass =
  "rounded-xl bg-[#0b5a7d] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#084763]";

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function convert(amount: number, from: Currency, to: Currency): number {
  const inUsd = amount * TO_USD_RATE[from];
  return inUsd / TO_USD_RATE[to];
}

function asMoney(value: number, currency: Currency): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "JPY" ? 0 : 2,
  }).format(value);
}

function placeMapLinks(place: Place): { google: string; amap: string } {
  const hasCoords = Boolean(place.lat.trim() && place.lng.trim());
  const q = hasCoords
    ? `${place.lat.trim()},${place.lng.trim()}`
    : place.address.trim() || place.name.trim();

  const google = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

  const amap = hasCoords
    ? `https://uri.amap.com/marker?position=${encodeURIComponent(
        `${place.lng.trim()},${place.lat.trim()}`,
      )}&name=${encodeURIComponent(place.name || "Saved place")}`
    : `https://uri.amap.com/search?keyword=${encodeURIComponent(
        place.address.trim() || place.name.trim(),
      )}`;

  return { google, amap };
}

function defaultData(): TravelData {
  return {
    places: [],
    budgetItems: [],
    members: ["Alex", "Jamie", "Sam"],
    expenses: [],
    itinerary: [],
    baseCurrency: "USD",
  };
}

function loadInitialData(): TravelData {
  if (typeof window === "undefined") return defaultData();

  try {
    const raw = localStorage.getItem("travel_agent_data_v1");
    if (!raw) return defaultData();

    const parsed = JSON.parse(raw) as Partial<TravelData>;
    return {
      places: parsed.places ?? [],
      budgetItems: parsed.budgetItems ?? [],
      members: parsed.members?.length ? parsed.members : ["Alex", "Jamie", "Sam"],
      expenses: parsed.expenses ?? [],
      itinerary: parsed.itinerary ?? [],
      baseCurrency: parsed.baseCurrency ?? "USD",
    };
  } catch {
    return defaultData();
  }
}

function cardClass(accent: string): string {
  return `rounded-2xl border border-white/60 bg-white/75 p-5 shadow-[0_16px_40px_rgba(10,45,72,0.12)] backdrop-blur-sm ${accent}`;
}

export default function Home() {
  const [initialData] = useState<TravelData>(() => loadInitialData());
  const [places, setPlaces] = useState<Place[]>(initialData.places);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(initialData.budgetItems);
  const [members, setMembers] = useState<string[]>(initialData.members);
  const [expenses, setExpenses] = useState<Expense[]>(initialData.expenses);
  const [itinerary, setItinerary] = useState<ItineraryItem[]>(initialData.itinerary);
  const [baseCurrency, setBaseCurrency] = useState<Currency>(initialData.baseCurrency);
  const [newMember, setNewMember] = useState("");

  useEffect(() => {
    localStorage.setItem(
      "travel_agent_data_v1",
      JSON.stringify({ places, budgetItems, members, expenses, itinerary, baseCurrency }),
    );
  }, [places, budgetItems, members, expenses, itinerary, baseCurrency]);

  const totalBudgetBase = useMemo(
    () => budgetItems.reduce((sum, item) => sum + convert(item.amount, item.currency, baseCurrency), 0),
    [budgetItems, baseCurrency],
  );

  const balances = useMemo(() => {
    const ledger = Object.fromEntries(members.map((m) => [m, 0])) as Record<string, number>;

    for (const ex of expenses) {
      if (ledger[ex.paidBy] === undefined || ex.participants.length === 0) continue;
      const share = ex.amount / ex.participants.length;
      ledger[ex.paidBy] += ex.amount;
      for (const p of ex.participants) {
        if (ledger[p] === undefined) continue;
        ledger[p] -= share;
      }
    }

    return ledger;
  }, [expenses, members]);

  const settlements = useMemo(() => {
    const creditors: Array<{ name: string; amount: number }> = [];
    const debtors: Array<{ name: string; amount: number }> = [];

    Object.entries(balances).forEach(([name, amount]) => {
      const rounded = Math.round(amount * 100) / 100;
      if (rounded > 0) creditors.push({ name, amount: rounded });
      if (rounded < 0) debtors.push({ name, amount: Math.abs(rounded) });
    });

    const result: Array<{ from: string; to: string; amount: number }> = [];
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i];
      const c = creditors[j];
      const amount = Math.min(d.amount, c.amount);
      result.push({ from: d.name, to: c.name, amount: Math.round(amount * 100) / 100 });
      d.amount -= amount;
      c.amount -= amount;
      if (d.amount < 0.01) i += 1;
      if (c.amount < 0.01) j += 1;
    }

    return result;
  }, [balances]);

  function addPlace(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") || "").trim();
    if (!name) return;

    setPlaces((prev) => [
      {
        id: id("place"),
        name,
        note: String(form.get("note") || "").trim(),
        address: String(form.get("address") || "").trim(),
        lat: String(form.get("lat") || "").trim(),
        lng: String(form.get("lng") || "").trim(),
      },
      ...prev,
    ]);
    e.currentTarget.reset();
  }

  function addBudget(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const label = String(form.get("label") || "").trim();
    const amount = Number(form.get("amount") || 0);
    const currency = String(form.get("currency") || "USD") as Currency;
    if (!label || amount <= 0) return;

    setBudgetItems((prev) => [{ id: id("budget"), label, amount, currency }, ...prev]);
    e.currentTarget.reset();
  }

  function addMember(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const member = newMember.trim();
    if (!member || members.includes(member)) return;
    setMembers((prev) => [...prev, member]);
    setNewMember("");
  }

  function addExpense(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") || "").trim();
    const amount = Number(form.get("amount") || 0);
    const paidBy = String(form.get("paidBy") || "");
    const participants = form.getAll("participants").map(String);
    if (!title || amount <= 0 || !paidBy || participants.length === 0) return;

    setExpenses((prev) => [{ id: id("expense"), title, amount, paidBy, participants }, ...prev]);
    e.currentTarget.reset();
  }

  function addItinerary(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const day = String(form.get("day") || "");
    const time = String(form.get("time") || "");
    const activity = String(form.get("activity") || "").trim();
    const note = String(form.get("note") || "").trim();
    if (!day || !activity) return;

    setItinerary((prev) => [{ id: id("itinerary"), day, time, activity, note }, ...prev]);
    e.currentTarget.reset();
  }

  const sortedItinerary = [...itinerary].sort((a, b) => `${a.day}${a.time}`.localeCompare(`${b.day}${b.time}`));

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f3fbff_0%,#e6edf7_48%,#f3f6fb_100%)] px-4 py-6 text-slate-900 md:px-8 md:py-8">
      <div className="pointer-events-none absolute -left-28 top-24 h-72 w-72 rounded-full bg-[#8fd9ff]/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-14 h-80 w-80 rounded-full bg-[#9ee9b7]/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-4 left-1/3 h-56 w-56 rounded-full bg-[#ffd69c]/30 blur-3xl" />

      <div className="relative mx-auto max-w-6xl space-y-5">
        <section className="rounded-3xl border border-white/70 bg-[#083a54] px-5 py-6 text-white shadow-[0_20px_55px_rgba(3,18,30,0.4)] md:px-7 md:py-7">
          <div className="grid gap-4 md:grid-cols-[1.6fr_1fr] md:items-end">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-200">Travel Operations</p>
              <h1 className="mt-2 text-3xl font-semibold leading-tight md:text-4xl">Trip Agent Workspace</h1>
              <p className="mt-3 max-w-xl text-sm text-slate-100/90">
                Manage places, budgeting, shared expenses, and itinerary in one phone-friendly dashboard.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-cyan-100">Places</p>
                <p className="mt-1 text-2xl font-semibold">{places.length}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-cyan-100">Members</p>
                <p className="mt-1 text-2xl font-semibold">{members.length}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-cyan-100">Budget</p>
                <p className="mt-1 text-lg font-semibold">{asMoney(totalBudgetBase, baseCurrency)}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-3">
                <p className="text-cyan-100">Itinerary</p>
                <p className="mt-1 text-2xl font-semibold">{itinerary.length}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <article className={cardClass("border-t-4 border-t-[#3f90b8]")}>
            <h2 className="text-xl font-semibold">Saved Places + Map Sync</h2>
            <p className="mt-1 text-sm text-slate-600">Store locations and open directly in Google Maps or Amap.</p>

            <form className="mt-4 grid gap-2" onSubmit={addPlace}>
              <input name="name" placeholder="Place name" className={inputClass} required />
              <input name="address" placeholder="Address" className={inputClass} />
              <div className="grid grid-cols-2 gap-2">
                <input name="lat" placeholder="Latitude" className={inputClass} />
                <input name="lng" placeholder="Longitude" className={inputClass} />
              </div>
              <input name="note" placeholder="Note" className={inputClass} />
              <button className={buttonClass}>Save place</button>
            </form>

            <div className="mt-4 space-y-2">
              {places.length === 0 ? <p className="text-sm text-slate-500">No places added yet.</p> : null}
              {places.map((place) => {
                const links = placeMapLinks(place);
                return (
                  <div key={place.id} className="rounded-xl border border-[#d6e1ec] bg-white p-3">
                    <p className="font-medium">{place.name}</p>
                    {place.address ? <p className="text-sm text-slate-600">{place.address}</p> : null}
                    {place.note ? <p className="text-sm text-slate-600">{place.note}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-2 text-sm">
                      <a
                        className="rounded-lg bg-[#d8eff9] px-3 py-1 font-medium text-[#0f4a66]"
                        href={links.google}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Google Maps
                      </a>
                      <a
                        className="rounded-lg bg-[#d7f6df] px-3 py-1 font-medium text-[#14532d]"
                        href={links.amap}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Amap
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className={cardClass("border-t-4 border-t-[#ca8c27]")}>
            <h2 className="text-xl font-semibold">Budget + Currency</h2>
            <p className="mt-1 text-sm text-slate-600">Track expenses across currencies with one base total.</p>

            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className="font-medium text-slate-700">Base currency:</span>
              <select
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value as Currency)}
                className={`${inputClass} max-w-[110px]`}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <form className="mt-3 grid gap-2" onSubmit={addBudget}>
              <input name="label" placeholder="Item (hotel, food...)" className={inputClass} required />
              <div className="grid grid-cols-2 gap-2">
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  className={inputClass}
                  required
                />
                <select name="currency" className={inputClass}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <button className={buttonClass}>Add budget item</button>
            </form>

            <p className="mt-4 text-lg font-semibold text-[#7a4d06]">Total: {asMoney(totalBudgetBase, baseCurrency)}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {budgetItems.length === 0 ? <li className="text-slate-500">No budget entries yet.</li> : null}
              {budgetItems.map((item) => (
                <li key={item.id} className="rounded-xl border border-[#eadcc8] bg-[#fffaf2] p-3">
                  <p className="font-medium">{item.label}</p>
                  <p>
                    {asMoney(item.amount, item.currency)} around {asMoney(convert(item.amount, item.currency, baseCurrency), baseCurrency)}
                  </p>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <article className={cardClass("border-t-4 border-t-[#2d8f71]")}>
            <h2 className="text-xl font-semibold">Group Expense Split</h2>
            <p className="mt-1 text-sm text-slate-600">Add members and compute who should pay whom.</p>

            <form className="mt-4 flex gap-2" onSubmit={addMember}>
              <input value={newMember} onChange={(e) => setNewMember(e.target.value)} placeholder="Add member" className={inputClass} />
              <button className={buttonClass}>Add</button>
            </form>

            <form className="mt-3 grid gap-2" onSubmit={addExpense}>
              <input name="title" placeholder="Expense title" className={inputClass} required />
              <input name="amount" type="number" step="0.01" placeholder="Amount (USD)" className={inputClass} required />
              <select name="paidBy" className={inputClass} required>
                <option value="">Who paid?</option>
                {members.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <div className="rounded-xl border border-[#cbe8dd] bg-[#f4fcf8] p-3">
                <p className="text-sm font-medium text-[#1f5f4a]">Participants</p>
                <div className="mt-1 grid grid-cols-2 gap-1 text-sm">
                  {members.map((m) => (
                    <label key={m} className="flex items-center gap-2">
                      <input type="checkbox" name="participants" value={m} defaultChecked />
                      {m}
                    </label>
                  ))}
                </div>
              </div>

              <button className={buttonClass}>Add expense</button>
            </form>

            <div className="mt-4 space-y-1 text-sm">
              {Object.entries(balances).map(([member, amount]) => (
                <p key={member}>
                  <span className="font-medium">{member}</span>: {amount >= 0 ? "gets back" : "owes"} {asMoney(Math.abs(amount), "USD")}
                </p>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-[#d0e8dd] bg-[#f7fffa] p-3 text-sm">
              <p className="font-semibold text-[#1e654f]">Settlement Suggestions</p>
              {settlements.length === 0 ? (
                <p className="text-slate-600">No transfers needed.</p>
              ) : (
                settlements.map((s, idx) => (
                  <p key={`${s.from}_${s.to}_${idx}`}>
                    {s.from} pays {s.to} {asMoney(s.amount, "USD")}
                  </p>
                ))
              )}
            </div>
          </article>

          <article className={cardClass("border-t-4 border-t-[#8c5ee0]")}>
            <h2 className="text-xl font-semibold">Itinerary Management</h2>
            <p className="mt-1 text-sm text-slate-600">Build a clear day-by-day plan for the trip.</p>

            <form className="mt-4 grid gap-2" onSubmit={addItinerary}>
              <div className="grid grid-cols-2 gap-2">
                <input name="day" type="date" className={inputClass} required />
                <input name="time" type="time" className={inputClass} />
              </div>
              <input name="activity" placeholder="Activity" className={inputClass} required />
              <input name="note" placeholder="Note" className={inputClass} />
              <button className={buttonClass}>Add to itinerary</button>
            </form>

            <div className="mt-4 space-y-2 text-sm">
              {sortedItinerary.length === 0 ? <p className="text-slate-500">No itinerary entries yet.</p> : null}
              {sortedItinerary.map((item) => (
                <div key={item.id} className="rounded-xl border border-[#e5dbff] bg-[#faf7ff] p-3">
                  <p className="font-medium text-[#5d3ea5]">
                    {item.day} {item.time ? `at ${item.time}` : ""}
                  </p>
                  <p>{item.activity}</p>
                  {item.note ? <p className="text-slate-600">{item.note}</p> : null}
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
