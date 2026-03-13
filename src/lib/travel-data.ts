export type Place = {
  id: string;
  name: string;
  note: string;
  address: string;
  lat: string;
  lng: string;
};

export type Currency = "USD" | "EUR" | "HKD" | "JPY" | "CNY" | "GBP";

export type BudgetItem = {
  id: string;
  label: string;
  amount: number;
  currency: Currency;
};

export type Expense = {
  id: string;
  title: string;
  amount: number;
  paidBy: string;
  participants: string[];
};

export type ItineraryItem = {
  id: string;
  day: string;
  time: string;
  activity: string;
  note: string;
};

export type TravelData = {
  places: Place[];
  budgetItems: BudgetItem[];
  members: string[];
  expenses: Expense[];
  itinerary: ItineraryItem[];
  baseCurrency: Currency;
};

export type TravelRecord = TravelData & {
  updatedAt: number;
};

export const CURRENCIES: Currency[] = ["USD", "EUR", "HKD", "JPY", "CNY", "GBP"];

export function defaultData(): TravelData {
  return {
    places: [],
    budgetItems: [],
    members: ["Alex", "Jamie", "Sam"],
    expenses: [],
    itinerary: [],
    baseCurrency: "USD",
  };
}

