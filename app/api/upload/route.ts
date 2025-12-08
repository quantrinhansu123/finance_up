import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = `${Date.now()}-${file.name.replace(/\s/g, '-')}`;

        // Bunny Storage Config
        // Bunny Storage Config
        // Support both standard names and user's provided names
        const storageZone = process.env.BUNNY_STORAGE_ZONE_NAME || process.env.NEXT_PUBLIC_BUNNY_STORAGE_ZONE;
        const accessKey = process.env.BUNNY_STORAGE_API_KEY || process.env.NEXT_PUBLIC_BUNNY_STORAGE_PASSWORD;
        const region = process.env.BUNNY_STORAGE_REGION || "";
        const cdnHostname = process.env.BUNNY_CDN_HOSTNAME || process.env.NEXT_PUBLIC_BUNNY_STORAGE_CDN_URL;

        if (!storageZone || !accessKey) {
            console.warn("Missing Bunny Storage credentials. Returning MOCK URL.");
            // Return a mock URL for development/testing
            return NextResponse.json({
                url: `https://placehold.co/600x400?text=${filename}`
            });
        }

        // Construct Upload URL
        // Endpoint format: https://{region}.storage.bunnycdn.com/{storageZoneName}/{fileName}
        // If region is empty (Main/DE), use storage.bunnycdn.com
        const baseUrl = region ? `https://${region}.storage.bunnycdn.com` : "https://storage.bunnycdn.com";
        const uploadUrl = `${baseUrl}/${storageZone}/${filename}`;

        const response = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
                "AccessKey": accessKey,
                "Content-Type": "application/octet-stream",
            },
            body: buffer,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Bunny Upload Error:", errorText);
            throw new Error("Failed to upload to storage");
        }

        // Return Public URL
        // If CDN hostname is set, use it. Otherwise fall back to direct storage URL (not recommended for prod)
        // Direct URL format: https://{storageZone}.b-cdn.net/{filename} usually if pull zone set up
        const publicUrl = cdnHostname
            ? `https://${cdnHostname}/${filename}`
            : `https://${storageZone}.b-cdn.net/${filename}`;

        return NextResponse.json({ url: publicUrl });
    } catch (error) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}
