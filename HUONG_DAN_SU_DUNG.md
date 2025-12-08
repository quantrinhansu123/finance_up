# 📘 HƯỚNG DẪN SỬ DỤNG HỆ THỐNG QUẢN LÝ TÀI CHÍNH DOLAB

## 🎯 Tổng quan

Hệ thống quản lý tài chính Dolab giúp theo dõi thu chi, quản lý tài khoản ngân hàng, phê duyệt giao dịch và tạo báo cáo tài chính theo thời gian thực.

---

## 👥 PHÂN QUYỀN NGƯỜI DÙNG

### 1. **ADMIN (Quản trị viên)**
- Điều kiện: `employment.position = "CEO&FOUNDER"` hoặc email `ceo.fata@gmail.com`
- Quyền hạn:
  - ✅ Xem tất cả giao dịch
  - ✅ Phê duyệt/từ chối giao dịch
  - ✅ Quản lý người dùng
  - ✅ Xem thống kê tổng quan
  - ✅ Quản lý tài khoản ngân hàng
  - ✅ Quản lý chi phí cố định
  - ✅ Quản lý dự án, quỹ, doanh thu
  - ✅ Xem báo cáo và nhật ký

### 2. **ACCOUNTANT (Kế toán)**
- Điều kiện: `employment.position` chứa "KẾ TOÁN"
- Quyền hạn:
  - ✅ Xem tất cả giao dịch
  - ✅ Chỉnh sửa số dư tài khoản
  - ✅ Xem thống kê tổng quan
  - ✅ Quản lý tài khoản ngân hàng
  - ✅ Quản lý chi phí cố định
  - ✅ Quản lý dự án, quỹ, doanh thu
  - ✅ Xem báo cáo
  - ❌ Không phê duyệt giao dịch
  - ❌ Không xem nhật ký hệ thống

### 3. **TREASURER (Thủ quỹ)**
- Điều kiện: `employment.position` chứa "THỦ QUỸ"
- Quyền hạn:
  - ✅ Xem tài khoản ngân hàng
  - ✅ Tạo giao dịch trong các danh mục được phép
  - ❌ Không xem thống kê tổng quan
  - ❌ Không phê duyệt giao dịch

### 4. **MANAGER (Quản lý)**
- Điều kiện: `employment.position` chứa "QUẢN LÝ" hoặc "TRƯỞNG PHÒNG"
- Quyền hạn:
  - ✅ Quản lý dự án
  - ✅ Xem báo cáo
  - ✅ Xem giao dịch của mình
  - ❌ Không xem thống kê tổng quan
  - ❌ Không phê duyệt giao dịch

### 5. **STAFF (Nhân viên)**
- Điều kiện: Tất cả các position khác
- Quyền hạn:
  - ✅ Tạo yêu cầu thu/chi
  - ✅ Xem giao dịch của mình
  - ❌ Không xem thống kê tổng quan
  - ❌ Không xem giao dịch của người khác

---

## 🔐 ĐĂNG NHẬP

### Bước 1: Truy cập trang đăng nhập
- URL: `/login`
- Nhập email và mật khẩu từ hệ thống nhân sự

### Bước 2: Chọn "Ghi nhớ đăng nhập"
- ✅ Bật: Lưu thông tin vào `localStorage` (không mất khi đóng trình duyệt)
- ❌ Tắt: Lưu vào `sessionStorage` (mất khi đóng trình duyệt)

### Bước 3: Đăng nhập
- Hệ thống tự động xác định quyền dựa trên `employment.position`
- Chuyển hướng đến trang Dashboard

### Xử lý lỗi:
- **"Không tìm thấy người dùng"**: Email không tồn tại trong hệ thống
- **"Mật khẩu không đúng"**: Kiểm tra lại mật khẩu
- **"Truy cập bị từ chối"**: Lỗi quyền Firestore, liên hệ Admin

---

## 📊 DASHBOARD (Trang tổng quan)

### Chức năng chính:
1. **Tổng số dư**: Hiển thị tổng số dư tất cả tài khoản (quy đổi USD)
2. **Tiền vào/ra**: Thống kê theo tháng/quý/năm
3. **Chờ duyệt**: Số lượng giao dịch đang chờ phê duyệt
4. **Chi theo Quỹ**: Phân bổ chi phí theo từng quỹ (Ads, Vận hành, Lương, SIM, Văn phòng, Marketing)

### Biểu đồ:
- **Thu - Chi theo tháng**: Biểu đồ cột so sánh 6 tháng gần nhất
- **Tỷ lệ chi phí**: Biểu đồ tròn top 5 danh mục chi tiêu
- **Tỷ lệ Lương/Doanh thu**: So sánh lương Marketing, Sale, Vận hành với doanh thu

