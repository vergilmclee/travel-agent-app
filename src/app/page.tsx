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

function loadInitialData(): TravelData {
  if (typeof window === "undefined") {
    return {
      places: [],
      budgetItems: [],
      members: ["Alex", "Jamie", "Sam"],
      expenses: [],
      itinerary: [],
      baseCurrency: "USD",
    };
  }

  try {
    const raw = localStorage.getItem("travel_agent_data_v1");
    if (!raw) {
      return {
        places: [],
        budgetItems: [],
        members: ["Alex", "Jamie", "Sam"],
        expenses: [],
        itinerary: [],
        baseCurrency: "USD",
      };
    }
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
    return {
      places: [],
      budgetItems: [],
      members: ["Alex", "Jamie", "Sam"],
      expenses: [],
      itinerary: [],
      baseCurrency: "USD",
    };
  }
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
      if (!ledger[ex.paidBy] || ex.participants.length === 0) continue;
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
      ...prev,
      {
        id: id("place"),
        name,
        note: String(form.get("note") || "").trim(),
        address: String(form.get("address") || "").trim(),
        lat: String(form.get("lat") || "").trim(),
        lng: String(form.get("lng") || "").trim(),
      },
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

    setBudgetItems((prev) => [...prev, { id: id("budget"), label, amount, currency }]);
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

    setExpenses((prev) => [...prev, { id: id("expense"), title, amount, paidBy, participants }]);
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

    setItinerary((prev) => [...prev, { id: id("itinerary"), day, time, activity, note }]);
    e.currentTarget.reset();
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 text-slate-900 md:p-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold">Travel Agent App</h1>
          <p className="mt-1 text-sm text-slate-600">
            Mobile-friendly planner for saved places, map sync, budgeting, currency conversion,
            group split, and itinerary.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Saved Places + Map Sync</h2>
            <form className="mt-3 grid gap-2" onSubmit={addPlace}>
              <input name="name" placeholder="Place name" className="rounded-lg border p-2" required />
              <input name="address" placeholder="Address" className="rounded-lg border p-2" />
              <div className="grid grid-cols-2 gap-2">
                <input name="lat" placeholder="Latitude" className="rounded-lg border p-2" />
                <input name="lng" placeholder="Longitude" className="rounded-lg border p-2" />
              </div>
              <input name="note" placeholder="Note" className="rounded-lg border p-2" />
              <button className="rounded-lg bg-slate-900 p-2 text-white">Save place</button>
            </form>

            <div className="mt-4 space-y-3">
              {places.map((place) => {
                const links = placeMapLinks(place);
                return (
                  <div key={place.id} className="rounded-xl border p-3">
                    <p className="font-medium">{place.name}</p>
                    {place.note ? <p className="text-sm text-slate-600">{place.note}</p> : null}
                    <div className="mt-2 flex gap-3 text-sm">
                      <a className="text-blue-600 underline" href={links.google} target="_blank" rel="noreferrer">
                        Open in Google Maps
                      </a>
                      <a className="text-emerald-700 underline" href={links.amap} target="_blank" rel="noreferrer">
                        Open in Amap
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Budget + Currency</h2>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span>Base currency:</span>
              <select
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value as Currency)}
                className="rounded border p-1"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <form className="mt-3 grid gap-2" onSubmit={addBudget}>
              <input name="label" placeholder="Item (hotel, food...)" className="rounded-lg border p-2" required />
              <div className="grid grid-cols-2 gap-2">
                <input name="amount" type="number" step="0.01" placeholder="Amount" className="rounded-lg border p-2" required />
                <select name="currency" className="rounded-lg border p-2">
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <button className="rounded-lg bg-slate-900 p-2 text-white">Add budget item</button>
            </form>

            <p className="mt-4 text-sm font-medium">Total: {asMoney(totalBudgetBase, baseCurrency)}</p>
            <ul className="mt-2 space-y-2 text-sm">
              {budgetItems.map((item) => (
                <li key={item.id} className="rounded-lg border p-2">
                  {item.label}: {asMoney(item.amount, item.currency)} (~
                  {asMoney(convert(item.amount, item.currency, baseCurrency), baseCurrency)})
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Group Expense Split</h2>
            <form className="mt-3 flex gap-2" onSubmit={addMember}>
              <input
                value={newMember}
                onChange={(e) => setNewMember(e.target.value)}
                placeholder="Add member"
                className="flex-1 rounded-lg border p-2"
              />
              <button className="rounded-lg bg-slate-900 px-3 text-white">Add</button>
            </form>

            <form className="mt-3 grid gap-2" onSubmit={addExpense}>
              <input name="title" placeholder="Expense title" className="rounded-lg border p-2" required />
              <input name="amount" type="number" step="0.01" placeholder="Amount (USD)" className="rounded-lg border p-2" required />
              <select name="paidBy" className="rounded-lg border p-2" required>
                <option value="">Who paid?</option>
                {members.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <div className="rounded-lg border p-2">
                <p className="text-sm font-medium">Participants</p>
                <div className="mt-1 grid grid-cols-2 gap-1 text-sm">
                  {members.map((m) => (
                    <label key={m} className="flex items-center gap-2">
                      <input type="checkbox" name="participants" value={m} defaultChecked />
                      {m}
                    </label>
                  ))}
                </div>
              </div>
              <button className="rounded-lg bg-slate-900 p-2 text-white">Add expense</button>
            </form>

            <div className="mt-4 space-y-1 text-sm">
              {Object.entries(balances).map(([member, amount]) => (
                <p key={member}>
                  {member}: {amount >= 0 ? "gets back" : "owes"} {asMoney(Math.abs(amount), "USD")}
                </p>
              ))}
            </div>

            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
              <p className="font-medium">Settlement suggestions</p>
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

          <article className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Itinerary Management</h2>
            <form className="mt-3 grid gap-2" onSubmit={addItinerary}>
              <div className="grid grid-cols-2 gap-2">
                <input name="day" type="date" className="rounded-lg border p-2" required />
                <input name="time" type="time" className="rounded-lg border p-2" />
              </div>
              <input name="activity" placeholder="Activity" className="rounded-lg border p-2" required />
              <input name="note" placeholder="Note" className="rounded-lg border p-2" />
              <button className="rounded-lg bg-slate-900 p-2 text-white">Add to itinerary</button>
            </form>

            <div className="mt-4 space-y-2 text-sm">
              {[...itinerary]
                .sort((a, b) => `${a.day}${a.time}`.localeCompare(`${b.day}${b.time}`))
                .map((item) => (
                  <div key={item.id} className="rounded-xl border p-3">
                    <p className="font-medium">
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
