# FDX Digital Twin - DENSO Logistics Digital Twin

A 3D Digital Twin simulation for automotive component manufacturing logistics built with React, Vite, and Three.js.

## 🚀 Features
- **3D Factory & Logistics Twin**: Visual simulation of material supply, assembly lines, packaging workers, finished-goods queues, and AGV delivery to the finished-goods warehouse.
- **Dynamic 3D Labels Projection**: Area and line labels remain visible; vehicle and worker labels appear on hover.
- **What-If Scenario Simulation**: Compare additional AMRs, line AGVs, and packaging workers, preview their effects, and apply a selected scenario.
- **Rule-based Demo Recommendations**: Compare scenarios using a 0–100 score, where higher is better, and account for transport and packaging bottlenecks.
- **JSON Mock Data Separation**: Modular JSON data structures located in `src/json/`.

## 🛠 Tech Stack
- **Framework**: React 19 + Vite
- **3D Engine**: Three.js
- **Styling**: CSS (TailwindCSS / Custom CSS design system)
- **Language**: TypeScript

## 📦 Getting Started

### 1. Installation
```bash
npm install
```

### 2. Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 3. Production Build
```bash
npm run build
```

## Luồng hoạt động demo theo sơ đồ

| Khối trong sơ đồ | Hoạt động trong chương trình |
| --- | --- |
| **Thay đổi kế hoạch sản xuất** | Chọn tình huống, sản lượng và Model Mix. Đổi sản lượng cập nhật nhịp sản xuất và dự báo, giữ trạng thái 3D đang chạy; chuyển tình huống đặt lại mô phỏng. |
| **Phân tích tác động logistics** | Tính nhu cầu và đối chiếu với năng lực theo kế hoạch hiện tại, BOM, Model Mix và nguồn lực. |
| **1. Nhu cầu vật tư** | Xác định vật tư cần dùng, lượng tiêu thụ theo giờ, số chuyến và thời gian tồn kho còn đáp ứng được. |
| **2. Nhu cầu logistics** | Tính nhu cầu vận chuyển theo Line A/B, luồng kho → AMR → tập kết → AGV → chuyền. |
| **3. Năng lực và nguồn lực** | Xét số AMR, AGV cấp vật tư, chu kỳ xe, khu tập kết, năng lực chuyền và nhân viên đóng gói. |
| **Bottleneck / rủi ro** | Nhận diện rủi ro thiếu vật tư, quá tải vận chuyển và thiếu nhân lực đóng gói. Chuyền dừng khi thiếu vật tư; hàng chưa đóng gói tích tụ khi nhân viên không xử lý kịp. |
| **Mô phỏng what-if** | Tạo các phương án bổ sung AMR, AGV hoặc nhân viên đúng chuyền thiếu người, cùng các phương án kết hợp. Bấm chọn để xem ngay trong 3D. |
| **So sánh các kịch bản** | So sánh năng lực, tải vận chuyển, sản lượng, tải đóng gói, lượng hàng chờ tăng mỗi giờ, giao trễ, điểm nguồn lực và điểm đánh giá. Nút Chi tiết hiển thị thay đổi trước–sau. |
| **Đề xuất phương án** | Ưu tiên phương án giữ tải cấp vật tư và đóng gói trong ngưỡng 85%. Nếu không có, ưu tiên phương án không còn quá tải; nếu vẫn chưa đạt, chọn phương án có mức tải lớn nhất thấp hơn. Sau đó so sánh điểm và nguồn lực bổ sung. |
| **Con người phê duyệt** | Người dùng xem trước, kiểm tra chi tiết và bấm Áp dụng vào mô phỏng. |
| **Thực thi** | Mô phỏng chạy với nguồn lực đã chọn: cấp vật tư → sản xuất → đóng gói → AGV thành phẩm → kho thành phẩm. Không phát lệnh tới thiết bị nhà máy. |
| **Kết quả thực tế** | Trong demo, đây là kết quả chạy mô phỏng được ghi vào lịch sử: sản lượng, chuyến giao, tồn vật tư và trạng thái chuyền. Có thể nhập mức sử dụng thực tế để đối chiếu, nhưng chưa có nguồn dữ liệu nhà máy trực tiếp. |
| **Học hỏi → dự báo → phân tích tác động** | Thể hiện vòng phản hồi mong muốn của hệ thống. Demo lưu lịch sử để đối chiếu, chưa tự học hoặc tự hiệu chỉnh mô hình từ kết quả thực tế. |

