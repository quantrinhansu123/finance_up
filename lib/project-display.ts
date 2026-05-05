import type { Project } from "@/types/finance";

/**
 * Chuỗi "Mã dự án" hiển thị thống nhất (cột Mã dự án, dropdown Thu/Chi, xin ngân sách…):
 * - Luôn chỉ lấy tên dự án và loại tiền: `Tên - VND`
 * Ví dụ: BIOKAMA - KHR, YASU Cambodia - KHR.
 */
export function formatProjectMaLan(p: Project | undefined | null): string {
    if (!p) return "N/A";
    const currency = String(p.defaultCurrency || p.currency || "VND").trim();
    const name = (p.name || "").trim();
    if (!name) return currency || "N/A";
    return `${name} - ${currency}`;
}

/** Giữ tên cũ cho import hiện có — cùng logic với formatProjectMaLan */
export const formatProjectListLabel = formatProjectMaLan;

export function projectLabelById(projects: Project[], id: string): string {
    return formatProjectMaLan(projects.find((proj) => proj.id === id));
}
