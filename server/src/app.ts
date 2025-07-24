import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  GenerateRegistrationOptionsOpts,
  GenerateAuthenticationOptionsOpts,
  VerifyRegistrationResponseOpts,
  VerifyAuthenticationResponseOpts,
} from '@simplewebauthn/server';

const app = express();
const port = process.env.PORT || 3001;

// 設定中間件
app.use(helmet());
app.use(cors({
  origin: process.env.ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// 提供靜態檔案 (生產環境)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('public'));

  // SPA fallback
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    }
  });
}

/**
 * 使用者資料介面
 * 描述每位使用者的資訊及其註冊的驗證器清單。
 *
 * @interface User
 * @member {string} id 使用者唯一識別碼
 * @member {string} username 使用者名稱
 * @member {string} [currentChallenge] 當前用於 WebAuthn 註冊或驗證的 challenge
 * @member {AuthenticatorDevice[]} authenticators 已註冊的驗證器裝置清單
 */
interface User {
  id: string;
  username: string;
  currentChallenge?: string;
  authenticators: AuthenticatorDevice[];
}

/**
 * 驗證器裝置介面
 * 描述註冊於使用者帳號下的驗證器裝置資訊。
 *
 * @interface AuthenticatorDevice
 * @member {string} credentialID 驗證器的唯一憑證 ID
 * @member {Uint8Array} credentialPublicKey 公鑰，用於驗證簽章
 * @member {number} counter 防止回放攻擊的計數器
 * @member {'singleDevice' | 'multiDevice'} credentialDeviceType 裝置類型（單一裝置或多裝置）
 * @member {boolean} credentialBackedUp 是否有備份裝置
 * @member {('ble' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb')[]=} transports 支援的傳輸方式（可選）
 */
