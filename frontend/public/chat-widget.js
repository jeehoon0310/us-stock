/**
 * AI톡 채팅 위젯 — admin 전용, HTTP fetch, Shadow DOM
 * /auth/me 에서 is_admin 확인 후 렌더링
 */
(function () {
  'use strict';

  // admin 체크 먼저 — 이름·이메일 저장해서 로그에 기록
  fetch('/auth/me', { credentials: 'include' })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(d) { if (d && d.is_admin) _init(d.name || '', d.email || ''); })
    .catch(function() {});

  const API_PATH = '/api/chat';
  const TITLE = 'AI톡';
  const PLACEHOLDER = '궁금한 점을 입력하세요…';

  const SESSION_ID = (function () {
    var key = 'chatbot_session_id';
    var id = sessionStorage.getItem(key);
    if (!id) {
      id = 'xxxxxxxxxxxx'.replace(/x/g, function() { return ((Math.random() * 16) | 0).toString(16); });
      sessionStorage.setItem(key, id);
    }
    return id;
  })();

  const CSS = `
    :host { all: initial; display: block; }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

    #toggle-btn {
      position: fixed; bottom: 28px; right: 28px; z-index: 2147483646;
      width: 60px; height: 60px; border-radius: 50%;
      background: transparent; border: none; cursor: pointer;
      box-shadow: 0 4px 20px rgba(74,222,128,.4);
      padding: 0; overflow: hidden;
      transition: transform .2s, box-shadow .2s;
    }
    #toggle-btn:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(74,222,128,.6); }
    #toggle-btn img { width: 60px; height: 60px; display: block; }

    #badge {
      position: absolute; top: -4px; right: -4px;
      background: #ef4444; color: #fff; font-size: 11px; font-weight: 700;
      min-width: 20px; height: 20px; border-radius: 10px; padding: 0 5px;
      display: none; align-items: center; justify-content: center;
    }
    #badge.visible { display: flex; }

    #chat-box {
      position: fixed; bottom: 100px; right: 28px; z-index: 2147483645;
      width: 340px; max-height: 520px;
      display: flex; flex-direction: column;
      background: #18181b; border-radius: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,.5);
      overflow: hidden;
      transform: translateY(20px) scale(.95); opacity: 0;
      pointer-events: none;
      transition: transform .25s cubic-bezier(.34,1.56,.64,1), opacity .2s;
    }
    #chat-box.open { transform: translateY(0) scale(1); opacity: 1; pointer-events: auto; }

    #header {
      background: #14532d; color: #86efac; padding: 14px 16px;
      display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
    }
    #header-title { font-size: 15px; font-weight: 700; }
    #header-sub { font-size: 11px; opacity: .65; margin-top: 1px; }
    #close-btn {
      background: none; border: none; cursor: pointer;
      color: rgba(134,239,172,.7); padding: 4px; border-radius: 6px;
      display: flex; align-items: center; transition: background .15s;
    }
    #close-btn:hover { background: rgba(134,239,172,.12); }
    #close-btn svg { width: 18px; height: 18px; fill: currentColor; }

    #messages {
      flex: 1; overflow-y: auto; padding: 14px 12px;
      display: flex; flex-direction: column; gap: 10px; scroll-behavior: smooth;
    }
    #messages::-webkit-scrollbar { width: 4px; }
    #messages::-webkit-scrollbar-thumb { background: #52525b; border-radius: 4px; }

    .msg { display: flex; flex-direction: column; max-width: 82%; gap: 3px; }
    .msg.user { align-self: flex-end; align-items: flex-end; }
    .msg.bot  { align-self: flex-start; align-items: flex-start; }
    .bubble { padding: 9px 13px; border-radius: 16px; font-size: 13.5px; line-height: 1.5; word-break: break-word; }
    .msg.user .bubble { background: #16a34a; color: #f0fdf4; border-bottom-right-radius: 4px; font-weight: 500; }
    .msg.bot  .bubble { background: #27272a; color: #e4e4e7; border-bottom-left-radius: 4px; }
    .msg-time { font-size: 10px; color: #71717a; }

    #typing {
      display: none; align-self: flex-start;
      background: #27272a; border-radius: 16px; border-bottom-left-radius: 4px;
      padding: 10px 14px; gap: 5px;
    }
    #typing.visible { display: flex; }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: #71717a; animation: bounce 1.2s infinite; }
    .dot:nth-child(2) { animation-delay: .2s; }
    .dot:nth-child(3) { animation-delay: .4s; }
    @keyframes bounce {
      0%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-6px); }
    }

    #welcome { text-align: center; padding: 16px 12px 4px; font-size: 12px; color: #71717a; }

    #input-area {
      display: flex; gap: 8px; padding: 10px 12px;
      border-top: 1px solid #3f3f46; flex-shrink: 0; background: #18181b;
    }
    #input {
      flex: 1; border: 1.5px solid #3f3f46; border-radius: 10px;
      padding: 8px 12px; font-size: 13.5px; outline: none; resize: none;
      line-height: 1.4; max-height: 80px; overflow-y: auto;
      background: #27272a; color: #f4f4f5;
      transition: border-color .15s;
    }
    #input::placeholder { color: #71717a; }
    #input:focus { border-color: #4ade80; }
    #send-btn {
      width: 38px; height: 38px; border-radius: 10px;
      background: #16a34a; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background .15s; flex-shrink: 0; align-self: flex-end;
    }
    #send-btn:hover { background: #15803d; }
    #send-btn:disabled { background: #166534; cursor: not-allowed; }
    #send-btn svg { width: 17px; height: 17px; fill: #f0fdf4; }
  `;

  const HTML = `
    <button id="toggle-btn" aria-label="AI톡 열기/닫기">
      <span id="badge"></span>
      <img src="/ai-tok.png" alt="AI톡" />
    </button>

    <div id="chat-box" role="dialog" aria-label="AI톡">
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
      <div id="input-area">
        <textarea id="input" rows="1" placeholder="${PLACEHOLDER}" aria-label="메시지 입력"></textarea>
        <button id="send-btn" aria-label="전송">
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
  `;

  function _init(username, email) {
    var host = document.createElement('div');
    host.id = 'chatbot-widget-host';
    document.body.appendChild(host);
    var shadow = host.attachShadow({ mode: 'open' });
    var styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    shadow.appendChild(styleEl);
    var wrapper = document.createElement('div');
    wrapper.innerHTML = HTML;
    shadow.appendChild(wrapper);

    var toggleBtn = shadow.getElementById('toggle-btn');
    var chatBox   = shadow.getElementById('chat-box');
    var closeBtn  = shadow.getElementById('close-btn');
    var messages  = shadow.getElementById('messages');
    var typing    = shadow.getElementById('typing');
    var inputEl   = shadow.getElementById('input');
    var sendBtn   = shadow.getElementById('send-btn');
    var badge     = shadow.getElementById('badge');

    var isOpen = false, unread = 0, busy = false;

    function _time() {
      return new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    }

    function _addMsg(role, text) {
      var wrap = document.createElement('div');
      wrap.className = 'msg ' + (role === 'user' ? 'user' : 'bot');
      var bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.textContent = text;
      var time = document.createElement('div');
      time.className = 'msg-time';
      time.textContent = _time();
      wrap.appendChild(bubble);
      wrap.appendChild(time);
      messages.insertBefore(wrap, typing);
      requestAnimationFrame(function() { messages.scrollTop = messages.scrollHeight; });
      if (role === 'bot' && !isOpen) {
        unread++;
        badge.textContent = unread > 9 ? '9+' : String(unread);
        badge.classList.add('visible');
      }
    }

    function _setTyping(on) {
      if (on) {
        messages.appendChild(typing);
        typing.classList.add('visible');
        requestAnimationFrame(function() { messages.scrollTop = messages.scrollHeight; });
      } else {
        typing.classList.remove('visible');
      }
    }

    function _send() {
      var text = inputEl.value.trim();
      if (!text || busy) return;
      busy = true;
      sendBtn.disabled = true;
      _addMsg('user', text);
      inputEl.value = '';
      inputEl.style.height = 'auto';
      _setTyping(true);

      fetch(API_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: SESSION_ID, content: text, username: username, email: email }),
        credentials: 'include',
      })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          _setTyping(false);
          _addMsg('bot', data.reply || '답변을 받지 못했습니다.');
        })
        .catch(function() {
          _setTyping(false);
          _addMsg('bot', '연결 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
        })
        .finally(function() {
          busy = false;
          sendBtn.disabled = false;
          inputEl.focus();
        });
    }

    toggleBtn.addEventListener('click', function() {
      isOpen = !isOpen;
      chatBox.classList.toggle('open', isOpen);
      if (isOpen) {
        unread = 0; badge.textContent = ''; badge.classList.remove('visible');
        setTimeout(function() { inputEl.focus(); }, 280);
      }
    });

    closeBtn.addEventListener('click', function() { isOpen = false; chatBox.classList.remove('open'); });

    inputEl.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _send(); }
    });

    inputEl.addEventListener('input', function() {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 80) + 'px';
    });

    sendBtn.addEventListener('click', _send);
  }
})();
