"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, ChevronRight, PackagePlus, Search, SlidersHorizontal } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageLoading } from "@/components/page-loading";
import { ProductThumb } from "@/components/product-thumb";
import { StockMovementDialog } from "@/components/stock-movement-dialog";
import { supabase } from "@/lib/supabase/client";
import type { InventoryRow, TransactionType } from "@/lib/types";

type StockFilter = "all" | "low" | "out";

function normalizeVariant(raw: Record<string, unknown>): InventoryRow {
  const inventoryValue = Array.isArray(raw.inventory) ? raw.inventory[0] : raw.inventory;
  const inventory = inventoryValue as { quantity?: number } | null;
  const productValue = Array.isArray(raw.product) ? raw.product[0] : raw.product;
  return { ...raw, product: productValue, quantity: inventory?.quantity ?? 0 } as InventoryRow;
}

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StockFilter>("all");
  const [dialog, setDialog] = useState<{ row: InventoryRow; type: TransactionType } | null>(null);

  const loadInventory = useCallback(async () => {
    setLoading(true); setError("");
    const { data, error: queryError } = await supabase
      .from("variants")
      .select("*, product:products(*), inventory(quantity, updated_at)")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (queryError) setError(queryError.message);
    else setRows((data ?? []).map((item) => normalizeVariant(item as Record<string, unknown>)));
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadInventory(), 0);
    return () => window.clearTimeout(timer);
  }, [loadInventory]);

  const totals = useMemo(() => ({
    sku: rows.length,
    units: rows.reduce((sum, row) => sum + row.quantity, 0),
    low: rows.filter((row) => row.quantity > 0 && row.quantity <= row.product.low_stock_threshold).length,
    out: rows.filter((row) => row.quantity === 0).length,
  }), [rows]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !term || [row.product.name, row.product.product_code, row.sku, row.color_name, row.size, row.product.category ?? ""].some((value) => value.toLocaleLowerCase().includes(term));
      const matchesStock = filter === "all" || (filter === "out" ? row.quantity === 0 : row.quantity > 0 && row.quantity <= row.product.low_stock_threshold);
      return matchesSearch && matchesStock;
    });
  }, [rows, query, filter]);

  const status = (row: InventoryRow) => row.quantity === 0 ? "out" : row.quantity <= row.product.low_stock_threshold ? "low" : "normal";

  return (
    <div className="page-stack">
      <header className="page-header">
        <div><p className="eyebrow">INVENTORY OVERVIEW</p><h1>재고 현황</h1><p>모든 상품의 SKU별 현재고를 한눈에 확인하세요.</p></div>
        <Link href="/products/new" className="button button-primary"><PackagePlus size={18} />상품 등록</Link>
      </header>

      <section className="metric-grid">
        <article className="metric-card"><span className="metric-icon blue"><Boxes size={20} /></span><div><p>전체 SKU</p><strong>{totals.sku.toLocaleString()}</strong><small>개</small></div></article>
        <article className="metric-card"><span className="metric-icon ink"><Boxes size={20} /></span><div><p>총 재고</p><strong>{totals.units.toLocaleString()}</strong><small>개</small></div></article>
        <article className="metric-card"><span className="metric-icon amber"><AlertTriangle size={20} /></span><div><p>저재고</p><strong>{totals.low.toLocaleString()}</strong><small>SKU</small></div></article>
        <article className="metric-card"><span className="metric-icon red"><AlertTriangle size={20} /></span><div><p>품절</p><strong>{totals.out.toLocaleString()}</strong><small>SKU</small></div></article>
      </section>

      <section className="panel inventory-panel">
        <div className="inventory-toolbar">
          <div className="search-box"><Search size={19} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="상품명, 품번, SKU 검색" /><kbd>⌘ K</kbd></div>
          <div className="filter-group" aria-label="재고 필터">
            <SlidersHorizontal size={17} />
            {([['all', '전체'], ['low', '저재고'], ['out', '품절']] as const).map(([value, label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}
          </div>
        </div>

        {loading ? <PageLoading /> : error ? <div className="inline-error"><strong>재고를 불러오지 못했습니다.</strong><p>{error}</p><button className="button button-secondary" onClick={loadInventory}>다시 시도</button></div> : filtered.length === 0 ? (
          <EmptyState icon={Boxes} title={rows.length ? "검색 결과가 없습니다" : "등록된 상품이 없습니다"} description={rows.length ? "검색어나 재고 필터를 바꿔보세요." : "첫 상품과 컬러·사이즈 SKU를 등록해 보세요."} action={!rows.length && <Link href="/products/new" className="button button-primary">첫 상품 등록</Link>} />
        ) : (
          <div className="table-scroll">
            <table className="inventory-table">
              <thead><tr><th>상품</th><th>컬러 / 사이즈</th><th>SKU</th><th>현재고</th><th>상태</th><th><span className="sr-only">작업</span></th></tr></thead>
              <tbody>
                {filtered.map((row) => {
                  const stockStatus = status(row);
                  return (
                    <tr key={row.id}>
                      <td data-label="상품"><Link href={`/products/detail?id=${row.product.id}`} className="product-cell"><ProductThumb path={row.color_image_path || row.product.main_image_path} alt={row.product.name} /><span><strong>{row.product.name}</strong><small>{row.product.product_code}{row.product.category ? ` · ${row.product.category}` : ""}</small></span></Link></td>
                      <td data-label="옵션"><span className="option-cell">{row.color_code && <i style={{ backgroundColor: row.color_code }} />}{row.color_name}<b>/</b>{row.size}</span></td>
                      <td data-label="SKU"><code className="sku-code">{row.sku}</code></td>
                      <td data-label="현재고"><strong className={`stock-number ${stockStatus}`}>{row.quantity.toLocaleString()}</strong><small className="stock-unit">개</small></td>
                      <td data-label="상태"><span className={`stock-badge ${stockStatus}`}>{stockStatus === "out" ? "품절" : stockStatus === "low" ? "저재고" : "정상"}</span></td>
                      <td className="row-actions"><button className="table-action inbound" onClick={() => setDialog({ row, type: "inbound" })}><ArrowDownToLine size={16} />입고</button><button className="table-action outbound" onClick={() => setDialog({ row, type: "outbound" })}><ArrowUpFromLine size={16} />출고</button><Link href={`/products/detail?id=${row.product.id}`} className="icon-button" aria-label="상품 상세"><ChevronRight size={19} /></Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filtered.length > 0 && <footer className="panel-footer">총 <strong>{filtered.length}</strong>개 SKU</footer>}
      </section>
      <StockMovementDialog row={dialog?.row ?? null} type={dialog?.type ?? "inbound"} open={Boolean(dialog)} onClose={() => setDialog(null)} onCompleted={loadInventory} />
    </div>
  );
}
