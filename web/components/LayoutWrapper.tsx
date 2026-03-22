"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

interface LayoutWrapperProps {
  children: React.ReactNode;
}

/**
 * LayoutWrapper — wraps all pages with auth guard.
 * Redirects to /login if user is not authenticated.
 * The /login page itself is exempt from the auth check.
 */
export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.push("/login");
    }
  }, [loading, user, isLoginPage, router]);

  // Login page — always render
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Loading auth state — show spinner
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Not authenticated — show nothing while redirect happens
  if (!user) {
    return null;
  }

  // Authenticated — render children
  return <>{children}</>;
}
