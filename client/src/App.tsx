import { useState, useEffect } from 'react';
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
} from '@simplewebauthn/browser';


interface User {
  id: string;
  username: string;
}

function App() {
  const [username, setUsername] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [supportsAutofill, setSupportsAutofill] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const API_BASE = '/api';

  useEffect(() => {
    // 檢查是否支援 Conditional UI
    const checkAutofillSupport = async () => {
      const supported = await browserSupportsWebAuthnAutofill();
      setSupportsAutofill(supported);

      if (supported && !user) {
        // 啟動 Conditional UI
        startConditionalUI();
      }
    };

    checkAutofillSupport();
  }, [user]);

  const startConditionalUI = async () => {
    try {
      const response = await fetch(`${API_BASE}/webauthn/authenticate/begin-usernameless`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) return;

      const options = await response.json();
      const { sessionId, ...optionsJSON } = options;
      setCurrentSessionId(sessionId);

      // 啟動 Conditional UI（自動填入模式）
      const credential = await startAuthentication({
        optionsJSON,
        useBrowserAutofill: true
      });

      // 完成驗證
      const verificationResponse = await fetch(`${API_BASE}/webauthn/authenticate/finish-usernameless`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, sessionId }),
      });

      if (verificationResponse.ok) {
        const result = await verificationResponse.json();
        if (result.verified) {
          setUser(result.user);
          showMessage('自動登入成功！', 'success');
        }
      }
    } catch (error: any) {
      // Conditional UI 失敗是正常的，不需要顯示錯誤
      console.log('Conditional UI not triggered:', error.message);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error' | 'info') => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleRegister = async () => {
    if (!username.trim()) {
      showMessage('請輸入使用者名稱', 'error');
      return;
    }

    if (!browserSupportsWebAuthn()) {
      showMessage('您的瀏覽器不支援 WebAuthn', 'error');
      return;
    }

    setLoading(true);
    try {
      // 開始註冊
      const response = await fetch(`${API_BASE}/webauthn/register/begin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      if (!response.ok) {
        throw new Error('註冊請求失敗');
      }

      const options = await response.json();

      // 呼叫 WebAuthn API
      const credential = await startRegistration({ optionsJSON: options });

      // 完成註冊
      const verificationResponse = await fetch(`${API_BASE}/webauthn/register/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, credential }),
      });

      if (!verificationResponse.ok) {
        throw new Error('註冊驗證失敗');
      }

      const result = await verificationResponse.json();

      if (result.verified) {
        showMessage('註冊成功！現在可以使用 passkey 登入了', 'success');
      } else {
        showMessage('註冊失敗', 'error');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error.name === 'NotAllowedError') {
        showMessage('註冊被取消或超時', 'error');
      } else if (error.name === 'InvalidStateError') {
        showMessage('此認證器已被註冊', 'error');
      } else {
        showMessage(`註冊錯誤: ${error.message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAuthenticate = async () => {
    if (!username.trim()) {
      showMessage('請輸入使用者名稱', 'error');
      return;
    }

    if (!browserSupportsWebAuthn()) {
      showMessage('您的瀏覽器不支援 WebAuthn', 'error');
      return;
    }

    setLoading(true);
    try {
      // 開始驗證
      const response = await fetch(`${API_BASE}/webauthn/authenticate/begin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          showMessage('使用者不存在，請先註冊', 'error');
          return;
        }
        throw new Error('驗證請求失敗');
      }

      const options = await response.json();

      // 呼叫 WebAuthn API
      const credential = await startAuthentication({ optionsJSON: options });

      // 完成驗證
      const verificationResponse = await fetch(`${API_BASE}/webauthn/authenticate/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, credential }),
      });

      if (!verificationResponse.ok) {
        throw new Error('驗證失敗');
      }

      const result = await verificationResponse.json();

      if (result.verified) {
        setUser(result.user);
        showMessage('登入成功！', 'success');
      } else {
        showMessage('驗證失敗', 'error');
      }
    } catch (error: any) {
      console.error('Authentication error:', error);
      if (error.name === 'NotAllowedError') {
        showMessage('驗證被取消或超時', 'error');
      } else {
        showMessage(`驗證錯誤: ${error.message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUsernamelessAuth = async () => {
    if (!browserSupportsWebAuthn()) {
      showMessage('您的瀏覽器不支援 WebAuthn', 'error');
      return;
    }

    setLoading(true);
    try {
      // 開始驗證
      const response = await fetch(`${API_BASE}/webauthn/authenticate/begin-usernameless`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('驗證請求失敗');
      }

      const options = await response.json();
      const { sessionId, ...optionsJSON } = options;

      // 呼叫 WebAuthn API（不使用 autofill）
      const credential = await startAuthentication({ optionsJSON });

      // 完成驗證
      const verificationResponse = await fetch(`${API_BASE}/webauthn/authenticate/finish-usernameless`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, sessionId }),
      });

      if (!verificationResponse.ok) {
        throw new Error('驗證失敗');
      }

      const result = await verificationResponse.json();

      if (result.verified) {
        setUser(result.user);
        showMessage('無密碼登入成功！', 'success');
      } else {
        showMessage('驗證失敗', 'error');
      }
    } catch (error: any) {
      console.error('Usernameless authentication error:', error);
      if (error.name === 'NotAllowedError') {
        showMessage('驗證被取消或超時', 'error');
      } else {
        showMessage(`驗證錯誤: ${error.message}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setUsername('');
    showMessage('已登出', 'info');

    // 重新啟動 Conditional UI
    if (supportsAutofill) {
      setTimeout(() => startConditionalUI(), 1000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            WebAuthn Demo
          </h1>
          <p className="text-gray-600">
            使用生物識別或安全金鑰進行無密碼驗證
          </p>
        </div>

        {/* 訊息顯示 */}
        {message && (
          <div className={`mb-4 p-3 rounded-md text-sm ${
            messageType === 'success' ? 'bg-green-100 text-green-700' :
            messageType === 'error' ? 'bg-red-100 text-red-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {message}
          </div>
        )}

        {user ? (
          /* 已登入狀態 */
          <div className="text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">歡迎回來！</h2>
              <p className="text-gray-600">使用者: {user.username}</p>
              <p className="text-sm text-gray-500">ID: {user.id}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition duration-200"
            >
              登出
            </button>
          </div>
        ) : (
          /* 未登入狀態 */
          <div>
            {/* 無使用者名稱登入 - 放在最上面 */}
            <div className="mb-6">
              <button
                onClick={handleUsernamelessAuth}
                disabled={loading}
                className="w-full bg-purple-600 text-white py-3 px-4 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 font-medium"
              >
                {loading ? '處理中...' : '🔑 使用 Passkey 登入'}
              </button>
            </div>

            {supportsAutofill && (
              <div className="mb-4 p-3 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-700">
                  💡 支援自動填入登入！點擊使用者名稱輸入框可能會出現 passkey 選項。
                </p>
              </div>
            )}

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">或使用傳統方式</span>
              </div>
            </div>

            <div className="mb-6">
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                使用者名稱
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="輸入您的使用者名稱"
                autoComplete="webauthn"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            <div className="space-y-3">
              <button
                onClick={handleRegister}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
              >
                {loading ? '處理中...' : '註冊新帳號'}
              </button>

              <button
                onClick={handleAuthenticate}
                disabled={loading}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
              >
                {loading ? '處理中...' : '登入'}
              </button>
            </div>

            <div className="mt-6 text-sm text-gray-500">
              <p className="mb-2">💡 使用說明：</p>
              <ul className="space-y-1 text-xs">
                <li>• 推薦使用「使用 Passkey 登入」體驗現代無密碼登入</li>
                <li>• 首次使用請先註冊（會自動建立 passkey）</li>
                <li>• 支援指紋、Face ID、USB 安全金鑰等</li>
                <li>• 需要 HTTPS 或 localhost 環境</li>
              </ul>
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <div className="space-y-1">
            <p className="text-xs text-gray-400">
              WebAuthn 支援: {browserSupportsWebAuthn() ? '✅ 支援' : '❌ 不支援'}
            </p>
            {supportsAutofill && (
              <p className="text-xs text-gray-400">
                自動填入: ✅ 支援 Conditional UI
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
