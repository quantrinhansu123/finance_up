# 📋 HƯỚNG DẪN LUỒNG THU CHI THEO DỰ ÁN

## 🎯 TỔNG QUAN LUỒNG HOẠT ĐỘNG

```
┌─────────────────────────────────────────────────────────────────┐
│                    THIẾT LẬP BAN ĐẦU (ADMIN)                    │
├─────────────────────────────────────────────────────────────────┤
│ 1. Tạo DỰ ÁN → Gán thành viên, ngân sách                       │
│ 2. Tạo TÀI KHOẢN → Gán vào dự án, giới hạn hạng mục            │
│ 3. Phân quyền NHÂN VIÊN → financeRole + gán vào dự án          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              LUỒNG THU CHI TUẦN TỰ (NHÂN VIÊN)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  BƯỚC 1: Chọn DỰ ÁN                                            │
│     ↓ (Chỉ thấy dự án mình tham gia)                           │
│                                                                 │
│  BƯỚC 2: Chọn TÀI KHOẢN                                        │
│     ↓ (Chỉ thấy tài khoản của dự án đã chọn)                   │
│     ↓ (Tiền tệ TỰ ĐỘNG theo tài khoản - không chọn được)       │
│     ↓ (Hạng mục TỰ ĐỘNG lọc theo tài khoản)                    │
│                                                                 │
│  BƯỚC 3: Nhập THÔNG TIN                                        │
│     - Số tiền (tiền tệ đã cố định)                             │
│     - Hạng mục (đã lọc sẵn)                                    │
│     - Đính kèm chứng từ                                        │
│     - Ghi chú                                                  │
│                                                                 │
│  BƯỚC 4: XÁC NHẬN & LƯU                                        │
│     - Số tiền nhỏ (<5M VND / <$100) → TỰ ĐỘNG DUYỆT            │
│     - Số tiền lớn → PENDING chờ Admin duyệt                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    LUỒNG DUYỆT (ADMIN/ACCOUNTANT)               │
├─────────────────────────────────────────────────────────────────┤
│ 1. Xem danh sách giao dịch PENDING                             │
│ 2. Kiểm tra: ảnh chứng từ, mô tả, số tiền                      │
│ 3. DUYỆT → Cập nhật số dư tài khoản                            │
│    hoặc TỪ CHỐI → Ghi lý do                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📌 BƯỚC 1: THIẾT LẬP DỰ ÁN (Admin)

### 1.1 Tạo Dự án mới
- Vào **Projects** → **+ New Project**
- Nhập: Tên dự án, Mô tả, Ngân sách, Tiền tệ
- Lưu dự án

### 1.2 Gán thành viên vào Dự án
- Vào chi tiết dự án → **Quản lý thành viên**
- Chọn nhân viên cần gán
- Lưu thay đổi

> ⚠️ **Quan trọng:** Nhân viên chỉ thấy dự án mình được gán!

---

## 📌 BƯỚC 2: THIẾT LẬP TÀI KHOẢN (Admin)

### 2.1 Tạo Tài khoản mới
- Vào **Accounts** → **+ Thêm tài khoản**
- Nhập: Tên, Loại (Ngân hàng/Tiền mặt/Ví), Tiền tệ, Số dư

### 2.2 Cấu hình Kiểm soát Tài khoản

| Tùy chọn | Mô tả |
|----------|-------|
| **🔒 Khóa loại tiền** | Tài khoản VND chỉ chi được VND, không chi USD |
| **📋 Giới hạn hạng mục** | Chỉ cho phép chi một số hạng mục nhất định |
| **📁 Gán vào dự án** | Tài khoản thuộc dự án nào |

### 2.3 Gán Tài khoản vào Dự án
- Vào chi tiết dự án → **Quản lý tài khoản**
- Chọn tài khoản cần gán
- Lưu thay đổi

---

## 📌 BƯỚC 3: PHÂN QUYỀN NHÂN VIÊN (Admin)

### Các vai trò trong hệ thống:

| Vai trò | Quyền hạn |
|---------|-----------|
| **ADMIN** | Toàn quyền: duyệt, xem tất cả, quản lý |
| **ACCOUNTANT** | Xem tất cả, quản lý chi phí, không duyệt |
| **TREASURER** | Quản lý quỹ, tài khoản được gán |
| **MANAGER** | Quản lý dự án, xem báo cáo |
| **STAFF** | Chỉ tạo giao dịch trong phạm vi được gán |

### Cách phân quyền:
- Vào **Users** → Chọn nhân viên
- Chọn **Finance Role** phù hợp
- Lưu thay đổi

---

## 📌 BƯỚC 4: NHÂN VIÊN TẠO GIAO DỊCH

### Luồng tạo giao dịch TUẦN TỰ:

```
1️⃣ Chọn loại: Thu tiền / Chi tiền

