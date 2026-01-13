# Hướng dẫn Hệ thống Danh mục Thu Chi Động

## Tổng quan

Hệ thống danh mục 2 cấp:
- **Danh mục GỐC (Master)**: Admin tạo, dùng chung cho tất cả dự án
- **Danh mục CON (Sub-category)**: Tạo trong từng dự án, thuộc danh mục gốc

## Cấu trúc

```
Danh mục GỐC (Admin tạo)
├── Lương
│   ├── [Dự án A] Lương Sale
│   ├── [Dự án A] Lương Marketing
│   ├── [Dự án B] Lương Dev
│   └── [Dự án B] Lương QA
├── Marketing
│   ├── [Dự án A] Facebook Ads
│   └── [Dự án A] Google Ads
└── COD
    ├── [Dự án A] COD VET
    └── [Dự án A] COD JNT
```

## Tính năng

### 1. Quản lý Danh mục Gốc (Admin)
- **Đường dẫn**: `/finance/categories`
- **Quyền**: Chỉ Admin
- **Chức năng**: Tạo/sửa/xóa danh mục gốc cho Thu và Chi

### 2. Quản lý Danh mục Con (Trong dự án)
- **Đường dẫn**: `/finance/projects/[id]` → Tab "Danh mục"
- **Quyền**: Admin hoặc người có quyền quản lý dự án
- **Chức năng**: Tạo danh mục con thuộc danh mục gốc

### 3. Form Thu/Chi
- Chọn dự án → Hiển thị danh mục con của dự án đó
- Fallback về danh mục mặc định nếu chưa có

## Cấu trúc dữ liệu

### MasterCategory (Firestore: finance_master_categories)
```typescript
interface MasterCategory {
    id: string;
    name: string;           // "Lương", "Marketing", "COD"
    type: "INCOME" | "EXPENSE";
    description?: string;
    isActive: boolean;
    createdAt: number;
    createdBy: string;
}
```

### ProjectSubCategory (Lưu trong Project)
```typescript
interface ProjectSubCategory {
    id: string;
    name: string;           // "Lương Sale", "COD VET"
    parentCategoryId: string;
    parentCategoryName?: string;
    type: "INCOME" | "EXPENSE";
    projectId: string;
    description?: string;
    isActive: boolean;
    createdAt: number;
    createdBy: string;
}
```

### Project (cập nhật)
```typescript
interface Project {
    // ... các field cũ
    incomeSubCategories?: ProjectSubCategory[];
    expenseSubCategories?: ProjectSubCategory[];
}
```

## Firebase Rules

```javascript
// Danh mục gốc
match /finance_master_categories/{categoryId} { 
    allow read, write: if true; 
}

// Danh mục con lưu trong finance_projects
// (đã có rule cho finance_projects)
```

## Workflow

### Bước 1: Admin tạo danh mục gốc
1. Vào `/finance/categories`
2. Thêm danh mục Thu: "COD", "Khách CK", "Khác"
3. Thêm danh mục Chi: "Lương", "Marketing", "Vận hành", "SIM"

### Bước 2: Tạo danh mục con trong dự án
1. Vào chi tiết dự án `/finance/projects/[id]`
2. Chọn tab "Danh mục"
3. Thêm danh mục con:
   - Thu: "COD VET" (thuộc COD), "COD JNT" (thuộc COD)
   - Chi: "Lương Sale" (thuộc Lương), "Facebook Ads" (thuộc Marketing)

### Bước 3: Nhân viên tạo giao dịch
1. Vào form Thu/Chi
2. Chọn dự án
3. Chọn danh mục con của dự án đó
4. Nhập thông tin và lưu

## Lưu ý

1. **Tương thích ngược**: Nếu dự án chưa có danh mục con, form sẽ dùng danh mục mặc định
2. **Danh mục gốc bị xóa**: Danh mục con vẫn tồn tại nhưng mất liên kết
3. **Quyền hạn**: Chỉ Admin hoặc người có quyền quản lý dự án mới tạo được danh mục con