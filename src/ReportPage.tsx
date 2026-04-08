// src/ReportPage.tsx  ── Complete replacement ────────────────────────────────
import React, { useEffect, useState, useCallback } from "react";
import { db } from "./firebase";
import { useLanguage } from "./App";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  limit,
} from "firebase/firestore";
import {
  LayoutDashboard,
  Download,
  FileText,
  Calendar,
  RefreshCw,
  ShoppingBag,
  Wifi,
  WifiOff,
  DollarSign,
  AlertCircle,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface OrderItem {
  name: { en?: string; ar?: string } | string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  orderId: string;
  items: OrderItem[] | any;
  amount: number;
  source: string;
  date: Timestamp | Date | string | any;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const toDate = (raw: any): Date => {
  if (!raw) return new Date();
  if (typeof raw?.toDate === "function") return raw.toDate();       // Firestore Timestamp
  if (raw instanceof Date) return raw;
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

const safeItemName = (item: any, lang: string): string => {
  if (!item) return "";
  if (typeof item.name === "object" && item.name !== null) {
    return item.name[lang] || item.name.en || item.name.ar || "";
  }
  return String(item.name || "");
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function ReportPage() {
  const { language, t } = useLanguage();
  const isAr = language === "ar";

  const [orders, setOrders] = useState<Order[]>([]);
  const [range, setRange] = useState<"daily" | "weekly">("weekly");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Date helpers ────────────────────────────────────────────────────────────
  const getDateRange = useCallback(() => {
    const now = new Date();
    const start = new Date();
    if (range === "daily") {
      start.setHours(0, 0, 0, 0);
    } else {
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    }
    return { start, end: now };
  }, [range]);

  const getRangeLabel = (): string => {
    const { start } = getDateRange();
    const fmt = (d: Date) =>
      d.toLocaleDateString(isAr ? "ar-SA" : "en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    return range === "daily"
      ? fmt(new Date())
      : `${fmt(start)} – ${fmt(new Date())}`;
  };

  // ── Fetch orders ────────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { start } = getDateRange();
      const startTs = Timestamp.fromDate(start);

      // ✅ FIX: Use only a single orderBy to avoid requiring a composite index.
      // Firestore requires a composite index for (where field) + (orderBy different field).
      // Using orderBy("date") on the same field we filter by avoids the index error.
      const q = query(
        collection(db, "orders"),
        where("date", ">=", startTs),
        orderBy("date", "desc"),
        limit(1000)
      );

      const snap = await getDocs(q);
      const fetched: Order[] = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as Order)
      );
      setOrders(fetched);
    } catch (err: any) {
      console.error("ReportPage fetchOrders error:", err);

      // ✅ Provide actionable error messages
      if (err?.code === "failed-precondition" || err?.message?.includes("index")) {
        setError(
          isAr
            ? "يلزم إنشاء فهرس في Firebase. انظر وحدة التحكم للحصول على الرابط."
            : "A Firestore index is required. Check your browser console for the link to create it, then refresh."
        );
      } else if (err?.code === "permission-denied") {
        setError(
          isAr
            ? "ليس لديك صلاحية لعرض الطلبات. تأكد من تسجيل الدخول كمسؤول."
            : "Permission denied. Make sure you are logged in as an admin."
        );
      } else {
        setError(err?.message || (isAr ? "فشل في جلب الطلبات." : "Failed to fetch orders."));
      }
    } finally {
      setLoading(false);
    }
  }, [range, getDateRange, isAr]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // ── Stats ───────────────────────────────────────────────────────────────────
  const stats = React.useMemo(() => {
    const totalRevenue = orders.reduce((s, o) => s + (Number(o.amount) || 0), 0);
    const online = orders.filter(
      (o) => (o.source || "").toLowerCase() === "online"
    ).length;
    const offline = orders.filter(
      (o) => (o.source || "").toLowerCase() === "offline"
    ).length;
    return { totalRevenue, online, offline };
  }, [orders]);

  const generatedAt = new Date().toLocaleString(isAr ? "ar-SA" : "en-GB");

  // ── CSV Download ────────────────────────────────────────────────────────────
  const downloadCSV = () => {
    try {
      const headers = isAr
        ? ["#", "رقم الطلب", "الأصناف", "التاريخ", "الوقت", "المبلغ (ر.س)", "المصدر"]
        : ["#", "Order ID", "Items", "Date", "Time", "Amount (SAR)", "Source"];

      const rows = orders.map((o, i) => {
        const d = toDate(o.date);

        // ✅ FIX: Safely handle items whether array or stringified JSON
        let itemsList = "";
        try {
          const itemsArr = Array.isArray(o.items)
            ? o.items
            : typeof o.items === "string"
            ? JSON.parse(o.items)
            : [];
          itemsList = itemsArr
            .map(
              (item: any) =>
                `${safeItemName(item, language)} x${item?.quantity ?? 0}`
            )
            .join(" | ");
        } catch {
          itemsList = String(o.items || "");
        }

        const esc = (val: any) =>
          `"${String(val ?? "").replace(/"/g, '""')}"`;

        return [
          esc(i + 1),
          esc(o.orderId || o.id),
          esc(itemsList),
          esc(d.toLocaleDateString(isAr ? "ar-SA" : "en-GB")),
          esc(
            d.toLocaleTimeString(isAr ? "ar-SA" : "en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })
          ),
          esc((Number(o.amount) || 0).toFixed(2)),
          esc(o.source || ""),
        ];
      });

      // Summary rows at the bottom
      const sep = ["", "", "", "", "", "", ""];
      const summaryRows = [
        sep,
        isAr
          ? ["", "", "", "", "إجمالي الطلبات", String(orders.length), ""]
          : ["", "", "", "", "Total Orders", String(orders.length), ""],
        isAr
          ? ["", "", "", "", "أونلاين", String(stats.online), ""]
          : ["", "", "", "", "Online", String(stats.online), ""],
        isAr
          ? ["", "", "", "", "أوفلاين", String(stats.offline), ""]
          : ["", "", "", "", "Offline", String(stats.offline), ""],
        isAr
          ? ["", "", "", "", "الإيرادات", `${stats.totalRevenue.toFixed(2)} ر.س`, ""]
          : ["", "", "", "", "Revenue", `SAR ${stats.totalRevenue.toFixed(2)}`, ""],
      ].map((r) => r.map((v) => `"${v}"`));

      const allRows = [headers.map((h) => `"${h}"`), ...rows, ...summaryRows];
      const csv = allRows.map((r) => r.join(",")).join("\n");

      // ✅ BOM for correct Arabic/UTF-8 rendering in Excel
      const blob = new Blob(["\ufeff" + csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mud-report-${range}-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url); // ✅ Always revoke to prevent memory leaks
    } catch (err: any) {
      console.error("CSV download error:", err);
      alert(
        isAr
          ? "فشل تحميل الملف. حاول مرة أخرى."
          : "Failed to generate CSV. Please try again."
      );
    }
  };

  // ── PDF Download (print) ────────────────────────────────────────────────────
  const downloadPDF = () => {
    window.print();
  };

  // ── UI ──────────────────────────────────────────────────────────────────────
  const cardClass =
    "bg-white rounded-2xl border border-[#8B1A1A]/20 p-6 flex flex-col items-center gap-2 shadow-sm";

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className="min-h-screen bg-[#F5F0E8] font-sans"
    >
      {/* ── Header ── */}
      <header className="bg-[#8B1A1A] text-white px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <LayoutDashboard size={22} />
            <h1 className="text-2xl font-bold tracking-wide">
              {isAr ? "تقرير المبيعات الأسبوعي" : "Weekly Sales Report"}
            </h1>
          </div>
          <p className="text-white/70 text-sm mt-1">{getRangeLabel()}</p>
          <p className="text-white/50 text-xs mt-1">
            {isAr ? "تم الإنشاء:" : "Generated:"} {generatedAt}
          </p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* ── Range Tabs + Download Buttons ── */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setRange("daily")}
              className={`flex-1 py-2 rounded-xl font-semibold text-sm border-2 transition-all ${
                range === "daily"
                  ? "bg-[#8B1A1A] text-white border-[#8B1A1A]"
                  : "bg-white text-[#8B1A1A] border-[#8B1A1A]"
              }`}
            >
              {isAr ? "يومي" : "Daily"}
            </button>
            <button
              onClick={() => setRange("weekly")}
              className={`flex-1 py-2 rounded-xl font-semibold text-sm border-2 transition-all ${
                range === "weekly"
                  ? "bg-[#8B1A1A] text-white border-[#8B1A1A]"
                  : "bg-white text-[#8B1A1A] border-[#8B1A1A]"
              }`}
            >
              {isAr ? "أسبوعي" : "Weekly"}
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={downloadCSV}
              disabled={loading || orders.length === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#2E7D32] text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              <Download size={16} />
              {isAr ? "تحميل CSV" : "Download CSV"}
            </button>
            <button
              onClick={downloadPDF}
              disabled={loading || orders.length === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#1565C0] text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              <FileText size={16} />
              {isAr ? "تحميل PDF" : "Download PDF"}
            </button>
          </div>
        </div>

        {/* ── Error Banner ── */}
        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold mb-0.5">
                {isAr ? "خطأ في جلب البيانات" : "Error loading data"}
              </p>
              <p>{error}</p>
              <button
                onClick={fetchOrders}
                className="mt-2 flex items-center gap-1 text-red-600 underline text-xs"
              >
                <RefreshCw size={12} />
                {isAr ? "إعادة المحاولة" : "Retry"}
              </button>
            </div>
          </div>
        )}

        {/* ── Stat Cards ── */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-[#8B1A1A]/10 p-6 h-28 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className={`${cardClass} col-span-2`}>
              <ShoppingBag size={20} className="text-[#8B1A1A]/60" />
              <p className="text-xs uppercase tracking-widest text-[#8B1A1A]/60">
                {isAr ? "إجمالي الطلبات" : "Total Orders"}
              </p>
              <p className="text-4xl font-bold text-[#8B1A1A]">
                {orders.length}
              </p>
            </div>

            <div className={cardClass}>
              <Wifi size={18} className="text-[#8B1A1A]/60" />
              <p className="text-xs uppercase tracking-widest text-[#8B1A1A]/60">
                {isAr ? "أونلاين" : "Online"}
              </p>
              <p className="text-3xl font-bold text-[#8B1A1A]">
                {stats.online}
              </p>
            </div>

            <div className={cardClass}>
              <WifiOff size={18} className="text-[#8B1A1A]/60" />
              <p className="text-xs uppercase tracking-widest text-[#8B1A1A]/60">
                {isAr ? "أوفلاين" : "Offline"}
              </p>
              <p className="text-3xl font-bold text-[#8B1A1A]">
                {stats.offline}
              </p>
            </div>

            <div className={`${cardClass} col-span-2`}>
              <DollarSign size={20} className="text-[#8B1A1A]/60" />
              <p className="text-xs uppercase tracking-widest text-[#8B1A1A]/60">
                {isAr ? "إجمالي الإيرادات" : "Total Revenue"}
              </p>
              <p className="text-3xl font-bold text-[#8B1A1A]">
                {isAr
                  ? `${stats.totalRevenue.toFixed(2)} ر.س`
                  : `SAR ${stats.totalRevenue.toFixed(2)}`}
              </p>
            </div>
          </div>
        )}

        {/* ── Orders Table ── */}
        {!loading && !error && orders.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#8B1A1A]/20 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-[#8B1A1A]/10 flex items-center gap-2">
              <Calendar size={16} className="text-[#8B1A1A]/60" />
              <h2 className="font-semibold text-sm text-[#8B1A1A]">
                {isAr ? "تفاصيل الطلبات" : "Order Details"}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#8B1A1A]/5 text-[#8B1A1A]/70 text-xs uppercase">
                    <th className="px-4 py-2 text-start">{isAr ? "رقم" : "ID"}</th>
                    <th className="px-4 py-2 text-start">{isAr ? "الأصناف" : "Items"}</th>
                    <th className="px-4 py-2 text-start">{isAr ? "المبلغ" : "Amount"}</th>
                    <th className="px-4 py-2 text-start">{isAr ? "المصدر" : "Source"}</th>
                    <th className="px-4 py-2 text-start">{isAr ? "التاريخ" : "Date"}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o, idx) => {
                    const d = toDate(o.date);
                    let itemsDisplay = "";
                    try {
                      const arr = Array.isArray(o.items)
                        ? o.items
                        : JSON.parse(o.items);
                      itemsDisplay = arr
                        .map(
                          (item: any) =>
                            `${safeItemName(item, language)} ×${item?.quantity ?? 0}`
                        )
                        .join(", ");
                    } catch {
                      itemsDisplay = String(o.items || "");
                    }

                    return (
                      <tr
                        key={o.id}
                        className={`border-t border-[#8B1A1A]/5 ${
                          idx % 2 === 0 ? "bg-white" : "bg-[#8B1A1A]/[0.02]"
                        }`}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-[#8B1A1A]/60">
                          #{o.orderId || o.id}
                        </td>
                        <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">
                          {itemsDisplay}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#8B1A1A]">
                          {(Number(o.amount) || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              (o.source || "").toLowerCase() === "online"
                                ? "bg-green-100 text-green-700"
                                : "bg-orange-100 text-orange-700"
                            }`}
                          >
                            {o.source}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {d.toLocaleDateString(isAr ? "ar-SA" : "en-GB", {
                            day: "numeric",
                            month: "short",
                          })}{" "}
                          {d.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Empty State ── */}
        {!loading && !error && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-[#8B1A1A]/40">
            <ShoppingBag size={48} strokeWidth={1} />
            <p className="text-sm font-medium">
              {isAr
                ? "لا توجد طلبات في هذه الفترة"
                : "No orders in this period"}
            </p>
            <button
              onClick={fetchOrders}
              className="flex items-center gap-1.5 text-xs text-[#8B1A1A]/60 border border-[#8B1A1A]/20 px-3 py-1.5 rounded-lg"
            >
              <RefreshCw size={12} />
              {isAr ? "تحديث" : "Refresh"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
