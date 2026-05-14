/**
 * Chat Thuận Thiên — tư vấn qua OpenRouter (Claude 3.5 Sonnet).
 * Cần deploy lên Vercel + biến OPENROUTER_API_KEY. API: /api/chat (server đọc SYSTEM_PROMPT.md, brandvoice.md, sales_script.md).
 */
(function () {
  "use strict";

  var GREETING =
    "Chào bạn, mình là trợ lý Thuận Thiên, bạn quan tâm điều gì, hãy đặt câu hỏi cho mình nhé.";

  var API_PATH = "/api/chat";

  function buildWidget() {
    var root = document.getElementById("thuan-thien-chat-root");
    if (!root) return null;

    root.innerHTML =
      '<button type="button" class="tt-chat-launcher" aria-label="Mở chat tư vấn">' +
      '<span class="tt-chat-badge" aria-hidden="true"></span>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/>' +
      "</svg></button>" +
      '<div class="tt-chat-panel" role="dialog" aria-label="Chat tư vấn Thuận Thiên">' +
      '<div class="tt-chat-header">' +
      '<div><div class="tt-chat-header-title">Thuận Thiên</div><div class="tt-chat-header-sub">Tư vấn AI — giọng Thanh A; không thay tư vấn từng ca 1-1</div></div>' +
      '<button type="button" class="tt-chat-close" aria-label="Đóng chat">×</button></div>' +
      '<div class="tt-chat-messages" id="tt-chat-messages"></div>' +
      '<div class="tt-chat-input-row">' +
      '<textarea class="tt-chat-input" id="tt-chat-input" rows="3" placeholder="Nhắn tin ở đây…" maxlength="800"></textarea>' +
      '<button type="button" class="tt-chat-send" id="tt-chat-send" aria-label="Gửi">➤</button>' +
      "</div></div>";

    return root;
  }

  function appendBubble(container, text, who) {
    var row = document.createElement("div");
    row.className = "tt-chat-row " + (who === "user" ? "user" : "bot");
    var bubble = document.createElement("div");
    bubble.className = "tt-chat-bubble";
    bubble.textContent = text;
    row.appendChild(bubble);
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
    return row;
  }

  function appendCta(container) {
    var row = document.createElement("div");
    row.className = "tt-chat-row bot";
    var wrap = document.createElement("div");
    wrap.className = "tt-chat-bubble";
    var inner = document.createElement("div");
    inner.textContent =
      "Muốn team đọc và liên hệ lại, kéo xuống form đỏ trên trang (Zalo) — mình không làm phiền bạn.";
    var a = document.createElement("a");
    a.className = "tt-chat-cta";
    a.href = "#contact-form";
    a.textContent = "Mở form đăng ký / danh sách chờ";
    a.addEventListener("click", function () {
      var rootEl = document.getElementById("thuan-thien-chat-root");
      if (rootEl && rootEl.classList.contains("tt-chat-open")) {
        rootEl.classList.remove("tt-chat-open");
      }
      setTimeout(function () {
        var el = document.getElementById("contact-form");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          var first = el.querySelector("input, textarea, select");
          if (first) first.focus();
        }
      }, 280);
    });
    var ctaWrap = document.createElement("div");
    ctaWrap.className = "tt-chat-cta-wrap";
    ctaWrap.appendChild(a);
    wrap.appendChild(inner);
    wrap.appendChild(ctaWrap);
    row.appendChild(wrap);
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
  }

  var INTEREST_KEYS = [
    "dang ky",
    "đăng ký",
    "muon mua",
    "muốn mua",
    "chot",
    "chốt",
    "link",
    "chuyen khoan",
    "chuyển khoản",
    "thanh toan",
    "thanh toán",
    "mua sach",
    "mua sách",
    "hoc luck",
    "học luck",
    "xin link",
    "cat tuong",
    "zalo",
    "để lại"
  ];

  function detectInterest(text) {
    var t = (text || "").toLowerCase();
    var i;
    for (i = 0; i < INTEREST_KEYS.length; i++) {
      if (t.indexOf(INTEREST_KEYS[i]) !== -1) return true;
    }
    return false;
  }

  function wireWidget(root) {
    var launcher = root.querySelector(".tt-chat-launcher");
    var panel = root.querySelector(".tt-chat-panel");
    var closeBtn = root.querySelector(".tt-chat-close");
    var messages = root.querySelector("#tt-chat-messages");
    var input = root.querySelector("#tt-chat-input");
    var sendBtn = root.querySelector("#tt-chat-send");

    var openedOnce = false;
    var userMsgCount = 0;
    var ctaShown = false;
    /** Lịch sử gửi lên API: user | assistant */
    var chatMessages = [];

    var apiUrl = (function () {
      try {
        if (typeof window !== "undefined" && window.location && window.location.origin) {
          return window.location.origin.replace(/\/$/, "") + API_PATH;
        }
      } catch (e) {}
      return API_PATH;
    })();

    function setBusy(busy) {
      sendBtn.disabled = !!busy;
      input.disabled = !!busy;
      sendBtn.setAttribute("aria-busy", busy ? "true" : "false");
    }

    function openChat() {
      root.classList.add("tt-chat-open");
      if (!openedOnce) {
        openedOnce = true;
        appendBubble(messages, GREETING, "bot");
      }
      setTimeout(function () {
        input.focus();
      }, 200);
    }

    function closeChat() {
      root.classList.remove("tt-chat-open");
    }

    launcher.addEventListener("click", function () {
      if (root.classList.contains("tt-chat-open")) {
        closeChat();
      } else {
        openChat();
      }
    });
    closeBtn.addEventListener("click", closeChat);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && root.classList.contains("tt-chat-open")) closeChat();
    });

    function sendMessage() {
      var text = (input.value || "").trim();
      if (!text) return;
      input.value = "";
      appendBubble(messages, text, "user");
      userMsgCount += 1;

      chatMessages.push({ role: "user", content: text });
      while (chatMessages.length > 40) {
        chatMessages.shift();
      }

      setBusy(true);
      appendBubble(messages, "…", "bot");
      var pendingRow = messages.lastElementChild;
      var pendingBubble = pendingRow ? pendingRow.querySelector(".tt-chat-bubble") : null;

      fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatMessages.slice() })
      })
        .then(function (r) {
          return r.json().then(function (data) {
            return { ok: r.ok, status: r.status, data: data };
          });
        })
        .then(function (result) {
          if (pendingBubble && pendingRow) {
            pendingRow.parentNode.removeChild(pendingRow);
          }
          if (!result.ok) {
            var err = (result.data && result.data.error) || "Không kết nối được máy chủ chat.";
            appendBubble(messages, err, "bot");
            chatMessages.pop();
            return;
          }
          var reply = (result.data && result.data.reply) || "";
          if (!reply) {
            appendBubble(messages, "Mình chưa nhận được câu trả lời — bạn thử gửi lại giúp mình nhé.", "bot");
            chatMessages.pop();
            return;
          }
          appendBubble(messages, reply, "bot");
          chatMessages.push({ role: "assistant", content: reply });
          while (chatMessages.length > 40) {
            chatMessages.shift();
          }
        })
        .catch(function () {
          if (pendingBubble && pendingRow) {
            pendingRow.parentNode.removeChild(pendingRow);
          }
          appendBubble(
            messages,
            "Mình không gọi được API (có thể bạn đang mở file từ máy, hoặc chưa deploy Vercel / thiếu OPENROUTER_API_KEY). Hãy mở trang đã deploy trên Vercel rồi thử lại.",
            "bot"
          );
          chatMessages.pop();
        })
        .finally(function () {
          setBusy(false);
          if (detectInterest(text)) {
            if (!ctaShown) {
              appendCta(messages);
              ctaShown = true;
            }
          } else if (userMsgCount >= 4 && !ctaShown) {
            appendCta(messages);
            ctaShown = true;
          }
        });
    }

    sendBtn.addEventListener("click", sendMessage);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    panel.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var focusables = panel.querySelectorAll('button, [href], textarea, input, select, [tabindex]:not([tabindex="-1"])');
      var list = Array.prototype.filter.call(focusables, function (el) {
        return !el.disabled && el.offsetParent !== null;
      });
      if (!list.length) return;
      var first = list[0];
      var last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  function init() {
    var root = buildWidget();
    if (!root) return;
    wireWidget(root);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
