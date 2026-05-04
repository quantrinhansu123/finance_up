import { supabase } from "./supabase";
import { UserProfile } from "@/types/user";

const mapUserFromDB = (data: any): UserProfile => ({
    uid: data.id,
    email: data.email || "",
    password: data.password || data.pass || "", // password column might not exist in employees, handle fallback in SSO
    displayName: data.name || data.display_name || "",
    boPhan: data.bo_phan || data.department || undefined,
    team: data.team || undefined,
    role: data.role || "student",
    position: data.position || undefined,
    departmentId: data.department_id || undefined,
    monthlySalary: data.monthly_salary ? Number(data.monthly_salary) : undefined,
    totalLearningHours: data.total_learning_hours ? Number(data.total_learning_hours) : undefined,
    approved: data.approved || false,
    photoURL: data.photo_url || undefined,
    dateOfBirth: data.date_of_birth || undefined,
    address: data.address || undefined,
    country: data.country || undefined,
    phoneNumber: data.phone_number || undefined,
    workLocation: data.work_location || undefined,
    employmentStatus: data.employment_status || undefined,
    employmentStartDate: data.employment_start_date || undefined,
    employmentMaritalStatus: data.employment_marital_status || undefined,
    employmentBranch: data.employment_branch || undefined,
    employmentTeam: data.employment_team || undefined,
    employmentSalaryPercentage: data.employment_salary_percentage ? Number(data.employment_salary_percentage) : undefined,
    employmentActive: data.employment_active !== null ? data.employment_active : undefined,
    employment: data.employment || undefined,
    financeRole: data.finance_role || data.financeRole || data.employment?.financeRole || undefined,
    createdAt: new Date(data.created_at || Date.now()),
    updatedAt: new Date(data.updated_at || Date.now())
});

const mapUserToDB = (data: any) => {
    const res: any = {};
    if (data.email !== undefined) res.email = data.email;
    if (data.displayName !== undefined) {
        res.name = data.displayName;
        res.display_name = data.displayName;
    }
    if (data.boPhan !== undefined) {
        res.bo_phan = data.boPhan;
        // Backward-compatible fallback for schemas that only have `department`
        res.department = data.boPhan;
        // employees.team is NOT NULL in many deployments — mirror bộ phận when set
        const bp = typeof data.boPhan === "string" ? data.boPhan.trim() : "";
        res.team = bp || "—";
    }
    if (data.team !== undefined) {
        res.team = typeof data.team === "string" && data.team.trim() ? data.team.trim() : "—";
    }
    if (data.role !== undefined) res.role = data.role;
    if (data.position !== undefined) res.position = data.position;
    if (data.departmentId !== undefined) res.department_id = data.departmentId;
    if (data.monthlySalary !== undefined) res.monthly_salary = data.monthlySalary;
    if (data.totalLearningHours !== undefined) res.total_learning_hours = data.totalLearningHours;
    if (data.approved !== undefined) res.approved = data.approved;
    if (data.photoURL !== undefined) res.photo_url = data.photoURL;
    if (data.dateOfBirth !== undefined) res.date_of_birth = data.dateOfBirth;
    if (data.address !== undefined) res.address = data.address;
    if (data.country !== undefined) res.country = data.country;
    if (data.phoneNumber !== undefined) res.phone_number = data.phoneNumber;
    if (data.workLocation !== undefined) res.work_location = data.workLocation;
    if (data.employmentStatus !== undefined) res.employment_status = data.employmentStatus;
    if (data.employmentStartDate !== undefined) res.employment_start_date = data.employmentStartDate;
    if (data.employmentMaritalStatus !== undefined) res.employment_marital_status = data.employmentMaritalStatus;
    if (data.employmentBranch !== undefined) res.employment_branch = data.employmentBranch;
    if (data.employmentTeam !== undefined) res.employment_team = data.employmentTeam;
    if (data.employmentSalaryPercentage !== undefined) res.employment_salary_percentage = data.employmentSalaryPercentage;
    if (data.employmentActive !== undefined) res.employment_active = data.employmentActive;
    if (data.employment !== undefined) res.employment = data.employment;
    if (data.financeRole !== undefined) {
        res.finance_role = data.financeRole;
        // Backward-compatible fallback for legacy schemas using camelCase column
        res.financeRole = data.financeRole;
        // Chỉ ghi JSON employment khi client gửi kèm — tránh ghi đè cả cột thành { financeRole } và mất employment.password / dữ liệu HR
        if (data.employment !== undefined) {
            const currentEmployment =
                typeof data.employment === "object" && data.employment !== null
                    ? { ...(data.employment as object) }
                    : {};
            res.employment = { ...currentEmployment, financeRole: data.financeRole };
        }
    }
    if (data.password !== undefined) {
        res.password = data.password;
        // Cột legacy `pass` — auth-login so khớp pass/password; nhiều DB chỉ có một trong hai
        res.pass = data.password;
    }
    return res;
};

