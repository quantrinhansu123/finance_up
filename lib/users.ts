import { supabase } from "./supabase";
import { UserProfile } from "@/types/user";

const mapUserFromDB = (data: any): UserProfile => ({
    uid: data.id,
    email: data.email || "",
    password: data.password || data.pass || "", // password column might not exist in employees, handle fallback in SSO
    displayName: data.display_name || "",
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
    financeRole: data.finance_role || undefined,
    createdAt: new Date(data.created_at || Date.now()),
    updatedAt: new Date(data.updated_at || Date.now())
});

const mapUserToDB = (data: any) => {
    const res: any = {};
    if (data.email !== undefined) res.email = data.email;
    if (data.displayName !== undefined) res.display_name = data.displayName;
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
    if (data.financeRole !== undefined) res.finance_role = data.financeRole;
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

export async function createUser(userId: string, userData: Partial<UserProfile>): Promise<void> {
    const dbData = mapUserToDB(userData);
    dbData.id = userId;
    const { error } = await supabase.from("employees").insert([dbData]);
    if (error) throw error;
}

export async function updateUser(userId: string, userData: Partial<UserProfile>): Promise<void> {
    const dbData = mapUserToDB(userData);
    dbData.updated_at = new Date().toISOString();
    const { error } = await supabase.from("employees").update(dbData).eq("id", userId);
    if (error) throw error;
}

export async function deleteUser(userId: string): Promise<void> {
    const { error } = await supabase.from("employees").delete().eq("id", userId);
    if (error) throw error;
}