2️⃣ BƯỚC 1 - Chọn DỰ ÁN
   → Chỉ thấy dự án mình được gán
   → Chọn xong mới mở bước tiếp theo

3️⃣ BƯỚC 2 - Chọn TÀI KHOẢN  
   → Chỉ thấy tài khoản của dự án đã chọn
   → Tiền tệ TỰ ĐỘNG theo tài khoản (không chọn được)
   → Chọn xong mới mở bước tiếp theo

4️⃣ BƯỚC 3 - Nhập THÔNG TIN
   → Số tiền (tiền tệ đã cố định)
   → Hạng mục (đã lọc theo tài khoản)
   → Đính kèm chứng từ
   → Ghi chú

5️⃣ XÁC NHẬN & LƯU
```

### Quy tắc tự động duyệt:
- **VND**: < 5,000,000 → Tự động duyệt
- **USD/KHR/TRY**: < $100 → Tự động duyệt
- Số tiền lớn hơn → Chờ Admin duyệt

---

## 📌 BƯỚC 5: ADMIN DUYỆT GIAO DỊCH

1. Vào **Approvals** (Chờ duyệt)
2. Xem danh sách giao dịch PENDING
3. Kiểm tra:
   - Ảnh chứng từ
   - Mô tả chi tiết
   - Số tiền hợp lý
4. **Duyệt** hoặc **Từ chối** (ghi lý do)

---

## 📊 XEM BÁO CÁO

### Dashboard:
- **Lọc theo Dự án**: Chọn dự án để xem riêng
- **Lọc theo Tiền tệ**: Xem riêng VND, USD, KHR, TRY
- **Lọc theo Thời gian**: Ngày, Tháng, Quý, Năm

### Reports:
- **Báo cáo theo Tiền tệ**: Tách riêng từng loại tiền (không quy đổi)
- **Báo cáo Chi Lương**: Chi tiết ngày thanh toán, số tiền
- **Báo cáo Chi phí Cố định**: Tổng hợp theo hạng mục

---

## ⚠️ LƯU Ý QUAN TRỌNG

1. **Tài khoản VND chỉ chi VND**: Bật "Khóa loại tiền" khi tạo tài khoản
2. **Nhân viên chỉ thấy dự án mình**: Phải gán nhân viên vào dự án
3. **Giới hạn hạng mục chi**: Cấu hình trong tài khoản để tránh chọn nhầm
4. **Báo cáo tách riêng tiền tệ**: Dùng filter "Loại tiền" trong Dashboard/Reports
5. **Xem báo cáo theo ngày**: Chọn "Ngày" trong bộ lọc thời gian

---

## 🔧 KHẮC PHỤC SỰ CỐ

| Vấn đề | Giải pháp |
|--------|-----------|
| Nhân viên không thấy dự án | Gán nhân viên vào dự án |
| Nhân viên không thấy tài khoản | Gán tài khoản vào dự án hoặc gán user vào tài khoản |
| Không chọn được tiền tệ khác | Tài khoản đã bật "Khóa loại tiền" |
| Không thấy hạng mục cần chi | Tài khoản đã giới hạn hạng mục |
| Giao dịch chờ duyệt | Số tiền lớn, cần Admin duyệt |
