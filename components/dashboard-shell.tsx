"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Boxes, ClipboardList, LogOut, Menu, PackagePlus, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

const navigation = [
  { href: "/inventory", label: "재고 현황", icon: Boxes },
  { href: "/products/new", label: "상품 등록", icon: PackagePlus },
  { href: "/transactions", label: "입출고 이력", icon: ClipboardList },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (!data.user) {
        router.replace("/login");
        return;
      }
      setEmail(data.user.email ?? "관리자");
      setReady(true);
    });
    return () => { mounted = false; };
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (!ready) {
    return (
      <main className="auth-loading">
        <Logo />
        <span className="spinner" aria-label="로그인 확인 중" />
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-top">
          <Logo />
          <button className="icon-button sidebar-close" onClick={() => setMenuOpen(false)} aria-label="메뉴 닫기">
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar-nav">
          <p className="nav-label">WORKSPACE</p>
          {navigation.map((item) => {
            const active = pathname === item.href || (item.href !== "/inventory" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className={active ? "nav-item active" : "nav-item"} onClick={() => setMenuOpen(false)}>
                <item.icon size={19} strokeWidth={1.8} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-account">
          <span className="account-avatar">{email.slice(0, 1).toUpperCase()}</span>
          <span className="account-copy"><strong>관리자</strong><small>{email}</small></span>
          <button className="icon-button" onClick={signOut} aria-label="로그아웃" title="로그아웃"><LogOut size={18} /></button>
        </div>
      </aside>
      {menuOpen && <button className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-label="메뉴 닫기" />}
      <div className="main-column">
        <header className="mobile-header">
          <button className="icon-button" onClick={() => setMenuOpen(true)} aria-label="메뉴 열기"><Menu size={22} /></button>
          <Logo />
          <span className="mobile-header-spacer" />
        </header>
        <main className="page-container">{children}</main>
      </div>
    </div>
  );
}
