import { useEffect, useMemo, useState } from "react";
import {
  Coffee,
  TrendingUp,
  Clock,
  Download,
  AlertCircle,
  LogOut,
  Menu as MenuIcon,
  LayoutDashboard,
  Clipboard,
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
} from "./services/salesService";

import { formatDateYYYYMMDD, getCurrentTimeslot } from "./utils/time";

type ViewMode = "input" | "dashboard" | "report";

export default function AppSupabase() {
  const [viewMode, setViewMode] = useState<ViewMode>("input");
  const [date, setDate] = useState<string>(formatDateYYYYMMDD());
  const [categories, setCategories] = useState<Category[]>([]);
  const [menus, setMenus] = useState<RemoteMenu[]>([]);
  const [sales, setSales] = useState<SalesRow[]>([]);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);
  // view 전환은 CSS 애니메이션으로 처리
  const [userMenuOpen, setUserMenuOpen] = useState<boolean>(false);

  const categoryOrder = ["COFFEE", "BREWING", "BEVERAGE", "TWG"];
  const menuOrderItem: Record<string, string[]> = {
    BREWING: ["페루 시에테 부엘타스 게이샤", "예맨 마타리 사예 네츄럴"],
    COFFEE: [
      "에스프레소",
      "아메리카노",
      "카페 라테",
      "바닐라빈 라테",
      "화이트 콜드브루 라테",
    ],
    BEVERAGE: [
      "제주 말차 라테",
      "다크쇼콜라 라테",
      "수제 진저레몬차",
      "수제 자몽차",
      "수제 자몽에이드",
      "히비스커스 한라봉 에이드",
      "대추 쌍화차",
      "배모과차",
      "식혜",
    ],
    TWG: ["레드 오브 아프리카", "얼그레이 젠틀맨", "나폴레옹"],
  };

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

  const orderedCategories = useMemo(() => {
    const orderIndex = new Map(categoryOrder.map((n, i) => [n, i]));
    return [...categories].sort(
      (a, b) => (orderIndex.get(a.name) ?? 1_000_000) - (orderIndex.get(b.name) ?? 1_000_000)
    );
  }, [categories]);

  const orderedMenusByCategory = useMemo(() => {
    const grouped: Record<string, RemoteMenu[]> = {};
    for (const category of orderedCategories) {
      const categoryMenus = menusByCategory[category.id] ?? [];
      const orderList = menuOrderItem[category.name] ?? [];
      const rank = new Map(orderList.map((n, i) => [n, i]));
      const sorted = [...categoryMenus].sort((a, b) => {
        const ra = rank.get(a.name) ?? 1_000_000;
        const rb = rank.get(b.name) ?? 1_000_000;
        if (ra !== rb) return ra - rb;
        return a.name.localeCompare(b.name, "ko-KR");
      });
      grouped[category.id] = sorted;
    }
    return grouped;
  }, [orderedCategories, menusByCategory]);

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
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // View fade는 CSS 애니메이션으로 대체

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

  // 수정 기능은 리포트 화면에서 제거되었습니다.

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

  // Report pagination
  const [reportPage, setReportPage] = useState<number>(1);
  const pageSize = 10;
  const sortedSalesDesc = useMemo(
    () =>
      [...sales].sort(
        (a, b) =>
          new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime()
      ),
    [sales]
  );
  const totalReportPages = useMemo(
    () => Math.max(1, Math.ceil(sortedSalesDesc.length / pageSize)),
    [sortedSalesDesc.length]
  );
  useEffect(() => {
    // 날짜 변경 시 페이지 초기화
    setReportPage(1);
  }, [date]);
  useEffect(() => {
    // 페이지 경계 보정
    if (reportPage > totalReportPages) setReportPage(totalReportPages);
  }, [reportPage, totalReportPages]);
  const pagedSales = useMemo(
    () =>
      sortedSalesDesc.slice((reportPage - 1) * pageSize, reportPage * pageSize),
    [sortedSalesDesc, reportPage]
  );

  function formatDateTimeYYMMDDHHmmSS(iso: string): string {
    const d = new Date(iso);
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${yy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
  }

  const fixedTimeSlots = useMemo(
    () => [
      "09:00-10:00",
      "10:00-11:00",
      "11:00-12:00",
      "12:00-13:00",
      "13:00-14:00",
      "14:00-15:00",
      "15:00-16:00",
      "16:00-17:00",
    ],
    []
  );

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

  async function copyHourlyStatsToClipboard() {
    const rows = fixedTimeSlots.map((slot) => {
      const stats = hourlyStats[slot] ?? { total: 0, hot: 0, ice: 0, revenue: 0 };
      return `${slot}\t${stats.total}`;
    });
    const content = ["시간대\t합계", ...rows].join("\n");
    const showToast = (msg: string) => {
      setToast(msg);
      window.setTimeout(() => setToast(null), 2000);
    };
    // 1) 현대 브라우저 + 보안 컨텍스트
    try {
      if (navigator.clipboard && (window as any).isSecureContext) {
        await navigator.clipboard.writeText(content);
        showToast("클립보드에 복사했어요.");
        return;
      }
    } catch (err) {
      // 폴백으로 진행
    }
    // 2) 폴백: 임시 textarea를 이용한 execCommand 복사
    try {
      const textarea = document.createElement("textarea");
      textarea.value = content;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      textarea.style.left = "0";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (successful) {
        showToast("클립보드에 복사했어요.");
      } else {
        showToast("복사에 실패했어요. 수동으로 복사해 주세요.");
      }
    } catch (e) {
      console.error(e);
      showToast("복사에 실패했어요. 수동으로 복사해 주세요.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Coffee className="w-6 h-6 text-amber-600" /> 지공 앱
            </h1>
            <div className="flex gap-1 items-center">
              {authReady ? (
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen((v) => !v)}
                    className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95 transition"
                    aria-haspopup="menu"
                    aria-expanded={userMenuOpen}
                    aria-label="메뉴"
                  >
                    <MenuIcon className="w-5 h-5" />
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
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-3 pb-16">
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
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold text-gray-800">{date}</div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
              />
            </div>

            {orderedCategories.map((category) => (
              <div key={category.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                    {category.name}
                  </h2>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {(orderedMenusByCategory[category.id] ?? []).map((m) => (
                      <div
                        key={m.id}
                        className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-all duration-200 border border-gray-200 hover:border-gray-300 hover:shadow-md"
                      >
                        <h3 className="font-bold text-sm mb-1.5 line-clamp-2 min-h-[1.5rem] text-gray-800">
                          {m.name}
                        </h3>
                        {m.price != null && (
                          <p className="text-gray-600 mb-3 text-sm font-medium">
                            {m.price.toLocaleString()}원
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button
                            disabled={!m.hot_yn}
                            onClick={() => addSale(m, "hot")}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                              m.hot_yn
                                ? "bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-md hover:shadow-lg"
                                : "bg-gray-200 text-gray-400 cursor-not-allowed"
                            }`}
                          >
                            HOT
                          </button>
                          <button
                            disabled={!m.ice_yn}
                            onClick={() => addSale(m, "ice")}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center transition-all duration-200 transform hover:scale-105 active:scale-95 ${
                              m.ice_yn
                                ? "bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-md hover:shadow-lg"
                                : "bg-gray-200 text-gray-400 cursor-not-allowed"
                            }`}
                          >
                            ICE
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {authReady && viewMode === "dashboard" && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">현황</h2>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-all duration-200 border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-600 text-sm">총 판매</span>
                  <TrendingUp className="w-4 h-4 text-green-500" />
                </div>
                <p className="text-xl font-bold">{todayCount}잔</p>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-all duration-200 border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-600 text-sm">운영 시간</span>
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <p className="text-xl font-bold">
                  {Object.keys(hourlyStats).length}시간
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4 mb-4 border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold">시간대별 판매 현황</h2>
                <button
                  onClick={copyHourlyStatsToClipboard}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium transition-all duration-200 active:scale-95"
                  title="클립보드 복사"
                  aria-label="시간대별 합계 복사"
                >
                  <Clipboard className="w-4 h-4" /> 복사
                </button>
              </div>
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
                    {fixedTimeSlots.map((slot) => {
                      const stats = hourlyStats[slot] ?? { total: 0, hot: 0, ice: 0, revenue: 0 };
                      const displaySlot = slot.replace("-", " - ");
                      return (
                        <tr key={slot} className="border-b">
                          <td className="py-2">{displaySlot}</td>
                          <td className="text-center py-2">{stats.hot}</td>
                          <td className="text-center py-2">{stats.ice}</td>
                          <td className="text-center py-2 font-medium">{stats.total}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
              <h2 className="text-lg font-bold mb-3">인기 메뉴 TOP 5</h2>
              <div className="space-y-3">
                {menuStats.slice(0, 5).map((stat, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors duration-200"
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
          <div className="animate-fade-in">
            {/* 상단 헤더 (페이지 제목 / Datepicker) */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">일간 리포트</h2>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-200"
              />
            </div>

            {/* 1) 카테고리별 판매 현황 */}
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100 mb-6">
              <h3 className="font-bold mb-3">카테고리별 판매 현황</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {categories.map((c) => {
                  const stat = menuStats.filter((r) => r.category === c.name);
                  const count = stat.reduce((sum, r) => sum + r.count, 0);
                  const revenue = stat.reduce((sum, r) => sum + r.revenue, 0);
                  return (
                    <div key={c.id} className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-all duration-200 border border-gray-200">
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

            {/* 2) 판매 내역 관리 */}
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold">판매 내역 관리</h3>
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
                >
                  <Download className="w-4 h-4" /> CSV 내보내기
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-2 px-3 whitespace-nowrap">생성일시</th>
                      <th className="text-left py-2 px-3">메뉴</th>
                      <th className="text-center py-2 px-3 whitespace-nowrap">온도</th>
                      <th className="text-center py-2 px-3 whitespace-nowrap">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedSales.map((s) => {
                      const menu = menuIdToMenu[s.menu_id];
                      const name = menu?.name ?? s.menu_id;
                      return (
                        <tr key={`${s.id}-${s.sold_at}`} className="border-b hover:bg-gray-50 transition-colors duration-200">
                          <td className="py-2 px-3 whitespace-nowrap">{formatDateTimeYYMMDDHHmmSS(s.sold_at)}</td>
                          <td className="py-2 px-3 truncate max-w-[10rem] sm:max-w-none">{name}</td>
                          <td className="text-center py-2 px-3 whitespace-nowrap">{s.temperature === "hot" ? "HOT" : "ICE"}</td>
                          <td className="text-center py-2 px-3 whitespace-nowrap">
                            <button
                              onClick={() => handleDeleteSale(s.id)}
                              className="px-3 py-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-sm hover:shadow-md"
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
              {/* Pagination */}
              <div className="flex items-center justify-center gap-2 mt-3">
                <button onClick={() => setReportPage(1)} disabled={reportPage === 1} className="px-2 py-1 text-xs rounded border disabled:opacity-40">처음</button>
                <button onClick={() => setReportPage((p) => Math.max(1, p - 1))} disabled={reportPage === 1} className="px-2 py-1 text-xs rounded border disabled:opacity-40">이전</button>
                <span className="text-xs text-gray-600">{reportPage} / {totalReportPages}</span>
                <button onClick={() => setReportPage((p) => Math.min(totalReportPages, p + 1))} disabled={reportPage === totalReportPages} className="px-2 py-1 text-xs rounded border disabled:opacity-40">다음</button>
                <button onClick={() => setReportPage(totalReportPages)} disabled={reportPage === totalReportPages} className="px-2 py-1 text-xs rounded border disabled:opacity-40">마지막</button>
              </div>
            </div>

            {/* 3) 메뉴별 상세 판매 내역 */}
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
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
                      <tr key={index} className="border-b hover:bg-gray-50 transition-colors duration-200">
                        <td className="py-2 px-3">{stat.category}</td>
                        <td className="py-2 px-3 font-medium">{stat.menuName}</td>
                        <td className="text-center py-2 px-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${stat.temperature === "hot" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                            {stat.temperature === "hot" ? "HOT" : "ICE"}
                          </span>
                        </td>
                        <td className="text-center py-2 px-3">{stat.count}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-bold">
                      <td colSpan={3} className="py-2 px-3">합계</td>
                      <td className="text-center py-2 px-3">{todayCount}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 하단 네비게이션 바 */}
      {authReady && (
        <nav className="fixed bottom-0 inset-x-0 bg-white border-t shadow-sm">
          <div className="max-w-4xl mx-auto grid grid-cols-3">
            <button
              onClick={() => setViewMode("report")}
              className={`flex flex-col items-center gap-1 py-2.5 text-xs font-medium ${
                viewMode === "report" ? "text-amber-600" : "text-gray-600"
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span>리포트</span>
            </button>
            <button
              onClick={() => setViewMode("input")}
              className={`flex flex-col items-center gap-1 py-2.5 text-xs font-medium ${
                viewMode === "input" ? "text-amber-600" : "text-gray-600"
              }`}
            >
              <Coffee className="w-5 h-5" />
              <span>입력</span>
            </button>
            <button
              onClick={() => setViewMode("dashboard")}
              className={`flex flex-col items-center gap-1 py-2.5 text-xs font-medium ${
                viewMode === "dashboard" ? "text-amber-600" : "text-gray-600"
              }`}
            >
              <TrendingUp className="w-5 h-5" />
              <span>현황</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
