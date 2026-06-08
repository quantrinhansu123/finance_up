import { NextResponse } from "next/server";
import crypto from "crypto";
import { uploadImageToSupabaseStorage } from "@/lib/server-storage";

function hasCloudinaryConfig(): boolean {
    return Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
            process.env.CLOUDINARY_API_KEY &&
            process.env.CLOUDINARY_API_SECRET
    );
}

async function uploadToCloudinary(file: File, fileBuffer: Buffer): Promise<string> {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
    const cloudKey = process.env.CLOUDINARY_API_KEY!;
    const cloudSecret = process.env.CLOUDINARY_API_SECRET!;

    const base64 = fileBuffer.toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "finance_up/bills";
    const toSign = `folder=${folder}&timestamp=${timestamp}${cloudSecret}`;
    const signature = crypto.createHash("sha1").update(toSign).digest("hex");

    const payload = new FormData();
    payload.append("file", dataUrl);
    payload.append("api_key", cloudKey);
    payload.append("timestamp", String(timestamp));
    payload.append("folder", folder);
    payload.append("signature", signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: payload,
    });

    const raw = await response.text();
    let data: { secure_url?: string; error?: { message?: string } } | null = null;
    try {
        data = JSON.parse(raw);
    } catch {
        data = null;
    }

    if (!response.ok || !data?.secure_url) {
        const errorMessage = data?.error?.message || `Cloudinary upload failed with status ${response.status}`;
        console.error("Cloudinary Upload Error:", { status: response.status, body: raw });
        throw new Error(errorMessage);
    }

    return data.secure_url;
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "Chưa chọn ảnh để tải lên." }, { status: 400 });
        }

        if (!file.type?.startsWith("image/")) {
            return NextResponse.json({ error: "Chỉ được tải lên ảnh. Không hỗ trợ PDF hoặc tài liệu khác." }, { status: 400 });
        }

        const maxSizeBytes = 32 * 1024 * 1024;
        if (file.size > maxSizeBytes) {
            return NextResponse.json({ error: "Ảnh quá lớn (tối đa 32MB)." }, { status: 413 });
        }

        const fileBuffer = Buffer.from(await file.arrayBuffer());

        if (hasCloudinaryConfig()) {
            try {
                const url = await uploadToCloudinary(file, fileBuffer);
                return NextResponse.json({ url, provider: "cloudinary" });
            } catch (cloudErr) {
                console.error("Cloudinary failed, trying Supabase Storage:", cloudErr);
            }
        }

        try {
            const url = await uploadImageToSupabaseStorage(file, fileBuffer);
            return NextResponse.json({ url, provider: "supabase" });
        } catch (storageErr) {
            const message =
                storageErr instanceof Error ? storageErr.message : "Không thể lưu ảnh lên Supabase Storage.";
            const hint = hasCloudinaryConfig()
                ? message
                : `${message} (Hoặc cấu hình CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET trên Vercel.)`;
            return NextResponse.json({ error: hint }, { status: 500 });
        }
    } catch (error) {
        console.error("Upload error:", error);
        const message = error instanceof Error ? error.message : "Không thể tải ảnh lên.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
