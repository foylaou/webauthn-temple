# WebAuthn Temple 🏛️

現代化的 WebAuthn/Passkey 實作模板，支援無使用者名稱登入和 Conditional UI 自動填入功能。

## ✨ 功能特色

- 🔑 **現代 Passkey 登入** - 無需輸入使用者名稱的一鍵登入
- 🌟 **Conditional UI** - 智能自動填入，點擊輸入框即可選擇 Passkey
- 📱 **跨平台支援** - 支援指紋、Face ID、Touch ID、安全金鑰等
- 🔄 **向後相容** - 保留傳統使用者名稱登入方式
- 🛡️ **安全可靠** - 基於 FIDO2/WebAuthn 標準，抗釣魚攻擊
- 🌐 **多語言後端** - 提供 Node.js 和 C# 兩種實作

## 🏗️ 專案結構

```
webauthn-temple/
├── client/                 # React + Vite 前端
│   ├── src/
│   │   ├── App.tsx        # 主要應用程式
│   │   ├── main.tsx       # 入口文件
│   │   └── ...
│   ├── package.json
│   └── vite.config.ts
├── server/                 # Node.js + Express 後端
│   ├── src/
│   │   ├── app.ts         # 主要伺服器文件
│   │   └── routes/
│   ├── package.json
│   └── tsconfig.json
├── server-dotnet/          # C# .NET Core 後端 (可選)
│   ├── Controllers/
│   ├── Models/
│   ├── Services/
│   └── Program.cs
└── README.md
```

## 🚀 快速開始

### 前置需求

