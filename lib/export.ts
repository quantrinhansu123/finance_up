"use client";

/**
 * Utility to export data to CSV (Excel compatible)
 * @param data Array of objects to export
 * @param filename File name without extension
 * @param headers Mapping of object keys to human-readable headers
 */
export function exportToCSV(data: any[], filename: string, headers: Record<string, string>) {
    if (!data || data.length === 0) {
        alert("Không có dữ liệu để xuất");
        return;
    }

    const columnKeys = Object.keys(headers);
    const headerRow = columnKeys.map(key => headers[key]).join(";");

    const rows = data.map(item => {
        return columnKeys.map(key => {
            let val = item[key];

            // Handle dates
            if (val instanceof Date) {
                val = val.toLocaleDateString("vi-VN");
            } else if (typeof val === "string" && (val.includes(";") || val.includes("\"") || val.includes("\n"))) {
                // Escape quotes and wrap in quotes if contains separator
                val = `"${val.replace(/"/g, "\"\"")}"`;
            } else if (val === null || val === undefined) {
                val = "";
            }

            return val;
        }).join(";");
    });

    const csvContent = "\uFEFF" + [headerRow, ...rows].join("\n"); // Add UTF-8 BOM for Excel
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().getTime()}.csv`);
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
