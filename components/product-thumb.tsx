import { ImageIcon } from "lucide-react";
import { productImageUrl } from "@/lib/supabase/images";

export function ProductThumb({ path, alt, size = "medium" }: { path?: string | null; alt: string; size?: "small" | "medium" | "large" }) {
  const url = productImageUrl(path);
  return (
    <div className={`product-thumb thumb-${size}`}>
      {url ? <img src={url} alt={alt} /> : <ImageIcon size={size === "large" ? 36 : 22} strokeWidth={1.4} />}
    </div>
  );
}