export async function getUsers(): Promise<UserProfile[]> {
    const { data, error } = await supabase.from("employees").select("*");
    if (error) throw error;
    return (data || []).map(mapUserFromDB);
}

export async function getUserById(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase.from("employees").select("*").eq("id", userId).maybeSingle();
    if (error) throw error;
    return data ? mapUserFromDB(data) : null;
}

export async function getUserByEmail(email: string): Promise<UserProfile | null> {
    const { data, error } = await supabase.from("employees").select("*").eq("email", email).maybeSingle();
    if (error) throw error;
    return data ? mapUserFromDB(data) : null;
}

export async function createUser(userId: string, userData: Partial<UserProfile>): Promise<void> {
    const dbData = mapUserToDB(userData);
    dbData.id = userId;
    if (dbData.team == null || String(dbData.team).trim() === "") {
        const fromEmployment =
            typeof userData.employmentTeam === "string" ? userData.employmentTeam.trim() : "";
        dbData.team = fromEmployment || "—";
    }
    await insertWithMissingColumnRetry("employees", dbData);
}

export async function updateUser(userId: string, userData: Partial<UserProfile>): Promise<void> {
    const dbData = mapUserToDB(userData);
    dbData.updated_at = new Date().toISOString();
    await updateWithMissingColumnRetry("employees", dbData, userId);
}

export async function deleteUser(userId: string): Promise<void> {
    const { error } = await supabase.from("employees").delete().eq("id", userId);
    if (error) throw error;
}

function extractMissingColumn(error: unknown): string | null {
    if (!error || typeof error !== "object") return null;
    const msg = String((error as { message?: unknown }).message || "");
    const match = msg.match(/Could not find the '([^']+)' column/i);
    return match ? match[1] : null;
}

function missingColumnError(column: string): Error {
    if (column === "approved") {
        return new Error(
            "Thiếu cột approved trong bảng employees. Hãy chạy migration 20260428133000_add_approved_to_employees.sql rồi thử lại."
        );
    }
    if (column === "position" || column === "finance_role") {
        return new Error(
            "Thiếu cột position/finance_role trong bảng employees. Hãy chạy migration 20260428141000_add_position_finance_role_to_employees.sql rồi thử lại."
        );
    }
    return new Error(`Thiếu cột ${column} trong bảng employees.`);
}

async function insertWithMissingColumnRetry(
    table: string,
    payload: Record<string, unknown>
): Promise<void> {
    const data = { ...payload };
    for (let i = 0; i < 12; i++) {
        const { error } = await supabase.from(table).insert([data]);
        if (!error) return;
        const missing = extractMissingColumn(error);
        if (missing === "approved" || missing === "position" || missing === "finance_role") {
            throw missingColumnError(missing);
        }
        if (!missing || !(missing in data)) throw error;
        delete data[missing];
    }
    throw new Error("Không thể lưu user: schema employees thiếu quá nhiều cột.");
}

async function updateWithMissingColumnRetry(
    table: string,
    payload: Record<string, unknown>,
    id: string
): Promise<void> {
    const data = { ...payload };
    for (let i = 0; i < 12; i++) {
        const { error } = await supabase.from(table).update(data).eq("id", id);
        if (!error) return;
        const missing = extractMissingColumn(error);
        if (missing === "approved" || missing === "position" || missing === "finance_role") {
            throw missingColumnError(missing);
        }
        if (!missing || !(missing in data)) throw error;
        delete data[missing];
    }
    throw new Error("Không thể cập nhật user: schema employees thiếu quá nhiều cột.");
}
