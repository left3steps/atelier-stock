"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, Plus, Save, Trash2, X } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { uploadProductImage } from "@/lib/supabase/images";
import type { VariantDraft } from "@/lib/types";

function newVariant(): VariantDraft {
  return { key: crypto.randomUUID(), sku: "", color_name: "", color_code: "#1f2937", size: "", image_file: null, image_preview: null };
}

export default function NewProductPage() {
  const router = useRouter();
  const [productCode, setProductCode] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("YOUNHEEPARK");
  const [category, setCategory] = useState("");
  const [threshold, setThreshold] = useState("5");
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [mainPreview, setMainPreview] = useState<string | null>(null);
  const [variants, setVariants] = useState<VariantDraft[]>([newVariant()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const uniqueColors = useMemo(() => new Set(variants.map((v) => v.color_name.trim()).filter(Boolean)).size, [variants]);

  function selectMainImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setMainFile(file);
    setMainPreview(file ? URL.createObjectURL(file) : null);
  }

  function updateVariant(key: string, patch: Partial<VariantDraft>) {
    setVariants((current) => current.map((variant) => variant.key === key ? { ...variant, ...patch } : variant));
  }

  function selectVariantImage(key: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    updateVariant(key, { image_file: file, image_preview: file ? URL.createObjectURL(file) : null });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!brand.trim()) {
      setError("브랜드를 입력해 주세요.");
      return;
    }
    if (!variants.length || variants.some((v) => !v.sku.trim() || !v.color_name.trim() || !v.size.trim())) {
      setError("모든 SKU의 컬러, 사이즈, SKU 코드를 입력해 주세요.");
      return;
    }
    if (new Set(variants.map((v) => v.sku.trim().toLowerCase())).size !== variants.length) {
      setError("중복된 SKU 코드가 있습니다.");
      return;
    }
    setSaving(true);
    try {
      const { data: product, error: productError } = await supabase.from("products").insert({
        product_code: productCode.trim(), name: name.trim(), brand: brand.trim(), category: category.trim() || null,
        low_stock_threshold: Number(threshold),
      }).select().single();
      if (productError) throw productError;

      let mainPath: string | null = null;
      if (mainFile) {
        mainPath = await uploadProductImage(mainFile, `${product.id}/main`);
        const { error: imageUpdateError } = await supabase.from("products").update({ main_image_path: mainPath }).eq("id", product.id);
        if (imageUpdateError) throw imageUpdateError;
      }

      const colorImages = new Map<string, string>();
      for (const variant of variants) {
        const color = variant.color_name.trim().toLocaleLowerCase();
        if (!colorImages.has(color)) {
          const sameColorFile = variants.find((item) => item.color_name.trim().toLocaleLowerCase() === color && item.image_file)?.image_file;
          if (sameColorFile) colorImages.set(color, await uploadProductImage(sameColorFile, `${product.id}/colors`));
        }
      }

      const { error: variantsError } = await supabase.from("variants").insert(variants.map((variant, index) => ({
        product_id: product.id, sku: variant.sku.trim(), color_name: variant.color_name.trim(),
        color_code: variant.color_code || null, color_image_path: colorImages.get(variant.color_name.trim().toLocaleLowerCase()) ?? mainPath,
        size: variant.size.trim().toUpperCase(), sort_order: index,
      })));
      if (variantsError) throw variantsError;
      router.push(`/products/detail?id=${product.id}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "상품을 저장하지 못했습니다.";
      setError(message.includes("duplicate key") ? "이미 사용 중인 품번 또는 SKU가 있습니다." : message);
      setSaving(false);
    }
  }

  return (
    <div className="page-stack narrow-page">
      <header className="page-header detail-header">
        <div className="header-with-back"><Link href="/inventory" className="icon-button"><ArrowLeft size={20} /></Link><div><p className="eyebrow">NEW PRODUCT</p><h1>상품 등록</h1><p>기본 정보와 판매 가능한 모든 SKU를 등록하세요.</p></div></div>
      </header>
      <form onSubmit={submit} className="form-stack">
        <section className="panel form-section">
          <div className="section-heading"><span>01</span><div><h2>기본 정보</h2><p>상품을 구분하는 대표 정보를 입력합니다.</p></div></div>
          <div className="product-form-grid">
            <label className={`image-uploader ${mainPreview ? "has-image" : ""}`}>
              {mainPreview ? <><img src={mainPreview} alt="대표 이미지 미리보기" /><button type="button" className="remove-preview" onClick={(e) => { e.preventDefault(); setMainFile(null); setMainPreview(null); }}><X size={17} /></button></> : <><ImagePlus size={27} /><strong>대표 이미지</strong><span>JPG, PNG, WEBP · 최대 10MB</span></>}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={selectMainImage} />
            </label>
            <div className="form-fields-grid">
              <label className="field"><span>상품명 *</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: Classic Oxford Shirt" required /></label>
              <label className="field"><span>품번 *</span><input value={productCode} onChange={(e) => setProductCode(e.target.value)} placeholder="예: SH-2026-001" required /></label>
              <label className="field"><span>브랜드 *</span><input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="예: YOUNHEEPARK" list="brand-suggestions" required /><datalist id="brand-suggestions"><option value="YOUNHEEPARK" /><option value="KRISPY" /></datalist></label>
              <label className="field"><span>카테고리</span><input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="예: Shirts" /></label>
              <label className="field"><span>저재고 기준 *</span><div className="input-suffix"><input type="number" min="0" step="1" value={threshold} onChange={(e) => setThreshold(e.target.value)} required /><span>개 이하</span></div></label>
            </div>
          </div>
        </section>

        <section className="panel form-section">
          <div className="section-heading section-heading-row"><div className="heading-left"><span>02</span><div><h2>컬러 · 사이즈 SKU</h2><p>컬러별 이미지는 같은 컬러의 모든 사이즈에 자동 적용됩니다.</p></div></div><div className="variant-summary"><b>{uniqueColors}</b> 컬러 · <b>{variants.length}</b> SKU</div></div>
          <div className="variant-list">
            {variants.map((variant, index) => (
              <article className="variant-editor" key={variant.key}>
                <div className="variant-index">{String(index + 1).padStart(2, "0")}</div>
                <label className={`color-image-uploader ${variant.image_preview ? "has-image" : ""}`} title="컬러 이미지 업로드">
                  {variant.image_preview ? <img src={variant.image_preview} alt="컬러 이미지" /> : <ImagePlus size={20} />}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => selectVariantImage(variant.key, e)} />
                </label>
                <div className="variant-fields">
                  <label className="field compact"><span>컬러 *</span><div className="color-field"><input className="color-picker" type="color" value={variant.color_code} onChange={(e) => updateVariant(variant.key, { color_code: e.target.value })} /><input value={variant.color_name} onChange={(e) => updateVariant(variant.key, { color_name: e.target.value })} placeholder="BLACK" required /></div></label>
                  <label className="field compact"><span>사이즈 *</span><input value={variant.size} onChange={(e) => updateVariant(variant.key, { size: e.target.value })} placeholder="M" required /></label>
                  <label className="field compact sku-field"><span>SKU *</span><input value={variant.sku} onChange={(e) => updateVariant(variant.key, { sku: e.target.value })} placeholder="SH-001-BLK-M" required /></label>
                </div>
                <button type="button" className="icon-button delete-variant" disabled={variants.length === 1} onClick={() => setVariants((current) => current.filter((item) => item.key !== variant.key))} aria-label="SKU 삭제"><Trash2 size={18} /></button>
              </article>
            ))}
          </div>
          <button type="button" className="add-variant" onClick={() => setVariants((current) => [...current, newVariant()])}><Plus size={18} />SKU 추가</button>
        </section>
        {error && <p className="form-error form-error-block">{error}</p>}
        <div className="form-footer"><Link href="/inventory" className="button button-secondary">취소</Link><button className="button button-primary" disabled={saving}><Save size={18} />{saving ? "상품 저장 중..." : "상품 등록"}</button></div>
      </form>
    </div>
  );
}
