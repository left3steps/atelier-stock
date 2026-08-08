"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, Clock3 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageLoading } from "@/components/page-loading";
import { ProductThumb } from "@/components/product-thumb";
import { StockMovementDialog } from "@/components/stock-movement-dialog";
import { supabase } from "@/lib/supabase/client";
import type { InventoryRow, InventoryTransaction, Product, TransactionType } from "@/lib/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function ProductDetailPage() {
  const [id, setId] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<{ row: InventoryRow; type: TransactionType } | null>(null);

  useEffect(() => {
    const productId = new URLSearchParams(window.location.search).get("id") ?? "";
    const timer = window.setTimeout(() => {
      if (!productId) {
        setError("상품 ID가 없습니다.");
        setLoading(false);
        return;
      }
      setId(productId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError("");
    const [productResult, variantsResult] = await Promise.all([
      supabase.from("products").select("*").eq("id", id).single(),
      supabase.from("variants").select("*, inventory(quantity, updated_at)").eq("product_id", id).eq("is_active", true).order("sort_order"),
    ]);
    if (productResult.error || variantsResult.error) {
      setError(productResult.error?.message ?? variantsResult.error?.message ?? "상품을 불러오지 못했습니다.");
      setLoading(false); return;
    }
    const currentProduct = productResult.data as Product;
    const normalized = (variantsResult.data ?? []).map((raw) => {
      const value = Array.isArray(raw.inventory) ? raw.inventory[0] : raw.inventory;
      return { ...raw, product: currentProduct, quantity: (value as { quantity?: number } | null)?.quantity ?? 0 } as InventoryRow;
    });
    setProduct(currentProduct); setRows(normalized);
    const variantIds = normalized.map((row) => row.id);
    if (variantIds.length) {
      const txResult = await supabase.from("inventory_transactions").select("*").in("variant_id", variantIds).order("created_at", { ascending: false }).limit(12);
      if (!txResult.error) setTransactions(txResult.data as InventoryTransaction[]);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [id, load]);

  const grouped = useMemo(() => {
    const map = new Map<string, InventoryRow[]>();
    rows.forEach((row) => map.set(row.color_name, [...(map.get(row.color_name) ?? []), row]));
    return [...map.entries()];
  }, [rows]);
  const total = rows.reduce((sum, row) => sum + row.quantity, 0);

  if (loading) return <PageLoading label="상품 정보를 불러오는 중" />;
  if (error || !product) return <div className="inline-error standalone"><strong>상품을 불러오지 못했습니다.</strong><p>{error}</p><Link href="/inventory" className="button button-secondary">재고 현황으로</Link></div>;

  return (
    <div className="page-stack">
      <header className="page-header detail-header">
        <div className="header-with-back"><Link href="/inventory" className="icon-button"><ArrowLeft size={20} /></Link><div><p className="eyebrow">PRODUCT DETAIL</p><h1>{product.name}</h1><p>{product.brand} · {product.product_code}{product.category ? ` · ${product.category}` : ""}</p></div></div>
      </header>

      <section className="product-hero panel">
        <ProductThumb path={product.main_image_path} alt={product.name} size="large" />
        <div className="product-hero-info"><span className="stock-badge normal">판매 중</span><h2>{product.name}</h2><code>{product.product_code}</code><div className="product-facts"><span><small>브랜드</small><strong>{product.brand}</strong></span><span><small>카테고리</small><strong>{product.category || "미지정"}</strong></span><span><small>컬러</small><strong>{grouped.length}</strong></span><span><small>SKU</small><strong>{rows.length}</strong></span><span><small>총 재고</small><strong>{total.toLocaleString()}개</strong></span></div></div>
      </section>

      <section className="panel detail-section">
        <div className="panel-title"><div><p className="eyebrow">OPTIONS & STOCK</p><h2>컬러 · 사이즈별 재고</h2></div><p>저재고 기준: {product.low_stock_threshold}개 이하</p></div>
        <div className="color-groups">
          {grouped.map(([color, colorRows]) => (
            <article className="color-group" key={color}>
              <div className="color-group-header"><ProductThumb path={colorRows[0].color_image_path || product.main_image_path} alt={`${product.name} ${color}`} /><div><span className="option-cell">{colorRows[0].color_code && <i style={{ backgroundColor: colorRows[0].color_code }} />}{color}</span><small>{colorRows.length}개 사이즈</small></div></div>
              <div className="size-list">
                {colorRows.map((row) => {
                  const state = row.quantity === 0 ? "out" : row.quantity <= product.low_stock_threshold ? "low" : "normal";
                  return <div className="size-stock-row" key={row.id}><span className="size-chip">{row.size}</span><code>{row.sku}</code><strong className={`stock-number ${state}`}>{row.quantity}<small>개</small></strong><span className={`stock-badge ${state}`}>{state === "out" ? "품절" : state === "low" ? "저재고" : "정상"}</span><div className="row-actions"><button className="table-action inbound" onClick={() => setDialog({ row, type: "inbound" })}><ArrowDownToLine size={16} />입고</button><button className="table-action outbound" onClick={() => setDialog({ row, type: "outbound" })}><ArrowUpFromLine size={16} />출고</button></div></div>;
                })}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel detail-section">
        <div className="panel-title"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>최근 입출고 이력</h2></div><Link href="/transactions" className="text-link">전체 이력 보기</Link></div>
        {transactions.length === 0 ? <EmptyState icon={Clock3} title="아직 입출고 이력이 없습니다" description="SKU 옆의 입고 또는 출고 버튼으로 첫 기록을 남겨보세요." /> : (
          <div className="activity-list">{transactions.map((tx) => { const row = rows.find((item) => item.id === tx.variant_id); return <div className="activity-row" key={tx.id}><span className={`movement-icon small ${tx.transaction_type}`}>{tx.transaction_type === "inbound" ? <ArrowDownToLine /> : <ArrowUpFromLine />}</span><div className="activity-copy"><strong>{tx.reason}</strong><span>{row ? `${row.color_name} / ${row.size} · ${row.sku}` : "SKU"}{tx.memo ? ` · ${tx.memo}` : ""}</span></div><strong className={tx.transaction_type}>{tx.transaction_type === "inbound" ? "+" : "−"}{tx.quantity}</strong><small>{formatDate(tx.created_at)}</small></div>; })}</div>
        )}
      </section>
      <StockMovementDialog row={dialog?.row ?? null} type={dialog?.type ?? "inbound"} open={Boolean(dialog)} onClose={() => setDialog(null)} onCompleted={load} />
    </div>
  );
}
