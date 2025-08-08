import Dexie, { type Table } from "dexie";

export type SaleRecord = {
  id?: number;
  menuId: string;
  category: string;
  menuName: string;
  type: "HOT" | "ICE";
  price: number;
  timestamp: number;
};

class DrinkSalesDB extends Dexie {
  sales!: Table<SaleRecord, number>;

  constructor() {
    super("drinkSalesDB");
    this.version(1).stores({
      sales: "++id, menuId, category, type, timestamp",
    });
  }
}

export const db = new DrinkSalesDB();
