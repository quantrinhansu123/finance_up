"use client";

const ALLOWED_ORIGIN = "https://up-care.vercel.app";

export function initSSOListener(handlers: {
    onLogin: (email: string, password: string) => Promise<void>;
    onLogout: () => Promise<void>;
}) {
    if (typeof window === "undefined") return;

    window.addEventListener("message", async (event) => {
        // QUAN TRỌNG: Chỉ chấp nhận message từ UP Care
        if (event.origin !== ALLOWED_ORIGIN) return;

        const { type, email, password } = event.data;

        switch (type) {
            case "SSO_LOGIN":
                try {
                    await handlers.onLogin(email, password);
                    console.log("✅ SSO Login thành công!");

                    // Gửi response về UP Care
                    window.parent.postMessage(
                        { type: "SSO_LOGIN_SUCCESS", email },
                        ALLOWED_ORIGIN
                    );
                } catch (error: any) {
                    console.error("❌ SSO Login thất bại:", error.message);
                    window.parent.postMessage(
                        { type: "SSO_LOGIN_ERROR", error: error.message },
                        ALLOWED_ORIGIN
                    );
                }
                break;

            case "SSO_LOGOUT":
                try {
                    await handlers.onLogout();
                    console.log("✅ SSO Logout thành công!");
                } catch (error: any) {
                    console.error("❌ SSO Logout thất bại:", error.message);
                }
                break;
        }
    });
}
