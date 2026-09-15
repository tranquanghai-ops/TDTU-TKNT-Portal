/**
 * TDTU-TKNT Shared Auth Guard
 * Tự động kiểm tra phiên đăng nhập và ngăn chặn truy cập ứng dụng khi chưa đăng nhập.
 */

(async function() {
  if (window.__tdtu_auth_guard_initialized) return;
  window.__tdtu_auth_guard_initialized = true;

  // Ngăn chặn tương tác nền ngay từ khi bắt đầu tải
  const style = document.createElement('style');
  style.id = 'tdtu-auth-guard-style';
  style.innerHTML = `
    #tdtu-auth-overlay {
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(15, 23, 42, 0.94);
      backdrop-filter: blur(10px);
      z-index: 2147483647; /* Đảm bảo luôn nằm trên cùng mọi modal/iframe */
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #0f172a;
      transition: opacity 0.25s ease;
      pointer-events: auto;
    }
    #tdtu-auth-modal {
      background: #ffffff;
      border-radius: 16px;
      padding: 2.5rem 2rem;
      max-width: 440px;
      width: 90%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
    }
    #tdtu-auth-modal h2 {
      font-size: 1.35rem;
      font-weight: 700;
      color: #1a3c5e;
      margin-bottom: 0.75rem;
    }
    #tdtu-auth-modal p {
      font-size: 0.95rem;
      color: #475569;
      line-height: 1.5;
      margin-bottom: 1.75rem;
    }
    .tdtu-btn-login {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.65rem;
      width: 100%;
      background: #1a3c5e;
      color: #ffffff;
      font-weight: 600;
      font-size: 0.95rem;
      padding: 0.8rem 1.25rem;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.15s, box-shadow 0.15s;
    }
    .tdtu-btn-login:hover {
      background: #132b43;
      box-shadow: 0 4px 12px rgba(26,60,94,0.25);
    }
    .tdtu-btn-portal {
      display: inline-block;
      margin-top: 1.1rem;
      font-size: 0.85rem;
      color: #64748b;
      text-decoration: none;
    }
    .tdtu-btn-portal:hover {
      color: #1a3c5e;
      text-decoration: underline;
    }
    .tdtu-auth-spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #e2e8f0;
      border-top-color: #1a3c5e;
      border-radius: 50%;
      animation: tdtu-spin 0.8s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes tdtu-spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = 'tdtu-auth-overlay';
  overlay.innerHTML = `
    <div id="tdtu-auth-modal">
      <div class="tdtu-auth-spinner" id="tdtu-auth-spinner"></div>
      <h2 id="tdtu-auth-title">Đang xác thực...</h2>
      <p id="tdtu-auth-desc">Đang kiểm tra phiên đăng nhập từ Cổng thông tin TDTU-TKNT.</p>
      <div id="tdtu-auth-actions" style="display:none;">
        <button class="tdtu-btn-login" id="tdtu-btn-auth-action">
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/><path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/><path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"/></svg>
          Đăng nhập bằng Google
        </button>
        <br>
        <a href="/" class="tdtu-btn-portal">← Về trang chính Cổng thông tin</a>
      </div>
    </div>
  `;
  function attachOverlay() {
    if (document.getElementById('tdtu-auth-overlay')) return;
    document.body.appendChild(overlay);
  }

  if (document.body) {
    attachOverlay();
  } else {
    document.addEventListener('DOMContentLoaded', attachOverlay);
  }

  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js');
    const { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider } = await import('https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js');

    let config = { authDomain: "tknt-tdtu.firebaseapp.com", projectId: "tknt-tdtu" };
    try {
      const res = await fetch('/__/firebase/init.json');
      if (res.ok) config = await res.json();
    } catch (e) {}

    const app = initializeApp(config);
    const auth = getAuth(app);

    onAuthStateChanged(auth, user => {
      if (user) {
        // Đã đăng nhập: gỡ overlay
        overlay.style.opacity = '0';
        setTimeout(() => {
          overlay.remove();
          const styleEl = document.getElementById('tdtu-auth-guard-style');
          if (styleEl) styleEl.remove();
        }, 200);
      } else {
        // Chưa đăng nhập: hiển thị giao diện yêu cầu đăng nhập
        const spinner = document.getElementById('tdtu-auth-spinner');
        const title = document.getElementById('tdtu-auth-title');
        const desc = document.getElementById('tdtu-auth-desc');
        const actions = document.getElementById('tdtu-auth-actions');

        if (spinner) spinner.style.display = 'none';
        if (title) title.innerHTML = '🔒 Bạn cần đăng nhập';
        if (desc) desc.textContent = 'Ứng dụng này thuộc Cổng thông tin Khoa MTCN – ĐH Tôn Đức Thắng. Vui lòng đăng nhập bằng tài khoản Google để sử dụng.';
        if (actions) actions.style.display = 'block';
      }
    });

    const btn = document.getElementById('tdtu-btn-auth-action');
    if (btn) {
      btn.onclick = async () => {
        try {
          btn.disabled = true;
          btn.textContent = 'Đang đăng nhập...';
          const provider = new GoogleAuthProvider();
          await signInWithPopup(auth, provider);
        } catch (err) {
          console.error('[auth-guard] Đăng nhập thất bại:', err);
          alert('Đăng nhập thất bại: ' + err.message);
          btn.disabled = false;
          btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/><path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/><path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"/></svg> Đăng nhập bằng Google';
        }
      };
    }
  } catch (err) {
    console.error('[auth-guard] Lỗi xác thực:', err);
  }
})();