### Cảnh báo:
- **Khoản chi lớn**: Giao dịch > 5 triệu VND hoặc > $100
- **Đang chờ duyệt**: Danh sách giao dịch cần xử lý

### Lọc dữ liệu:
- **Tháng**: Dữ liệu tháng hiện tại
- **Quý**: Dữ liệu quý hiện tại
- **Năm**: Dữ liệu năm hiện tại

---

## 💰 THU TIỀN (Income)

### Tạo phiếu thu:
1. Click nút **"+ New Income"**
2. Điền thông tin:
   - **Ngày**: Ngày thu tiền
   - **Số tiền**: Số tiền thu được
   - **Tiền tệ**: VND, USD, hoặc KHR
   - **Nguồn**: COD VET, COD JNT, Khách CK, Khác
   - **Tài khoản**: Chọn tài khoản nhận tiền
   - **Dự án**: (Tùy chọn) Gắn với dự án
   - **Mô tả**: Ghi chú chi tiết
3. Click **"Create Income"**

### Trạng thái:
- **PENDING**: Chờ Admin phê duyệt
- **APPROVED**: Đã duyệt, số dư tài khoản được cộng
- **REJECTED**: Bị từ chối

### Lưu ý:
- Chỉ giao dịch **APPROVED** mới ảnh hưởng đến số dư
- Admin có thể phê duyệt tại trang **Phê duyệt**

---

## 💸 CHI TIỀN (Expense)

### Tạo phiếu chi:
1. Click nút **"+ New Expense"**
2. Điền thông tin:
   - **Ngày**: Ngày chi tiền
   - **Số tiền**: Số tiền chi
   - **Tiền tệ**: VND, USD, hoặc KHR
   - **Danh mục**: Chọn từ danh sách (Chi lương, Ads, Văn phòng, SIM, v.v.)
   - **Tài khoản**: Chọn tài khoản trừ tiền
   - **Dự án**: (Tùy chọn) Gắn với dự án
   - **Quỹ**: (Tùy chọn) Gắn với quỹ để theo dõi ngân sách
   - **Mô tả**: Ghi chú chi tiết
   - **File đính kèm**: Upload hóa đơn, chứng từ
3. Click **"Create Expense"**

### Danh mục chi phí:
- Chi lương nhân viên
- Chi phí Ads (Facebook, Google, TikTok)
- Mua đồ dùng văn phòng
- Thanh toán cước vận chuyển (VET, J&T)
- Chi phí SIM (Smart, CellCard, MetPhone)
- Cước vận chuyển nội địa (HN-HCM, HCM-HN)
- Chuyển nội bộ
- Khác

### Lưu ý:
- **TREASURER** chỉ được tạo giao dịch trong các danh mục được phép
- **STAFF** có thể tạo yêu cầu chi cho tất cả danh mục nhưng cần phê duyệt

---

## 🔄 CHUYỂN TIỀN (Transfer)

### Chuyển tiền giữa các tài khoản:
1. Click nút **"+ New Transfer"**
2. Điền thông tin:
   - **Ngày**: Ngày chuyển
   - **Từ tài khoản**: Tài khoản nguồn
   - **Đến tài khoản**: Tài khoản đích
   - **Số tiền**: Số tiền chuyển
   - **Tiền tệ**: VND, USD, hoặc KHR
   - **Mô tả**: Lý do chuyển
3. Click **"Create Transfer"**

### Lưu ý:
- Hệ thống tự động tạo 2 giao dịch:
  - Giao dịch OUT từ tài khoản nguồn
  - Giao dịch IN vào tài khoản đích
- Cả 2 giao dịch đều cần phê duyệt (nếu user không phải Admin)

---

## ✅ PHÊ DUYỆT (Approvals)

**Chỉ dành cho ADMIN**

### Danh sách chờ duyệt:
- Hiển thị tất cả giao dịch có trạng thái **PENDING**
- Thông tin: Ngày, Người tạo, Loại, Danh mục, Số tiền, Mô tả

### Phê duyệt giao dịch:
1. Click nút **"Approve"** màu xanh
2. Hệ thống:
   - Đổi trạng thái thành **APPROVED**
   - Cập nhật số dư tài khoản
   - Ghi log vào nhật ký

### Từ chối giao dịch:
1. Click nút **"Reject"** màu đỏ
2. Hệ thống:
   - Đổi trạng thái thành **REJECTED**
   - Không ảnh hưởng số dư
   - Ghi log vào nhật ký

### Lưu ý:
- Không thể hoàn tác sau khi phê duyệt/từ chối
- Giao dịch đã duyệt mới được tính vào báo cáo

---

## 💳 GIAO DỊCH (Transactions)

