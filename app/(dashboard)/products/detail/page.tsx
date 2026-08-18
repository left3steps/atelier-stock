"use client";

import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowLeft, ArrowUpFromLine, Camera, CheckCircle2, Clock3, Handshake } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageLoading } from "@/components/page-loading";
import { ProductThumb } from "@/components/product-thumb";
import { StockMovementDialog } from "@/components/stock-movement-dialog";
import { supabase } from "@/lib/supabase/client";
import { uploadProductImage } from "@/lib/supabase/images";
import type { InventoryRow, InventoryTransaction, Product, TransactionType } from "@/lib/types";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

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
  const [rentalSaving, setRentalSaving] = useState(false);
  const [rentalError, setRentalError] = useState("");
  const [imageSavingKey, setImageSavingKey] = useState<string | null>(null);
  const [imageError, setImageError] = useState("");
  const [imageSuccess, setImageSuccess] = useState("");
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

  async function toggleRental() {
    if (!product || rentalSaving) return;
    const nextRentalState = !product.is_rented;
    setRentalSaving(true);
    setRentalError("");
    const { data, error: updateError } = await supabase
      .from("products")
      .update({
        is_rented: nextRentalState,
        rented_at: nextRentalState ? new Date().toISOString() : null,
      })
      .eq("id", product.id)
      .select()
      .single();

    if (updateError) setRentalError("대여 상태를 변경하지 못했습니다. 다시 시도해 주세요.");
    else setProduct(data as Product);
    setRentalSaving(false);
  }

  function validateImage(file: File) {
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) return "JPG, PNG, WEBP 또는 AVIF 이미지로 선택해 주세요.";
    if (file.size > MAX_IMAGE_SIZE) return "이미지 크기는 10MB 이하로 선택해 주세요.";
    return "";
  }

  async function replaceMainImage(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!product || !file || imageSavingKey) return;

    const validationError = validateImage(file);
    if (validationError) {
      setImageError(validationError);
      input.value = "";
      return;
    }

    setImageSavingKey("main");
    setImageError("");
    setImageSuccess("");

    try {
      const path = await uploadProductImage(file, `${product.id}/main`);
      const { data, error: updateError } = await supabase
        .from("products")
        .update({ main_image_path: path })
        .eq("id", product.id)
        .select()
        .single();
      if (updateError) throw updateError;

      const updatedProduct = data as Product;
      setProduct(updatedProduct);
      setRows((current) => current.map((row) => ({ ...row, product: updatedProduct })));
      setImageSuccess("대표 이미지가 변경되었습니다.");
    } catch (uploadError) {
      setImageError(uploadError instanceof Error ? uploadError.message : "대표 이미지를 변경하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      input.value = "";
      setImageSavingKey(null);
    }
  }

  async function replaceColorImage(color: string, colorRows: InventoryRow[], event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!product || !file || imageSavingKey) return;

    const validationError = validateImage(file);
    if (validationError) {
      setImageError(validationError);
      input.value = "";
      return;
    }

    const savingKey = `color:${color}`;
    const variantIds = colorRows.map((row) => row.id);
    setImageSavingKey(savingKey);
    setImageError("");
    setImageSuccess("");

    try {
      const path = await uploadProductImage(file, `${product.id}/colors`);
      const { error: updateError } = await supabase
        .from("variants")
        .update({ color_image_path: path })
        .in("id", variantIds);
      if (updateError) throw updateError;

      const updatedIds = new Set(variantIds);
      setRows((current) => current.map((row) => updatedIds.has(row.id) ? { ...row, color_image_path: path } : row));
      setImageSuccess(`${color} 컬러 이미지가 변경되었습니다.`);
    } catch (uploadError) {
      setImageError(uploadError instanceof Error ? uploadError.message : "컬러 이미지를 변경하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      input.value = "";
      setImageSavingKey(null);
    }
  }

  if (loading) return <PageLoading label="상품 정보를 불러오는 중" />;
  if (error || !product) return <div className="inline-error standalone"><strong>상품을 불러오지 못했습니다.</strong><p>{error}</p><Link href="/inventory" className="button button-secondary">재고 현황으로</Link></div>;

  return (
    <div className="page-stack">
      <header className="page-header detail-header">
        <div className="header-with-back"><Link href="/inventory" className="icon-button"><ArrowLeft size={20} /></Link><div><p className="eyebrow">PRODUCT DETAIL</p><h1>{product.name}</h1><p>{product.brand} · {product.product_code}{product.category ? ` · ${product.category}` : ""}</p></div></div>
        <button className={`button ${product.is_rented ? "button-rental-active" : "button-secondary"}`} onClick={toggleRental} disabled={rentalSaving}><Handshake size={17} />{rentalSaving ? "변경 중..." : product.is_rented ? "대여 종료" : "대여중으로 설정"}</button>
      </header>

      {rentalError && <p className="form-error rental-error">{rentalError}</p>}
      {imageError && <p className="form-error image-update-message">{imageError}</p>}
      {imageSuccess && <p className="form-success image-update-message"><CheckCircle2 size={15} />{imageSuccess}</p>}

      <section className="product-hero panel">
        <div className="product-image-editor">
          <ProductThumb path={product.main_image_path} alt={product.name} size="large" />
          <label className={`image-change-button ${imageSavingKey ? "is-disabled" : ""}`} aria-disabled={Boolean(imageSavingKey)}>
            <Camera size={15} />
            {imageSavingKey === "main" ? "업로드 중..." : product.main_image_path ? "대표 이미지 변경" : "대표 이미지 등록"}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={replaceMainImage} disabled={Boolean(imageSavingKey)} />
          </label>
        </div>
        <div className="product-hero-info"><div className="product-status-row"><span className="stock-badge normal">판매 중</span>{product.is_rented && <span className="rental-badge static"><Handshake size={12} />대여중</span>}</div><h2>{product.name}</h2><code>{product.product_code}</code><div className="product-facts"><span><small>브랜드</small><strong>{product.brand}</strong></span><span><small>카테고리</small><strong>{product.category || "미지정"}</strong></span><span><small>컬러</small><strong>{grouped.length}</strong></span><span><small>SKU</small><strong>{rows.length}</strong></span><span><small>총 재고</small><strong>{total.toLocaleString()}개</strong></span><span><small>대여 상태</small><strong>{product.is_rented ? "대여중" : "대여 가능"}</strong></span></div></div>
      </section>

      <section className="panel detail-section">
        <div className="panel-title"><div><p className="eyebrow">OPTIONS & STOCK</p><h2>컬러 · 사이즈별 재고</h2></div><p>저재고 기준: {product.low_stock_threshold}개 이하</p></div>
        <div className="color-groups">
          {grouped.map(([color, colorRows]) => (
            <article className="color-group" key={color}>
              <div className="color-group-header">
                <ProductThumb path={colorRows[0].color_image_path || product.main_image_path} alt={`${product.name} ${color}`} />
                <div className="color-group-copy"><span className="option-cell">{colorRows[0].color_code && <i style={{ backgroundColor: colorRows[0].color_code }} />}{color}</span><small>{colorRows.length}개 사이즈</small></div>
                <label className={`image-change-button compact ${imageSavingKey ? "is-disabled" : ""}`} aria-disabled={Boolean(imageSavingKey)}>
                  <Camera size={14} />
                  {imageSavingKey === `color:${color}` ? "업로드 중..." : "컬러 이미지 변경"}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => void replaceColorImage(color, colorRows, event)} disabled={Boolean(imageSavingKey)} />
                </label>
              </div>
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
