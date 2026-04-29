import { supabase } from "./supabase";
import {
    Account,
    BudgetRequest,
    Project,
    ProjectMember,
    ProjectPermission,
    ProjectSubCategory,
    Transaction,
    FixedCost,
    MonthlyRevenue,
    Fund,
    Beneficiary,
} from "@/types/finance";
import { logAction } from "./logger";
import { v4 as uuidv4 } from "uuid";

// --- Accounts ---

const mapAccountFromDB = (data: any): Account => ({
    id: data.id,
    name: data.name,
    type: data.type,
    currency: data.currency,
    balance: Number(data.balance),
    openingBalance: Number(data.opening_balance),
    projectId: data.project_id || undefined,
    departmentId: data.department_id || undefined,
    isLocked: data.is_locked,
    restrictCurrency: data.restrict_currency,
    allowedCategories: data.allowed_categories || [],
    assignedUserIds: data.assigned_user_ids || [],
    createdAt: new Date(data.created_at).getTime()
});

const mapAccountToDB = (data: any) => {
    const res: any = {};
    if (data.name !== undefined) res.name = data.name;
    if (data.type !== undefined) res.type = data.type;
    if (data.currency !== undefined) res.currency = data.currency;
    if (data.balance !== undefined) res.balance = data.balance;
    if (data.openingBalance !== undefined) res.opening_balance = data.openingBalance;
    if (data.projectId !== undefined) res.project_id = data.projectId || null;
    if (data.departmentId !== undefined) res.department_id = data.departmentId;
    if (data.isLocked !== undefined) res.is_locked = data.isLocked;
    if (data.restrictCurrency !== undefined) res.restrict_currency = data.restrictCurrency;
    if (data.allowedCategories !== undefined) res.allowed_categories = data.allowedCategories;
    if (data.assignedUserIds !== undefined) res.assigned_user_ids = data.assignedUserIds;
    return res;
};

export async function getAccounts(): Promise<Account[]> {
    const { data, error } = await supabase.from("finance_accounts").select("*");
    if (error) throw error;
    return (data || []).map(mapAccountFromDB);
}

export async function getAccount(id: string): Promise<Account | null> {
    const { data, error } = await supabase.from("finance_accounts").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapAccountFromDB(data) : null;
}

export async function createAccount(account: Omit<Account, "id">): Promise<string> {
    const { data, error } = await supabase.from("finance_accounts").insert([mapAccountToDB(account)]).select("id").single();
    if (error) throw error;
    await logAction("CREATE_ACCOUNT", { name: account.name, type: account.type }, data.id);
    return data.id;
}

export async function updateAccountBalance(accountId: string, newBalance: number): Promise<void> {
    const { error } = await supabase.from("finance_accounts").update({ balance: newBalance }).eq("id", accountId);
    if (error) throw error;
}

export async function updateAccount(accountId: string, data: Partial<Account>): Promise<void> {
    const { error } = await supabase.from("finance_accounts").update(mapAccountToDB(data)).eq("id", accountId);
    if (error) throw error;
}

export async function deleteAccount(accountId: string): Promise<void> {
    const { error } = await supabase.from("finance_accounts").delete().eq("id", accountId);
    if (error) throw error;
    await logAction("DELETE_ACCOUNT", {}, accountId);
}

// --- Projects ---

export async function getDuAnList(): Promise<Array<{ id: string; tenDuAn: string }>> {
    const { data, error } = await supabase
        .from("du_an")
        .select("id, ten_du_an")
        .order("ten_du_an", { ascending: true });
    if (error) throw error;
    return (data || []).map((r: any) => ({
        id: r.id,
        tenDuAn: r.ten_du_an,
    }));
}

const mapProjectFromDB = (data: any): Project => ({
    id: data.id,
    name: data.name,
    description: data.description || undefined,
    status: data.status,
    budget: data.budget ? Number(data.budget) : undefined,
    currency: data.currency || undefined,
    totalRevenue: Number(data.total_revenue),
    totalExpense: Number(data.total_expense),
    defaultCurrency: data.default_currency || undefined,
    allowedCategories: data.allowed_categories || [],
    createdBy: data.created_by || undefined,
    createdAt: new Date(data.created_at).getTime(),
    memberIds: data.member_ids || [],
});

