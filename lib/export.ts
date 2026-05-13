"use client";

/**
 * Utility to export tabular data as an Excel-readable worksheet.
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
    const escapeHtml = (value: unknown) =>
        String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");

    const formatCell = (value: unknown) => {
        let val = value;

        if (val instanceof Date) {
            val = val.toLocaleDateString("vi-VN");
        } else if (val === null || val === undefined) {
            val = "";
        }

        return escapeHtml(val);
    };

    const headerRow = columnKeys.map(key => `<th>${escapeHtml(headers[key])}</th>`).join("");
    const rows = data.map(item =>
        `<tr>${columnKeys.map(key => `<td>${formatCell(item[key])}</td>`).join("")}</tr>`
    );

    const excelContent = `\uFEFF<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
</head>
<body>
    <table>
        <thead><tr>${headerRow}</tr></thead>
        <tbody>${rows.join("")}</tbody>
    </table>
</body>
</html>`;
    const blob = new Blob([excelContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().getTime()}.xls`);
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
