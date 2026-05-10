const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const pool = require('./db');

const app = express();

// Cấu hình Express
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', './views');

// Cấu hình Session (Duy trì đăng nhập)
app.use(session({
    secret: 'edumanage_hcmut_secret',
    resave: false,
    saveUninitialized: true
}));

// ==========================================
// 1. MIDDLEWARE KIỂM TRA QUYỀN TRUY CẬP
// ==========================================
const requireUser = (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    next();
};

const requireAdmin = (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    if (req.session.user.Role !== 'ADMIN') {
        return res.send(`<script>alert("Bạn không có quyền truy cập trang Quản trị!"); window.location.href="/";</script>`);
    }
    next();
};

// ==========================================
// 2. ĐĂNG KÝ VÀ ĐĂNG NHẬP
// ==========================================
// --- ĐĂNG KÝ ---
app.get('/register', (req, res) => res.render('register', { error: null }));

app.post('/register', async (req, res) => {
    const { username, password, hoten, email, sdt, ngaysinh, gioitinh, duong, quan, city } = req.body;
    if (sdt && !/^\d{10}$/.test(sdt)) {
        return res.render('register', { error: 'Số điện thoại không hợp lệ. Vui lòng nhập đúng 10 chữ số!' });
    }
    const connection = await pool.getConnection(); 
    try {
        await connection.beginTransaction();

        // TỰ ĐỘNG TĂNG MÃ NGƯỜI DÙNG (ND01, ND02...)
        // Trích xuất phần số đằng sau chữ "ND", lấy số lớn nhất
        const [idResult] = await connection.query("SELECT MAX(CAST(SUBSTRING(MaND, 3) AS UNSIGNED)) as maxId FROM NGUOI_DUNG WHERE MaND LIKE 'ND%'");
        let nextId = 1;
        if (idResult[0].maxId !== null) {
            nextId = idResult[0].maxId + 1;
        }
        // Ép chuẩn định dạng 2 chữ số: 1 -> "ND01", 10 -> "ND10"
        const maND = 'ND' + String(nextId).padStart(2, '0');

        // 1. Chèn vào bảng NGUOI_DUNG
        const sqlND = `
            INSERT INTO NGUOI_DUNG (MaND, Ten_Dang_Nhap, Mat_Khau, Ho_Ten, Email, So_Dien_Thoai, Ngay_Sinh, Gioi_Tinh, Duong, Quan, Thanh_Pho)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await connection.query(sqlND, [maND, username, password, hoten, email, sdt, ngaysinh, gioitinh, duong, quan, city]);

        // 2. Chèn vào bảng HOC_VIEN
        const sqlHV = `INSERT INTO HOC_VIEN (MaHV, Diem_Tich_Luy) VALUES (?, 0)`;
        await connection.query(sqlHV, [maND]);

        await connection.commit();
        res.redirect('/login');
    } catch (error) {
        await connection.rollback();
        res.render('register', { error: 'Lỗi đăng ký: ' + error.message });
    } finally {
        connection.release();
    }
});

// --- ĐĂNG NHẬP ---
app.get('/login', (req, res) => {
    if (req.session.user) return res.redirect(req.session.user.Role === 'ADMIN' ? '/admin' : '/dashboard');
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        // Kiểm tra user và xác định Role (ADMIN nếu có tên trong bảng GIANG_VIEN)
        const sql = `
            SELECT n.*, CASE WHEN g.MaGV IS NOT NULL THEN 'ADMIN' ELSE 'USER' END AS Role
            FROM NGUOI_DUNG n
            LEFT JOIN GIANG_VIEN g ON n.MaND = g.MaGV
            WHERE n.Ten_Dang_Nhap = ? AND n.Mat_Khau = ?
        `;
        const [rows] = await pool.query(sql, [username, password]);

        if (rows.length > 0) {
            req.session.user = {
                MaND: rows[0].MaND,
                Ho_Ten: rows[0].Ho_Ten,
                Username: rows[0].Ten_Dang_Nhap,
                Role: rows[0].Role
            };
            res.redirect(rows[0].Role === 'ADMIN' ? '/admin' : '/dashboard');
        } else {
            res.render('login', { error: 'Sai tài khoản hoặc mật khẩu!' });
        }
    } catch (error) {
        res.status(500).send("Lỗi Database: " + error.message);
    }
});

// --- ĐĂNG XUẤT ---
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});


// ==========================================
// 3. TRANG NGƯỜI DÙNG (GIAO DIỆN STUDY4)
// ==========================================
// Trang chủ (Hiển thị tất cả khóa học)
app.get('/', async (req, res) => {
    try {
        const [coursesRows] = await pool.query('CALL sp_TimKiemKhoaHoc(?)', ['']);
        res.render('index', { courses: coursesRows[0], user: req.session.user || null }); 
    } catch (error) {
        res.status(500).send("Lỗi Database: " + error.message);
    }
});

// Trang xem chi tiết một khóa học
app.get('/khoa-hoc/:id', async (req, res) => {
    try {
        const sql = `
            SELECT k.*, n.Ho_Ten AS Ten_Giang_Vien 
            FROM KHOA_HOC k
            LEFT JOIN GIANG_VIEN g ON k.MaGV = g.MaGV
            LEFT JOIN NGUOI_DUNG n ON g.MaGV = n.MaND
            WHERE k.MaKH = ?
        `;
        const [rows] = await pool.query(sql, [req.params.id]);
        
        if (rows.length === 0) return res.status(404).send("Không tìm thấy khóa học!");

        res.render('detail', { course: rows[0], user: req.session.user || null });
    } catch (error) {
        res.status(500).send("Lỗi Database: " + error.message);
    }
});

// ==========================================
// 4. TRANG DASHBOARD CÁ NHÂN CỦA HỌC VIÊN
// ==========================================
app.get('/dashboard', requireUser, async (req, res) => {
    if (req.session.user.Role === 'ADMIN') return res.redirect('/admin'); 
    
    try {
        const maND = req.session.user.MaND;

        // 1. Lấy thông tin cá nhân cơ bản
        const sqlProfile = `
            SELECT n.*, h.Diem_Tich_Luy 
            FROM NGUOI_DUNG n
            LEFT JOIN HOC_VIEN h ON n.MaND = h.MaHV
            WHERE n.MaND = ?
        `;
        const [profileRows] = await pool.query(sqlProfile, [maND]);
        const userProfile = profileRows[0];

        // 2. Lấy Điểm Trung Bình và Xếp Loại
        const sqlAcademic = `SELECT fn_TinhDiemTrungBinh(?) AS DiemTB, fn_XepLoaiHocVien(?) AS XepLoai`;
        const [academicRows] = await pool.query(sqlAcademic, [maND, maND]);
        const academicInfo = academicRows[0] || { DiemTB: null, XepLoai: 'Chưa có dữ liệu' };

        // 3. Lấy danh sách khóa học
        const sqlCourses = `
            SELECT k.MaKH, k.Ten_Khoa_Hoc 
            FROM CoQuyen cq
            JOIN KHOA_HOC k ON cq.MaKH = k.MaKH
            WHERE cq.MaHV = ?
        `;
        const [enrolledCourses] = await pool.query(sqlCourses, [maND]);

        // 4. LẤY LỊCH SỬ CÁC BÀI THI ĐÃ LÀM (THÊM MỚI Ở ĐÂY)
        const sqlHistory = `
            SELECT bdt.Ten_De, lbl.Diem_So, lbl.Ngay_Lam, bdt.Thang_Diem_Toi_Da 
            FROM Luot_Bai_Lam lbl
            JOIN Bo_De_Thi bdt ON lbl.MaDe = bdt.MaDe
            WHERE lbl.MaNguoiLam = ?
            ORDER BY lbl.Ngay_Lam DESC, lbl.MaLuot DESC
        `;
        const [examHistory] = await pool.query(sqlHistory, [maND]);

        res.render('dashboard', { 
            user: req.session.user, 
            profile: userProfile,   
            academic: academicInfo, 
            enrolledCourses: enrolledCourses,
            examHistory: examHistory // <--- Truyền dữ liệu lịch sử ra EJS
        });
    } catch (error) {
        res.status(500).send("Lỗi Database: " + error.message);
    }
});

// THÊM MỚI: Route xử lý cập nhật thông tin cá nhân
app.post('/cap-nhat-thong-tin', requireUser, async (req, res) => {
    const { hoten, email, sdt, gioitinh, ngaysinh, duong, quan, thanhpho } = req.body;
    const maND = req.session.user.MaND; 
    if (sdt && !/^\d{10}$/.test(sdt)) {
        return res.send(`<script>alert("Cập nhật thất bại: Số điện thoại phải có đúng 10 chữ số!"); window.location.href="/dashboard";</script>`);
    }
    try {
        const sql = `
            UPDATE NGUOI_DUNG 
            SET Ho_Ten = ?, Email = ?, So_Dien_Thoai = ?, Gioi_Tinh = ?, Ngay_Sinh = ?, Duong = ?, Quan = ?, Thanh_Pho = ? 
            WHERE MaND = ?
        `;
        // Xử lý ngày sinh rỗng
        const formattedDate = ngaysinh ? ngaysinh : null; 
        
        await pool.query(sql, [hoten, email, sdt, gioitinh, formattedDate, duong, quan, thanhpho, maND]);
        
        // Cập nhật lại tên trong session nếu họ có đổi tên
        req.session.user.Ho_Ten = hoten; 
        
        res.redirect('/dashboard');
    } catch (error) {
        res.send(`<script>alert("Lỗi cập nhật: ${error.message}"); window.location.href="/dashboard";</script>`);
    }
});

// ==========================================
// 5. TRANG QUẢN TRỊ ADMIN
// ==========================================
app.get('/admin', async (req, res) => {
    try {
        // 1. XỬ LÝ TÌM KIẾM 
        const keyword = req.query.keyword || '';
        const [searchResult] = await pool.query('CALL sp_TimKiemKhoaHoc(?)', [keyword]);
        // Kết quả từ procedure thường nằm trong mảng đầu tiên
        const coursesRows = searchResult[0]; 

        // 2. XỬ LÝ THỐNG KÊ DOANH THU 
        const [revenueResult] = await pool.query('CALL sp_ThongKeDoanhThu(?)', ['Đã thanh toán']);
        const revenueData = revenueResult[0];

        // 3. XỬ LÝ TRA CỨU HỌC LỰC 
        const showRank = req.query.showRank === 'true';
        const mahv = req.query.mahv || '';
        let rank = null;

        if (showRank && mahv) {
            // Dùng SELECT để gọi Function trong MySQL
            const [rankResult] = await pool.query('SELECT fn_XepLoaiHocVien(?) AS XepLoai', [mahv]);
            if (rankResult.length > 0) {
                rank = rankResult[0].XepLoai;
            }
        }

        // 4. KIỂM TRA CHẾ ĐỘ SỬA KHÓA HỌC 
        let editData = null;
        const editId = req.query.edit;
        if (editId) {
            const [editResult] = await pool.query('SELECT * FROM KHOA_HOC WHERE MaKH = ?', [editId]);
            if (editResult.length > 0) editData = editResult[0];
        }
const [exams] = await pool.query('SELECT * FROM Bo_De_Thi ORDER BY MaDe DESC');
const [students] = await pool.query('SELECT h.MaHV, n.Ho_Ten, fn_XepLoaiHocVien(h.MaHV) AS XepLoai FROM HOC_VIEN h JOIN NGUOI_DUNG n ON h.MaHV = n.MaND');
        // Ném tất cả dữ liệu ra file admin.ejs
        res.render('admin', {
            user: req.session.user || { Ho_Ten: 'Ban Quản Trị' },
            courses: coursesRows,
            searchKeyword: keyword, 
            revenueData: revenueData,
            showRank: showRank,
            mahv: mahv,
            rank: rank,
            editData: editData,
            exams: exams,
            students: students
        });

    } catch (error) {
        console.error(error);
        res.status(500).send("Lỗi Database: " + error.message);
    }
});
// 5.4. Thêm / Sửa Khóa Học
app.post('/luu-khoa-hoc', requireAdmin, async (req, res) => {
    const { makh, magv, tenkhoahoc, mota, lotrinh, giatien, isEdit } = req.body;
    try {
        if (isEdit === "true") {
            await pool.query('CALL p_suakhoahoc(?,?,?,?,?,?)', [makh, magv, tenkhoahoc, mota, lotrinh, giatien]);
        } else {
            await pool.query('CALL sp_themkhoahoc(?,?,?,?,?,?)', [makh, magv, tenkhoahoc, mota, lotrinh, giatien]);
        }
        res.redirect('/admin');
    } catch (error) {
        res.send(`<script>alert("LỖI CSDL: ${error.message}"); window.location.href="/admin";</script>`);
    }
});

// 5.5. Xóa Khóa Học
app.post('/xoa-khoa-hoc/:id', requireAdmin, async (req, res) => {
    try {
        await pool.query('CALL p_xoakhoahoc(?)', [req.params.id]);
        res.redirect('/admin');
    } catch (error) {
        res.send(`<script>alert("LỖI CSDL: ${error.message}"); window.location.href="/admin";</script>`);
    }
});
// ==========================================
// ROUTE MỚI: TRANG DANH SÁCH CHƯƠNG TRÌNH HỌC
// ==========================================
app.get('/chuong-trinh-hoc', async (req, res) => {
    try {
        // Lấy toàn bộ khóa học từ CSDL
        const [coursesRows] = await pool.query('CALL sp_TimKiemKhoaHoc(?)', ['']);
        
        res.render('courses', { 
            courses: coursesRows[0], 
            user: req.session.user || null 
        }); 
    } catch (error) {
        res.status(500).send("Lỗi Database: " + error.message);
    }
});
// ==========================================
// 6. CHỨC NĂNG GIỎ HÀNG & THANH TOÁN
// ==========================================

// 6.1. Thêm khóa học vào giỏ hàng
app.post('/them-vao-gio/:makh', requireUser, async (req, res) => {
    const maHV = req.session.user.MaND;
    const maKH = req.params.makh;
    const maGH = maHV; 

    try {
        const [checkOwned] = await pool.query('SELECT * FROM CoQuyen WHERE MaHV = ? AND MaKH = ?', [maHV, maKH]);
        if (checkOwned.length > 0) return res.json({ status: 'info', message: 'Bạn đã sở hữu khóa học này rồi!' });

        const [checkCart] = await pool.query('SELECT * FROM BaoGom WHERE MaGH = ? AND MaKH = ?', [maGH, maKH]);
        if (checkCart.length > 0) return res.json({ status: 'warning', message: 'Khóa học này đã có sẵn trong giỏ!' });

        await pool.query('INSERT IGNORE INTO GioHang (MaGH, Ngay_Tao) VALUES (?, CURDATE())', [maGH]);
        await pool.query('INSERT IGNORE INTO BaoGom (MaGH, MaKH) VALUES (?, ?)', [maGH, maKH]);
        
        res.json({ status: 'success', message: 'Đã thêm khóa học vào giỏ hàng thành công!' });
    } catch (error) {
        res.json({ status: 'error', message: 'Lỗi Database: ' + error.message });
    }
});

// 6.2. Hiển thị trang Giỏ hàng
app.get('/gio-hang', requireUser, async (req, res) => {
    const maGH = req.session.user.MaND;
    try {
        const sql = `
            SELECT k.MaKH, k.Ten_Khoa_Hoc, k.Gia_Tien, k.Mo_Ta 
            FROM BaoGom bg
            JOIN KHOA_HOC k ON bg.MaKH = k.MaKH
            WHERE bg.MaGH = ?
        `;
        const [cartItems] = await pool.query(sql, [maGH]);
        
        // Tính tổng tiền
        const tongTien = cartItems.reduce((sum, item) => sum + Number(item.Gia_Tien), 0);

        res.render('cart', { 
            user: req.session.user, 
            cartItems: cartItems,
            tongTien: tongTien 
        });
    } catch (error) {
        res.status(500).send("Lỗi Database: " + error.message);
    }
});

app.post('/thanh-toan', requireUser, async (req, res) => {
    const maHV = req.session.user.MaND;
    const maGH = maHV;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [cartItems] = await connection.query('SELECT MaKH FROM BaoGom WHERE MaGH = ?', [maGH]);
        if (cartItems.length === 0) throw new Error("Giỏ hàng trống!");

        const maHD = 'HD' + Date.now().toString().slice(-5);
        await connection.query(
            'INSERT INTO HOA_DON (MaHD, Ma_Khach_Hang, Ngay_Thanh_Toan, Phuong_Thuc, Trang_Thai) VALUES (?, ?, CURDATE(), ?, ?)',
            [maHD, maHV, 'CK', 'Đã thanh toán']
        );

        for (let item of cartItems) {
            await connection.query('INSERT INTO Chi_Tiet_Mua (MaHD, MaKH) VALUES (?, ?)', [maHD, item.MaKH]);
            await connection.query('INSERT INTO CoQuyen (MaHV, MaKH, Ngay_Kich_Hoat) VALUES (?, ?, CURDATE())', [maHV, item.MaKH]);
        }

        await connection.query('DELETE FROM BaoGom WHERE MaGH = ?', [maGH]);

        await connection.commit();
        res.json({ status: 'success', message: 'Thanh toán thành công! Khóa học đã được thêm vào Dashboard.' });
    } catch (error) {
        await connection.rollback();
        // Lỗi từ Trigger mua trùng sẽ được hứng và báo ra đây
        res.json({ status: 'error', message: error.message }); 
    } finally {
        connection.release();
    }
});
// 6.4 Xóa 1 item khỏi giỏ hàng
app.post('/xoa-khoi-gio/:makh', requireUser, async (req, res) => {
    try {
        await pool.query('DELETE FROM BaoGom WHERE MaGH = ? AND MaKH = ?', [req.session.user.MaND, req.params.makh]);
        res.redirect('/gio-hang');
    } catch (error) {
        res.status(500).send("Lỗi Database");
    }
});
// ==========================================
// 7. GIAO DIỆN KHÔNG GIAN HỌC TẬP
// ==========================================
app.get('/vao-hoc/:makh', requireUser, async (req, res) => {
    const maHV = req.session.user.MaND;
    const maKH = req.params.makh;

    try {
        // 1. Bảo mật: Kiểm tra xem học viên đã thực sự có quyền (CoQuyen) khóa này chưa
        const [checkQuyen] = await pool.query('SELECT * FROM CoQuyen WHERE MaHV = ? AND MaKH = ?', [maHV, maKH]);
        
        if (checkQuyen.length === 0 && req.session.user.Role !== 'ADMIN') {
            return res.send(`<script>alert("Bạn chưa mua khóa học này!"); window.location.href="/dashboard";</script>`);
        }

        // 2. Lấy thông tin Tên Khóa Học
        const [courseInfo] = await pool.query('SELECT * FROM KHOA_HOC WHERE MaKH = ?', [maKH]);
        
        // 3. Lấy danh sách Bài Học thuộc khóa này (lấy từ bảng BAI_HOC)
        const [lessons] = await pool.query('SELECT * FROM BAI_HOC WHERE MaKH = ? ORDER BY MaBH ASC', [maKH]);

        // 4. Render ra giao diện học tập
        res.render('learning', {
            user: req.session.user,
            course: courseInfo[0],
            lessons: lessons
        });

    } catch (error) {
        res.status(500).send("Lỗi Database: " + error.message);
    }
});
// ==========================================
// 8. CHỨC NĂNG THI ONLINE & TÍNH ĐIỂM
// ==========================================

// 8.1. Hiển thị danh sách đề thi
app.get('/de-thi', async (req, res) => {
    try {
        const [exams] = await pool.query('SELECT * FROM Bo_De_Thi');
        
        // --- XỬ LÝ ÉP KIỂU THỜI GIAN CHO TOÀN BỘ DANH SÁCH ---
        exams.forEach(exam => {
            let totalMinutes = 60; // Mặc định
            if (exam.Tong_Thoi_Gian) {
                if (typeof exam.Tong_Thoi_Gian === 'string') {
                    const parts = exam.Tong_Thoi_Gian.split(':');
                    totalMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
                } else if (exam.Tong_Thoi_Gian instanceof Date) {
                    totalMinutes = exam.Tong_Thoi_Gian.getUTCHours() * 60 + exam.Tong_Thoi_Gian.getUTCMinutes();
                }
            }
            exam.Tong_Thoi_Gian = totalMinutes;
        });

        res.render('exams', { user: req.session.user || null, exams: exams });
    } catch (error) { 
        res.status(500).send("Lỗi: " + error.message); 
    }
});

// 8.2. Vào phòng thi (Lấy câu hỏi và Phương án)
app.get('/thi/:made', requireUser, async (req, res) => {
    try {
        const maDe = req.params.made;
        const [examInfo] = await pool.query('SELECT * FROM Bo_De_Thi WHERE MaDe = ?', [maDe]);
        if (examInfo.length === 0) return res.redirect('/de-thi');

        // ======================================================
        // FIX LỖI THỜI GIAN: Đổi "00:45:00" thành số phút (45)
        // ======================================================
        let timeData = examInfo[0].Tong_Thoi_Gian;
        let totalMinutes = 60; 
        
        if (timeData) {
            if (typeof timeData === 'string') {
                const parts = timeData.split(':');
                totalMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
            } else if (timeData instanceof Date) {
                totalMinutes = timeData.getUTCHours() * 60 + timeData.getUTCMinutes();
            }
        }
        examInfo[0].Tong_Thoi_Gian = totalMinutes;
        // ======================================================

        const [questions] = await pool.query('SELECT MaCH, Noi_Dung, Dap_An FROM Cau_Hoi WHERE MaDe = ?', [maDe]);
        
        const [options] = await pool.query(`
            SELECT pa.MaCH, pa.Phuong_AN 
            FROM Phuong_An_Chon pa 
            JOIN Cau_Hoi ch ON pa.MaCH = ch.MaCH 
            WHERE ch.MaDe = ?
        `, [maDe]);

        questions.forEach(q => {
            q.DanhSachPhuongAn = options.filter(opt => opt.MaCH === q.MaCH).map(opt => opt.Phuong_AN);
        });

        res.render('exam-taking', { user: req.session.user, exam: examInfo[0], questions: questions });
    } catch (error) { 
        res.status(500).send("Lỗi: " + error.message); 
    }
});

// 8.3. Nộp bài, chấm điểm và lưu vào CSDL
app.post('/nop-bai/:made', requireUser, async (req, res) => {
    const maHV = req.session.user.MaND;
    const maDe = req.params.made;
    const answers = req.body; 
    
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [correctAnswers] = await connection.query('SELECT MaCH, Dap_An FROM Cau_Hoi WHERE MaDe = ?', [maDe]);
        const [examInfo] = await connection.query('SELECT Thang_Diem_Toi_Da FROM Bo_De_Thi WHERE MaDe = ?', [maDe]);
        
        const maxScore = examInfo[0]?.Thang_Diem_Toi_Da || 10;
        let soCauDung = 0;
        const tongSoCau = correctAnswers.length;
        const maLuot = 'L' + Date.now().toString().slice(-6); 
        let stt = 1;
        const chiTietData = [];

        correctAnswers.forEach(q => {
            const dapAnCuaHocVien = answers[q.MaCH] || '';
            const tinhDungSai = (dapAnCuaHocVien === q.Dap_An) ? 1 : 0;
            if (tinhDungSai === 1) soCauDung++;
            chiTietData.push([maDe, maLuot, String(stt++), q.MaCH, tinhDungSai, dapAnCuaHocVien]);
        });

        const diemSo = tongSoCau > 0 ? ((soCauDung / tongSoCau) * maxScore).toFixed(2) : 0;

        await connection.query('INSERT INTO Luot_Bai_Lam (MaDe, MaLuot, MaNguoiLam, Diem_So, Ngay_Lam) VALUES (?, ?, ?, ?, CURDATE())', [maDe, maLuot, maHV, diemSo]);

        if (chiTietData.length > 0) {
            await connection.query('INSERT INTO Chi_Tiet_Bai_Lam (MaDe, MaLuot, STT, MaCH, Tinh_Dung_Sai, Phuong_An_Chon) VALUES ?', [chiTietData]);
        }

        await connection.commit();
        res.json({ status: 'success', score: diemSo, correct: soCauDung, total: tongSoCau });

    } catch (error) {
        await connection.rollback();
        res.json({ status: 'error', message: error.message });
    } finally {
        connection.release();
    }
});
// ==========================================
// 9. QUẢN TRỊ: TẠO, SỬA, XÓA ĐỀ THI (CÓ PHƯƠNG ÁN CHỌN)
// ==========================================
app.post('/admin/tao-de', requireUser, async (req, res) => {
    if (req.session.user.Role !== 'ADMIN') return res.json({ status: 'error', message: 'Không có quyền truy cập!' });
    const { tende, thoigian, thangdiem, questions } = req.body;
    const maGV = req.session.user.MaND;
    
    let gio = Math.floor(thoigian / 60); let phut = thoigian % 60;
    let timeStr = `${gio < 10 ? '0'+gio : gio}:${phut < 10 ? '0'+phut : phut}:00`;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // TỰ ĐỘNG TĂNG MÃ ĐỀ THI (D01, D02...)
        // Trích xuất phần số đằng sau chữ "D", lấy số lớn nhất
        const [idResult] = await conn.query("SELECT MAX(CAST(SUBSTRING(MaDe, 2) AS UNSIGNED)) as maxId FROM Bo_De_Thi WHERE MaDe LIKE 'D%'");
        let nextId = 1;
        if (idResult[0].maxId !== null) {
            nextId = idResult[0].maxId + 1;
        }
        const maDe = 'D' + String(nextId).padStart(2, '0');
        await conn.query(`INSERT INTO Bo_De_Thi (MaDe, MaGV, Ten_De, Nam_Phat_Hanh, Tong_Thoi_Gian, Thang_Diem_Toi_Da) VALUES (?, ?, ?, CURDATE(), ?, ?)`, [maDe, maGV, tende, timeStr, thangdiem]);

        if (questions && questions.length > 0) {
            const questionData = []; const phuongAnData = [];
            questions.forEach((q, index) => {
                const maCH = maDe + 'C' + index;
                questionData.push([maCH, maDe, q.noidung, 'Đang cập nhật', null, q.dapan]);
                phuongAnData.push([maCH, 'A. ' + q.optA], [maCH, 'B. ' + q.optB], [maCH, 'C. ' + q.optC], [maCH, 'D. ' + q.optD]);
            });
            await conn.query(`INSERT INTO Cau_Hoi (MaCH, MaDe, Noi_Dung, Giai_Thich, File_Am_Thanh, Dap_An) VALUES ?`, [questionData]);
            await conn.query(`INSERT INTO Phuong_An_Chon (MaCH, Phuong_AN) VALUES ?`, [phuongAnData]);
        }
        await conn.commit();
        res.json({ status: 'success', message: 'Tạo đề thi thành công!', redirect: '/de-thi' });
    } catch (error) { await conn.rollback(); res.json({ status: 'error', message: error.message }); } 
    finally { conn.release(); }
});

app.post('/admin/xoa-de/:made', requireUser, async (req, res) => {
    if (req.session.user.Role !== 'ADMIN') return res.json({ status: 'error' });
    try {
        await pool.query('DELETE FROM Phuong_An_Chon WHERE MaCH IN (SELECT MaCH FROM Cau_Hoi WHERE MaDe = ?)', [req.params.made]);
        await pool.query('DELETE FROM Bo_De_Thi WHERE MaDe = ?', [req.params.made]);
        res.json({ status: 'success', message: 'Đã xóa đề thi!' });
    } catch (error) { res.json({ status: 'error', message: error.message }); }
});

app.post('/admin/sua-de/:made', requireUser, async (req, res) => {
    if (req.session.user.Role !== 'ADMIN') return res.json({ status: 'error' });
    const maDe = req.params.made; const { tende, thoigian, thangdiem, questions } = req.body;
    let timeStr = `${Math.floor(thoigian/60).toString().padStart(2,'0')}:${(thoigian%60).toString().padStart(2,'0')}:00`;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query(`UPDATE Bo_De_Thi SET Ten_De=?, Tong_Thoi_Gian=?, Thang_Diem_Toi_Da=? WHERE MaDe=?`, [tende, timeStr, thangdiem, maDe]);

        await conn.query('DELETE FROM Phuong_An_Chon WHERE MaCH IN (SELECT MaCH FROM Cau_Hoi WHERE MaDe = ?)', [maDe]);
        await conn.query('DELETE FROM Cau_Hoi WHERE MaDe = ?', [maDe]);

        if (questions && questions.length > 0) {
            const questionData = []; const phuongAnData = [];
            questions.forEach((q, index) => {
                const maCH = maDe + 'C' + index;
                questionData.push([maCH, maDe, q.noidung, 'Đang cập nhật', null, q.dapan]);
                phuongAnData.push([maCH, 'A. ' + q.optA], [maCH, 'B. ' + q.optB], [maCH, 'C. ' + q.optC], [maCH, 'D. ' + q.optD]);
            });
            await conn.query(`INSERT INTO Cau_Hoi (MaCH, MaDe, Noi_Dung, Giai_Thich, File_Am_Thanh, Dap_An) VALUES ?`, [questionData]);
            await conn.query(`INSERT INTO Phuong_An_Chon (MaCH, Phuong_AN) VALUES ?`, [phuongAnData]);
        }
        await conn.commit();
        res.json({ status: 'success', message: 'Cập nhật thành công!' });
    } catch (error) { await conn.rollback(); res.json({ status: 'error', message: error.message }); } 
    finally { conn.release(); }
});

app.get('/api/de-thi/:made', requireUser, async (req, res) => {
    if (req.session.user.Role !== 'ADMIN') return res.status(403).json({ status: 'error', message: 'Forbidden' });
    
    try {
        const maDe = req.params.made;
        const [examResult] = await pool.query('SELECT * FROM Bo_De_Thi WHERE MaDe = ?', [maDe]);
        if (examResult.length === 0) return res.json({ status: 'error', message: 'Không tìm thấy đề thi!' });
        
        const exam = examResult[0];
        // Đã thêm ORDER BY để câu hỏi không bị xáo trộn
        const [questions] = await pool.query('SELECT * FROM Cau_Hoi WHERE MaDe = ? ORDER BY MaCH ASC', [maDe]);
        const [options] = await pool.query('SELECT pa.MaCH, pa.Phuong_AN FROM Phuong_An_Chon pa JOIN Cau_Hoi ch ON pa.MaCH = ch.MaCH WHERE ch.MaDe = ?', [maDe]);

        // Trộn phương án A, B, C, D an toàn hơn
        questions.forEach(q => {
            const qOpts = options.filter(o => o.MaCH === q.MaCH);
            q.A = (qOpts.length > 0 && qOpts[0]) ? qOpts[0].Phuong_AN.substring(3).trim() : ''; 
            q.B = (qOpts.length > 1 && qOpts[1]) ? qOpts[1].Phuong_AN.substring(3).trim() : '';
            q.C = (qOpts.length > 2 && qOpts[2]) ? qOpts[2].Phuong_AN.substring(3).trim() : '';
            q.D = (qOpts.length > 3 && qOpts[3]) ? qOpts[3].Phuong_AN.substring(3).trim() : '';
        });

        // XỬ LÝ ÉP KIỂU THỜI GIAN (Khắc phục triệt để lỗi báo đỏ)
        let timeString = '00:45:00'; 
        if (exam.Tong_Thoi_Gian) {
            if (typeof exam.Tong_Thoi_Gian === 'string') {
                 timeString = exam.Tong_Thoi_Gian;
            } else if (exam.Tong_Thoi_Gian instanceof Date) {
                 const hours = String(exam.Tong_Thoi_Gian.getUTCHours()).padStart(2, '0');
                 const minutes = String(exam.Tong_Thoi_Gian.getUTCMinutes()).padStart(2, '0');
                 const seconds = String(exam.Tong_Thoi_Gian.getUTCSeconds()).padStart(2, '0');
                 timeString = `${hours}:${minutes}:${seconds}`;
            } else {
                 timeString = exam.Tong_Thoi_Gian.toString();
            }
        }
        exam.Tong_Thoi_Gian = timeString;

        res.json({ status: 'success', exam: exam, questions: questions });
    } catch (error) { 
        res.json({ status: 'error', message: error.message }); 
    }
});
// ==========================================
// KHỞI ĐỘNG SERVER
// ==========================================
app.listen(3000, () => {
    console.log(`🚀 Hệ thống EduManage đang chạy tại: http://localhost:3000`);
});