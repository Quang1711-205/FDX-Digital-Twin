# Hướng dẫn sử dụng demo

Demo giúp quan sát điểm nghẽn, so sánh phương án bổ sung nguồn lực và xem tác động trong mô phỏng 3D.

**Luồng thao tác:** Chọn tình huống → Chỉnh kế hoạch → Quan sát → Chọn what-if → Xem Chi tiết → Áp dụng → Theo dõi kết quả.

## 1. Chạy trương trình

- Chạy lệnh `npm run dev` nếu web chưa được mở
- Các mục **Tổng quan**, **Mô phỏng**, **Phân tích**, **Nguồn lực** đưa tới khu vực tương ứng; **Lịch sử** mở danh sách các lần chạy.

## 2. Chọn tình huống và kế hoạch

1. Chọn **Tình huống** trên thanh điều khiển của cảnh 3D.
2. Điều chỉnh **Kế hoạch** trên thanh phía trên, ví dụ 110% hoặc 120%.
3. Khi cần, mở **Chi tiết kế hoạch & công đoạn** để xem hoặc điều chỉnh các đầu vào liên quan.

**Đổi Kế hoạch** cập nhật dự báo và nhịp sản xuất, giữ cảnh đang chạy. **Đổi Tình huống** đặt lại mô phỏng theo tình huống mới.

## 3. Quan sát điểm nghẽn

**Kho vật tư → AMR → Khu tập kết vật tư → AGV → Line A/B → Đóng gói → Ô chờ AGV → Kho thành phẩm.**

| Quan sát | Cách đọc |
| --- | --- |
| Nguồn lực hiện có | Số AMR, AGV từng Line và tổng nhân viên đóng gói. |
| Mức tải cao nhất AMR/AGV | Trên 100%: nhu cầu vượt năng lực vận chuyển; cần xem phương án bổ sung xe. |
| Vật tư cần chú ý / trạng thái chuyền | Chuyền thiếu vật tư có thể dừng dù có nhân viên đóng gói. |
| Nhân lực đóng gói | So sánh nhu cầu với năng lực từng Line; trên 100% thì hàng chưa đóng gói có thể tích tụ trước bàn. Hover biểu tượng ⓘ để xem chi tiết. |
| Hàng sau đóng gói | Kiện nằm tại ô chờ đến khi AGV lấy và đưa trực tiếp vào kho thành phẩm. |

Kéo chuột để xoay cảnh, cuộn để zoom; dùng danh sách góc nhìn hoặc **Đặt lại góc nhìn** để quan sát thuận tiện. Hover phương tiện/nhân viên để hiện nhãn. Bắt đầu ở **1× · demo**, tăng tốc khi cần quan sát dài hơn.

## 4. So sánh và xem thử what-if

1. Tới bảng **So sánh kịch bản (What-if Analysis)**.
2. Đọc phương án **Giữ kế hoạch đang chọn** ở đầu bảng làm mốc; các phương án còn lại xếp theo điểm đánh giá từ cao xuống thấp.
3. Bấm vào hàng kịch bản để xem ngay cảnh 3D và dự báo của phương án đó.
4. Bấm **Chi tiết** để mở popup trước–sau: số AMR, AGV theo Line và nhân viên đóng gói thay đổi thế nào.
5. Đối chiếu thẻ **Đề xuất phương án** và trạng thái đóng gói trước khi quyết định.

**Điểm đánh giá:** thang 0–100, cao hơn tốt hơn; xét giảm giao trễ, giảm rủi ro vật tư, nguồn lực bổ sung và quá tải đóng gói. Điểm nguồn lực/chi phí trong demo là quy ước so sánh, không phải giá tiền.

Chọn hàng mới chỉ là **xem thử**. Có thể chuyển sang phương án khác hoặc bấm **Về hiện trạng** để quay lại trạng thái chính; nguồn lực chỉ được chốt khi bấm áp dụng.

## 5. Áp dụng và theo dõi

