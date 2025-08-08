import { useEffect, useMemo, useState } from "react";
import {
  Coffee,
  Droplets,
  TrendingUp,
  Clock,
  Download,
  AlertCircle,
  LogOut,
} from "lucide-react";
import {
  ensureSession,
  isSupabaseConfigured,
  signInWithEmailPassword,
  signOut,
} from "./lib/supabaseClient";
import {
  fetchCategories,
  fetchMenus,
  insertSale,
  fetchSalesByDate,
  type Category,
  type Menu as RemoteMenu,
  type SalesRow,
} from "./services/salesService";
import {
  deleteSale as apiDeleteSale,
  updateSale as apiUpdateSale,
} from "./services/salesService";

import { formatDateYYYYMMDD, getCurrentTimeslot } from "./utils/time";

type ViewMode = "input" | "dashboard" | "report";

export default function AppSupabase() {
  const [viewMode, setViewMode] = useState<ViewMode>("input");
  const [date, setDate] = useState<string>(formatDateYYYYMMDD());
  const [categories, setCategories] = useState<Category[]>([]);
  const [menus, setMenus] = useState<RemoteMenu[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [sales, setSales] = useState<SalesRow[]>([]);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isFading, setIsFading] = useState<boolean>(false);
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);

  // Derived maps
  const categoryIdToName = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of categories) map[c.id] = c.name;
    return map;
  }, [categories]);

  const menuIdToMenu = useMemo(() => {
    const map: Record<string, RemoteMenu> = {};
    for (const m of menus) map[m.id] = m;
    return map;
  }, [menus]);

  const menusByCategory = useMemo(() => {
    const grouped: Record<string, RemoteMenu[]> = {};
    for (const m of menus) {
      if (!grouped[m.category_id]) grouped[m.category_id] = [];
      grouped[m.category_id].push(m);
    }
    return grouped;
  }, [menus]);

  // Load master data
  useEffect(() => {
    (async () => {
      if (!isSupabaseConfigured) return;
      try {
        await ensureSession();
        setAuthReady(true);
      } catch (e) {
        setAuthError("Supabase 인증 세션이 필요합니다. 로그인해 주세요.");
      }
      try {
        const [cats, mns] = await Promise.all([
          fetchCategories(),
          fetchMenus(),
        ]);
        setCategories(cats);
        setMenus(mns);
        if (cats.length > 0) setSelectedCategoryId(cats[0].id);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // View fade
  useEffect(() => {
    setIsFading(true);
    const t = window.setTimeout(() => setIsFading(false), 160);
    return () => window.clearTimeout(t);
  }, [viewMode]);

  // Load sales per date
  useEffect(() => {
    (async () => {
      if (!isSupabaseConfigured) return;
      try {
        const rows = await fetchSalesByDate(date);
        setSales(rows);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [date]);

  async function addSale(menu: RemoteMenu, temperature: "hot" | "ice") {
    try {
      await insertSale({
        menu_id: menu.id,
        temperature,
        price: menu.price ?? null,
      });
      // optimistic update
      setSales((prev) => [
        ...prev,
        {
          id: Date.now(),
          menu_id: menu.id,
          temperature,
          price: menu.price ?? null,
          sold_at: new Date().toISOString(),
          sold_date: date,
          time_slot: getCurrentTimeslot(new Date()),
        },
      ]);
      setToast("판매 내용이 기록됐어요.");
      window.setTimeout(() => setToast(null), 2000);
    } catch (e: any) {
      setAuthError(e?.message ?? "판매 등록 실패");
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      await signInWithEmailPassword(loginEmail, loginPassword);
      setAuthReady(true);
      setToast("로그인 됐어요.");
      window.setTimeout(() => setToast(null), 2000);
      const [cats, mns] = await Promise.all([fetchCategories(), fetchMenus()]);
      setCategories(cats);
      setMenus(mns);
      if (cats.length > 0) setSelectedCategoryId(cats[0].id);
    } catch (e: any) {
      setAuthError(e?.message ?? "로그인 실패");
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLogout() {
    try {
      await signOut();
    } finally {
      setAuthReady(false);
      setCategories([]);
      setMenus([]);
      setSales([]);
      setToast("로그아웃 됐어요.");
      window.setTimeout(() => setToast(null), 2000);
    }
  }

  async function handleDeleteSale(id: number) {
    if (!confirm("이 판매 내역을 삭제할까요?")) return;
    try {
      await apiDeleteSale(id);
      setSales((prev) => prev.filter((s) => s.id !== id));
    } catch (e: any) {
      setAuthError(e?.message ?? "삭제 실패");
    }
  }

  async function handleEditSaleInline(id: number) {
    const target = sales.find((s) => s.id === id);
    if (!target) return;
    const nextPriceStr = prompt(
      "가격을 입력하세요(숫자)",
      String(target.price ?? 0)
    );
    if (nextPriceStr == null) return;
    const nextPrice = Number(nextPriceStr);
    if (Number.isNaN(nextPrice)) return alert("숫자를 입력하세요.");
    try {
      await apiUpdateSale(id, { price: nextPrice });
      setSales((prev) =>
        prev.map((s) => (s.id === id ? { ...s, price: nextPrice } : s))
      );
    } catch (e: any) {
      setAuthError(e?.message ?? "수정 실패");
    }
  }

  // Aggregations
  const hourlyStats = useMemo(() => {
    const stats: Record<
      string,
      { total: number; hot: number; ice: number; revenue: number }
    > = {};
    for (const s of sales) {
      const slot = s.time_slot ?? getCurrentTimeslot(new Date(s.sold_at));
      if (!stats[slot]) stats[slot] = { total: 0, hot: 0, ice: 0, revenue: 0 };
      stats[slot].total += 1;
      if (s.temperature === "hot") stats[slot].hot += 1;
      if (s.temperature === "ice") stats[slot].ice += 1;
      stats[slot].revenue += s.price ?? 0;
    }
    return stats;
  }, [sales]);

  const menuStats = useMemo(() => {
    type Row = {
      menuName: string;
      temperature: "hot" | "ice";
      count: number;
      revenue: number;
      category: string;
    };
    const map = new Map<string, Row>();
    for (const s of sales) {
      const menu = menuIdToMenu[s.menu_id];
      const categoryName = menu ? categoryIdToName[menu.category_id] : "기타";
      const key = `${s.menu_id}_${s.temperature}`;
      const cur = map.get(key) ?? {
        menuName: menu?.name ?? "알 수 없음",
        temperature: s.temperature,
        count: 0,
        revenue: 0,
        category: categoryName,
      };
      cur.count += 1;
      cur.revenue += s.price ?? 0;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [sales, menuIdToMenu, categoryIdToName]);

  const todayCount = useMemo(() => sales.length, [sales]);

  function exportToCSV() {
    const headers = ["날짜", "시간", "카테고리", "메뉴명", "온도", "가격"];
    const rows = sales.map((s) => {
      const menu = menuIdToMenu[s.menu_id];
      const categoryName = menu ? categoryIdToName[menu.category_id] : "기타";
      return [
        date,
        s.time_slot ?? getCurrentTimeslot(new Date(s.sold_at)),
        categoryName,
        menu?.name ?? s.menu_id,
        s.temperature === "hot" ? "HOT" : "ICE",
        String(s.price ?? 0),
      ];
    });
    const csvContent = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `sales_${date}.csv`;
    link.click();
  }

  const currentCategoryMenus = menusByCategory[selectedCategoryId] ?? [];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Coffee className="w-6 h-6 text-amber-600" /> 판매 관리
            </h1>
            <div className="flex gap-1 items-center">
              {authReady ? (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen((v) => !v)}
                    className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition"
                    aria-haspopup="menu"
                    aria-expanded={userMenuOpen}
                  >
                    메뉴
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-36 bg-white border rounded-lg shadow z-20 py-1">
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          void handleLogout();
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" /> 로그아웃
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
              <button
                onClick={() => setViewMode("input")}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition active:scale-95 ${
                  viewMode === "input"
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                입력
              </button>
              <button
                onClick={() => setViewMode("dashboard")}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition active:scale-95 ${
                  viewMode === "dashboard"
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                현황
              </button>
              <button
                onClick={() => setViewMode("report")}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition active:scale-95 ${
                  viewMode === "report"
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                리포트
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-3">
        {/* Toast */}
        {toast && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2 rounded-full shadow">
            {toast}
          </div>
        )}
        {!authReady ? (
          <div className="max-w-md mx-auto bg-white rounded-lg shadow-sm p-4 mb-4">
            <h2 className="text-lg font-bold mb-2">로그인</h2>
            {authError && (
              <div className="mb-2 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm p-2 rounded flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {authError}
              </div>
            )}
            <form onSubmit={handleLogin} className="space-y-2">
              <input
                type="email"
                placeholder="이메일"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                required
              />
              <input
                type="password"
                placeholder="비밀번호"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                required
              />
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full px-3 py-2 rounded-lg text-sm font-medium bg-amber-600 text-white disabled:opacity-60"
              >
                {isLoggingIn ? "로그인 중..." : "로그인"}
              </button>
            </form>
          </div>
        ) : null}

        {authReady && viewMode === "input" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-base font-medium">{date}</div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              />
            </div>
            {/* 카테고리 탭 */}
            <div className="bg-white rounded-lg shadow-sm p-2 mb-3 overflow-x-auto">
              <div className="flex gap-2 min-w-max">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategoryId(c.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition active:scale-95 ${
                      selectedCategoryId === c.id
                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 메뉴 카드 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {currentCategoryMenus.map((m) => (
                <div
                  key={m.id}
                  className="bg-white rounded-lg shadow-sm p-3 hover:shadow-md transition"
                >
                  <h3 className="font-bold text-sm mb-1 line-clamp-2 min-h-[2.5rem]">
                    {m.name}
                  </h3>
                  {m.price != null && (
                    <p className="text-gray-600 mb-2 text-sm">
                      {m.price.toLocaleString()}원
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      disabled={!m.hot_yn}
                      onClick={() => addSale(m, "hot")}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1 transition active:scale-95 ${
                        m.hot_yn
                          ? "bg-rose-500 hover:bg-rose-600 text-white"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      <Droplets className="w-4 h-4" /> HOT
                    </button>
                    <button
                      disabled={!m.ice_yn}
                      onClick={() => addSale(m, "ice")}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1 transition active:scale-95 ${
                        m.ice_yn
                          ? "bg-sky-500 hover:bg-sky-600 text-white"
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      <Droplets className="w-4 h-4" /> ICE
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {authReady && viewMode === "dashboard" && (
          <div>
            <div className="bg-white rounded-lg shadow-sm p-3 mb-3">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-600 text-sm">총 판매</span>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
                <p className="text-xl font-bold">{todayCount}잔</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-600 text-sm">운영 시간</span>
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-xl font-bold">
                  {Object.keys(hourlyStats).length}시간
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <h2 className="text-lg font-bold mb-3">시간대별 판매 현황</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">시간대</th>
                      <th className="text-center py-2">HOT</th>
                      <th className="text-center py-2">ICE</th>
                      <th className="text-center py-2">합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(hourlyStats)
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([timeSlot, stats]) => (
                        <tr key={timeSlot} className="border-b">
                          <td className="py-2">{timeSlot}</td>
                          <td className="text-center py-2">{stats.hot}</td>
                          <td className="text-center py-2">{stats.ice}</td>
                          <td className="text-center py-2 font-medium">
                            {stats.total}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4">
              <h2 className="text-lg font-bold mb-3">인기 메뉴 TOP 5</h2>
              <div className="space-y-3">
                {menuStats.slice(0, 5).map((stat, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold text-gray-400">
                        #{index + 1}
                      </span>
                      <div>
                        <p className="font-medium">{stat.menuName}</p>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            stat.temperature === "hot"
                              ? "bg-red-100 text-red-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {stat.temperature === "hot" ? "HOT" : "ICE"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{stat.count}잔</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {authReady && viewMode === "report" && (
          <div
            className={`bg-white rounded-lg shadow-sm p-4 ${
              isFading ? "opacity-0" : "opacity-100"
            } transition-opacity duration-150`}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">일간 리포트</h2>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm"
                />
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm"
                >
                  <Download className="w-4 h-4" /> CSV 내보내기
                </button>
              </div>
            </div>

            {/* 관리: 판매 내역 수정/삭제 */}
            <div className="mb-6">
              <h3 className="font-bold mb-3">판매 내역 관리</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-2 px-3 whitespace-nowrap">
                        시간
                      </th>
                      <th className="text-left py-2 px-3">메뉴</th>
                      <th className="text-center py-2 px-3 whitespace-nowrap">
                        온도
                      </th>
                      <th className="text-center py-2 px-3 whitespace-nowrap">
                        작업
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((s) => {
                      const menu = menuIdToMenu[s.menu_id];
                      const name = menu?.name ?? s.menu_id;
                      return (
                        <tr key={`${s.id}-${s.sold_at}`} className="border-b">
                          <td className="py-2 px-3 whitespace-nowrap">
                            {s.time_slot ??
                              getCurrentTimeslot(new Date(s.sold_at))}
                          </td>
                          <td className="py-2 px-3 truncate max-w-[10rem] sm:max-w-none">
                            {name}
                          </td>
                          <td className="text-center py-2 px-3 whitespace-nowrap">
                            {s.temperature === "hot" ? "HOT" : "ICE"}
                          </td>
                          <td className="text-center py-2 px-3 whitespace-nowrap">
                            <button
                              onClick={() => handleEditSaleInline(s.id)}
                              className="px-2 py-1 text-xs bg-sky-600 hover:bg-sky-700 text-white rounded mr-2 transition active:scale-95"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleDeleteSale(s.id)}
                              className="px-2 py-1 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded transition active:scale-95"
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="font-bold mb-3">카테고리별 판매 현황</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {categories.map((c) => {
                  const stat = menuStats.filter((r) => r.category === c.name);
                  const count = stat.reduce((sum, r) => sum + r.count, 0);
                  const revenue = stat.reduce((sum, r) => sum + r.revenue, 0);
                  return (
                    <div key={c.id} className="bg-gray-50 rounded-lg p-3">
                      <h4 className="font-medium mb-1">{c.name}</h4>
                      <p className="text-xl font-bold">{count}잔</p>
                      <p className="text-xs text-gray-600">
                        {revenue.toLocaleString()}원
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="font-bold mb-3">메뉴별 상세 판매 내역</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-2 px-3">카테고리</th>
                      <th className="text-left py-2 px-3">메뉴명</th>
                      <th className="text-center py-2 px-3">온도</th>
                      <th className="text-center py-2 px-3">판매량</th>
                    </tr>
                  </thead>
                  <tbody>
                    {menuStats.map((stat, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-2 px-3">{stat.category}</td>
                        <td className="py-2 px-3 font-medium">
                          {stat.menuName}
                        </td>
                        <td className="text-center py-2 px-3">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              stat.temperature === "hot"
                                ? "bg-red-100 text-red-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {stat.temperature === "hot" ? "HOT" : "ICE"}
                          </span>
                        </td>
                        <td className="text-center py-2 px-3">{stat.count}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-bold">
                      <td colSpan={3} className="py-2 px-3">
                        합계
                      </td>
                      <td className="text-center py-2 px-3">{todayCount}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
