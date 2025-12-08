"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Redirect if already logged in
        const loggedIn = localStorage.getItem("isLoggedIn") || sessionStorage.getItem("isLoggedIn");
        if (loggedIn) {
            router.push("/finance");
        }
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const usersRef = collection(db, "users");
            // Query Firestore for the email
            const q = query(usersRef, where("email", "==", email));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                throw new Error("Không tìm thấy người dùng");
            }

            let foundUser = null;
            querySnapshot.forEach((doc) => {
                const user = doc.data();
                // Validating password
                if (user.password === password) {
                    foundUser = { id: doc.id, ...user };
                }
            });

            if (!foundUser) {
                throw new Error("Mật khẩu không đúng");
            }

            // Check finance access permission
            const user = foundUser as any;
            const isAdmin = user.email?.toLowerCase() === "ceo.fata@gmail.com" || 
                           user.employment?.position?.toUpperCase() === "CEO&FOUNDER";
            
            if (!isAdmin && (!user.financeRole || user.financeRole === "NONE")) {
                throw new Error("Bạn chưa được phân quyền truy cập hệ thống tài chính. Vui lòng liên hệ Admin.");
            }

            // Login success
            const userData = JSON.stringify(foundUser);
            if (rememberMe) {
                localStorage.setItem("user", userData);
                localStorage.setItem("isLoggedIn", "true");
            } else {
                sessionStorage.setItem("user", userData);
                sessionStorage.setItem("isLoggedIn", "true");
            }

            router.push("/finance");
        } catch (err: any) {
            console.error("Login Error:", err);
            if (err.code === "permission-denied") {
                setError("Truy cập bị từ chối: Vui lòng kiểm tra quyền Firestore.");
            } else {
                setError(err.message || "Đã xảy ra lỗi không xác định");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-[url('/bg-finance.jpg')] bg-cover bg-center">
            {/* Overlay for better text contrast if bg image is added later */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

            <div className="glass-card w-full max-w-md p-8 rounded-2xl relative z-10 border border-white/10 shadow-2xl">
                <div className="mb-8 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-[#FF5E62] to-[#FF9966] rounded-xl mx-auto flex items-center justify-center text-3xl font-bold text-white mb-4 shadow-lg shadow-orange-500/20">
                        D
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Chào mừng trở lại</h1>
                    <p className="text-[var(--muted)]">Đăng nhập để truy cập trang quản lý</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    {error && (
                        <div className="p-4 text-sm text-red-200 bg-red-900/40 border border-red-500/30 rounded-xl flex items-center gap-2">
                            <span>⚠️</span> {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-[var(--muted)]">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="glass-input w-full p-3 rounded-xl focus:ring-2 focus:ring-[#FF5E62] transition-all"
                            placeholder="nhanvien@example.com"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-medium text-[var(--muted)]">Mật khẩu</label>
                            <a href="#" className="text-xs text-[#FF9966] hover:text-[#FF5E62] transition-colors">Quên mật khẩu?</a>
                        </div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="glass-input w-full p-3 rounded-xl focus:ring-2 focus:ring-[#FF5E62] transition-all"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <div className="flex items-center">
                        <input
                            id="remember-me"
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#FF5E62] focus:ring-[#FF5E62] focus:ring-offset-0 placeholder:text-white/20"
                        />
                        <label htmlFor="remember-me" className="ml-2 block text-sm text-[var(--muted)] cursor-pointer">
                            Ghi nhớ đăng nhập
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="glass-button w-full p-3 rounded-xl font-bold text-lg mt-4 bg-gradient-to-r from-[#FF5E62] to-[#FF9966] hover:shadow-lg hover:shadow-orange-500/20 transition-all border-none"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Đang xử lý...
                            </span>
                        ) : "Đăng nhập"}
                    </button>
                </form>

                <div className="mt-8 text-center text-sm text-[var(--muted)]">
                    Bạn chưa có tài khoản? <span className="text-white/50 cursor-not-allowed">Liên hệ Admin</span>
                </div>
            </div>
        </div>
    );
}
