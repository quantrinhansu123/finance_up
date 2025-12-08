export interface CompanySettings {
  id: string;
  allowedIPs: string[]; // Danh sách IP công ty được phép check-in
  workStartTime: string; // Giờ bắt đầu làm việc (HH:mm format)
  workEndTime: string; // Giờ kết thúc làm việc (HH:mm format)
  lateThresholdMinutes: number; // Số phút được phép đi muộn (mặc định 15)
  workingDaysPerMonth: number; // Số ngày công chuẩn (mặc định 26)
  createdAt: Date;
  updatedAt: Date;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  date: string; // YYYY-MM-DD format
  checkInTime: Date;
  checkInIP: string;
  checkInPhoto?: string; // URL ảnh chụp khi check-in
  checkOutTime?: Date;
  checkOutIP?: string;
  checkOutPhoto?: string; // URL ảnh chụp khi check-out
  status: 'present' | 'late' | 'absent' | 'half-day';
  lateMinutes?: number;
  workHours?: number; // Số giờ làm việc thực tế
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MonthlySalary {
  id: string;
  userId: string;
  userName: string;
  departmentId?: string;
  month: string; // YYYY-MM format
  baseSalary: number;
  workingDays: number; // Số ngày công chuẩn
  presentDays: number; // Số ngày đi làm
  absentDays: number; // Số ngày nghỉ
  lateDays: number; // Số ngày đi muộn
  halfDays: number; // Số ngày làm nửa ngày
  totalDeduction: number; // Tổng trừ lương
  finalSalary: number; // Lương thực nhận
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}
