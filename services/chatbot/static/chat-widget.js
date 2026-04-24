/**
 * AI 채팅 위젯 — Shadow DOM 기반, 의존성 없음
 * 삽입: <script src="http://YOUR_SYNOLOGY:8001/widget.js" data-server-url="http://YOUR_SYNOLOGY:8001"></script>
 */
(function () {
  'use strict';

  // ── 설정 ──────────────────────────────────────────────────────────────
  const scriptEl = document.currentScript || document.querySelector('script[data-server-url]');
  const SERVER_URL = (scriptEl && scriptEl.dataset.serverUrl)
    || (window.ChatbotConfig && window.ChatbotConfig.serverUrl)
    || 'http://localhost:8001';
  const TITLE = (window.ChatbotConfig && window.ChatbotConfig.title)
    || window.__ChatbotServerTitle
    || 'AI 도우미';
  const PLACEHOLDER = (window.ChatbotConfig && window.ChatbotConfig.placeholder)
    || '궁금한 점을 입력하세요…';
  const WS_URL = SERVER_URL.replace(/^http/, 'ws') + '/ws/' + _uid();

  function _uid() {
    return 'xxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));
  }

  // ── 스타일 ─────────────────────────────────────────────────────────────
  const CSS = `
    :host { all: initial; display: block; }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

    /* 토글 버튼 */
    #toggle-btn {
      position: fixed; bottom: 28px; right: 28px; z-index: 2147483646;
      width: 60px; height: 60px; border-radius: 50%;
      background: #6366f1; border: none; cursor: pointer;
      box-shadow: 0 4px 20px rgba(99,102,241,.5);
      display: flex; align-items: center; justify-content: center;
      transition: transform .2s, box-shadow .2s;
    }
    #toggle-btn:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(99,102,241,.65); }
    #toggle-btn svg { width: 28px; height: 28px; fill: #fff; }

    /* 배지 */
    #badge {
      position: absolute; top: -4px; right: -4px;
      background: #ef4444; color: #fff; font-size: 11px; font-weight: 700;
      min-width: 20px; height: 20px; border-radius: 10px; padding: 0 5px;
      display: none; align-items: center; justify-content: center;
    }
    #badge.visible { display: flex; }

    /* 채팅창 래퍼 */
    #chat-box {
      position: fixed; bottom: 100px; right: 28px; z-index: 2147483645;
      width: 340px;
      max-height: 520px;
      display: flex; flex-direction: column;
      background: #fff; border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,.18);
      overflow: hidden;
      transform: translateY(20px) scale(.95); opacity: 0;
      pointer-events: none;
      transition: transform .25s cubic-bezier(.34,1.56,.64,1), opacity .2s;
    }
    #chat-box.open {
      transform: translateY(0) scale(1); opacity: 1; pointer-events: auto;
    }

    /* 헤더 */
    #header {
      background: #6366f1; color: #fff; padding: 14px 16px;
      display: flex; align-items: center; justify-content: space-between;
      flex-shrink: 0;
    }
    #header-title { font-size: 15px; font-weight: 600; }
    #header-sub { font-size: 11px; opacity: .75; margin-top: 1px; }
    #close-btn {
      background: none; border: none; cursor: pointer;
      color: rgba(255,255,255,.85); padding: 4px; border-radius: 6px;
      display: flex; align-items: center;
      transition: background .15s;
    }
    #close-btn:hover { background: rgba(255,255,255,.2); }
    #close-btn svg { width: 18px; height: 18px; fill: currentColor; }

    /* 메시지 리스트 */
    #messages {
      flex: 1; overflow-y: auto; padding: 14px 12px;
      display: flex; flex-direction: column; gap: 10px;
      scroll-behavior: smooth;
    }
    #messages::-webkit-scrollbar { width: 4px; }
    #messages::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 4px; }

    /* 메시지 버블 */
    .msg { display: flex; flex-direction: column; max-width: 82%; gap: 3px; }
    .msg.user { align-self: flex-end; align-items: flex-end; }
    .msg.bot  { align-self: flex-start; align-items: flex-start; }
    .bubble {
      padding: 9px 13px; border-radius: 16px; font-size: 13.5px;
      line-height: 1.5; word-break: break-word;
    }
    .msg.user .bubble { background: #6366f1; color: #fff; border-bottom-right-radius: 4px; }
    .msg.bot  .bubble { background: #f3f4f6; color: #1f2937; border-bottom-left-radius: 4px; }
    .msg-time { font-size: 10px; color: #9ca3af; }

    /* 타이핑 인디케이터 */
    #typing {
      display: none; align-self: flex-start;
      background: #f3f4f6; border-radius: 16px; border-bottom-left-radius: 4px;
      padding: 10px 14px; gap: 5px;
    }
    #typing.visible { display: flex; }
    .dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #9ca3af; animation: bounce 1.2s infinite;
    }
    .dot:nth-child(2) { animation-delay: .2s; }
    .dot:nth-child(3) { animation-delay: .4s; }
    @keyframes bounce {
      0%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-6px); }
    }

    /* 웰컴 메시지 */
    #welcome {
      text-align: center; padding: 16px 12px 4px;
      font-size: 12px; color: #6b7280;
    }

    /* 입력 영역 */
    #input-area {
      display: flex; gap: 8px; padding: 10px 12px;
      border-top: 1px solid #e5e7eb; flex-shrink: 0; background: #fff;
    }
    #input {
      flex: 1; border: 1.5px solid #e5e7eb; border-radius: 10px;
      padding: 8px 12px; font-size: 13.5px; outline: none; resize: none;
      line-height: 1.4; max-height: 80px; overflow-y: auto;
      transition: border-color .15s;
    }
    #input:focus { border-color: #6366f1; }
    #send-btn {
      width: 38px; height: 38px; border-radius: 10px;
      background: #6366f1; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background .15s; flex-shrink: 0;
      align-self: flex-end;
    }
    #send-btn:hover { background: #4f46e5; }
    #send-btn:disabled { background: #c7d2fe; cursor: not-allowed; }
    #send-btn svg { width: 17px; height: 17px; fill: #fff; }

    /* 연결 상태 */
    #conn-status {
      font-size: 10px; text-align: center; padding: 3px 0 6px;
      color: #9ca3af; flex-shrink: 0;
    }
    #conn-status.error { color: #ef4444; }
  `;

  // ── HTML ───────────────────────────────────────────────────────────────
  const HTML = `
    <button id="toggle-btn" aria-label="채팅 열기/닫기">
      <span id="badge"></span>
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 10H6V10h12v2zm0-3H6V7h12v2z"/></svg>
    </button>

    <div id="chat-box" role="dialog" aria-label="AI 채팅">
      <div id="header">
        <div>
          <div id="header-title">${TITLE}</div>
          <div id="header-sub">AI가 답변 드립니다</div>
        </div>
        <button id="close-btn" aria-label="닫기">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>

      <div id="messages">
        <div id="welcome">무엇이든 물어보세요</div>
        <div id="typing">
          <span class="dot"></span><span class="dot"></span><span class="dot"></span>
        </div>
      </div>

      <div id="conn-status">연결 중…</div>

      <div id="input-area">
        <textarea id="input" rows="1" placeholder="${PLACEHOLDER}" aria-label="메시지 입력"></textarea>
        <button id="send-btn" disabled aria-label="전송">
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
  `;

  // ── 마운트 ─────────────────────────────────────────────────────────────
  const host = document.createElement('div');
  host.id = 'chatbot-widget-host';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });
  const styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  shadow.appendChild(styleEl);

  const wrapper = document.createElement('div');
  wrapper.innerHTML = HTML;
  shadow.appendChild(wrapper);

  // ── 요소 참조 ──────────────────────────────────────────────────────────
  const toggleBtn  = shadow.getElementById('toggle-btn');
  const chatBox    = shadow.getElementById('chat-box');
  const closeBtn   = shadow.getElementById('close-btn');
  const messages   = shadow.getElementById('messages');
  const typing     = shadow.getElementById('typing');
  const inputEl    = shadow.getElementById('input');
  const sendBtn    = shadow.getElementById('send-btn');
  const badge      = shadow.getElementById('badge');
  const connStatus = shadow.getElementById('conn-status');

  // ── 상태 ───────────────────────────────────────────────────────────────
  let isOpen = false;
  let unread = 0;
  let ws = null;
  let wsReady = false;

  // ── 유틸 ───────────────────────────────────────────────────────────────
  function _time() {
    return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  }

  function _scrollBottom() {
    requestAnimationFrame(() => { messages.scrollTop = messages.scrollHeight; });
  }

  function _addMsg(role, text) {
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + (role === 'user' ? 'user' : 'bot');

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;

    const time = document.createElement('div');
    time.className = 'msg-time';
    time.textContent = _time();

    wrap.appendChild(bubble);
    wrap.appendChild(time);

    // typing 인디케이터 앞에 삽입
    messages.insertBefore(wrap, typing);
    _scrollBottom();

    if (role === 'bot' && !isOpen) {
      unread++;
      badge.textContent = unread > 9 ? '9+' : String(unread);
      badge.classList.add('visible');
    }
  }

  function _setTyping(on) {
    if (on) {
      messages.appendChild(typing); // 맨 끝으로 이동
      typing.classList.add('visible');
      _scrollBottom();
    } else {
      typing.classList.remove('visible');
    }
  }

  function _setSendable(ok) {
    sendBtn.disabled = !ok;
  }

  // ── WebSocket ──────────────────────────────────────────────────────────
  function _connect() {
    try {
      ws = new WebSocket(WS_URL);
    } catch (e) {
      _setStatus('연결 실패 — 서버를 확인하세요', true);
      return;
    }

    ws.onopen = () => {
      wsReady = true;
      _setStatus('');
      _setSendable(true);
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'typing') {
          _setTyping(data.status);
        } else if (data.type === 'message') {
          _setTyping(false);
          _addMsg('bot', data.content);
          _setSendable(true);
        }
      } catch {}
    };

    ws.onerror = () => {
      wsReady = false;
      _setSendable(false);
      _setStatus('연결 오류 — 재연결 중…', true);
    };

    ws.onclose = () => {
      wsReady = false;
      _setSendable(false);
      _setStatus('연결 끊김 — 재연결 중…', true);
      setTimeout(_connect, 3000);
    };
  }

  function _setStatus(msg, isError) {
    connStatus.textContent = msg;
    connStatus.className = isError ? 'error' : '';
  }

  // ── 전송 ───────────────────────────────────────────────────────────────
  function _send() {
    const text = inputEl.value.trim();
    if (!text || !wsReady) return;

    _addMsg('user', text);
    inputEl.value = '';
    inputEl.style.height = 'auto';
    _setSendable(false);

    ws.send(JSON.stringify({ content: text }));
  }

  // ── 이벤트 ─────────────────────────────────────────────────────────────
  toggleBtn.addEventListener('click', () => {
    isOpen = !isOpen;
    chatBox.classList.toggle('open', isOpen);
    if (isOpen) {
      unread = 0;
      badge.textContent = '';
      badge.classList.remove('visible');
      setTimeout(() => inputEl.focus(), 280);
    }
  });

  closeBtn.addEventListener('click', () => {
    isOpen = false;
    chatBox.classList.remove('open');
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      _send();
    }
  });

  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 80) + 'px';
  });

  sendBtn.addEventListener('click', _send);

  // ── 초기화 ─────────────────────────────────────────────────────────────
  _connect();
})();
