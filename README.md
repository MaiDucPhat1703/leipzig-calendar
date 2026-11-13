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

## Email xác nhận đặt phòng Leipzig

Mã gửi email nằm ở [scripts/apps-script/LeipzigNotifications.gs](scripts/apps-script/LeipzigNotifications.gs). Tạo một dự án riêng tại [Google Apps Script](https://script.google.com/) bằng tài khoản sẽ gửi mail, rồi dán mã vào dự án. Phần này chạy độc lập với GitHub Pages và Cloudflare Worker. Email người đặt chỉ dùng trong lần chạy gửi mail, không đưa vào dữ liệu công khai hoặc nhật ký.

1. Trong Apps Script, chạy `previewLeipzigNotifications` để xem số lịch theo mã trạng thái. Các lịch Leipzig quan sát được trên UII có `approveForm.status = 1`. Trước khi bật, xác nhận với người quản trị UII hoặc đối chiếu một lượt thử do bạn quản lý trước và sau khi duyệt để biết mã nào thực sự là **Đã duyệt**.
2. Trong **Project Settings → Script properties**, đặt:
   - `APPROVED_STATUS` bằng mã đã xác nhận.
   - `SENDER_ACCOUNT` bằng địa chỉ chính của tài khoản Google chạy tác vụ.
   - `SENDER_FROM` (tùy chọn) bằng địa chỉ đã cấu hình trong Gmail **Gửi thư bằng**. Để trống để gửi từ địa chỉ chính.
   - Giữ `NOTIFICATIONS_ENABLED` ở `false` trong lúc thử. Chuyển sang `true` khi đã xác nhận mã duyệt và sẵn sàng bật thông báo thật.
3. Chạy `sendLeipzigTestEmail` và cấp quyền trên màn hình Google. Thư thử chỉ gửi về tài khoản đang chạy, kể cả khi cấu hình gửi tự động đang tắt. Mở thư và kiểm tra địa chỉ **Từ**. Bước này không đọc lịch hay gửi thư cho người đặt.
4. Chạy `startLeipzigNotifications`. Lần đầu ghi nhận lịch đã có trong khoảng 120 ngày tới mà không gửi mail. Sau đó tác vụ kiểm tra mỗi 5 phút. Chỉ lượt có mã đặt phòng mới, có đúng trạng thái và xuất hiện công khai trong khoảng đã theo dõi mới được gửi. Mỗi ngày mới mở rộng ở cuối khoảng 120 ngày được ghi nhận làm mốc, để tránh gửi cho lịch cũ vừa lọt vào phạm vi. Lịch đã kết thúc không được gửi.
5. Đổi địa chỉ gửi cùng tài khoản bằng cách sửa `SENDER_FROM`. Nếu đổi hẳn tài khoản, chạy `stopLeipzigNotifications` từ tài khoản cũ, cấp quyền chỉnh sửa cùng dự án cho tài khoản mới, cập nhật `SENDER_ACCOUNT` và `SENDER_FROM`, rồi chạy `startLeipzigNotifications` bằng tài khoản mới. Dùng cùng dự án để giữ lịch sử đã gửi.
6. Xem **Executions** để kiểm tra số lượt gửi và số lượt cần kiểm tra. Nếu một lượt có giá trị `sending` trong `LEIPZIG_BOOKING_<mã>`, kiểm tra thư đã gửi bằng mã đặt phòng. Nếu thư đã đi, đổi giá trị thành `sent`. Nếu chắc chắn chưa đi, xóa riêng khóa đó để lần chạy sau thử lại. Muốn tạm dừng, chạy `stopLeipzigNotifications` hoặc đổi `NOTIFICATIONS_ENABLED` thành `false`.
