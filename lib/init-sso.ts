"use client";

import { initSSOListener } from "./sso-listener";
import { db } from "./firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

async function handleLogin(email: string, password: string) {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email));

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        throw new Error("Email không tồn tại");
    }

    let foundUser = null;
    querySnapshot.forEach((doc) => {
        const user = doc.data();
        if (user.password === password) {
            foundUser = { id: doc.id, ...user };
        }
    });

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
