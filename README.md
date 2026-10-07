# FDX Digital Twin - DENSO Logistics Digital Twin

A 3D Digital Twin simulation for automotive component manufacturing logistics built with React, Vite, and Three.js.

## 🚀 Features
- **3D Factory & Logistics Twin**: Mô phỏng trực quan luồng cấp vật tư, các Line sản xuất, nhân viên đóng gói, hàng chờ thành phẩm và AGV đưa hàng trực tiếp vào kho thành phẩm.
- **Dynamic 3D Labels Projection**: Nhãn khu vực và Line luôn hiển thị; nhãn phương tiện và nhân viên xuất hiện khi hover.
- **What-If Scenario Simulation**: So sánh các phương án bổ sung AMR, AGV theo Line và nhân viên đóng gói, xem trước tác động và áp dụng kịch bản được chọn.
- **Rule-based Demo Recommendations**: So sánh các kịch bản theo thang điểm 0–100, điểm cao hơn tốt hơn, có xét điểm nghẽn vận chuyển và đóng gói.
- **JSON Mock Data Separation**: Dữ liệu JSON được tách thành các module trong `src/json/`.

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

## Luồng hoạt động demo hiện tại

1. **Chọn tình huống và kế hoạch sản xuất.** Người dùng điều chỉnh sản lượng, Model Mix và các đầu vào liên quan. Đổi sản lượng cập nhật nhịp sản xuất và dự báo, giữ trạng thái 3D đang chạy; chuyển tình huống đặt lại mô phỏng.
2. **Tính nhu cầu và năng lực.** Chương trình tính lượng vật tư theo BOM và Model Mix, nhu cầu chuyến vận chuyển của Line A/B, năng lực AMR/AGV và năng lực nhân viên đóng gói.
3. **Theo dõi mô phỏng và điểm nghẽn.** AMR đưa vật tư từ kho tới khu tập kết; AGV cấp vào chuyền. Chuyền sản xuất khi đủ vật tư, nhân viên đóng gói thành phẩm, rồi AGV đưa hàng tới kho thành phẩm. Giao diện thể hiện thiếu vật tư, tải vận chuyển và tải đóng gói; hàng chưa đóng gói chờ trước bàn khi nhân viên xử lý không kịp.
4. **So sánh các phương án what-if.** Chương trình tạo phương án bổ sung AMR, AGV, nhân viên đúng chuyền thiếu người hoặc kết hợp các nguồn lực. Các phương án giữ nguyên sản lượng mục tiêu và được so sánh bằng năng lực, mức tải, giao trễ, điểm nguồn lực và điểm đánh giá.
5. **Xem trước phương án.** Bấm chọn một hàng trong bảng để xem ngay phương án đó trong 3D và dự báo tương ứng. Bấm **Chi tiết** để xem những thay đổi trước–sau, gồm số xe và nhân viên bổ sung theo chuyền.
6. **Chọn và áp dụng.** Người dùng xem khuyến nghị rồi bấm **Áp dụng vào mô phỏng**. Chương trình cập nhật nguồn lực và tiếp tục chạy; hàng chờ đóng gói được giữ lại để quan sát tác động của phương án.
7. **Theo dõi kết quả và lịch sử.** Người dùng quan sát sản lượng, chuyến giao, tồn vật tư và trạng thái chuyền; xem cấu hình cùng dự báo trước–sau trong lịch sử và có thể nhập mức sử dụng thực tế để đối chiếu.

Các thao tác áp dụng chỉ tác động tới mô phỏng. Demo chưa kết nối dữ liệu thiết bị nhà máy hoặc tự học từ kết quả chạy.

### Luồng vật tư và thành phẩm trong 3D

![Minh họa luồng cấp vật tư, sản xuất, đóng gói và vận chuyển thành phẩm](docs/images/material-finished-goods-flow.png)

Hình minh họa các công đoạn của demo; AGV lấy kiện đã đóng gói tại ô chờ và đưa trực tiếp vào kho thành phẩm.

```text
Kho vật tư → Lấy/gom → AMR → Khu tập kết vật tư → AGV → Bộ đệm Line A/B
                                                              ↓
                                                           Sản xuất
                                                              ↓
Hàng chưa đóng gói chờ trước bàn → Nhân viên đóng gói → Kiện chờ AGV
                                                              ↓
                         AGV thành phẩm → Ô nhận kho thành phẩm
```

