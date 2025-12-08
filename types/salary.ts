export interface SalaryRecord {
  id: string;
  userId: string;
  userName: string;
  departmentId?: string;
  month: string; // YYYY-MM format
  baseSalary: number;
  workingDays: number; // Số ngày công chuẩn (26)
  absentDays: number; // Số ngày nghỉ
  lateDays: number; // Số ngày đi muộn
  deduction: number; // Tổng trừ lương
  finalSalary: number; // Lương thực nhận
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}
