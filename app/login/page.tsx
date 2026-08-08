"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace("/inventory");
    });
  }, [router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!isSupabaseConfigured) {
      setError("Supabase 환경변수가 설정되지 않았습니다. .env.local 파일을 확인해 주세요.");
      return;
    }
    setLoading(true);
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) {
      setError("이메일 또는 비밀번호를 확인해 주세요.");
      setLoading(false);
      return;
    }
    router.replace("/inventory");
    router.refresh();
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <Logo />
        <div className="brand-message">
          <p className="eyebrow light">INVENTORY, IN FOCUS</p>
          <h1>흐름이 보이면,<br />재고가 가벼워집니다.</h1>
          <p>상품부터 컬러, 사이즈 SKU까지.<br />하나의 정확한 원장으로 관리하세요.</p>
        </div>
        <p className="brand-footer">Internal inventory workspace</p>
      </section>
      <section className="login-form-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <div>
            <p className="eyebrow">ADMIN ACCESS</p>
            <h2>관리자 로그인</h2>
            <p className="muted">등록된 관리자 계정으로 접속하세요.</p>
          </div>
          <label className="field">
            <span>이메일</span>
            <div className="input-with-icon"><Mail size={18} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@company.com" required autoComplete="email" /></div>
          </label>
          <label className="field">
            <span>비밀번호</span>
            <div className="input-with-icon"><LockKeyhole size={18} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호 입력" required autoComplete="current-password" /></div>
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="button button-primary button-wide" disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}<ArrowRight size={18} />
          </button>
          <p className="login-help">계정은 Supabase Authentication에서 관리합니다.</p>
        </form>
      </section>
    </main>
  );
}
