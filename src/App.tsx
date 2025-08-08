import { useEffect, useMemo, useState } from "react";
import "./App.css";
import menuDataJson from "./assets/menu.json";
import type { MenuData, DrinkType } from "./types";
import { db, type SaleRecord } from "./db";
import {
  formatDateYYYYMMDD,
  getCurrentTimeslot,
  getDayStartEnd,
} from "./utils/time";

type AggregatedRow = {
  timeslot: string;
  total: number;
  hot: number;
  ice: number;
};

function App() {
  const menuData = menuDataJson as MenuData;
  const [todaySales, setTodaySales] = useState<SaleRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  async function addSale(
    menuId: string,
    category: string,
    menuName: string,
    type: DrinkType
  ) {
    const itemPrice =
      menuData[category]?.find((i) => i.id === menuId)?.price ?? 0;
    const record: SaleRecord = {
      menuId,
      category,
      menuName,
      type,
      price: itemPrice,
      timestamp: Date.now(),
    };
    await db.sales.add(record);
    await refreshToday();
  }

  const { start: startOfDay, end: endOfDay } = useMemo(
    () => getDayStartEnd(new Date()),
    []
  );

  async function refreshToday() {
    setIsLoading(true);
    const items = await db.sales
      .where("timestamp")
      .between(startOfDay, endOfDay, true, true)
      .toArray();
    setTodaySales(items);
    setIsLoading(false);
  }

  useEffect(() => {
    void refreshToday();
  }, []);

  const aggregatedByTimeslot = useMemo<AggregatedRow[]>(() => {
    const map = new Map<string, AggregatedRow>();
    for (const s of todaySales) {
      const slot = getCurrentTimeslot(new Date(s.timestamp));
      const current = map.get(slot) ?? {
        timeslot: slot,
        total: 0,
        hot: 0,
        ice: 0,
      };
      current.total += 1;
      if (s.type === "HOT") current.hot += 1;
      if (s.type === "ICE") current.ice += 1;
      map.set(slot, current);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.timeslot.localeCompare(b.timeslot)
    );
  }, [todaySales]);

  const totalToday = useMemo(() => todaySales.length, [todaySales]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-2xl md:text-3xl font-bold">
            매장 음료 판매 기록
          </h1>
          <div className="text-lg md:text-xl font-medium">
            {formatDateYYYYMMDD()}
          </div>
        </header>

        <section className="mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {Object.entries(menuData).map(([category, items]) => (
              <div
                key={category}
                className="col-span-2 sm:col-span-3 lg:col-span-4"
              >
                <h2 className="text-xl font-semibold mt-4 mb-2">{category}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white shadow rounded-lg p-3 md:p-4 flex flex-col gap-2"
                    >
                      <div className="text-base md:text-lg font-medium">
                        {item.name}
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="flex-1 py-2 rounded-md bg-red-500 text-white hover:bg-red-600 active:scale-[0.98]"
                          onClick={() =>
                            addSale(item.id, category, item.name, "HOT")
                          }
                        >
                          HOT
                        </button>
                        <button
                          className="flex-1 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 active:scale-[0.98]"
                          onClick={() =>
                            addSale(item.id, category, item.name, "ICE")
                          }
                        >
                          ICE
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg md:text-xl font-semibold">당일 판매 요약</h2>
            <div className="text-base">총 {totalToday}잔</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm md:text-base">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">시간대</th>
                  <th className="text-right p-2">HOT</th>
                  <th className="text-right p-2">ICE</th>
                  <th className="text-right p-2">합계</th>
                </tr>
              </thead>
              <tbody>
                {aggregatedByTimeslot.map((row) => (
                  <tr className="border-b last:border-b-0" key={row.timeslot}>
                    <td className="p-2">{row.timeslot}</td>
                    <td className="p-2 text-right">{row.hot}</td>
                    <td className="p-2 text-right">{row.ice}</td>
                    <td className="p-2 text-right font-medium">{row.total}</td>
                  </tr>
                ))}
                {aggregatedByTimeslot.length === 0 && !isLoading && (
                  <tr>
                    <td className="p-3 text-gray-500" colSpan={4}>
                      아직 판매 기록이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