const mapProjectToDB = (data: any) => {
    const res: any = {};
    if (data.name !== undefined) res.name = data.name;
    if (data.description !== undefined) res.description = data.description;
    if (data.status !== undefined) res.status = data.status;
    if (data.budget !== undefined) res.budget = data.budget;
    if (data.currency !== undefined) res.currency = data.currency;
    if (data.totalRevenue !== undefined) res.total_revenue = data.totalRevenue;
    if (data.totalExpense !== undefined) res.total_expense = data.totalExpense;
    if (data.defaultCurrency !== undefined) res.default_currency = data.defaultCurrency;
    if (data.allowedCategories !== undefined) res.allowed_categories = data.allowedCategories;
    if (data.createdBy !== undefined) res.created_by = data.createdBy;
    return res;
};

const isUuid = (s: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);

const mapProjectSubRow = (row: any): ProjectSubCategory => ({
    id: row.id,
    name: row.name,
    parentCategoryId: row.parent_category_id,
    parentCategoryName: row.parent_category_name || undefined,
    type: row.type,
    description: row.description || undefined,
    isActive: row.is_active,
    createdAt: new Date(row.created_at).getTime(),
    createdBy: row.created_by || "",
    projectId: row.project_id,
});

const mapProjectMemberRow = (row: any): ProjectMember => ({
    id: row.user_id,
    role: row.role,
    permissions: (row.permissions || []) as ProjectPermission[],
    addedAt: new Date(row.added_at).getTime(),
    addedBy: row.added_by || undefined,
});

async function attachRelationsToProjects(projects: Project[]): Promise<Project[]> {
    if (projects.length === 0) return projects;
    const ids = projects.map((p) => p.id);
    // Relations are used for member list, permissions and sub categories.
    // If RLS/policy causes them to fail, we should still return base projects
    // so the page doesn't appear empty.
    let subRows: any[] = [];
    let memRows: any[] = [];
    const [{ data: subData, error: e1 }, { data: memData, error: e2 }] = await Promise.all([
        supabase.from("finance_project_sub_categories").select("*").in("project_id", ids),
        supabase.from("finance_project_members").select("*").in("project_id", ids),
    ]);
    if (!e1 && subData) subRows = subData;
    if (!e2 && memData) memRows = memData;
    // eslint-disable-next-line no-console
    if (e1 || e2) console.warn("attachRelationsToProjects: failed relations", e1 || e2);
    const subsBy = new Map<string, any[]>();
    const memsBy = new Map<string, any[]>();
    for (const r of subRows || []) {
        const k = r.project_id;
        if (!subsBy.has(k)) subsBy.set(k, []);
        subsBy.get(k)!.push(r);
    }
    for (const r of memRows || []) {
        const k = r.project_id;
        if (!memsBy.has(k)) memsBy.set(k, []);
        memsBy.get(k)!.push(r);
    }
    return projects.map((p) => {
        const subs = subsBy.get(p.id) || [];
        const mems = memsBy.get(p.id) || [];

        const resolvedMemberIds = mems.length > 0 ? mems.map((m) => m.user_id) : p.memberIds || [];

        return {
            ...p,
            incomeSubCategories: subs.filter((s) => s.type === "INCOME").map(mapProjectSubRow),
            expenseSubCategories: subs.filter((s) => s.type === "EXPENSE").map(mapProjectSubRow),
            members: mems.length > 0 ? mems.map(mapProjectMemberRow) : p.members,
            memberIds: resolvedMemberIds,
        };
    });
}

