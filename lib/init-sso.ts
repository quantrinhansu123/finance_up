"use client";

import { initSSOListener } from "./sso-listener";
import { supabase } from "./supabase";

async function handleLogin(email: string, password: string) {
    const { data: users, error } = await supabase
        .from("employees")
        .select("*")
        .eq("email", email);

    if (error) {
        console.error(error);
        throw new Error("Lỗi khi kết nối cơ sở dữ liệu");
    }

    if (!users || users.length === 0) {
        throw new Error("Email không tồn tại");
    }

    let foundUser: any = null;
    for (const user of users) {
        // Fallback check if password is in column or inside employment json
        let userPass = user.password || user.pass;
        if (!userPass && user.employment && typeof user.employment === 'object') {
            userPass = (user.employment as any).password;
        }

        if (userPass === password) {
            foundUser = { 
                id: user.id,
                uid: user.id, // Support old apps looking for uid
                email: user.email,
                displayName: user.display_name,
                role: user.role,
                position: user.position,
                departmentId: user.department_id,
                photoURL: user.photo_url,
                // Include employment fields needed for JWT/Session
                financeRole: user.finance_role,
            };
            break;
        }
    }

    if (!foundUser) {
        throw new Error("Mật khẩu không đúng");
    }

    // Save to localStorage
    localStorage.setItem("user", JSON.stringify(foundUser));
    localStorage.setItem("isLoggedIn", "true");

    // Reload to update UI
    window.location.reload();
}

async function handleLogout() {
    localStorage.removeItem("user");
    localStorage.removeItem("isLoggedIn");
    window.location.reload();
}

// Initialize listener
if (typeof window !== "undefined") {
    initSSOListener({
        onLogin: handleLogin,
        onLogout: handleLogout,
    });
}
