import { createClient } from "@supabase/supabase-js";
import { readSupabaseServiceRoleKey, readSupabaseUrl } from "@/lib/supabase-env";
import crypto from "crypto";

export function readStorageBucket(): string {
    const raw =
        process.env.SUPABASE_STORAGE_BUCKET ||
        process.env.VITE_SUPABASE_FINANCE_BILLS_BUCKET ||
        process.env.VITE_SUPABASE_AVATARS_BUCKET ||
        "finance-bills";
    return raw.trim().replace(/^["']|["']$/g, "");
}

export async function uploadImageToSupabaseStorage(
    file: File,
    fileBuffer: Buffer
): Promise<string> {
    const url = readSupabaseUrl();
    const serviceKey = readSupabaseServiceRoleKey();
    if (!url || !serviceKey) {
        throw new Error(
            "Thiếu SUPABASE_SERVICE_ROLE_KEY hoặc URL Supabase — không thể lưu ảnh lên Storage."
        );
    }

    const bucket = readStorageBucket();
    const client = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const extFromName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
    const extFromType = file.type?.split("/")[1]?.replace(/jpeg/, "jpg");
    const ext = extFromName || extFromType || "jpg";
    const objectPath = `bills/${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${ext}`;

    const { error } = await client.storage.from(bucket).upload(objectPath, fileBuffer, {
        contentType: file.type || "image/jpeg",
        upsert: false,
    });

    if (error) {
        const hint =
            error.message?.includes("Bucket not found") || error.message?.includes("not found")
                ? ` Bucket "${bucket}" chưa tồn tại — tạo bucket public trên Supabase Storage hoặc set SUPABASE_STORAGE_BUCKET.`
                : "";
        throw new Error(`Supabase Storage: ${error.message}.${hint}`);
    }

    const { data } = client.storage.from(bucket).getPublicUrl(objectPath);
    if (!data?.publicUrl) {
        throw new Error("Supabase Storage: không lấy được URL công khai của ảnh.");
    }
    return data.publicUrl;
}