- Node.js 18+ 或 Bun
- .NET 8+ (如果使用 C# 後端)
- 現代瀏覽器 (Chrome 88+, Firefox 90+, Safari 14+)
- HTTPS 環境 (生產環境) 或 localhost (開發環境)

### 安裝依賴

#### 前端 (React)
```bash
cd client
bun install
# 或
npm install
```

#### 後端 (Node.js)
```bash
cd server
bun install
# 或
npm install
```

#### 後端 (C# - 可選)
```bash
cd server-dotnet
dotnet restore
```

### 開發環境啟動

#### 使用 Node.js 後端
```bash
# 終端 1: 啟動後端
cd server
bun run dev

# 終端 2: 啟動前端
cd client
bun run dev
```

#### 使用 C# 後端
```bash
# 終端 1: 啟動後端
cd server-dotnet
dotnet run

# 終端 2: 啟動前端
cd client
bun run dev
```

### 使用 ngrok 測試 (HTTPS 環境)

```bash
# 安裝 ngrok
npm install -g ngrok

# 為前端建立 HTTPS 隧道
ngrok http 5173

# 為後端建立 HTTPS 隧道
ngrok http 3001
```

更新 `.env` 檔案中的設定：
```env
RP_ID=your-ngrok-domain.ngrok-free.app
ORIGIN=https://your-ngrok-domain.ngrok-free.app
```

## 📚 API 端點

### 傳統登入流程
- `POST /api/webauthn/register/begin` - 開始註冊
- `POST /api/webauthn/register/finish` - 完成註冊
- `POST /api/webauthn/authenticate/begin` - 開始驗證
- `POST /api/webauthn/authenticate/finish` - 完成驗證

### 現代 Passkey 流程
- `POST /api/webauthn/authenticate/begin-usernameless` - 開始無使用者名稱驗證
- `POST /api/webauthn/authenticate/finish-usernameless` - 完成無使用者名稱驗證

### 健康檢查
- `GET /api/health` - API 健康狀態

## 🎯 使用流程

### 1. 註冊新帳號
1. 輸入使用者名稱
2. 點擊「註冊新帳號」
3. 完成生物識別驗證
4. 系統自動建立支援無使用者名稱登入的 Passkey

### 2. 現代 Passkey 登入
1. 點擊「🔑 使用 Passkey 登入」按鈕
2. 選擇要使用的 Passkey
3. 完成生物識別驗證
4. 自動登入成功

### 3. Conditional UI 自動填入
1. 點擊使用者名稱輸入框
2. 瀏覽器自動顯示可用的 Passkey 選項
3. 選擇後自動完成登入

### 4. 傳統使用者名稱登入
1. 輸入使用者名稱
2. 點擊「登入」按鈕
3. 使用已註冊的 Passkey 完成驗證

## 🔧 設定選項

### 環境變數 (Server)

```env
# WebAuthn 設定
RP_NAME=WebAuthn Demo
RP_ID=localhost
ORIGIN=http://localhost:5173
PORT=3001

# 生產環境範例
# RP_ID=your-domain.com
# ORIGIN=https://your-domain.com
```

### Vite 設定 (Client)

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
```

## 🏭 生產環境部署

### Docker 部署

```dockerfile
# Dockerfile.client
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

```dockerfile
# Dockerfile.server
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  webauthn-client:
    build:
      context: ./client
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://webauthn-server:3001
    depends_on:
      - webauthn-server

  webauthn-server:
    build:
      context: ./server
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - RP_ID=your-domain.com
      - ORIGIN=https://your-domain.com
      - NODE_ENV=production
```

## 🧪 測試

### 支援的認證器
- **平台認證器**: Touch ID (macOS), Face ID (iOS), Windows Hello, Android 指紋
- **跨平台認證器**: YubiKey, Google Titan, 其他 FIDO2 安全金鑰
- **軟體認證器**: 1Password, Bitwarden 等密碼管理器

### 瀏覽器支援
- ✅ Chrome 88+
- ✅ Firefox 90+
- ✅ Safari 14+
- ✅ Edge 88+

### 作業系統支援
- ✅ Windows 10+ (Windows Hello)
- ✅ macOS 12+ (Touch ID)
- ✅ iOS 15+ (Face ID/Touch ID)
- ✅ Android 9+ (指紋/生物識別)

## 📖 技術細節

### 前端技術棧
- **React 18** - UI 框架
- **TypeScript** - 型別安全
- **Vite** - 建置工具
- **Tailwind CSS** - 樣式框架
- **@simplewebauthn/browser** - WebAuthn 客戶端

### 後端技術棧

#### Node.js 版本
- **Express** - Web 框架
- **TypeScript** - 型別安全
- **@simplewebauthn/server** - WebAuthn 伺服器端
- **CORS & Helmet** - 安全中間件

#### C# 版本
- **ASP.NET Core** - Web 框架
- **Fido2NetLib** - WebAuthn 伺服器端
- **Entity Framework Core** - ORM (可選)

## 🔒 安全性考量

### 最佳實踐
- ✅ 使用 HTTPS (生產環境必須)
- ✅ 驗證 Origin 和 RP ID
- ✅ 實作適當的 CORS 策略
- ✅ 使用安全的 challenge 管理
- ✅ 驗證 authenticator 狀態

### 注意事項
- 🚨 生產環境必須使用 HTTPS
- 🚨 妥善保存 credential 資料
- 🚨 實作適當的速率限制
- 🚨 定期更新依賴套件

## 🤝 貢獻指南

1. Fork 此專案
2. 建立功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交變更 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 開啟 Pull Request

## 📄 授權條款

此專案採用 MIT 授權條款 - 詳見 [LICENSE](LICENSE) 檔案

## 🙏 致謝

- [SimpleWebAuthn](https://simplewebauthn.dev/) - 優秀的 WebAuthn 函式庫
- [Fido2NetLib](https://github.com/passwordless-lib/fido2-net-lib) - .NET WebAuthn 實作
- [WebAuthn Guide](https://webauthn.guide/) - WebAuthn 學習資源

## 📞 支援

如有問題或建議，請：
- 開啟 [GitHub Issue](https://github.com/your-username/webauthn-temple/issues)
- 查看 [WebAuthn 規範](https://www.w3.org/TR/webauthn-2/)
- 參考 [FIDO Alliance 文件](https://fidoalliance.org/specs/)

---

**WebAuthn Temple** - 讓無密碼認證變得簡單 🚀
