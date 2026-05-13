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
    const escapeCell = (value: unknown) => {
        let val = value;

        if (val instanceof Date) {
            val = val.toLocaleDateString("vi-VN");
        } else if (val === null || val === undefined) {
            val = "";
        }

        return `"${String(val).replace(/"/g, "\"\"")}"`;
    };

    const headerRow = columnKeys.map(key => escapeCell(headers[key])).join(",");

    const rows = data.map(item => {
        return columnKeys.map(key => {
            return escapeCell(item[key]);
        }).join(",");
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
