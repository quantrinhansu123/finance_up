import { NextResponse } from "next/server";

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

        const apiKey = process.env.IMGBB_API_KEY;

        if (!apiKey) {
            // Dev fallback: return a data URL so the app can continue without external storage.
            const fallbackBuffer = Buffer.from(await file.arrayBuffer());
            const fallbackBase64 = fallbackBuffer.toString("base64");
            const mimeType = file.type || "application/octet-stream";
            const fallbackUrl = `data:${mimeType};base64,${fallbackBase64}`;

            console.warn("IMGBB_API_KEY is missing. Using data URL fallback for upload.");
            return NextResponse.json({
                url: fallbackUrl,
                warning: "Using local data URL fallback because IMGBB_API_KEY is missing",
            });
        }

        // ImgBB is more reliable with base64 payload than multipart file forwarding.
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const imageBase64 = fileBuffer.toString("base64");
        const payload = new URLSearchParams();
        payload.set("key", apiKey);
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
