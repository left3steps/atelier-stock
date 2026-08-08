import { Boxes } from "lucide-react";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="logo" aria-label="Atelier Stock">
      <span className="logo-mark"><Boxes size={19} strokeWidth={1.8} /></span>
      {!compact && (
        <span>
          <strong>ATELIER</strong>
          <small>STOCK</small>
        </span>
      )}
    </div>
  );
}