### Xem danh sách giao dịch:
- **Admin/Accountant**: Xem tất cả giao dịch
- **Staff/Manager**: Chỉ xem giao dịch của mình

### Bộ lọc:
1. **Ngày**: Lọc theo ngày cụ thể
2. **Dự án**: Lọc theo dự án
3. **Tài khoản**: Lọc theo tài khoản
4. **Tìm kiếm**: Tìm theo nguồn/danh mục

### Thông tin hiển thị:
- Ngày giao dịch
- Loại (Thu/Chi)
- Danh mục
- Số tiền (màu xanh = thu, màu trắng = chi)
- Trạng thái (Đã duyệt/Chờ duyệt/Từ chối)
- Người tạo
- Mô tả

---

## 🏦 TÀI KHOẢN (Accounts)

**Chỉ Admin/Accountant/Treasurer được xem**

### Quản lý tài khoản ngân hàng:
1. Click **"+ Add Account"**
2. Điền thông tin:
   - **Tên tài khoản**: VD: "Vietcombank - HN"
   - **Loại**: Bank, Cash, E-Wallet
   - **Số dư ban đầu**: Số dư hiện tại
   - **Tiền tệ**: VND, USD, KHR
   - **Mô tả**: Ghi chú (số tài khoản, chi nhánh)
3. Click **"Create Account"**

### Chỉnh sửa số dư:
- **Admin/Accountant** có thể chỉnh sửa số dư trực tiếp
- Dùng khi cần điều chỉnh số dư do lỗi hoặc đối soát

### Lưu ý:
- Số dư tự động cập nhật khi giao dịch được phê duyệt
- Không nên chỉnh sửa thủ công trừ khi cần thiết

---

## 📁 DỰ ÁN (Projects)

**Chỉ Admin/Accountant/Manager được quản lý**

### Tạo dự án:
1. Click **"+ Add Project"**
2. Điền thông tin:
   - **Tên dự án**: VD: "Chiến dịch Q4 2024"
   - **Mô tả**: Mục tiêu, phạm vi
   - **Ngân sách**: Ngân sách dự kiến
   - **Tiền tệ**: VND, USD, KHR
3. Click **"Create Project"**

### Theo dõi chi phí:
- Gắn giao dịch với dự án khi tạo thu/chi
- Xem tổng chi phí thực tế so với ngân sách
- Báo cáo chi tiết theo dự án

---

## 💼 QUỸ/NHÓM (Funds)

**Chỉ Admin/Accountant được quản lý**

### Tạo quỹ:
1. Click **"+ Add Fund"**
2. Điền thông tin:
   - **Tên quỹ**: Ads, Vận hành, Lương, SIM, Văn phòng, Marketing
   - **Mô tả**: Mục đích sử dụng
   - **Ngân sách tháng**: Hạn mức chi tiêu
   - **Tiền tệ**: VND, USD, KHR
3. Click **"Create Fund"**

### Theo dõi ngân sách:
- Gắn giao dịch với quỹ khi tạo chi tiêu
- Dashboard hiển thị chi theo quỹ
- Cảnh báo khi vượt ngân sách

---

## 📈 DOANH THU (Revenue)

**Chỉ Admin/Accountant/Manager được quản lý**

### Nhập doanh thu tháng:
1. Click **"+ Add Entry"**
2. Điền thông tin:
   - **Tháng**: 1-12
   - **Năm**: VD: 2024
   - **Doanh thu**: Tổng doanh thu tháng
   - **Tiền tệ**: VND, USD, KHR
   - **Ghi chú**: Nguồn doanh thu
3. Click **"Save Revenue"**

### Mục đích:
- Tính tỷ lệ Lương/Doanh thu
- Đánh giá hiệu quả kinh doanh
- Báo cáo KPI

---

## 📌 CHI PHÍ CỐ ĐỊNH (Fixed Costs)

**Chỉ Admin/Accountant được quản lý**

### Tạo chi phí cố định:
1. Click **"+ Add Fixed Cost"**
2. Điền thông tin:
   - **Tên**: VD: "Tiền thuê văn phòng"
   - **Số tiền**: Chi phí hàng tháng
   - **Tiền tệ**: VND, USD, KHR
   - **Chu kỳ**: Monthly, Quarterly, Yearly
   - **Ngày thanh toán**: Ngày hàng tháng
   - **Tài khoản**: Tài khoản trừ tiền
3. Click **"Create Fixed Cost"**

### Tự động hóa:
- Hệ thống tự động tạo giao dịch chi vào ngày đến hạn
- Gửi thông báo nhắc nhở trước 3 ngày

---

## 👥 NGƯỜI DÙNG (Users)

**Chỉ Admin được xem**

