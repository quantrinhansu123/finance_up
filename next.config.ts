import type { NextConfig } from "next";
import { readSupabaseAnonKey, readSupabaseUrl } from "./lib/supabase-env";

/** Next chỉ bundle `NEXT_PUBLIC_*` ra client; project này dùng `VITE_*` trong `.env` (kiểu Vite). */
const nextConfig: NextConfig = {
    env: {
        NEXT_PUBLIC_SUPABASE_URL: readSupabaseUrl(),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: readSupabaseAnonKey(),
    },
};

export default nextConfig;
