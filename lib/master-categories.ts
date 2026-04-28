import { supabase } from "./supabase";
import type { MasterCategory, MasterSubCategory } from "@/types/finance";

const mapMasterCatFromRow = (row: Record<string, unknown>): MasterCategory => ({
    id: String(row.id),
    name: String(row.name),
    type: row.type as MasterCategory["type"],
    description: row.description != null ? String(row.description) : undefined,
    isActive: Boolean(row.is_active),
    createdAt: new Date(String(row.created_at)).getTime(),
    createdBy: row.created_by != null ? String(row.created_by) : "",
});

const mapMasterSubFromRow = (row: Record<string, unknown>): MasterSubCategory => ({
    id: String(row.id),
    name: String(row.name),
    parentCategoryId: String(row.parent_category_id),
    parentCategoryName: row.parent_category_name != null ? String(row.parent_category_name) : undefined,
    type: row.type as MasterSubCategory["type"],
    description: row.description != null ? String(row.description) : undefined,
    isActive: Boolean(row.is_active),
    createdAt: new Date(String(row.created_at)).getTime(),
    createdBy: row.created_by != null ? String(row.created_by) : "",
});

export async function getMasterCategories(): Promise<MasterCategory[]> {
    const { data, error } = await supabase.from("finance_master_categories").select("*").order("name");
    if (error) throw error;
    return (data || []).map((row) => mapMasterCatFromRow(row as Record<string, unknown>));
}

export async function getMasterSubCategories(): Promise<MasterSubCategory[]> {
    const { data, error } = await supabase.from("finance_master_sub_categories").select("*").order("name");
    if (error) throw error;
    return (data || []).map((row) => mapMasterSubFromRow(row as Record<string, unknown>));
}

export async function updateMasterCategory(
    id: string,
    patch: { name?: string; description?: string; type?: MasterCategory["type"]; isActive?: boolean }
): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.type !== undefined) row.type = patch.type;
    if (patch.isActive !== undefined) row.is_active = patch.isActive;
    const { error } = await supabase.from("finance_master_categories").update(row).eq("id", id);
    if (error) throw error;
}

export async function insertMasterCategory(
    row: Omit<MasterCategory, "id" | "createdAt" | "createdBy"> & { createdBy?: string | null }
): Promise<string> {
    const insertRow: Record<string, unknown> = {
        name: row.name,
        type: row.type,
        description: row.description ?? "",
        is_active: row.isActive,
    };
    if (row.createdBy) insertRow.created_by = row.createdBy;
    const { data, error } = await supabase
        .from("finance_master_categories")
        .insert([insertRow])
        .select("id")
        .single();
    if (error) throw error;
    return data.id as string;
}

export async function deleteMasterCategory(id: string): Promise<void> {
    const { error } = await supabase.from("finance_master_categories").delete().eq("id", id);
    if (error) throw error;
}

export async function updateMasterSubCategory(
    id: string,
    patch: { name?: string; description?: string; isActive?: boolean }
): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.isActive !== undefined) row.is_active = patch.isActive;
    const { error } = await supabase.from("finance_master_sub_categories").update(row).eq("id", id);
    if (error) throw error;
}

export async function insertMasterSubCategory(row: {
    name: string;
    parentCategoryId: string;
    parentCategoryName: string;
    type: MasterSubCategory["type"];
    description: string;
    createdBy?: string | null;
}): Promise<string> {
    const insertRow: Record<string, unknown> = {
        name: row.name,
        parent_category_id: row.parentCategoryId,
        parent_category_name: row.parentCategoryName,
        type: row.type,
        description: row.description,
        is_active: true,
    };
    if (row.createdBy) insertRow.created_by = row.createdBy;
    const { data, error } = await supabase
        .from("finance_master_sub_categories")
        .insert([insertRow])
        .select("id")
        .single();
    if (error) throw error;
    return data.id as string;
}

export async function deleteMasterSubCategory(id: string): Promise<void> {
    const { error } = await supabase.from("finance_master_sub_categories").delete().eq("id", id);
    if (error) throw error;
}