### Luồng vật tư và thành phẩm trong 3D

```text
Kho vật tư → Lấy/gom → AMR → Khu tập kết vật tư → AGV → Bộ đệm Line A/B
                                                              ↓
                                                           Sản xuất
                                                              ↓
Hàng chưa đóng gói chờ trước bàn → Nhân viên đóng gói → Kiện chờ AGV
                                                              ↓
                         Qua khu tập kết thành phẩm → Ô nhận kho thành phẩm
```

- AMR lấy hàng từ kho và giao tới khu tập kết vật tư; AGV nhận đúng mã vật tư rồi giao vào bộ đệm của chuyền. Kho hết hàng hoặc bộ đệm đầy khiến xe chờ. Chuyền chỉ tiêu thụ vật tư và tạo sản phẩm khi đủ các vật tư cần thiết.
- Mỗi chuyền mặc định có **1 nhân viên đóng gói**, thời gian **60 giây mô phỏng/sản phẩm**, tương đương **60 sản phẩm/giờ/người**. Hàng chưa đóng gói được hiển thị trước bàn; kiện đã đóng gói nằm trên ô chờ đến khi AGV lấy.
- Với kế hoạch **120 sản phẩm/giờ** và mix mặc định **75% Line A / 25% Line B**, tải đóng gói là **150% ở A**, **50% ở B**. Thêm một nhân viên A đưa tải A xuống **75%**, năng lực lên **120 sản phẩm/giờ**.
- AGV thành phẩm đi theo tuyến hình chữ nhật. Xe giữ hàng khi qua điểm trung gian và các góc, chỉ dỡ tại ô nhận kho. Tốc độ lấy theo AGV cấp vật tư của cùng chuyền; đây là đội xe riêng, không trừ xe khỏi đội cấp vật tư.
- Nhãn khu vực chính và chuyền luôn hiện; nhãn xe và nhân viên chỉ hiện khi hover. Góc nhìn tổng quan bao gồm khu đóng gói, tập kết và kho thành phẩm.

### Xem trước, đánh giá và áp dụng what-if

- Giữ phương án **Giữ kế hoạch đang chọn** ở đầu bảng; các phương án khác xếp theo điểm đánh giá giảm dần. Các lựa chọn giữ nguyên sản lượng mục tiêu và điều chỉnh nguồn lực.
- Phương án nhân lực được tạo theo chuyền đang thiếu người, không cố định ở Line A. Số người bổ sung được tính để tải đóng gói về ngưỡng 85%; khi đã đủ người và không phát sinh tồn do thiếu nhân lực thì không tạo thêm phương án nhân lực.
- Dự báo, xem trước, NPC và thao tác áp dụng dùng chung số nhân viên. Mục Nhân sự hiển thị tổng nhân viên đóng gói A/B: mặc định 2 người, thêm một người thành 3.
- Thẻ Nhân lực đóng gói thể hiện tải, nhu cầu, năng lực và trạng thái có/không có điểm nghẽn. Hover hoặc focus biểu tượng ⓘ để xem cảnh báo cụ thể.
- Xem trước giữ bản sao trạng thái chính để có thể khôi phục khi thoát. Hàng chờ đóng gói được giữ lại khi áp dụng bổ sung nhân viên, thay vì xóa để tạo hiệu ứng hết nghẽn.
- Áp dụng ghi cấu hình và dự báo trước–sau vào lịch sử. Nguồn lực thay đổi được cập nhật trong cảnh; khi thay đội xe cấp vật tư, hàng trên xe được trả về kho trước khi tạo đội xe mới để bảo toàn vật tư.

