import type { Project } from "@/types/finance";

/**
 * Chuỗi "Mã dự án" hiển thị thống nhất (cột Mã dự án, dropdown Thu/Chi, xin ngân sách…):
 * - Có thị trường (`market` / thi_truong) và tên chưa lồng sẵn thị trường: `Tên - Thị trường - VND`
 * - Ngược lại: `Tên - VND`
 * Ví dụ: BIOKAMA - Cambodia - KHR, YASU Cambodia - KHR (khi tên dự án đã là "YASU Cambodia").
 */
export function formatProjectMaLan(p: Project | undefined | null): string {
    if (!p) return "N/A";
    const currency = String(p.defaultCurrency || p.currency || "VND").trim();
    const name = (p.name || "").trim();
    const market = (p.market || "").trim();
    if (!name) return currency || "N/A";

    const norm = (s: string) => s.replace(/\s+/g, " ").toLowerCase();
    const nameContainsMarket =
        market.length > 0 && norm(name).includes(norm(market));

    if (market && !nameContainsMarket) {
        return `${name} - ${market} - ${currency}`;
    }
    return `${name} - ${currency}`;
}

/** Giữ tên cũ cho import hiện có — cùng logic với formatProjectMaLan */
export const formatProjectListLabel = formatProjectMaLan;

export function projectLabelById(projects: Project[], id: string): string {
    return formatProjectMaLan(projects.find((proj) => proj.id === id));
}
