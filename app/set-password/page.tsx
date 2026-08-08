"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, LockKeyhole } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted && data.session) setSessionReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted && session) setSessionReady(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (!sessionReady) {
      setError("초대 링크가 만료되었거나 올바르지 않습니다. 새 초대 메일을 요청해 주세요.");
      return;
    }
    if (password.length < 8) {
      setError("비밀번호는 8자 이상 입력해 주세요.");
      return;
    }
    if (password !== confirmPassword) {
      setError("두 비밀번호가 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("비밀번호를 저장하지 못했습니다. 초대 링크를 다시 열어 주세요.");
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
          <p className="eyebrow light">WELCOME TO ATELIER</p>
          <h1>첫 관리자 계정을<br />준비합니다.</h1>
          <p>안전한 비밀번호를 설정하면<br />바로 재고관리를 시작할 수 있습니다.</p>
        </div>
        <p className="brand-footer">Internal inventory workspace</p>
      </section>
      <section className="login-form-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <div>
            <p className="eyebrow">ACCOUNT SETUP</p>
            <h2>비밀번호 설정</h2>
            <p className="muted">8자 이상의 비밀번호를 등록해 주세요.</p>
          </div>
          <label className="field">
            <span>새 비밀번호</span>
            <div className="input-with-icon"><KeyRound size={18} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8자 이상 입력" required minLength={8} autoComplete="new-password" /></div>
          </label>
          <label className="field">
            <span>비밀번호 확인</span>
            <div className="input-with-icon"><LockKeyhole size={18} /><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="한 번 더 입력" required minLength={8} autoComplete="new-password" /></div>
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="button button-primary button-wide" disabled={loading || !sessionReady}>
            {loading ? "저장 중..." : sessionReady ? "비밀번호 저장" : "초대 확인 중..."}<ArrowRight size={18} />
          </button>
          <p className="login-help">비밀번호는 Supabase Authentication에 안전하게 저장됩니다.</p>
        </form>
      </section>
    </main>
  );
}