interface AuthenticatorDevice {
  credentialID: string;
  credentialPublicKey: Uint8Array;
  counter: number;
  credentialDeviceType: 'singleDevice' | 'multiDevice';
  credentialBackedUp: boolean;
  transports?: ('ble' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb')[];
}


const users: Map<string, User> = new Map();

// WebAuthn 設定
const rpName = process.env.RP_NAME || 'WebAuthn Demo';
const rpID = process.env.RP_ID || 'localhost';
const origin = process.env.ORIGIN || 'http://localhost:5173';

// 註冊開始
app.post('/api/webauthn/register/begin', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // 取得或建立使用者
    let user = users.get(username);
    if (!user) {
      user = {
        id: Math.random().toString(36).substring(2, 15),
        username,
        authenticators: []
      };
      users.set(username, user);
    }

    const opts: GenerateRegistrationOptionsOpts = {
      rpName,
      rpID,
      userName: user.username,
      userID: new TextEncoder().encode(user.id),
      timeout: 60000,
      attestationType: 'none',
      excludeCredentials: user.authenticators.map(authenticator => ({
        id: authenticator.credentialID,
        transports: authenticator.transports,
      })),
      authenticatorSelection: {
        residentKey: 'discouraged',
        userVerification: 'preferred',
      },
      supportedAlgorithmIDs: [-7, -257],
    };

    const options = await generateRegistrationOptions(opts);

    // 儲存 challenge
    user.currentChallenge = options.challenge;
    users.set(username, user);

    res.json(options);
  } catch (error) {
    console.error('Registration begin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 註冊完成
app.post('/api/webauthn/register/finish', async (req, res) => {
  try {
    const { username, credential } = req.body;

    if (!username || !credential) {
      return res.status(400).json({ error: 'Username and credential are required' });
    }

    const user = users.get(username);
    if (!user || !user.currentChallenge) {
      return res.status(400).json({ error: 'Invalid registration request' });
    }

    const opts: VerifyRegistrationResponseOpts = {
      response: credential,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    };

    const verification = await verifyRegistrationResponse(opts);

    if (verification.verified && verification.registrationInfo) {
      const { credential: regCredential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

      const newAuthenticator: AuthenticatorDevice = {
        credentialID: regCredential.id,
        credentialPublicKey: regCredential.publicKey,
        counter: regCredential.counter,
        credentialDeviceType,
        credentialBackedUp,
        transports: regCredential.transports?.filter((t): t is ('ble' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb') =>
          ['ble', 'hybrid', 'internal', 'nfc', 'smart-card', 'usb'].includes(t)
        ),
      };

      user.authenticators.push(newAuthenticator);
      user.currentChallenge = undefined;
      users.set(username, user);

      res.json({ verified: true });
    } else {
      res.status(400).json({ error: 'Registration verification failed' });
    }
  } catch (error) {
    console.error('Registration finish error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 驗證開始
app.post('/api/webauthn/authenticate/begin', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const user = users.get(username);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const opts: GenerateAuthenticationOptionsOpts = {
      timeout: 60000,
      allowCredentials: user.authenticators.map(authenticator => ({
        id: authenticator.credentialID,
        transports: authenticator.transports,
      })),
      userVerification: 'preferred',
      rpID,
    };

    const options = await generateAuthenticationOptions(opts);

    // 儲存 challenge
    user.currentChallenge = options.challenge;
    users.set(username, user);

    res.json(options);
  } catch (error) {
    console.error('Authentication begin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 驗證完成
app.post('/api/webauthn/authenticate/finish', async (req, res) => {
  try {
    const { username, credential } = req.body;

    if (!username || !credential) {
      return res.status(400).json({ error: 'Username and credential are required' });
    }

    const user = users.get(username);
    if (!user || !user.currentChallenge) {
      return res.status(400).json({ error: 'Invalid authentication request' });
    }

    const authenticator = user.authenticators.find(auth => auth.credentialID === credential.id);

    if (!authenticator) {
      return res.status(400).json({ error: 'Authenticator not found' });
    }

    const opts: VerifyAuthenticationResponseOpts = {
      response: credential,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: authenticator.credentialID,
        publicKey: authenticator.credentialPublicKey,
        counter: authenticator.counter,
        transports: authenticator.transports,
      },
      requireUserVerification: false,
    };

    const verification = await verifyAuthenticationResponse(opts);

    if (verification.verified) {
      // 更新 authenticator counter
      authenticator.counter = verification.authenticationInfo.newCounter;
      user.currentChallenge = undefined;
      users.set(username, user);

      res.json({ verified: true, user: { id: user.id, username: user.username } });
    } else {
      res.status(400).json({ error: 'Authentication verification failed' });
    }
  } catch (error) {
    console.error('Authentication finish error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 健康檢查
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`🚀 WebAuthn server running on http://localhost:${port}`);
});
// 無使用者名稱驗證開始 (Conditional UI)
app.post('/api/webauthn/authenticate/begin-usernameless', async (req, res) => {
  try {
    const opts: GenerateAuthenticationOptionsOpts = {
      timeout: 60000,
      allowCredentials: [], // 空陣列表示支援所有註冊的 credentials
      userVerification: 'preferred',
      rpID,
    };

    const options = await generateAuthenticationOptions(opts);

    // 儲存 challenge（不綁定特定使用者）
    // 在實際應用中，你可能需要使用 session 或其他方式來儲存
    global.currentChallenge = options.challenge;

    res.json(options);
  } catch (error) {
    console.error('Usernameless authentication begin error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 無使用者名稱驗證完成
app.post('/api/webauthn/authenticate/finish-usernameless', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Credential is required' });
    }

    if (!global.currentChallenge) {
      return res.status(400).json({ error: 'Invalid authentication request' });
    }

    // 尋找對應的使用者和 authenticator
    let foundUser: User | null = null;
    let foundAuthenticator: AuthenticatorDevice | null = null;

    // 使用 Array.from 來遍歷 Map
    const userEntries = Array.from(users.entries());
    for (const [username, user] of userEntries) {
      const authenticator = user.authenticators.find(auth => auth.credentialID === credential.id);
      if (authenticator) {
        foundUser = user;
        foundAuthenticator = authenticator;
        break;
      }
    }

    if (!foundUser || !foundAuthenticator) {
      return res.status(400).json({ error: 'Authenticator not found' });
    }

    const opts: VerifyAuthenticationResponseOpts = {
      response: credential,
      expectedChallenge: global.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: foundAuthenticator.credentialID,
        publicKey: foundAuthenticator.credentialPublicKey,
        counter: foundAuthenticator.counter,
        transports: foundAuthenticator.transports,
      },
      requireUserVerification: false,
    };

    const verification = await verifyAuthenticationResponse(opts);

    if (verification.verified) {
      // 更新 authenticator counter
      foundAuthenticator.counter = verification.authenticationInfo.newCounter;
      global.currentChallenge = undefined;
      users.set(foundUser.username, foundUser);

      res.json({
        verified: true,
        user: {
          id: foundUser.id,
          username: foundUser.username
        }
      });
    } else {
      res.status(400).json({ error: 'Authentication verification failed' });
    }
  } catch (error) {
    console.error('Usernameless authentication finish error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