- AMR lấy hàng từ kho và giao tới khu tập kết vật tư; AGV nhận đúng mã vật tư rồi giao vào bộ đệm của chuyền. Kho hết hàng hoặc bộ đệm đầy khiến xe chờ. Chuyền chỉ tiêu thụ vật tư và tạo sản phẩm khi đủ các vật tư cần thiết.
- Mỗi chuyền mặc định có **1 nhân viên đóng gói**, thời gian **60 giây mô phỏng/sản phẩm**, tương đương **60 sản phẩm/giờ/người**. Hàng chưa đóng gói được hiển thị trước bàn; kiện đã đóng gói nằm trên ô chờ đến khi AGV lấy.
- Với kế hoạch **120 sản phẩm/giờ** và mix mặc định **75% Line A / 25% Line B**, tải đóng gói là **150% ở A**, **50% ở B**. Thêm một nhân viên A đưa tải A xuống **75%**, năng lực lên **120 sản phẩm/giờ**.
- AGV thành phẩm đi theo tuyến hình chữ nhật. Xe giữ hàng khi qua điểm trung gian và các góc, chỉ dỡ tại ô nhận kho. Tốc độ lấy theo AGV cấp vật tư của cùng chuyền; đây là đội xe riêng, không trừ xe khỏi đội cấp vật tư.
- Nhãn khu vực chính và chuyền luôn hiện; nhãn xe và nhân viên chỉ hiện khi hover. Khu thành phẩm gồm bàn đóng gói, ô chờ AGV và kho; AGV đưa hàng trực tiếp vào kho, không qua khu tập kết trung gian.

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

## Tài liệu bổ sung

Xem [Những thay đổi so với repo ban đầu](CHANGES_FROM_INITIAL.md).

## Cấu hình, giả định và giới hạn

- Cấu hình chính: `src/json/demo_config.json`, gồm kế hoạch, BOM, tồn ban đầu, chu kỳ AMR/AGV, năng lực, ngưỡng rủi ro, nhân viên và điểm nguồn lực. Các JSON cũ là dữ liệu mẫu/tham chiếu; `actual_results.json` không phải luồng đo thực tế.
- BOM và thông số năng lực là giả định demo, cần xác nhận bằng dữ liệu nhà máy trước khi sử dụng thực tế. Nhu cầu theo model được tính từ BOM có trọng số theo Model Mix.
- Sổ vật tư bảo toàn từng mã: **kho + tập kết + hàng trên xe + bộ đệm chuyền + đã tiêu thụ = tồn đầu kỳ + lượng bổ sung kho**. Vật tư khởi tạo tại tập kết và chuyền được trích từ tồn kho.
- Ở tốc độ 1×, một giây chạy tương ứng một phút mô phỏng. Điều khiển tốc độ ảnh hưởng chuyển động và tiêu thụ vật tư. Tốc độ xe cấp vật tư tính từ độ dài tuyến, chu kỳ và thời gian giao nhận.
- Giao trễ là dự báo từ tỷ lệ sử dụng năng lực, chưa phải thời gian giao hàng đo từ animation. Các chỉ số không phải telemetry từ thiết bị.
- Điểm what-if đã xét quá tải nhân viên đóng gói, **chưa xét riêng năng lực và hàng chờ của AGV thành phẩm**. Phương án giải quyết cấp vật tư/đóng gói vì vậy chưa bảo đảm giải quyết toàn bộ luồng tới kho thành phẩm.
- Kho thành phẩm hiển thị tối đa 36 kiện/chuyền; hàng chưa đóng gói hiển thị tối đa 48 sản phẩm/chuyền. Bộ đếm nội bộ vẫn giữ số lượng đầy đủ, nhãn đóng gói hiển thị tổng hàng chưa đóng gói.
- Lịch sử dùng để lưu và đối chiếu. Nhập mức sử dụng thực tế không tự huấn luyện hoặc hiệu chỉnh mô hình. Khả năng tự học là hướng phát triển tiếp theo.

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
