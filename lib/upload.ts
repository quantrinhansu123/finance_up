export async function uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        let errorMessage = "Failed to upload image";
        try {
            const errorData = await res.json();
            errorMessage = errorData?.error || errorMessage;
        } catch {
            // Keep default message when response is not JSON.
        }
        throw new Error(errorMessage);
    }

    const data = await res.json();
    if (!data?.url) {
        throw new Error("Upload succeeded but no image URL was returned");
    }
    return data.url;
}
