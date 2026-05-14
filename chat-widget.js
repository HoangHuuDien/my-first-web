/**
 * Chat Thuận Thiên — tư vấn qua OpenRouter (model mặc định: Claude Sonnet 4.5; đổi bằng OPENROUTER_MODEL trên Vercel).
 * Cần deploy lên Vercel + OPENROUTER_API_KEY. API /api/chat đọc data/SYSTEM_PROMPT.md, data/brandvoice.md, data/sales_script.md.
 *
 * Lead → Make.com: POST JSON tới webhook (URL công khai trong bundle — nên giới hạn / xác thực phía Make nếu bị spam).
 */
(function () {
  "use strict";

  /** Webhook Make.com — nhận lead + toàn bộ hội thoại (JSON). */
  var MAKE_WEBHOOK_URL = "https://hook.eu1.make.com/20n86h5h51cd37v91clfwjeukns6v7zj";

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
      '<div class="tt-chat-lead-section" id="tt-chat-lead-section">' +
      '<button type="button" class="tt-chat-lead-toggle" id="tt-chat-lead-toggle" aria-expanded="false">Để lại Tên · SĐT · Nhu cầu — team liên hệ</button>' +
      '<div class="tt-chat-lead-fields" id="tt-chat-lead-fields" hidden>' +
      '<label class="tt-chat-lead-label">Tên<input type="text" class="tt-chat-lead-input" id="tt-lead-name" maxlength="120" autocomplete="name" placeholder="Họ tên"></label>' +
      '<label class="tt-chat-lead-label">SĐT<input type="tel" class="tt-chat-lead-input" id="tt-lead-phone" maxlength="20" autocomplete="tel" placeholder="VD: 0901234567"></label>' +
      '<label class="tt-chat-lead-label">Nhu cầu<textarea class="tt-chat-lead-textarea" id="tt-lead-need" rows="2" maxlength="500" placeholder="Bạn cần gì (quẻ, sách, bát tự…)"></textarea></label>' +
      '<p class="tt-chat-lead-hint" id="tt-lead-hint" role="status"></p>' +
      '<button type="button" class="tt-chat-lead-submit" id="tt-lead-submit">Gửi cho team</button>' +
      "</div></div>" +
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

  function randomId() {
    return "tt_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
  }

  /** Chuẩn hóa SĐT VN cơ bản; trả null nếu không thấy. */
  function extractVnPhone(s) {
    var t = String(s || "").replace(/[\s.\-]/g, "");
    var m = t.match(/(?:^|[^\d])(0[35789]\d{8})(?:[^\d]|$)/);
    if (m) return m[1];
    m = t.match(/(?:^|[^\d])\+?84([35789]\d{8})(?:[^\d]|$)/);
    if (m) return "0" + m[1];
    return null;
  }

  /**
   * HOT LEAD: ý mua / đăng ký / liên hệ, hoặc để lại SĐT trong chat,
   * hoặc từ khóa chốt nhanh (bổ sung ngoài INTEREST_KEYS).
   */
  function isHotLead(text) {
    if (detectInterest(text)) return true;
    if (extractVnPhone(text)) return true;
    var t = (text || "").toLowerCase();
    var extra = [
      "hen lich",
      "hẹn lịch",
      "dat lich",
      "đặt lịch",
      "lien he ngay",
      "liên hệ ngay",
      "goi cho",
      "gọi cho",
      "xin tu van",
      "xin tư vấn",
      "muon gap",
      "muốn gặp",
      "chot don",
      "chốt đơn",
      "bao gia roi mua",
      "báo giá rồi mua",
      "em lay",
      "em lấy",
      "cho em slot",
      "con slot",
      "còn slot"
    ];
    var j;
    for (j = 0; j < extra.length; j++) {
      if (t.indexOf(extra[j]) !== -1) return true;
    }
    return false;
  }

  function transcriptPlainFromLog(log) {
    var lines = [];
    var i;
    for (i = 0; i < log.length; i++) {
      var e = log[i];
      var who = e.role === "user" ? "Khách" : "Bot";
      lines.push(who + ": " + String(e.content || "").trim());
    }
    return lines.join("\n\n");
  }

  /**
   * POST JSON sạch sang Make.com (Custom Webhook).
   * payload: { event_type, occurred_at, page_url, session_id, customer, conversation, transcript_plain, hot_lead_reason? }
   */
  function postMakeWebhook(payload) {
    return fetch(MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload)
    })
      .then(function (r) {
        if (!r.ok) {
          return { ok: false, status: r.status };
        }
        return { ok: true, status: r.status };
      })
      .catch(function (err) {
        console.warn("[Thuận Thiên chat] Make webhook:", err);
        return { ok: false, status: 0, error: err && err.message ? String(err.message) : "network" };
      });
  }

  function buildMakePayload(eventType, sessionId, leadLog, customer, hotReason) {
    var pageUrl = "";
    try {
      if (typeof window !== "undefined" && window.location && window.location.href) {
        pageUrl = window.location.href;
      }
    } catch (e) {}
    var conv = [];
    var k;
    for (k = 0; k < leadLog.length; k++) {
      conv.push({ role: leadLog[k].role, content: String(leadLog[k].content || "") });
    }
    var payload = {
      source: "thuan-thien-chat-widget",
      event_type: eventType,
      occurred_at: new Date().toISOString(),
      page_url: pageUrl,
      session_id: sessionId,
      customer: {
        name: String((customer && customer.name) || "").trim(),
        phone: String((customer && customer.phone) || "").trim(),
        need: String((customer && customer.need) || "").trim()
      },
      conversation: {
        messages: conv
      },
      transcript_plain: transcriptPlainFromLog(leadLog)
    };
    if (hotReason) payload.hot_lead_reason = String(hotReason);
    return payload;
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
    /** Bản sao hội thoại cho Make (có lời chào đầu). */
    var leadLog = [];
    var sessionId = randomId();
    var hotLeadSent = false;

    var leadToggle = root.querySelector("#tt-chat-lead-toggle");
    var leadFields = root.querySelector("#tt-chat-lead-fields");
    var leadName = root.querySelector("#tt-lead-name");
    var leadPhone = root.querySelector("#tt-lead-phone");
    var leadNeed = root.querySelector("#tt-lead-need");
    var leadSubmit = root.querySelector("#tt-lead-submit");
    var leadHint = root.querySelector("#tt-lead-hint");
    var leadSection = root.querySelector("#tt-chat-lead-section");

    function pushLead(role, content) {
      leadLog.push({
        role: role,
        content: String(content || ""),
        ts: new Date().toISOString()
      });
    }

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
        pushLead("assistant", GREETING);
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
      pushLead("user", text);

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
            pushLead("assistant", "[Lỗi máy chủ] " + err);
            chatMessages.pop();
            return;
          }
          var reply = (result.data && result.data.reply) || "";
          if (!reply) {
            appendBubble(messages, "Mình chưa nhận được câu trả lời — bạn thử gửi lại giúp mình nhé.", "bot");
            pushLead("assistant", "[Không có reply]");
            chatMessages.pop();
            return;
          }
          appendBubble(messages, reply, "bot");
          pushLead("assistant", reply);
          chatMessages.push({ role: "assistant", content: reply });
          while (chatMessages.length > 40) {
            chatMessages.shift();
          }
          if (isHotLead(text) && !hotLeadSent) {
            hotLeadSent = true;
            var reasonParts = [];
            if (detectInterest(text)) reasonParts.push("interest_keywords");
            if (extractVnPhone(text)) reasonParts.push("phone_in_message");
            if (reasonParts.length === 0) reasonParts.push("hot_intent");
            postMakeWebhook(
              buildMakePayload(
                "hot_lead",
                sessionId,
                leadLog,
                { name: "", phone: extractVnPhone(text) || "", need: "" },
                reasonParts.join(",")
              )
            );
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
          pushLead("assistant", "[Lỗi mạng / API]");
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

    if (leadToggle && leadFields) {
      leadToggle.addEventListener("click", function () {
        var open = !!leadFields.hidden;
        leadFields.hidden = !open;
        leadToggle.setAttribute("aria-expanded", open ? "true" : "false");
        if (open && leadSection) {
          setTimeout(function () {
            leadSection.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }, 80);
        }
      });
    }

    function normalizePhoneDigits(p) {
      var x = String(p || "").trim().replace(/[\s.\-]/g, "");
      if (x.indexOf("+84") === 0) x = "0" + x.slice(3);
      else if (x.indexOf("84") === 0 && x.length >= 10) x = "0" + x.slice(2);
      return x;
    }

    if (leadSubmit && leadName && leadPhone && leadNeed && leadHint) {
      leadSubmit.addEventListener("click", function () {
        var name = (leadName.value || "").trim();
        var phoneRaw = normalizePhoneDigits(leadPhone.value);
        var need = (leadNeed.value || "").trim();
        leadHint.textContent = "";
        if (name.length < 2) {
          leadHint.textContent = "Bạn cho mình họ tên (ít nhất 2 ký tự) nhé.";
          return;
        }
        if (!/^0[35789]\d{8}$/.test(phoneRaw)) {
          leadHint.textContent = "SĐT chưa đúng dạng (10 số, đầu 03/05/07/08/09).";
          return;
        }
        if (need.length < 3) {
          leadHint.textContent = "Bạn ghi giúp nhu cầu ngắn gọn (ít nhất vài chữ).";
          return;
        }
        var prevBtnText = leadSubmit.textContent;
        leadHint.textContent = "Đang gửi…";
        leadSubmit.disabled = true;
        leadSubmit.textContent = "Đang gửi…";
        postMakeWebhook(
          buildMakePayload(
            "lead_form",
            sessionId,
            leadLog,
            { name: name, phone: phoneRaw, need: need },
            null
          )
        ).then(function (res) {
          leadSubmit.textContent = prevBtnText;
          leadSubmit.disabled = false;
          if (!res || !res.ok) {
            var st = res && res.status ? String(res.status) : "?";
            leadHint.textContent =
              "Chưa gửi được (mã " + st + "). Bạn thử lại sau vài phút; hoặc kéo xuống form đỏ trên trang.";
            appendBubble(
              messages,
              "Mình chưa kết nối được tới Make — có thể do mạng hoặc chặn trình duyệt. Bạn thử bấm Gửi lại, hoặc điền form đỏ trên trang nhé.",
              "bot"
            );
            return;
          }
          leadHint.textContent = "Đã gửi xong. Cảm ơn bạn — team sẽ đọc và liên hệ khi phù hợp.";
          appendBubble(messages, "Mình đã chuyển thông tin của bạn cho team. Cảm ơn bạn đã tin tưởng nhé.", "bot");
          pushLead("assistant", "[Đã gửi form: Tên / SĐT / Nhu cầu cho team]");
          leadName.value = "";
          leadPhone.value = "";
          leadNeed.value = "";
          leadFields.hidden = true;
          leadToggle.setAttribute("aria-expanded", "false");
        });
      });
    }
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
