# EduManage - Hệ thống quản lý khóa học trực tuyến

EduManage là ứng dụng web quản lý khóa học trực tuyến được xây dựng cho bài tập lớn môn Hệ cơ sở dữ liệu. Hệ thống hỗ trợ người học xem khóa học, thêm khóa học vào giỏ hàng, thanh toán, học tập, làm đề thi online và theo dõi kết quả học tập. Bên cạnh đó, quản trị viên/giảng viên có thể quản lý khóa học, quản lý đề thi, thống kê doanh thu và tra cứu học lực học viên.

## Đường dẫn mã nguồn


```text
https://github.com/qb-isme/BTL2_Database
```

## Chức năng chính

### Người dùng / Học viên

- Đăng ký tài khoản học viên.
- Đăng nhập và đăng xuất.
- Xem danh sách khóa học.
- Xem chi tiết khóa học.
- Thêm khóa học vào giỏ hàng.
- Xóa khóa học khỏi giỏ hàng.
- Thanh toán khóa học.
- Xem dashboard cá nhân.
- Xem các khóa học đã sở hữu.
- Truy cập không gian học tập.
- Xem danh sách đề thi online.
- Làm bài thi và nhận điểm sau khi nộp bài.
- Xem lịch sử làm bài.
- Cập nhật thông tin cá nhân.

### Quản trị viên / Giảng viên

- Đăng nhập vào trang quản trị.
- Thêm khóa học mới.
- Cập nhật thông tin khóa học.
- Xóa khóa học.
- Tìm kiếm khóa học theo từ khóa.
- Thống kê doanh thu khóa học từ các hóa đơn đã thanh toán.
- Tra cứu học lực học viên.
- Tạo đề thi mới.
- Sửa đề thi.
- Xóa đề thi.
- Quản lý câu hỏi và phương án chọn của đề thi.

## Công nghệ sử dụng

- **Node.js**: xây dựng server ứng dụng.
- **Express.js**: định tuyến và xử lý request/response.
- **EJS**: render giao diện động phía server.
- **MySQL**: hệ quản trị cơ sở dữ liệu.
- **Bootstrap 5**: xây dựng giao diện responsive.
- **Font Awesome**: hiển thị icon.
- **express-session**: quản lý phiên đăng nhập.
- **body-parser**: xử lý dữ liệu form và request body.

## Cấu trúc thư mục tham khảo

```text
EduManage/
│
├── app.js                  # File server chính của ứng dụng
├── db.js                   # Cấu hình kết nối MySQL
├── package.json            # Danh sách dependency và script chạy ứng dụng
├── quanlikhoahoc.sql       # File tạo CSDL, bảng, dữ liệu mẫu, procedure, trigger, function
│
├── public/                 # Tài nguyên tĩnh: CSS, JS, hình ảnh
│
└── views/                  # Giao diện EJS
    ├── admin.ejs           # Trang quản trị
    ├── cart.ejs            # Trang giỏ hàng
    ├── courses.ejs         # Danh sách chương trình học
    ├── dashboard.ejs       # Dashboard học viên
    ├── detail.ejs          # Chi tiết khóa học
    ├── exams.ejs           # Danh sách đề thi
    ├── exam-taking.ejs     # Giao diện làm bài thi
    ├── index.ejs           # Trang chủ
    ├── learning.ejs        # Không gian học tập
    ├── login.ejs           # Đăng nhập
    └── register.ejs        # Đăng ký
```

## Yêu cầu cài đặt

Trước khi chạy dự án, cần cài đặt:

- Node.js
- MySQL Server
- MySQL Workbench hoặc công cụ quản trị CSDL tương đương
- Git nếu muốn clone repository từ GitHub

## Cài đặt và chạy ứng dụng

### Bước 1: Clone repository

```bash
git clone https://github.com/<username>/<repository-name>.git
cd <repository-name>
```

### Bước 2: Cài đặt dependency

```bash
npm install
```

Nếu chưa có file `package.json`, có thể cài thủ công các thư viện chính:

```bash
npm install express body-parser express-session mysql2 ejs
```

### Bước 3: Tạo cơ sở dữ liệu

Mở MySQL Workbench hoặc terminal MySQL, sau đó chạy file SQL của dự án:

```sql
SOURCE path/to/quanlikhoahoc.sql;
```

Hoặc copy nội dung trong file `quanlikhoahoc.sql` và chạy trực tiếp trong MySQL Workbench.

File SQL bao gồm:

- Tạo bảng dữ liệu.
- Thêm dữ liệu mẫu.
- Tạo stored procedure.
- Tạo trigger.
- Tạo function.

### Bước 4: Cấu hình kết nối database

Tạo hoặc kiểm tra file `db.js` theo mẫu sau:

```js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'your_password',
    database: 'your_database_name',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;
```

Cần thay các thông tin sau cho đúng với máy đang chạy:

```text
user
password
database
```

### Bước 5: Khởi động server

```bash
node app.js
```

Sau khi chạy thành công, truy cập:

```text
http://localhost:3000
```

## Các route chính

### Route người dùng

