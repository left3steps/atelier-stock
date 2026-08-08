"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Boxes, PackagePlus, Search, SlidersHorizontal } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageLoading } from "@/components/page-loading";
import { ProductThumb } from "@/components/product-thumb";
import { supabase } from "@/lib/supabase/client";
import type { InventoryRow, Product } from "@/lib/types";

type StockFilter = "all" | "low" | "out";
type ProductStockStatus = "normal" | "low" | "out";

interface InventoryProduct {
  product: Product;
  rows: InventoryRow[];
  quantity: number;
  imagePath: string | null;
  status: ProductStockStatus;
}

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

  const products = useMemo<InventoryProduct[]>(() => {
    const grouped = new Map<string, InventoryRow[]>();

    rows.forEach((row) => {
      const productRows = grouped.get(row.product.id) ?? [];
      productRows.push(row);
      grouped.set(row.product.id, productRows);
    });

    return Array.from(grouped.values()).map((productRows) => {
      const product = productRows[0].product;
      const quantity = productRows.reduce((sum, row) => sum + row.quantity, 0);
      const status: ProductStockStatus = quantity === 0
        ? "out"
        : productRows.some((row) => row.quantity > 0 && row.quantity <= product.low_stock_threshold)
          ? "low"
          : "normal";

      return {
        product,
        rows: productRows,
        quantity,
        imagePath: product.main_image_path || productRows.find((row) => row.color_image_path)?.color_image_path || null,
        status,
      };
    });
  }, [rows]);

  const totals = useMemo(() => ({
    products: products.length,
    units: products.reduce((sum, product) => sum + product.quantity, 0),
    low: products.filter((product) => product.status === "low").length,
    out: products.filter((product) => product.status === "out").length,
  }), [products]);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return products.filter((item) => {
      const matchesSearch = !term || [
        item.product.name,
        item.product.product_code,
        item.product.category ?? "",
        ...item.rows.flatMap((row) => [row.sku, row.color_name, row.size]),
      ].some((value) => value.toLocaleLowerCase().includes(term));
      const matchesStock = filter === "all" || item.status === filter;
      return matchesSearch && matchesStock;
    });
  }, [products, query, filter]);

  return (
    <div className="page-stack">
      <header className="page-header">
        <div><p className="eyebrow">INVENTORY OVERVIEW</p><h1>재고 현황</h1><p>상품별 총재고를 빠르게 확인하고 상세 옵션으로 이동하세요.</p></div>
        <Link href="/products/new" className="button button-primary"><PackagePlus size={18} />상품 등록</Link>
      </header>

      <section className="metric-grid inventory-metrics">
        <article className="metric-card"><span className="metric-icon blue"><Boxes size={20} /></span><div><p>전체 상품</p><strong>{totals.products.toLocaleString()}</strong><small>개</small></div></article>
        <article className="metric-card"><span className="metric-icon ink"><Boxes size={20} /></span><div><p>총 재고</p><strong>{totals.units.toLocaleString()}</strong><small>개</small></div></article>
        <article className="metric-card"><span className="metric-icon amber"><AlertTriangle size={20} /></span><div><p>저재고 상품</p><strong>{totals.low.toLocaleString()}</strong><small>개</small></div></article>
        <article className="metric-card"><span className="metric-icon red"><AlertTriangle size={20} /></span><div><p>품절 상품</p><strong>{totals.out.toLocaleString()}</strong><small>개</small></div></article>
      </section>

      <section className="panel inventory-panel inventory-product-panel">
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
          <div className="inventory-product-grid">
            {filtered.map((item) => (
              <Link
                key={item.product.id}
                href={`/products/detail?id=${item.product.id}`}
                className="inventory-product-card"
                aria-label={`${item.product.product_code}, 재고 ${item.quantity.toLocaleString()}개`}
              >
                <div className="inventory-card-image">
                  <ProductThumb path={item.imagePath} alt={item.product.name} />
                  <span className={`stock-badge ${item.status}`}>{item.status === "out" ? "품절" : item.status === "low" ? "저재고" : "정상"}</span>
                </div>
                <div className="inventory-card-copy">
                  <strong title={item.product.product_code}>{item.product.product_code}</strong>
                  <span><small>재고</small><b className={item.status}>{item.quantity.toLocaleString()}</b><small>개</small></span>
                </div>
              </Link>
            ))}
          </div>
        )}
        {!loading && filtered.length > 0 && <footer className="panel-footer">총 <strong>{filtered.length}</strong>개 상품 · <strong>{filtered.reduce((sum, item) => sum + item.rows.length, 0)}</strong>개 SKU</footer>}
      </section>
    </div>
  );
}
