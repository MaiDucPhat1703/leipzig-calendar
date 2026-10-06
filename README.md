# Leipzig – GitHub Pages

Giữ nguyên giao diện, các bộ lọc nhóm độc lập, lịch ngày, zoom tuần, chọn cột vàng, phân tích tiêu đề và xuất PDF.

## Hướng dẫn Windows với GitHub Desktop

1. Giải nén ZIP. Bên trong `leipzig-github-pages` có `ui`, `scripts`, `.github` và README này.
2. Cài https://desktop.github.com/ rồi đăng nhập GitHub.
3. **File → New repository**. Name: `leipzig-calendar`. Chọn nơi lưu, bấm **Create repository**.
4. **Repository → Show in Explorer**. Copy TOÀN BỘ nội dung bên trong thư mục giải nén vào thư mục repository vừa tạo, kể cả `.github` và `.gitignore`. Không copy thư mục cha bao ngoài.
5. Trong Desktop, nhập Summary `Add Leipzig dashboard`, bấm **Commit to main**.
6. **Publish repository**. Bỏ chọn **Keep this code private** nếu dùng GitHub Free rồi Publish. Repository/web công khai sẽ chứa tên người đặt và tiêu đề cuộc họp trong dữ liệu; gói không chứa token hoặc email.
7. Trên github.com mở repository → **Settings → Pages → Build and deployment → Source → GitHub Actions**. Không chọn Deploy from a branch.
8. **Actions → Update UII calendar and deploy Pages → Run workflow → main → Run workflow**. Bật Actions nếu GitHub yêu cầu. Chờ các bước chuyển xanh.
9. **Settings → Pages → Visit site**. URL thường là `https://TEN-GITHUB.github.io/leipzig-calendar/`.

Không cần npm install, API key hoặc token tự tạo.

## Cập nhật dữ liệu

GitHub Pages là web tĩnh. Actions lấy lịch UII mỗi 5 phút và deploy dữ liệu mới; lịch chạy có thể trễ. Đây là cập nhật định kỳ, không realtime từng giây. Trình duyệt kiểm tra bản dữ liệu đã deploy mỗi 60 giây.

**Cập nhật ngay** trên web chỉ tải snapshot trên Pages. Muốn ép lấy lịch UII ngay: vào Actions → Run workflow, chờ xanh rồi cập nhật trang.

Nếu Fetch thất bại, workflow dừng và giữ website đã deploy. Web báo dữ liệu cũ khi timestamp quá 20 phút. Snapshot mới nằm trong website được deploy, không commit trở lại `ui/data.json` trong repository.

Sau 60 ngày không hoạt động repository công khai, GitHub có thể tắt lịch chạy. Vào Actions → Enable workflow để bật lại.

Phạm vi cố định: năm 2026, phòng Leipzig ID1034, lịch được duyệt màu đen. Không tự chuyển sang năm 2027.

## Khắc phục lỗi

- Không thấy workflow: kiểm tra `.github/workflows/pages.yml` nằm đúng ở gốc repository.
- Web 404: Pages Source phải là GitHub Actions; branch main, workflow phải xanh; đợi Pages xuất bản.
- Fetch đỏ: xem Actions log; nguồn UII có thể tạm lỗi hoặc đổi cấu trúc. Chạy lại workflow. Website cũ vẫn tồn tại.
- Lỗi quyền: Pages phải bật, giữ quyền `pages: write`, `id-token: write`; môi trường github-pages cho phép main.
- Không thấy dữ liệu mới: kiểm tra thời gian đồng bộ, chạy workflow rồi Ctrl+F5 sau deploy.

## Chạy và sửa trên máy

Cần Python3 và Node22 trở lên:

```bash
python scripts/collect.py
node scripts/build-pages.mjs
python -m http.server 8080 --directory dist
```

Mở http://localhost:8080. Sửa file trong `ui/`, commit và push bằng GitHub Desktop.

## Tài liệu GitHub chính thức

- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows

Đã kiểm tra build tại máy tạo gói. Chưa chạy workflow trong tài khoản GitHub của bạn.
