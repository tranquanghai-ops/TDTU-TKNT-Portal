# TDTU-TKNT-Portal — AI Handover & Deployment Guide

## 1. Tổng quan Kiến trúc Deployment

- **Repository:** [`tranquanghai-ops/TDTU-TKNT-Portal`](https://github.com/tranquanghai-ops/TDTU-TKNT-Portal)
- **Production URL:** `https://tknt-tdtu.web.app`
- **Firebase Project ID:** `tknt-tdtu`
- **Nguyên tắc cốt lõi:**
  - `TDTU-TKNT-Portal` là repository **DUY NHẤT** được phép deploy lên `tknt-tdtu.web.app`.
  - Các app độc lập (như `PDF-Optimizer`) phát triển và release tại repo riêng.
  - Portal tích hợp các app qua tệp cấu hình `apps-registry.json` và tải release zip artifacts tự động trong quá trình build.

## 2. GitHub Actions Auto-Deploy Pipeline

- **Workflow:** `.github/workflows/deploy-production.yml`
- **Triggers:**
  - `push` lên nhánh `main`.
  - `workflow_dispatch` (kích hoạt thủ công qua GitHub Actions UI hoặc GitHub REST API).
  - `repository_dispatch: [app-release]` (hỗ trợ app repos tự động trigger portal deploy khi có bản phát hành mới).
- **GitHub Secret:**
  - `FIREBASE_SERVICE_ACCOUNT_TKNT_TDTU`: Service account private key cho Firebase Hosting project `tknt-tdtu`.
  - Tạo và quản lý tự động thông qua `firebase init hosting:github`.
- **Thứ tự thực thi trong pipeline:**
  1. `Checkout` mã nguồn.
  2. `Set up Node.js 20` & `Install dependencies` (`npm install --ignore-scripts`).
  3. `Validate registry` (`npm run validate` / `scripts/validate-registry.mjs`).
  4. `Download enabled app artifacts` (tải release `.zip` từ GitHub Releases của các repo con).
  5. `Build` (`npm run build` / `scripts/assemble.mjs` lắp ráp `build/`).
  6. `Check Firebase credentials` (kiểm tra secret).
  7. `Deploy to Firebase Hosting` (`FirebaseExtended/action-hosting-deploy@v0`) với `channelId: live`, `projectId: tknt-tdtu`.
- **Phạm vi Deploy:**
  - **CHỈ deploy Firebase Hosting.**
  - **TUYỆT ĐỐI KHÔNG** deploy Firestore Rules, Storage Rules, hoặc Cloud Functions.

- **Apps Registry (`apps-registry.json`):**
  - `pdf-optimizer`: Repo `tranquanghai-ops/PDF-Optimizer`, mount `/pdf-optimizer/`, version `v1.0.1`.
  - `video-encode`: Repo `tranquanghai-ops/VIDEO-ENCODE-STUDIO`, mount `/video-encode/`, version `latest`. Hỗ trợ cả tag cố định và `latest`.

## 3. Quy trình Tự động Cập nhật từ App Repos (Auto-Update)

1. Khi push lên nhánh `main` của repo app (ví dụ `VIDEO-ENCODE-STUDIO`), workflow `.github/workflows/release.yml` sẽ tự động:
   - Build ứng dụng (Vite production build với relative base path `./`).
   - Đóng gói toàn bộ `dist/` thành file zip (ví dụ `video-encode.zip`).
   - Tạo GitHub Release mới với tag version tự tăng.
   - Gửi tín hiệu `repository_dispatch` sang `TDTU-TKNT-Portal` (nếu cấu hình secret `PORTAL_DISPATCH_TOKEN`).
2. Khi `TDTU-TKNT-Portal` nhận dispatch hoặc được push:
   - Tự động tải release zip mới nhất của app (hoặc tag chỉ định).
   - Lắp ráp vào thư mục mount tương ứng trong `build/`.
   - Tự động deploy lên Firebase Hosting live channel của project `tknt-tdtu`.

## 4. Trạng thái Xác minh Production

- **Ngày xác minh:** 2026-09-15.
- **Phương pháp xác minh:** Chrome Headless DevTools Protocol (CDP) trực tiếp trên môi trường live production.
- **Kết quả:**
  - `https://tknt-tdtu.web.app/`: Root portal hiển thị đầy đủ, danh mục công cụ gồm PDF Optimizer và Video Encode Studio.
  - `https://tknt-tdtu.web.app/pdf-optimizer/`:
    - Ứng dụng khởi động thành công, màn hình loading biến mất.
    - Script `pdf-tools.js` được nạp chính xác từ `/pdf-optimizer/pdf-tools.js?v=5.8.0` (HTTP 200).
    - Badge `V5.8 • ENGINE TÍCH HỢP` hiển thị chính xác.
    - Toàn bộ tính năng UI và engine xử lý PDF sẵn sàng, 0 lỗi runtime bootstrap.
  - `https://tknt-tdtu.web.app/video-encode/`:
    - Ứng dụng React / WebCodecs / FFmpeg WASM mount thành công tại subpath `/video-encode/`.
    - Tất cả assets và ffmpeg-core được load qua đường dẫn tương đối (HTTP 200).
    - Sẵn sàng phục vụ người dùng.
