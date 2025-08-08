export type DrinkType = "HOT" | "ICE";

export type MenuItem = {
  id: string;
  name: string;
  price: number;
};

export type MenuData = Record<string, MenuItem[]>;
