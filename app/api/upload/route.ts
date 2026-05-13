import { NextResponse } from "next/server";
import crypto from "crypto";

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

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const cloudKey = process.env.CLOUDINARY_API_KEY;
        const cloudSecret = process.env.CLOUDINARY_API_SECRET;

        if (!cloudName || !cloudKey || !cloudSecret) {
            return NextResponse.json(
                { error: "Chưa cấu hình Cloudinary trên server." },
                { status: 500 }
            );
        }

        const fileBuffer = Buffer.from(await file.arrayBuffer());
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
        let data: any = null;
        try {
            data = JSON.parse(raw);
        } catch {
            data = null;
        }

        if (!response.ok || !data?.secure_url) {
            const errorMessage = data?.error?.message || `Cloudinary upload failed with status ${response.status}`;
            console.error("Cloudinary Upload Error:", { status: response.status, body: raw });
            return NextResponse.json({ error: errorMessage }, { status: 502 });
        }

        return NextResponse.json({ url: data.secure_url });

    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "Không thể tải ảnh lên Cloudinary." }, { status: 500 });
    }
}
