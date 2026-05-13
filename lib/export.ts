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
    const widthByKey: Record<string, number> = {
        date: 110,
        parentCategory: 170,
        category: 210,
        amount: 120,
        currency: 80,
        accountName: 170,
        projectName: 220,
        description: 420,
    };
    const numericKeys = new Set([
        "amount",
        "balance",
        "openingBalance",
        "moneyIn",
        "moneyOut",
        "totalSpent",
        "targetBudget",
        "totalRevenue",
        "totalExpense",
    ]);
    const longTextKeys = new Set(["description", "details", "note"]);

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

    const getCellClass = (key: string) => {
        if (numericKeys.has(key)) return "number";
        if (longTextKeys.has(key)) return "long-text";
        return "text";
    };

    const colGroup = columnKeys
        .map(key => `<col style="width:${widthByKey[key] || 150}px" />`)
        .join("");
    const headerRow = columnKeys.map(key => `<th class="text">${escapeHtml(headers[key])}</th>`).join("");
    const rows = data.map(item =>
        `<tr>${columnKeys.map(key => `<td class="${getCellClass(key)}">${formatCell(item[key])}</td>`).join("")}</tr>`
    );

    const excelContent = `\uFEFF<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <style>
        table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11pt; }
        th, td { border: .5pt solid #d9d9d9; padding: 4px 6px; vertical-align: top; }
        th { font-weight: 700; text-align: center; background: #f3f4f6; white-space: nowrap; }
        .text { mso-number-format:"\\@"; white-space: nowrap; text-align: left; }
        .long-text { mso-number-format:"\\@"; white-space: normal; text-align: left; }
        .number { mso-number-format:"0"; text-align: right; white-space: nowrap; }
    </style>
</head>
<body>
    <table>
        <colgroup>${colGroup}</colgroup>
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