| Method | Route | Chức năng |
|---|---|---|
| GET | `/` | Trang chủ, hiển thị danh sách khóa học |
| GET | `/register` | Giao diện đăng ký |
| POST | `/register` | Xử lý đăng ký tài khoản học viên |
| GET | `/login` | Giao diện đăng nhập |
| POST | `/login` | Xử lý đăng nhập |
| GET | `/logout` | Đăng xuất |
| GET | `/dashboard` | Dashboard cá nhân của học viên |
| POST | `/cap-nhat-thong-tin` | Cập nhật thông tin cá nhân |
| GET | `/chuong-trinh-hoc` | Danh sách chương trình học |
| GET | `/khoa-hoc/:id` | Chi tiết khóa học |
| POST | `/them-vao-gio/:makh` | Thêm khóa học vào giỏ hàng |
| GET | `/gio-hang` | Xem giỏ hàng |
| POST | `/xoa-khoi-gio/:makh` | Xóa khóa học khỏi giỏ hàng |
| POST | `/thanh-toan` | Thanh toán khóa học |
| GET | `/vao-hoc/:makh` | Vào không gian học tập |
| GET | `/de-thi` | Danh sách đề thi |
| GET | `/thi/:made` | Giao diện làm bài thi |
| POST | `/nop-bai/:made` | Nộp bài và chấm điểm |

### Route quản trị

| Method | Route | Chức năng |
|---|---|---|
| GET | `/admin` | Trang quản trị |
| POST | `/luu-khoa-hoc` | Thêm hoặc sửa khóa học |
| POST | `/xoa-khoa-hoc/:id` | Xóa khóa học |
| POST | `/admin/tao-de` | Tạo đề thi mới |
| POST | `/admin/sua-de/:made` | Sửa đề thi |
| POST | `/admin/xoa-de/:made` | Xóa đề thi |
| GET | `/api/de-thi/:made` | Lấy dữ liệu đề thi để sửa |

## Liên kết với stored procedure, trigger và function

Ứng dụng có gọi trực tiếp các thủ tục và hàm trong cơ sở dữ liệu.

### Procedure thêm, sửa, xóa khóa học

| Chức năng | Procedure |
|---|---|
| Thêm khóa học | `sp_themkhoahoc` |
| Sửa khóa học | `p_suakhoahoc` |
| Xóa khóa học | `p_xoakhoahoc` |

Các procedure này được gọi trong route:

```text
POST /luu-khoa-hoc
POST /xoa-khoa-hoc/:id
```

### Procedure hiển thị dữ liệu

| Chức năng | Procedure |
|---|---|
| Tìm kiếm khóa học | `sp_TimKiemKhoaHoc` |
| Thống kê doanh thu | `sp_ThongKeDoanhThu` |

Trong trang quản trị, doanh thu được thống kê với trạng thái:

```text
Đã thanh toán
```

Vì vậy phần doanh thu trên giao diện là doanh thu thực thu từ các hóa đơn đã thanh toán.

### Function

| Chức năng | Function |
|---|---|
| Tính điểm trung bình | `fn_TinhDiemTrungBinh` |
| Xếp loại học viên | `fn_XepLoaiHocVien` |

Các function này được dùng trong dashboard học viên và chức năng tra cứu học lực trên trang quản trị.

### Trigger

| Trigger | Mục đích |
|---|---|
| `trg_ChongMuaTrung` | Chặn học viên mua trùng khóa học đã sở hữu |
| `trg_CongDiemTichLuy` | Cộng điểm tích lũy khi học viên có lượt bài làm mới cao hơn điểm cao nhất cũ |

## Tài khoản mẫu

> Cập nhật lại tài khoản mẫu theo dữ liệu trong CSDL của nhóm.

### Tài khoản quản trị / giảng viên

```text
Tên đăng nhập: teacher_john
Mật khẩu: 123
```

### Tài khoản học viên

```text
Tên đăng nhập: cuong_pro
Mật khẩu: 123
```

## Một số hình ảnh minh họa nên đưa vào báo cáo

- Trang chủ.
- Giao diện đăng nhập.
- Giao diện đăng ký.
- Giao diện quản lý khóa học.
- Giao diện thêm khóa học.
- Giao diện sửa khóa học.
- Giao diện xóa khóa học.
- Giao diện tìm kiếm khóa học.
- Giao diện thống kê doanh thu.
- Giao diện tra cứu học lực.
- Giao diện giỏ hàng.
- Dashboard học viên.
- Danh sách đề thi.
- Giao diện làm bài thi.

## Hạn chế hiện tại

Ứng dụng đã hiện thực các chức năng cốt lõi của hệ thống quản lý khóa học trực tuyến. Tuy nhiên, một số chức năng định hướng ban đầu vẫn chưa được triển khai đầy đủ, bao gồm:

- Chức năng flashcard hỗ trợ ôn tập.
- Chức năng blog học tập.
- Chức năng bình luận và tương tác giữa học viên.

Các chức năng này có thể được phát triển trong các phiên bản tiếp theo để tăng tính tương tác và hỗ trợ học tập cộng đồng.

## Tác giả

Nhóm thực hiện bài tập lớn môn Hệ cơ sở dữ liệu.

```text
Nhóm: 8
Lớp: L04
Thành viên:
- Trần Hoàng Quốc Bảo - 2410297
- Đào Quang Huy - 2411167
- Phạm Tiến Đạt - 2410723
- Vũ Hoàng Sang - 2412996
