"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { InventoryRow, TransactionType } from "@/lib/types";

const inboundReasons = ["생산 입고", "반품 입고", "재고 이동", "기타"];
const outboundReasons = ["판매 출고", "샘플 출고", "불량/폐기", "재고 이동", "기타"];

export function StockMovementDialog({ row, type, open, onClose, onCompleted }: { row: InventoryRow | null; type: TransactionType; open: boolean; onClose: () => void; onCompleted: () => void }) {
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inbound = type === "inbound";

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setQuantity(""); setReason(""); setMemo(""); setError("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, type]);

  if (!open || !row) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = Number(quantity);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setError("수량은 1 이상의 정수로 입력해 주세요.");
      return;
    }
    if (!inbound && parsed > row!.quantity) {
      setError(`현재고 ${row!.quantity}개보다 많이 출고할 수 없습니다.`);
      return;
    }
    setLoading(true); setError("");
    const { error: rpcError } = await supabase.rpc("register_inventory_transaction", {
      p_variant_id: row!.id,
      p_transaction_type: type,
      p_quantity: parsed,
      p_reason: reason,
      p_memo: memo || null,
    });
    if (rpcError) {
      setError(rpcError.message.includes("Insufficient stock") ? "출고 가능한 재고가 부족합니다. 새로고침 후 확인해 주세요." : rpcError.message);
      setLoading(false);
      return;
    }
    setLoading(false);
    onCompleted();
    onClose();
  }

  const nextQuantity = row.quantity + (inbound ? 1 : -1) * (Number(quantity) || 0);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="movement-title">
        <div className="modal-header">
          <span className={`movement-icon ${inbound ? "inbound" : "outbound"}`}>{inbound ? <ArrowDownToLine /> : <ArrowUpFromLine />}</span>
          <div><p className="eyebrow">STOCK MOVEMENT</p><h2 id="movement-title">{inbound ? "입고 등록" : "출고 등록"}</h2></div>
          <button className="icon-button modal-close" onClick={onClose} aria-label="닫기"><X size={21} /></button>
        </div>
        <div className="movement-product">
          <div><strong>{row.product.name}</strong><span>{row.product.product_code} · {row.color_name} / {row.size}</span></div>
          <code>{row.sku}</code>
        </div>
        <form onSubmit={submit} className="modal-form">
          <label className="field"><span>수량</span><input className="quantity-input" type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" autoFocus required /></label>
          <div className="stock-calculation">
            <span>현재고 <strong>{row.quantity}</strong></span><span>→</span><span>반영 후 <strong className={nextQuantity < 0 ? "danger" : ""}>{nextQuantity}</strong></span>
          </div>
          <label className="field"><span>사유</span><select value={reason} onChange={(e) => setReason(e.target.value)} required><option value="">사유 선택</option>{(inbound ? inboundReasons : outboundReasons).map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="field"><span>메모 <small>선택</small></span><textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="거래처, 주문번호 등 참고사항" rows={3} /></label>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>취소</button><button className={`button ${inbound ? "button-primary" : "button-dark"}`} disabled={loading}>{loading ? "저장 중..." : `${inbound ? "입고" : "출고"} 확정`}</button></div>
        </form>
      </div>
    </div>
  );
}