1. Bấm **Áp dụng vào mô phỏng** tại thẻ phương án đang chọn.
2. Kiểm tra số xe và nhân viên trong cảnh, mục Nguồn lực và thẻ Nhân lực đóng gói.
3. Quan sát chuyền, hàng chờ trước bàn và lượng hàng vào kho. Hàng tồn trước đó được giữ lại, nên cần thời gian để giải phóng; không kỳ vọng biến mất ngay sau áp dụng.
4. Xem **Kết quả mô phỏng gần nhất** và **Lịch sử** để đối chiếu trước–sau.

Khi có kết quả mô phỏng, dùng **Đánh giá vòng mới** để tiếp tục. Nếu có số liệu mức sử dụng thực tế, nhập vào phần kết quả và bấm **Ghi nhận** để đối chiếu. Nếu điều khiển bị khóa trong lúc chạy, chờ kết quả hoặc dùng **Reset** để bắt đầu lại; lần chạy đang chờ sẽ bị hủy.

**Reset** đặt lại mô phỏng và đầu vào; **Đặt lại góc nhìn** chỉ chỉnh camera.

## 6. Thử từng trường hợp

| Trường hợp | Các bước cần thử | Điều cần kiểm tra |
| --- | --- | --- |
| **Vận hành ổn định** | Chọn tình huống → quan sát cấp vật tư và đóng gói → đối chiếu phương án giữ nguyên. | Kiểm tra trạng thái từng Line trước khi quyết định có cần bổ sung nguồn lực. |
| Tăng kế hoạch 110% / 120% | Chọn tình huống thay đổi kế hoạch sản xuất → chỉnh Kế hoạch → so sánh phương án xe và nhân viên kết hợp. | Giữ đúng sản lượng mục tiêu; giải quyết cả cấp vật tư và đóng gói. Không mặc định cùng một phương án tối ưu cho cả hai mức. |
| **Tăng sản lượng · nghẽn AMR** | Chọn tình huống → xem tải AMR → thử phương án thêm AMR, kết hợp nhân viên nếu cần. | Thêm AGV đơn lẻ chưa chắc giải quyết được nguồn cấp từ kho. |
| **Đổi mix · nghẽn AGV Line B** | Chọn tình huống → xem nhu cầu Line B → thử bổ sung AGV Line B. | Popup Chi tiết phải thể hiện bổ sung xe đúng Line; xem thêm tải đóng gói B. |
| **AGV Line A ngừng hoạt động** | Chọn tình huống → thử **Kích hoạt AGV dự phòng**. | Khả năng cấp vật tư Line A cải thiện; kiểm tra các điểm nghẽn còn lại. |
| Thiếu nhân viên đóng gói | Xem Line có tải trên 100% → chọn phương án thêm người tại Line đó → áp dụng. | NPC tăng, năng lực đóng gói tăng và hàng chờ có thể giảm khi năng lực lớn hơn nhu cầu. |
| Chuyền vẫn thiếu vật tư sau áp dụng | Kiểm tra mã vật tư, tồn kho, tải AMR và AGV từng Line → thử phương án giải quyết đúng nguyên nhân. | Thêm nhân viên không giải quyết thiếu vật tư; thêm xe không tạo thêm vật tư khi kho đã hết. |
| Không có phương án nhân lực | Xem nhu cầu/năng lực đóng gói hiện tại. | Khi không thiếu người, demo không tạo phương án bổ sung nhân viên. |

**Ví dụ đóng gói:** ở 120 sản phẩm/giờ, mix 75% A / 25% B, mỗi Line có 1 người xử lý 60 sản phẩm/giờ: A cần 90, tải 150%; B cần 30, tải 50%. Thêm 1 người A đưa năng lực A lên 120 và tải xuống 75%. Đây là ví dụ theo cấu hình mặc định; kết quả đổi khi đầu vào đổi.

## 7. Kết quả

- Đây là mô phỏng theo giả định demo; áp dụng phương án không phát lệnh tới thiết bị nhà máy.
- Giao trễ là dự báo, chưa phải thời gian giao hàng đo từ animation.
- Điểm what-if đã xét vận chuyển vật tư và nhân viên đóng gói, chưa xét riêng năng lực AGV thành phẩm; tiếp tục quan sát hàng sau đóng gói dù điểm cao.
- Lịch sử phục vụ đối chiếu, chưa tự học hoặc tự hiệu chỉnh mô hình.

Xem [README](../README.md) để biết cấu hình và giới hạn chi tiết.
