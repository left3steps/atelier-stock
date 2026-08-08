"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export default function AccountPage() {
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setEmail(data.user?.email ?? "관리자 계정");
    });
    return () => { mounted = false; };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 8) {
      setError("새 비밀번호는 8자 이상 입력해 주세요.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("새 비밀번호와 확인 비밀번호가 일치하지 않습니다.");
      return;
    }
    if (currentPassword === newPassword) {
      setError("현재 비밀번호와 다른 새 비밀번호를 입력해 주세요.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
      current_password: currentPassword,
    });
    setLoading(false);

    if (updateError) {
      if (updateError.code === "weak_password") {
        setError("더 안전한 비밀번호를 사용해 주세요.");
      } else if (updateError.code === "same_password") {
        setError("현재 비밀번호와 다른 새 비밀번호를 입력해 주세요.");
      } else {
        setError("비밀번호를 변경하지 못했습니다. 현재 비밀번호를 확인해 주세요.");
      }
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSuccess("비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용하세요.");
  }

  return (
    <div className="page-stack narrow-page account-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">ACCOUNT SETTINGS</p>
          <h1>계정 설정</h1>
          <p>관리자 계정과 로그인 비밀번호를 안전하게 관리하세요.</p>
        </div>
      </header>

      <section className="panel account-settings-panel">
        <div className="account-settings-heading">
          <span><ShieldCheck size={21} /></span>
          <div>
            <p className="eyebrow">PASSWORD</p>
            <h2>비밀번호 변경</h2>
            <p>{email}</p>
          </div>
        </div>

        <div className="account-settings-content">
          <form className="account-password-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>현재 비밀번호</span>
              <div className="input-with-icon"><LockKeyhole size={18} /><input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="현재 비밀번호 입력" required autoComplete="current-password" /></div>
            </label>
            <label className="field">
              <span>새 비밀번호</span>
              <div className="input-with-icon"><KeyRound size={18} /><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="8자 이상 입력" required minLength={8} autoComplete="new-password" /></div>
            </label>
            <label className="field">
              <span>새 비밀번호 확인</span>
              <div className="input-with-icon"><CheckCircle2 size={18} /><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="한 번 더 입력" required minLength={8} autoComplete="new-password" /></div>
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            {success && <p className="form-success" role="status"><CheckCircle2 size={17} />{success}</p>}
            <button className="button button-primary account-password-submit" disabled={loading}>
              {loading ? "변경 중..." : "비밀번호 변경"}
            </button>
          </form>

          <aside className="password-guide">
            <ShieldCheck size={23} />
            <div>
              <strong>안전한 비밀번호 사용</strong>
              <p>8자 이상으로 만들고 다른 서비스에서 사용하는 비밀번호와 다르게 설정하세요.</p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
