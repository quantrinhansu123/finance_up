import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const apiKey = process.env.IMGBB_API_KEY;

        if (!apiKey) {
            console.error("Missing ImgBB API Key");
            return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
        }

        // Prepare FormData for ImgBB
        const imgBBFormData = new FormData();
        imgBBFormData.append("image", file); // ImgBB expects 'image'
        imgBBFormData.append("key", apiKey);

        const response = await fetch("https://api.imgbb.com/1/upload", {
            method: "POST",
            body: imgBBFormData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("ImgBB Upload Error:", errorText);
            throw new Error("Failed to upload to external storage");
        }

        const data = await response.json();

        if (data.success) {
            return NextResponse.json({ url: data.data.url });
        } else {
            console.error("ImgBB API Error:", data);
            throw new Error(data.error?.message || "Upload failed");
        }

    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