Điểm đánh giá được làm tròn trong **thang 0–100; cao hơn tốt hơn**:

```text
Điểm = làm tròn(
  (55% × điểm giảm giao trễ
   + 30% × điểm giảm rủi ro vật tư
   + 15% × điểm tiết kiệm nguồn lực)
  / max(1, tỷ lệ tải đóng gói cao nhất)
)
```

Điểm giảm giao trễ và rủi ro được tính theo mức cải thiện so với kế hoạch hiện tại. Điểm tiết kiệm so sánh với phương án tốn nhiều điểm nguồn lực nhất trong nhóm. Điểm nguồn lực là quy ước demo, **không phải giá tiền**: mỗi xe bổ sung 12 điểm, mỗi nhân viên đóng gói bổ sung 6 điểm.

## Những thay đổi so với repo ban đầu

Mốc đối chiếu: commit đầu tiên **`b74ad1f` — Initial commit: DENSO Logistics Digital Twin (React + Vite + Three.js)**. Danh sách dưới đây mô tả trạng thái hiện tại của workspace, bao gồm thay đổi chưa commit.

| Hạng mục | Repo ban đầu | Demo hiện tại |
| --- | --- | --- |
| Luồng logistics | Cảnh kho, lấy/gom, tập kết, tuyến AMR/Forklift và chuyền; thử thay đổi số AMR hoặc ca vận chuyển. | Tách AMR kho–tập kết và AGV tập kết–chuyền, phân bổ xe theo nhu cầu A/B và quản lý giao nhận vật tư. |
| Mô hình vật tư | Dữ liệu mock tách thành nhiều JSON và cảnh minh họa. | BOM theo model, Model Mix, tồn kho, số kiện/chuyến và chu kỳ xe cùng tham gia tính nhu cầu; có sổ theo dõi vật tư qua các công đoạn. |
| Trạng thái sản xuất | Chuyển động minh họa của sản phẩm trong cảnh. | Sản phẩm được tạo từ tiêu thụ vật tư mô phỏng; chuyền dừng khi thiếu vật tư, sản phẩm không quay vòng vô hạn. |
| Thành phẩm và nhân lực | Chưa có luồng đóng gói trong cảnh đang chạy. | Thêm NPC đóng gói, hàng chờ trước bàn, kiện chờ AGV, khu tập kết và kho thành phẩm; tải nhân viên tham gia đánh giá what-if. |
| Kịch bản what-if | Các phương án nguồn lực nạp sẵn. | Tính lại theo đầu vào hiện tại; tự tạo phương án nhân lực đúng chuyền và các phương án kết hợp xe + nhân viên. |
| Cách chọn phương án | README giới thiệu hệ thống AI đánh giá rủi ro và chi phí. | Khuyến nghị theo quy tắc minh bạch, điểm 0–100 cao hơn tốt hơn; ưu tiên xử lý cả cấp vật tư và đóng gói. Không có mô hình AI tự học. |
| Tương tác quyết định | So sánh phương án trong giao diện ban đầu. | Chọn hàng trong bảng để xem ngay, popup Chi tiết trước–sau, nút áp dụng, lịch sử chạy và đối chiếu mức sử dụng nhập tay. |
| Giao diện | Nhãn 3D và giao diện ban đầu. | Thẻ trạng thái đóng gói gọn, cảnh báo qua ⓘ, nhãn chi tiết chỉ hiện khi hover, điểm sắp giảm dần với phương án giữ kế hoạch đứng đầu; nhu cầu/năng lực hiển thị số nguyên. |
| Thay đổi kế hoạch | Chưa có quy tắc giữ trạng thái hiện tại được tài liệu hóa. | Đổi kế hoạch cập nhật trực tiếp, không đặt lại cảnh; chuyển tình huống đặt lại mô phỏng. Nút Reset vẫn cho phép đặt lại thủ công. |
| Cấu hình và mã nguồn | React, Vite, Three.js, TypeScript, các tệp JSON mock. | Dùng `demo_config.json` làm cấu hình chính; tách logic vận hành, nhân lực, vật tư và thành phẩm thành các helper riêng. |

