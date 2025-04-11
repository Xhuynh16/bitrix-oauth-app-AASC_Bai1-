# Bitrix24 OAuth Application
Ứng dụng OAuth cho Bitrix24 với tính năng quản lý và tự động refresh token.
## Yêu cầu hệ thống
- Node.js (v14 trở lên)
- npm (Node Package Manager)
- ngrok (để test webhook local)
## Các bước cài đặt và cấu hình

1. Clone repository:
```bash
git clone <your-repo-url>
cd bitrix-oauth-app
```

2. Cài đặt dependencies:
```bash
npm install
```

3. Tạo và cấu hình file .env:
```bash
cp .env.example .env
```

Cập nhật các thông tin sau trong file .env:
```env
PORT=3000
NODE_ENV=development
BITRIX_CLIENT_ID=your_client_id
BITRIX_CLIENT_SECRET=your_client_secret
```

## Cấu hình Bitrix24

1. Tạo ứng dụng cục bộ trong Bitrix24 Developer 

2. Trong phần cài đặt ứng dụng, cấu hình:
   - Handler URL: `https://your-ngrok-domain/auth/install-event`
   - Auth URL: `https://your-ngrok-domain/auth/auth`

3. Copy Client ID và Client Secret từ ứng dụng vừa tạo và cập nhật vào file .env

## Chạy ứng dụng

1. Chạy ngrok để tạo public URL:
```bash
ngrok http 3000
```

2. Copy ngrok URL (https://xxx.ngrok.io) và cập nhật vào cài đặt ứng dụng cục bộ (Handler URL, Auth URL) trong Bitrix24

3. Chạy server:
```bash
# Development mode
npm run dev

# Hoặc Production mode
npm start
```

## Test kết nối

Kiểm tra server đang hoạt động:
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/health"
```

Kiểm tra kết nối với Bitrix24:
```powershell
$headers = @{ "X-Bitrix-Domain" = "your-domain.bitrix24.com" }
Invoke-RestMethod -Uri "http://localhost:3000/api/test/user" -Headers $headers
```
## API Endpoints

### Authentication
- `POST /auth/install-event`: Nhận webhook cài đặt từ Bitrix24
- `GET /auth/auth`: Xử lý OAuth callback

### API
- `GET /api/health`: Kiểm tra status server
- `POST /api/:method`: Gọi bất kỳ Bitrix24 API method
- `GET /api/test/user`: Test lấy thông tin user
- `GET /api/test/contacts`: Test lấy danh sách contacts
- `GET /api/test/leads`: Test lấy danh sách leads
- `POST /api/test/token-refresh`: Test tính năng tự động refresh token

## Test API

Sử dụng PowerShell:
```powershell
# Test health check
Invoke-RestMethod -Uri "http://localhost:3000/api/health"

# Test API call với domain
$headers = @{ "X-Bitrix-Domain" = "your-domain.bitrix24.com" }
Invoke-RestMethod -Uri "http://localhost:3000/api/test/user" -Headers $headers
```