async function replaceProjectSubCategories(
    projectId: string,
    income: ProjectSubCategory[],
    expense: ProjectSubCategory[]
) {
    const { error: delErr } = await supabase
        .from("finance_project_sub_categories")
        .delete()
        .eq("project_id", projectId);
    if (delErr) throw delErr;
    const all = [...income, ...expense];
    if (all.length === 0) return;
    const rows = all.map((sub) => ({
        id: isUuid(sub.id) ? sub.id : uuidv4(),
        project_id: projectId,
        name: sub.name,
        parent_category_id: sub.parentCategoryId,
        parent_category_name: sub.parentCategoryName || null,
        type: sub.type,
        description: sub.description || null,
        is_active: sub.isActive,
        created_by: sub.createdBy && isUuid(sub.createdBy) ? sub.createdBy : null,
        created_at: new Date(sub.createdAt).toISOString(),
    }));
    const { error } = await supabase.from("finance_project_sub_categories").insert(rows);
    if (error) throw error;
}

async function replaceProjectMembers(projectId: string, members: ProjectMember[]) {
    const { error: delErr } = await supabase.from("finance_project_members").delete().eq("project_id", projectId);
    if (delErr) throw delErr;
    if (members.length === 0) return;
    const rows = members.map((m) => ({
        project_id: projectId,
        user_id: m.id,
        role: m.role,
        permissions: m.permissions,
        added_at: new Date(m.addedAt).toISOString(),
        added_by: m.addedBy && isUuid(m.addedBy) ? m.addedBy : null,
    }));
    const { error } = await supabase.from("finance_project_members").insert(rows);
    if (error) throw error;
}

export async function getProjects(): Promise<Project[]> {
    const { data, error } = await supabase.from("finance_projects").select("*");
    if (error) throw error;
    const base = (data || []).map(mapProjectFromDB);
    return attachRelationsToProjects(base);
}

export async function createProject(project: Omit<Project, "id">): Promise<string> {
    const { members, memberIds, ...projectFields } = project as Omit<Project, "id"> & {
        members?: ProjectMember[];
        memberIds?: string[];
    };

    const { data, error } = await supabase
        .from("finance_projects")
        .insert([mapProjectToDB(projectFields)])
        .select("id")
        .single();
    if (error) throw error;

    if (members !== undefined || memberIds !== undefined) {
        const normalizedMembers: ProjectMember[] =
            members ??
            (memberIds || []).map((id) => ({
                id,
                role: "MEMBER",
                permissions: [],
                addedAt: Date.now(),
                addedBy: undefined,
            }));

        const normalizedMemberIds = normalizedMembers.map((m) => m.id);
        // Persist member list for checkbox selection & fast access checks
        const { error: miErr } = await supabase
            .from("finance_projects")
            .update({ member_ids: normalizedMemberIds })
            .eq("id", data.id);
        if (miErr) {
            console.warn("createProject: failed to update member_ids, will fallback.", miErr);
        }
    }

    await logAction("CREATE_PROJECT", { name: project.name }, data.id);
    return data.id;
}

export async function getProject(id: string): Promise<Project | null> {
    const { data, error } = await supabase.from("finance_projects").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const [withRels] = await attachRelationsToProjects([mapProjectFromDB(data)]);
    return withRels;
}

export async function updateProject(projectId: string, data: Partial<Project>): Promise<void> {
    const { incomeSubCategories, expenseSubCategories, members, memberIds, ...projectFields } = data;

    const dbPayload = mapProjectToDB(projectFields);
    if (Object.keys(dbPayload).length > 0) {
        const { error } = await supabase.from("finance_projects").update(dbPayload).eq("id", projectId);
        if (error) throw error;
    }

    if (incomeSubCategories !== undefined && expenseSubCategories !== undefined) {
        await replaceProjectSubCategories(projectId, incomeSubCategories, expenseSubCategories);
    }

    if (members !== undefined || memberIds !== undefined) {
        const normalizedMembers: ProjectMember[] =
            members ??
            (memberIds || []).map((id) => ({
                id,
                role: "MEMBER",
                permissions: [],
                addedAt: Date.now(),
                addedBy: undefined,
            }));

        const normalizedMemberIds = normalizedMembers.map((m) => m.id);
        const { error: miErr } = await supabase
            .from("finance_projects")
            .update({ member_ids: normalizedMemberIds })
            .eq("id", projectId);
        if (miErr) {
            console.warn("updateProject: failed to update member_ids, will fallback.", miErr);
        }
    }

    if (
        Object.keys(dbPayload).length > 0 ||
        (incomeSubCategories !== undefined && expenseSubCategories !== undefined) ||
        members !== undefined
    ) {
        await logAction("UPDATE_PROJECT", projectFields, projectId);
    }
}