### Danh sách người dùng:
- Hiển thị tất cả user trong hệ thống
- Thông tin: Tên, Email, Position, Role

### Xem chi tiết user:
1. Click vào user
2. Xem:
   - Thông tin cá nhân
   - Tổng giao dịch đã tạo
   - Lịch sử giao dịch

### Lưu ý:
- User được đồng bộ từ hệ thống nhân sự
- Không thể tạo/xóa user trực tiếp trong hệ thống tài chính

---

## 📊 BÁO CÁO (Reports)

**Chỉ Admin/Accountant/Manager được xem**

### Các loại báo cáo:
1. **Báo cáo thu chi**: Tổng hợp theo tháng/quý/năm
2. **Báo cáo theo dự án**: Chi phí và tiến độ
3. **Báo cáo theo quỹ**: So sánh ngân sách vs thực tế
4. **Báo cáo lương**: Tỷ lệ lương/doanh thu
5. **Báo cáo tài khoản**: Biến động số dư

### Xuất báo cáo:
- Format: Excel, PDF
- Tùy chỉnh khoảng thời gian
- Lọc theo dự án, quỹ, tài khoản

---

## 📜 NHẬT KÝ (Logs)

**Chỉ Admin được xem**

### Theo dõi hoạt động:
- Đăng nhập/đăng xuất
- Tạo/sửa/xóa giao dịch
- Phê duyệt/từ chối
- Thay đổi số dư tài khoản
- Thay đổi quyền user

### Thông tin log:
- Thời gian
- User thực hiện
- Hành động
- Dữ liệu trước/sau thay đổi
- IP address

---

## 🔧 CÀI ĐẶT & XỬ LÝ LỖI

### Xóa cache và đăng nhập lại:
```javascript
// Mở Console (F12) và chạy:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### Kiểm tra quyền user:
```javascript
// Mở Console (F12) và chạy:
const user = JSON.parse(localStorage.getItem('user'));
console.log('User:', user);
console.log('Employment Position:', user.employment?.position);
```

### Lỗi thường gặp:

**1. Không thấy Dashboard đầy đủ**
- Nguyên nhân: User không có quyền Admin
- Giải pháp: Kiểm tra `employment.position` phải là "CEO&FOUNDER"

**2. Không thể phê duyệt giao dịch**
- Nguyên nhân: User không phải Admin
- Giải pháp: Chỉ Admin mới có quyền phê duyệt

**3. Số dư không cập nhật**
- Nguyên nhân: Giao dịch chưa được phê duyệt
- Giải pháp: Chờ Admin phê duyệt hoặc tự phê duyệt nếu là Admin

**4. Không thấy menu Người dùng/Nhật ký**
- Nguyên nhân: User không có quyền
- Giải pháp: Chỉ Admin mới thấy các menu này

---

## 📞 HỖ TRỢ

### Liên hệ:
- **Email**: ceo.fata@gmail.com
- **Hotline**: [Số điện thoại]

### Yêu cầu tính năng mới:
- Gửi email với tiêu đề: "[Feature Request] Tên tính năng"
- Mô tả chi tiết use case và lợi ích

### Báo lỗi:
- Gửi email với tiêu đề: "[Bug Report] Mô tả lỗi"
- Đính kèm screenshot và bước tái hiện lỗi

---

## 🎓 TIPS & BEST PRACTICES

### 1. Quản lý giao dịch:
- ✅ Luôn điền đầy đủ mô tả
- ✅ Upload chứng từ cho giao dịch lớn
- ✅ Gắn dự án và quỹ để dễ theo dõi
- ❌ Không tạo giao dịch trùng lặp

### 2. Phê duyệt:
- ✅ Kiểm tra chứng từ trước khi duyệt
- ✅ Xác nhận số tiền và tài khoản
- ❌ Không duyệt giao dịch thiếu thông tin

### 3. Báo cáo:
- ✅ Xuất báo cáo định kỳ (tuần/tháng)
- ✅ So sánh với kỳ trước để phát hiện bất thường
- ✅ Lưu trữ báo cáo để audit

### 4. Bảo mật:
- ✅ Đăng xuất khi rời máy
- ✅ Không chia sẻ mật khẩu
- ✅ Thay đổi mật khẩu định kỳ
- ❌ Không truy cập từ máy công cộng

---

## 📅 CẬP NHẬT

**Phiên bản hiện tại**: 1.0.0  
**Ngày cập nhật**: 07/12/2024

### Tính năng sắp ra mắt:
- 🔔 Thông báo real-time
- 📱 Mobile app
- 🤖 Tự động phân loại giao dịch bằng AI
- 📧 Email báo cáo tự động
- 🔗 Tích hợp với ngân hàng

---

**© 2024 Dolab Finance Management System. All rights reserved.**
