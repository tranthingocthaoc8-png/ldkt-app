# Lãnh Đạo Khai Tâm 21 ngày — Mobile MVP

Bản này áp dụng trực tiếp ý tưởng prototype thành app mobile-first đơn giản:

- Đăng ký học viên
- Tạo mã học viên tự động: LDKT001, LDKT002...
- Đăng nhập bằng Email/SĐT + Mã học viên
- Check-in hằng ngày
- Tính XP, streak, huy hiệu
- Leaderboard
- Dashboard giảng viên
- Xuất CSV check-in
- PWA manifest để Add to Home Screen

## Demo login

Học viên:
- tuan@example.com / LDKT001

Giảng viên:
- trainer@senpharma.vn / GV001

## Deploy Vercel

Upload đúng cấu trúc root lên GitHub:

```text
app/
public/
package.json
next.config.js
README.md
```

Sau đó import repo vào Vercel và deploy.

Bản này chưa cần Environment Variables, chưa cần Google Cloud, chưa cần OAuth.

## Lưu ý

Dữ liệu hiện lưu bằng localStorage trên trình duyệt để test luồng trước. Sau khi chốt giao diện và flow, bước tiếp theo là chuyển `users` và `checkins` sang Google Sheet API hoặc Apps Script Web App.
