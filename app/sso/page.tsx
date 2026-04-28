"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getUserByEmail } from "@/lib/users";

function SSOHandler() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const handleAutoLogin = async () => {
            const token = searchParams.get("token");
            if (!token) {
                router.push("/login");
                return;
            }

            try {
                // 1. Gửi token lên API giải mã lấy email
                const response = await fetch(`/api/verify-sso`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.message || "Xác thực không thành công");
                }

                const email = data.email;

                const profile = await getUserByEmail(email);
                if (!profile) {
                    throw new Error("Không tìm thấy người dùng trong hệ thống UpBank");
                }

                const foundUser = { ...profile, id: profile.uid };

                const userData = JSON.stringify(foundUser);
                localStorage.setItem("user", userData);
                localStorage.setItem("isLoggedIn", "true");

                // Chuyển hướng vào trang quản lý Dashboard
                router.push("/finance");

            } catch (error: any) {
                console.error("SSO Error:", error);
                alert("Lỗi đăng nhập SSO: " + (error.message || "Không rõ nguyên nhân"));
                router.push("/login?error=SSOFailed");
            }
        };

        handleAutoLogin();
    }, [router, searchParams]);

    return (
        <div className="flex flex-col h-screen w-screen items-center justify-center bg-[url('/bg-finance.jpg')] bg-cover bg-center">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
            <div className="relative z-10 flex flex-col items-center gap-6">
                <div className="w-16 h-16 bg-gradient-to-br from-[#FF5E62] to-[#FF9966] rounded-xl flex items-center justify-center text-3xl font-bold text-white shadow-lg shadow-orange-500/20">
                    D
                </div>
                <div className="flex items-center gap-3">
                    <svg className="animate-spin h-6 w-6 text-[#FF5E62]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <h2 className="text-white text-lg font-medium">Đang tự động xác thực và cấu hình tài khoản...</h2>
                </div>
            </div>
        </div>
    );
}

export default function SSOPage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen w-screen items-center justify-center bg-black/90">
                <h2 className="text-white">Đoạn tải module xác thực...</h2>
            </div>
        }>
            <SSOHandler />
        </Suspense>
    );
}