## Cấu hình, giả định và giới hạn

- Cấu hình chính: `src/json/demo_config.json`, gồm kế hoạch, BOM, tồn ban đầu, chu kỳ AMR/AGV, năng lực, ngưỡng rủi ro, nhân viên và điểm nguồn lực. Các JSON cũ là dữ liệu mẫu/tham chiếu; `actual_results.json` không phải luồng đo thực tế.
- BOM và thông số năng lực là giả định demo, cần xác nhận bằng dữ liệu nhà máy trước khi sử dụng thực tế. Nhu cầu theo model được tính từ BOM có trọng số theo Model Mix.
- Sổ vật tư bảo toàn từng mã: **kho + tập kết + hàng trên xe + bộ đệm chuyền + đã tiêu thụ = tồn đầu kỳ + lượng bổ sung kho**. Vật tư khởi tạo tại tập kết và chuyền được trích từ tồn kho.
- Ở tốc độ 1×, một giây chạy tương ứng một phút mô phỏng. Điều khiển tốc độ ảnh hưởng chuyển động và tiêu thụ vật tư. Tốc độ xe cấp vật tư tính từ độ dài tuyến, chu kỳ và thời gian giao nhận.
- Giao trễ là dự báo từ tỷ lệ sử dụng năng lực, chưa phải thời gian giao hàng đo từ animation. Các chỉ số không phải telemetry từ thiết bị.
- Điểm what-if đã xét quá tải nhân viên đóng gói, **chưa xét riêng năng lực và hàng chờ của AGV thành phẩm**. Phương án giải quyết cấp vật tư/đóng gói vì vậy chưa bảo đảm giải quyết toàn bộ luồng tới kho thành phẩm.
- Kho thành phẩm hiển thị tối đa 36 kiện/chuyền; hàng chưa đóng gói hiển thị tối đa 48 sản phẩm/chuyền. Bộ đếm nội bộ vẫn giữ số lượng đầy đủ, nhãn đóng gói hiển thị tổng hàng chưa đóng gói.
- Lịch sử dùng để lưu và đối chiếu. Nhập mức sử dụng thực tế không tự huấn luyện hoặc hiệu chỉnh mô hình. Khối học hỏi trong sơ đồ là hướng phát triển tiếp theo.

## Mã nguồn của luồng đang chạy

```text
src/main.tsx → src/app/App.tsx
                ├─ src/json/demo_config.json          Cấu hình demo
                ├─ src/services/operationsEngine.ts   Nhu cầu, năng lực, rủi ro
                ├─ src/services/packing.ts            Nhân lực và phương án đóng gói
                ├─ src/three/LogisticsFleet.ts        Xe cấp vật tư và sổ vật tư
                ├─ src/three/FactoryFloor.ts          Mặt bằng và khu tập kết
                └─ src/three/FinishedGoodsFlow.ts     Đóng gói, AGV, kho thành phẩm
```

Cảnh đang chạy dùng Three.js trực tiếp trong `App.tsx`. Các component R3F khác trong `src/three/` là bản thử nghiệm cũ, không được entry point hiện tại tải. Xem thêm `src/three/README.md`.

## Kiểm tra

```bash
npm run build
```

Các script kiểm tra bổ sung nằm trong `scripts/`; cần đối chiếu giả định của script với mô hình hiện tại trước khi dùng. Kết quả kiểm tra logic hoặc build không thay thế kiểm tra trực quan cảnh 3D trong trình duyệt.