export async function deleteProject(projectId: string): Promise<void> {
    const { error } = await supabase.from("finance_projects").delete().eq("id", projectId);
    if (error) throw error;
    await logAction("DELETE_PROJECT", {}, projectId);
}

// --- Transactions ---
const mapTxFromDB = (data: any): Transaction => ({
    id: data.id,
    amount: Number(data.amount),
    currency: data.currency,
    type: data.type,
    category: data.category,
    parentCategory: data.parent_category || undefined,
    parentCategoryId: data.parent_category_id || undefined,
    description: data.description || undefined,
    date: data.transaction_date, // Note: ISO string in frontend, 'date' type in db might be 'YYYY-MM-DD'
    status: data.status,
    accountId: data.account_id || undefined,
    projectId: data.project_id || undefined,
    fundId: data.fund_id || undefined,
    source: data.source || undefined,
    images: data.images || [],
    beneficiary: data.beneficiary || undefined,
    platform: data.platform || undefined,
    bankInfo: data.bank_info || undefined,
    transferContent: data.transfer_content || undefined,
    proofOfPayment: data.proof_of_payment || [],
    proofOfReceipt: data.proof_of_receipt || [],
    warning: data.warning || false,
    rejectionReason: data.rejection_reason || undefined,
    approvedBy: data.approved_by || undefined,
    rejectedBy: data.rejected_by || undefined,
    paidBy: data.paid_by || undefined,
    confirmedBy: data.confirmed_by || undefined,
    createdBy: data.created_by || "",
    userId: data.owner_user_id || "", 
    paymentType: data.payment_type || undefined,
    createdAt: new Date(data.created_at).getTime(),
    updatedAt: new Date(data.updated_at).getTime(),
});

const mapTxToDB = (data: any) => {
    const res: any = {};
    if (data.amount !== undefined) res.amount = data.amount;
    if (data.currency !== undefined) res.currency = data.currency;
    if (data.type !== undefined) res.type = data.type;
    if (data.category !== undefined) res.category = data.category;
    if (data.parentCategory !== undefined) res.parent_category = data.parentCategory;
    if (data.parentCategoryId !== undefined) res.parent_category_id = data.parentCategoryId;
    if (data.description !== undefined) res.description = data.description;
    if (data.date !== undefined) res.transaction_date = data.date;
    if (data.status !== undefined) res.status = data.status;
    if (data.accountId !== undefined) res.account_id = data.accountId;
    if (data.projectId !== undefined) res.project_id = data.projectId;
    if (data.fundId !== undefined) res.fund_id = data.fundId;
    if (data.source !== undefined) res.source = data.source;
    if (data.images !== undefined) res.images = data.images;
    if (data.beneficiary !== undefined) res.beneficiary = data.beneficiary;
    if (data.platform !== undefined) res.platform = data.platform;
    if (data.bankInfo !== undefined) res.bank_info = data.bankInfo;
    if (data.transferContent !== undefined) res.transfer_content = data.transferContent;
    if (data.proofOfPayment !== undefined) res.proof_of_payment = data.proofOfPayment;
    if (data.proofOfReceipt !== undefined) res.proof_of_receipt = data.proofOfReceipt;
    if (data.warning !== undefined) res.warning = data.warning;
    if (data.rejectionReason !== undefined) res.rejection_reason = data.rejectionReason;
    if (data.approvedBy !== undefined) res.approved_by = data.approvedBy;
    if (data.rejectedBy !== undefined) res.rejected_by = data.rejectedBy;
    if (data.paidBy !== undefined) res.paid_by = data.paidBy;
    if (data.confirmedBy !== undefined) res.confirmed_by = data.confirmedBy;
    if (data.createdBy !== undefined) res.created_by = data.createdBy;
    if (data.userId !== undefined) res.owner_user_id = data.userId;
    if (data.paymentType !== undefined) res.payment_type = data.paymentType;
    return res;
};

