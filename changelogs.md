# Những thay đổi so với repo ban đầu

Mốc đối chiếu: commit đầu tiên **`b74ad1f` — Initial commit: DENSO Logistics Digital Twin (React + Vite + Three.js)**. Danh sách dưới đây mô tả trạng thái hiện tại của workspace, bao gồm thay đổi chưa commit.

| Hạng mục | Repo ban đầu | Demo hiện tại |
| --- | --- | --- |
| Luồng logistics | Cảnh kho, lấy/gom, tập kết, tuyến AMR/Forklift và chuyền; thử thay đổi số AMR hoặc ca vận chuyển. | Tách AMR kho–tập kết và AGV tập kết–chuyền, phân bổ xe theo nhu cầu A/B và quản lý giao nhận vật tư. |
| Mô hình vật tư | Dữ liệu mock tách thành nhiều JSON và cảnh minh họa. | BOM theo model, Model Mix, tồn kho, số kiện/chuyến và chu kỳ xe cùng tham gia tính nhu cầu; có sổ theo dõi vật tư qua các công đoạn. |
| Trạng thái sản xuất | Chuyển động minh họa của sản phẩm trong cảnh. | Sản phẩm được tạo từ tiêu thụ vật tư mô phỏng; chuyền dừng khi thiếu vật tư, sản phẩm không quay vòng vô hạn. |
| Thành phẩm và nhân lực | Chưa có luồng đóng gói trong cảnh đang chạy. | Thêm NPC đóng gói, hàng chờ trước bàn, kiện chờ AGV và kho thành phẩm; AGV đưa hàng trực tiếp từ ô chờ đóng gói vào kho, bỏ khu tập kết thành phẩm trung gian. Tải nhân viên tham gia đánh giá what-if. |
| Kịch bản what-if | Các phương án nguồn lực nạp sẵn. | Tính lại theo đầu vào hiện tại; tự tạo phương án nhân lực đúng chuyền và các phương án kết hợp xe + nhân viên. |
| Cách chọn phương án | README giới thiệu hệ thống AI đánh giá rủi ro và chi phí. | Khuyến nghị theo quy tắc minh bạch, điểm 0–100 cao hơn tốt hơn; ưu tiên xử lý cả cấp vật tư và đóng gói. Không có mô hình AI tự học. |
| Tương tác quyết định | So sánh phương án trong giao diện ban đầu. | Chọn hàng trong bảng để xem ngay, popup Chi tiết trước–sau, nút áp dụng, lịch sử chạy và đối chiếu mức sử dụng nhập tay. |
| Giao diện | Nhãn 3D và giao diện ban đầu. | Thẻ trạng thái đóng gói gọn, cảnh báo qua ⓘ, nhãn chi tiết chỉ hiện khi hover, điểm sắp giảm dần với phương án giữ kế hoạch đứng đầu; nhu cầu/năng lực hiển thị số nguyên. |
| Thay đổi kế hoạch | Chưa có quy tắc giữ trạng thái hiện tại được tài liệu hóa. | Đổi kế hoạch cập nhật trực tiếp, không đặt lại cảnh; chuyển tình huống đặt lại mô phỏng. Nút Reset vẫn cho phép đặt lại thủ công. |
| Cấu hình và mã nguồn | React, Vite, Three.js, TypeScript, các tệp JSON mock. | Dùng `demo_config.json` làm cấu hình chính; tách logic vận hành, nhân lực, vật tư và thành phẩm thành các helper riêng. |

Quay lại [README](README.md).
