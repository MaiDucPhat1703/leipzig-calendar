# Leipzig – GitHub Pages + Cloudflare

## Cập nhật repository hiện tại
1. Giải nén ZIP.
2. Trên GitHub ở gốc repository, Add file → Upload files; kéo ui, scripts và README.md vào rồi Commit changes. Không kéo thư mục cha hoặc ZIP.
3. Mở .github/workflows/pages.yml trên GitHub → Edit; thay toàn bộ nội dung bằng file cùng đường dẫn trong ZIP → Commit changes.
4. Giữ Settings → Pages → Source: GitHub Actions. Chờ lượt triển khai mới thành công, rồi mở web và Ctrl+F5.

## Cơ chế cập nhật
Web gọi https://leipzig-calendar-api.ducphat100.workers.dev/api/calendar khi mở và mỗi 60 giây sau khi lần kiểm tra trước hoàn tất. Khi tab ở nền, việc kiểm tra tạm dừng; quay lại sẽ kiểm tra khi đến hạn. Worker lấy lịch UII, dùng dữ liệu trong bộ nhớ tối đa 60 giây trên mỗi instance và trả dữ liệu đã lọc. Không cần Cron Trigger. Không bảo đảm realtime từng giây.

Actions chỉ triển khai giao diện khi push hoặc chạy thủ công, không còn chạy theo lịch. Không cần Run workflow để lấy lịch mới. Snapshot ui/data.json chỉ là dữ liệu dự phòng ban đầu. Nếu API lỗi, web giữ dữ liệu đang có và báo lỗi, không giả vờ đồng bộ thành công.

Worker cho phép origin https://maiducphat1703.github.io. Nếu đổi tài khoản hoặc tên miền website, phải đổi CORS trong Worker. Phạm vi: Leipzig, lịch màu đen, năm 2026.

API đã trả dữ liệu trong ảnh người dùng. Gói đã kiểm tra cú pháp và build; chưa triển khai bản giao diện này vào repository người dùng.