export async function getTransactions(): Promise<Transaction[]> {
    const { data, error } = await supabase.from("finance_transactions").select("*").order("transaction_date", { ascending: false });
    if (error) throw error;
    return (data || []).map(mapTxFromDB);
}

export async function createTransaction(tx: Omit<Transaction, "id">): Promise<string> {
    const { data, error } = await supabase.from("finance_transactions").insert([mapTxToDB(tx)]).select("id").single();
    if (error) throw error;
    await logAction("CREATE_TRANSACTION", { amount: tx.amount, currency: tx.currency }, data.id, tx.userId);
    return data.id;
}

export async function updateTransactionStatus(txId: string, status: Transaction["status"]): Promise<void> {
    const { error } = await supabase.from("finance_transactions").update({ status, updated_at: new Date().toISOString() }).eq("id", txId);
    if (error) throw error;
}

export async function updateTransaction(txId: string, tx: Partial<Transaction>): Promise<void> {
    const dbData = mapTxToDB(tx);
    dbData.updated_at = new Date().toISOString();
    const { error } = await supabase.from("finance_transactions").update(dbData).eq("id", txId);
    if (error) throw error;
}

export async function deleteTransaction(txId: string): Promise<void> {
    const { error } = await supabase.from("finance_transactions").delete().eq("id", txId);
    if (error) throw error;
    await logAction("DELETE_TRANSACTION", {}, txId);
}

// --- Fixed Costs ---
const mapFixedCostFromDB = (data: any): FixedCost => ({
    id: data.id,
    name: data.name,
    amount: Number(data.amount),
    currency: data.currency,
    cycle: data.cycle,
    status: data.status,
    lastGenerated: data.last_generated || undefined,
    description: data.description || undefined,
    accountId: data.account_id || undefined,
    category: data.category,
    projectId: data.project_id || undefined,
    lastPaymentDate: data.last_payment_date || undefined,
    nextPaymentDate: data.next_payment_date || undefined,
});

const mapFixedCostToDB = (data: any) => {
    const res: any = {};
    if (data.name !== undefined) res.name = data.name;
    if (data.amount !== undefined) res.amount = data.amount;
    if (data.currency !== undefined) res.currency = data.currency;
    if (data.cycle !== undefined) res.cycle = data.cycle;
    if (data.status !== undefined) res.status = data.status;
    if (data.lastGenerated !== undefined) res.last_generated = data.lastGenerated;
    if (data.description !== undefined) res.description = data.description;
    if (data.accountId !== undefined) res.account_id = data.accountId;
    if (data.category !== undefined) res.category = data.category;
    if (data.projectId !== undefined) res.project_id = data.projectId;
    if (data.lastPaymentDate !== undefined) res.last_payment_date = data.lastPaymentDate;
    if (data.nextPaymentDate !== undefined) res.next_payment_date = data.nextPaymentDate;
    return res;
};

export async function getFixedCosts(): Promise<FixedCost[]> {
    const { data, error } = await supabase.from("finance_fixed_costs").select("*");
    if (error) throw error;
    return (data || []).map(mapFixedCostFromDB);
}

export async function createFixedCost(cost: Omit<FixedCost, "id">): Promise<string> {
    const { data, error } = await supabase.from("finance_fixed_costs").insert([mapFixedCostToDB(cost)]).select("id").single();
    if (error) throw error;
    await logAction("CREATE_FIXED_COST", { name: cost.name, amount: cost.amount }, data.id);
    return data.id;
}

