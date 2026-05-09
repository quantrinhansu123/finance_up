import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const maxSizeBytes = 32 * 1024 * 1024;
        if (file.size > maxSizeBytes) {
            return NextResponse.json({ error: "File too large (max 32MB)" }, { status: 413 });
        }

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const cloudKey = process.env.CLOUDINARY_API_KEY;
        const cloudSecret = process.env.CLOUDINARY_API_SECRET;
        const imgbbKey = process.env.IMGBB_API_KEY;

        // Prefer Cloudinary when configured
        if (cloudName && cloudKey && cloudSecret) {
            const fileBuffer = Buffer.from(await file.arrayBuffer());
            const base64 = fileBuffer.toString("base64");
            const mimeType = file.type || "application/octet-stream";
            const dataUrl = `data:${mimeType};base64,${base64}`;

            const timestamp = Math.floor(Date.now() / 1000);
            const folder = "finance_up/bills";
            // Signature: sha1("folder=...&timestamp=...<api_secret>")
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
        }

        // Fallback to local data URL when no external storage configured
        if (!imgbbKey) {
            // Dev fallback: return a data URL so the app can continue without external storage.
            const fallbackBuffer = Buffer.from(await file.arrayBuffer());
            const fallbackBase64 = fallbackBuffer.toString("base64");
            const mimeType = file.type || "application/octet-stream";
            const fallbackUrl = `data:${mimeType};base64,${fallbackBase64}`;

            console.warn("No upload provider configured. Using data URL fallback for upload.");
            return NextResponse.json({
                url: fallbackUrl,
                warning: "Using local data URL fallback because no upload provider is configured",
            });
        }

        // ImgBB is more reliable with base64 payload than multipart file forwarding.
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const imageBase64 = fileBuffer.toString("base64");
        const payload = new URLSearchParams();
        payload.set("key", imgbbKey);
        payload.set("image", imageBase64);
        payload.set("name", file.name || `upload-${Date.now()}`);

        const response = await fetch("https://api.imgbb.com/1/upload", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: payload.toString(),
        });

        const rawResponse = await response.text();
        let data: any = null;
        try {
            data = JSON.parse(rawResponse);
        } catch {
            data = null;
        }

        if (!response.ok || !data?.success || !data?.data?.url) {
            const errorMessage =
                data?.error?.message ||
                data?.status_txt ||
                `ImgBB upload failed with status ${response.status}`;

            console.error("ImgBB Upload Error:", {
                status: response.status,
                body: rawResponse,
            });

            return NextResponse.json({ error: errorMessage }, { status: 502 });
        }

        return NextResponse.json({ url: data.data.url });

    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "Upload failed unexpectedly" }, { status: 500 });
    }
}
