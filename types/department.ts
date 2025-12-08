import { PermissionAction } from './permission';

export interface Department {
  id: string;
  name: string;
  description: string;
  managerId?: string; // ID của trưởng phòng
  managerName?: string;
  permissions?: PermissionAction[]; // Quyền của phòng ban này
  createdAt: Date;
  updatedAt: Date;
}