export async function updateFixedCost(id: string, data: Partial<FixedCost>): Promise<void> {
    const { error } = await supabase.from("finance_fixed_costs").update(mapFixedCostToDB(data)).eq("id", id);
    if (error) throw error;
}

export async function deleteFixedCost(id: string): Promise<void> {
    const { error } = await supabase.from("finance_fixed_costs").delete().eq("id", id);
    if (error) throw error;
    await logAction("DELETE_FIXED_COST", {}, id);
}

// --- Revenue ---
const mapRevFromDB = (data: any): MonthlyRevenue => ({
    id: data.id,
    month: data.month,
    year: data.year,
    amount: Number(data.amount),
    currency: data.currency,
    note: data.note || undefined,
    createdAt: new Date(data.created_at).getTime()
});

const mapRevToDB = (data: any) => {
    const res: any = {};
    if (data.month !== undefined) res.month = data.month;
    if (data.year !== undefined) res.year = data.year;
    if (data.amount !== undefined) res.amount = data.amount;
    if (data.currency !== undefined) res.currency = data.currency;
    if (data.note !== undefined) res.note = data.note;
    // Composite id e.g. YYYY-MM when provided
    if (data.id !== undefined) res.id = data.id;
    return res;
};

export async function getRevenues(): Promise<MonthlyRevenue[]> {
    const { data, error } = await supabase.from("finance_monthly_revenues").select("*");
    if (error) throw error;
    const list = (data || []).map(mapRevFromDB);
    return list.sort((a, b) => (Number(b.year) * 12 + Number(b.month)) - (Number(a.year) * 12 + Number(a.month)));
}

export async function createRevenue(data: Omit<MonthlyRevenue, "id">): Promise<string> {
    const dbData = mapRevToDB(data);
    dbData.id = `${data.year}-${data.month}`; // Use composite id if missing
    const { data: inserted, error } = await supabase.from("finance_monthly_revenues").insert([dbData]).select("id").single();
    if (error) throw error;
    await logAction("CREATE_REVENUE", { month: data.month, year: data.year, amount: data.amount }, inserted.id);
    return inserted.id;
}

// --- Funds ---
const mapFundFromDB = (data: any): Fund => ({
    id: data.id,
    name: data.name,
    description: data.description || undefined,
    totalSpent: Number(data.total_spent),
    targetBudget: data.target_budget ? Number(data.target_budget) : undefined,
    keywords: data.keywords || [],
    createdAt: new Date(data.created_at).getTime()
});

const mapFundToDB = (data: any) => {
    const res: any = {};
    if (data.name !== undefined) res.name = data.name;
    if (data.description !== undefined) res.description = data.description;
    if (data.totalSpent !== undefined) res.total_spent = data.totalSpent;
    if (data.targetBudget !== undefined) res.target_budget = data.targetBudget;
    if (data.keywords !== undefined) res.keywords = data.keywords;
    return res;
};

export async function getFunds(): Promise<Fund[]> {
    const { data, error } = await supabase.from("finance_funds").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(mapFundFromDB);
}

export async function createFund(fund: Omit<Fund, "id">): Promise<string> {
    const { data, error } = await supabase.from("finance_funds").insert([mapFundToDB(fund)]).select("id").single();
    if (error) throw error;
    await logAction("CREATE_FUND", { name: fund.name }, data.id);
    return data.id;
}

export async function updateFund(id: string, data: Partial<Fund>): Promise<void> {
    const { error } = await supabase.from("finance_funds").update(mapFundToDB(data)).eq("id", id);
    if (error) throw error;
    await logAction("UPDATE_FUND", data, id);
}

export async function deleteFund(id: string): Promise<void> {
    const { error } = await supabase.from("finance_funds").delete().eq("id", id);
    if (error) throw error;
    await logAction("DELETE_FUND", {}, id);
}

