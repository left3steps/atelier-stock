"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const authCallback = `${window.location.search}${window.location.hash}`;
    if (authCallback.includes("code=") || authCallback.includes("access_token=") || authCallback.includes("type=invite")) {
      router.replace(`/set-password${authCallback}`);
      return;
    }
    router.replace("/inventory");
  }, [router]);

  return <main className="auth-loading"><Logo /><span className="spinner" /></main>;
}
