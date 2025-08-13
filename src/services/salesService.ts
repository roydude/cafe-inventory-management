import {
  supabase,
  isSupabaseConfigured,
  ensureSession,
} from "../lib/supabaseClient";

export type Category = {
  id: string;
  name: string;
  sort_order: number | null;
};

export type Menu = {
  id: string;
  category_id: string;
  code: string;
  name: string;
  price: number | null;
  is_active: boolean | null;
  hot_yn: boolean;
  ice_yn: boolean;
};

export type NewSaleInput = {
  menu_id: string;
  temperature: "hot" | "ice";
  price: number | null;
};

export type SalesRow = {
  id: number;
  menu_id: string;
  temperature: "hot" | "ice";
  price: number | null;
  sold_at: string;
  sold_date: string | null;
  time_slot: string | null;
};

export async function fetchCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, sort_order")
    .order("sort_order", { ascending: true, nullsFirst: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function fetchMenus(): Promise<Menu[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("menus")
    .select("*")
    .eq("is_active", true)
    .order("code", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function insertSale(input: NewSaleInput): Promise<void> {
  if (!isSupabaseConfigured) return;
  await ensureSession();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Supabase 사용자 세션이 필요합니다.");
  const { error } = await supabase.from("sales").insert({
    menu_id: input.menu_id,
    temperature: input.temperature,
    price: input.price,
    user_id: userId,
  });
  if (error) throw error;
}

export async function fetchSalesByDate(dateISO: string): Promise<SalesRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("sales")
    .select("id, menu_id, temperature, price, sold_at, time_slot, sold_date")
    .eq("sold_date", dateISO)
    .order("sold_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SalesRow[];
}

export async function updateSale(
  id: number,
  updates: Partial<
    Pick<
      SalesRow,
      "menu_id" | "temperature" | "price" | "sold_at" | "sold_date" | "time_slot"
    >
  >
): Promise<void> {
  if (!isSupabaseConfigured) return;
  await ensureSession();
  const { error } = await supabase.from("sales").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteSale(id: number): Promise<void> {
  if (!isSupabaseConfigured) return;
  await ensureSession();
  const { error } = await supabase.from("sales").delete().eq("id", id);
  if (error) throw error;
}