// --- Beneficiaries ---
const mapBeneficiaryFromDB = (data: any): Beneficiary => ({
    id: data.id,
    name: data.name,
    platforms: data.platforms || [],
    bankAccounts: data.bank_accounts || [],
    description: data.description || undefined,
    isActive: data.is_active,
    createdAt: new Date(data.created_at).getTime(),
    updatedAt: new Date(data.updated_at).getTime(),
});

const mapBeneficiaryToDB = (data: any) => {
    const res: any = {};
    if (data.name !== undefined) res.name = data.name;
    if (data.platforms !== undefined) res.platforms = data.platforms;
    if (data.bankAccounts !== undefined) res.bank_accounts = data.bankAccounts;
    if (data.description !== undefined) res.description = data.description;
    if (data.isActive !== undefined) res.is_active = data.isActive;
    return res;
};

export async function getBeneficiaries(): Promise<Beneficiary[]> {
    const { data, error } = await supabase.from("finance_beneficiaries").select("*");
    if (error) throw error;
    return (data || []).map(mapBeneficiaryFromDB);
}

export async function createBeneficiary(beneficiary: Omit<Beneficiary, "id">): Promise<string> {
    const { data, error } = await supabase.from("finance_beneficiaries").insert([mapBeneficiaryToDB(beneficiary)]).select("id").single();
    if (error) throw error;
    await logAction("CREATE_BENEFICIARY", { name: beneficiary.name }, data.id);
    return data.id;
}

export async function updateBeneficiary(id: string, data: Partial<Beneficiary>): Promise<void> {
    const dbData = mapBeneficiaryToDB(data);
    dbData.updated_at = new Date().toISOString();
    const { error } = await supabase.from("finance_beneficiaries").update(dbData).eq("id", id);
    if (error) throw error;
    await logAction("UPDATE_BENEFICIARY", data, id);
}

export async function deleteBeneficiary(id: string): Promise<void> {
    const { error } = await supabase.from("finance_beneficiaries").delete().eq("id", id);
    if (error) throw error;
    await logAction("DELETE_BENEFICIARY", {}, id);
}

// --- Budget Requests (Manager Approval) ---

export async function getBudgetRequests(): Promise<BudgetRequest[]> {
    const { data, error } = await supabase
        .from("budget_requests")
        .select("*, du_an(ten_du_an), crm_agencies(ten_agency)")
        .eq("trang_thai", "cho_phe_duyet")
        .order("created_at", { ascending: false });
    
    if (error) throw error;
    return data || [];
}

export async function updateBudgetStatus(id: string, status: 'dong_y' | 'tu_choi', reason?: string): Promise<void> {
    const updateData: any = { 
        trang_thai: status,
        updated_at: new Date().toISOString()
    };
    if (reason) updateData.ly_do_tu_choi = reason;
    
    const { error } = await supabase
        .from("budget_requests")
        .update(updateData)
        .eq("id", id);
    
    if (error) throw error;
}

export async function updateBudgetRequestStatus(id: string, status: 'dong_y' | 'tu_choi', reason?: string): Promise<void> {
    await updateBudgetStatus(id, status, reason);
}

export async function approveBudgetByDirector(id: string, approverName: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await supabase
        .from("budget_requests")
        .update({
            giam_doc_da_duyet: true,
            giam_doc_duyet_boi: approverName,
            giam_doc_duyet_at: now,
            updated_at: now
        })
        .eq("id", id);

    if (error) throw error;
}

export async function approveBudgetByAccountant(id: string, approverName: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await supabase
        .from("budget_requests")
        .update({
            ke_toan_da_duyet: true,
            ke_toan_duyet_boi: approverName,
            ke_toan_duyet_at: now,
            updated_at: now
        })
        .eq("id", id);

    if (error) throw error;
}

export async function disburseBudgetRequest(id: string, imageUrls: string[], disburserName: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await supabase
        .from("budget_requests")
        .update({
            da_giai_ngan: true,
            anh_giai_ngan_urls: imageUrls,
            giai_ngan_boi: disburserName,
            giai_ngan_at: now,
            trang_thai: "dong_y",
            updated_at: now
        })
        .eq("id", id);

    if (error) throw error;
}
