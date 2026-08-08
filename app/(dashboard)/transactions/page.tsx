"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, ClipboardList, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageLoading } from "@/components/page-loading";
import { ProductThumb } from "@/components/product-thumb";
import { supabase } from "@/lib/supabase/client";
import type { InventoryTransaction, Product, Variant } from "@/lib/types";

type JoinedTransaction = InventoryTransaction & { variant: Variant & { product: Product } };

function formatDate(value: string) {
  const date = new Date(value);
  return { date: new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date), time: new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(date) };
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<JoinedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | "inbound" | "outbound">("all");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    const { data, error: queryError } = await supabase.from("inventory_transactions").select("*, variant:variants(*, product:products(*))").order("created_at", { ascending: false }).limit(500);
    if (queryError) setError(queryError.message);
    else setTransactions((data ?? []) as unknown as JoinedTransaction[]);
    setLoading(false);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return transactions.filter((tx) => {
      const product = tx.variant.product;
      const searchMatch = !term || [product.name, product.product_code, tx.variant.sku, tx.reason, tx.memo ?? ""].some((value) => value.toLocaleLowerCase().includes(term));
      return searchMatch && (type === "all" || tx.transaction_type === type);
    });
  }, [transactions, query, type]);

  return (
    <div className="page-stack">
      <header className="page-header"><div><p className="eyebrow">MOVEMENT LEDGER</p><h1>입출고 이력</h1><p>모든 재고 변동이 시간순으로 기록됩니다.</p></div></header>
      <section className="panel inventory-panel">
        <div className="inventory-toolbar"><div className="search-box"><Search size={19} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="상품명, 품번, SKU, 사유 검색" /></div><div className="filter-group">{([['all', '전체'], ['inbound', '입고'], ['outbound', '출고']] as const).map(([value, label]) => <button key={value} className={type === value ? "active" : ""} onClick={() => setType(value)}>{label}</button>)}</div></div>
        {loading ? <PageLoading /> : error ? <div className="inline-error"><strong>이력을 불러오지 못했습니다.</strong><p>{error}</p><button className="button button-secondary" onClick={load}>다시 시도</button></div> : filtered.length === 0 ? <EmptyState icon={ClipboardList} title="표시할 입출고 이력이 없습니다" description={transactions.length ? "검색어나 유형 필터를 바꿔보세요." : "입고 또는 출고를 등록하면 이곳에 기록됩니다."} /> : (
          <div className="table-scroll"><table className="inventory-table transactions-table"><thead><tr><th>일시</th><th>유형</th><th>상품</th><th>옵션 / SKU</th><th>사유 / 메모</th><th>수량</th><th>반영 후</th></tr></thead><tbody>{filtered.map((tx) => { const formatted = formatDate(tx.created_at); const inbound = tx.transaction_type === "inbound"; return <tr key={tx.id}><td data-label="일시"><span className="date-cell"><strong>{formatted.date}</strong><small>{formatted.time}</small></span></td><td data-label="유형"><span className={`movement-type ${tx.transaction_type}`}>{inbound ? <ArrowDownToLine size={15} /> : <ArrowUpFromLine size={15} />}{inbound ? "입고" : "출고"}</span></td><td data-label="상품"><div className="product-cell"><ProductThumb path={tx.variant.color_image_path || tx.variant.product.main_image_path} alt={tx.variant.product.name} size="small" /><span><strong>{tx.variant.product.name}</strong><small>{tx.variant.product.product_code}</small></span></div></td><td data-label="옵션"><span className="option-and-sku"><strong>{tx.variant.color_name} / {tx.variant.size}</strong><code>{tx.variant.sku}</code></span></td><td data-label="사유"><span className="reason-cell"><strong>{tx.reason}</strong><small>{tx.memo || "—"}</small></span></td><td data-label="수량"><strong className={tx.transaction_type}>{inbound ? "+" : "−"}{tx.quantity}</strong></td><td data-label="반영 후"><strong>{tx.resulting_quantity}</strong><small className="stock-unit">개</small></td></tr>; })}</tbody></table></div>
        )}
        {!loading && filtered.length > 0 && <footer className="panel-footer">최근 기록 <strong>{filtered.length}</strong>건</footer>}
      </section>
    </div>
  );
}
