/**
 * Chat widget — đồng bộ ý định với Top 10 FAQ (`data/faq/cau-hoi-thuong-gap.md` ##1–##10) + `sales_script.md` §2,
 * cùng `data/products/*` (Thuận Thiên). Mỗi bubble: một intent (điểm khớp + priority); không nhét nhiều dịch vụ.
 */
(function () {
  "use strict";

  var GREETING = "Chào bạn, mình là trợ lý của Thuận Thiên, bạn đang quan tâm điều gì nhỉ?";

  var SOFT_CLARIFY =
    "Mình có thể hiểu tin nhắn theo vài hướng khác nhau. Bạn chốt giúp **một ý** đang cần nhất ngay bây giờ: kẹt **một quyết định gần**, hay lo **tiền — nghề dài hơi**, hay chuyện **số điện thoại / ngày giờ / form**? Nhắn lại **một dòng** — mình trả **một** hướng thôi.";

  var FALLBACK =
    "Mình chưa bắt được ý chính. Bạn nhắn **một câu ngắn** (đang cần quyết việc gì, hoặc đang lo nhất điều gì) — mình sẽ chỉ **một** cách làm phù hợp.\n\n" +
    "Muốn team đọc kỹ hơn: form đỏ cuối trang (Họ tên, Email, Zalo).";

  function norm(s) {
    return (s || "")
      .toLowerCase()
      .replace(/đ/g, "d")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function matches(text, keys) {
    var n = norm(text);
    return keys.some(function (k) {
      return n.indexOf(norm(k)) !== -1;
    });
  }

  /** Điểm khớp mềm: cả cụm khóa và từng mảnh (>=3 ký tự) trong khóa. */
  function faqScore(userNorm, item) {
    var score = 0;
    var u = userNorm;
    for (var j = 0; j < item.keys.length; j++) {
      var nk = norm(item.keys[j]);
      if (nk.length < 2) continue;
      if (u.indexOf(nk) !== -1) {
        score += 8 + Math.min(nk.length, 24);
        continue;
      }
      var parts = nk.split(/\s+/);
      for (var p = 0; p < parts.length; p++) {
        var frag = parts[p];
        if (frag.length >= 3 && u.indexOf(frag) !== -1) score += 4;
      }
    }
    return score;
  }

  /** @type {{ priority: number, keys: string[], reply: string }[]} */
  var INTENTS = [
    {
      priority: 96,
      keys: [
        "quẻ", "que kinh dich", "kinh dich", "gieo", "gieo que", "rut que", "iching", "i ching",
        "mot cau hoi", "1 cau hoi", "co nen lam bay gio", "co nen ky", "co nen hop tac", "hoi mot viec", "hỏi một việc"
      ],
      reply:
        "Với **một việc cụ thể** sắp quyết (ký — bung tiền — chọn hướng trong vài tháng), hợp nhất là **hỏi quẻ Kinh Dịch**: 200k / câu, nhắn **Cát Tường** định câu rõ **trước khi** rút, làm đúng trang kinhdich.thuanthienkinhdich.com — thường 1–3 ngày có luận sau khi đủ bước."
    },
    {
      priority: 94,
      keys: ["luận số", "luan so", "xem so dang dung", "so dang dung", "luansdt", "xem số điện thoại", "danh gia số"],
      reply:
        "Bạn đang cần **luận một số đang (hoặc sắp) dùng** — một lộ duy nhất: **200k / số**, làm đúng hướng dẫn tại https://luansdt.thuanthienkinhdich.com/. Không ép đổi số."
    },
    {
      priority: 93,
      keys: ["tim sim", "tim sdt", "chon sim", "sim moi", "tim so dep", "tim so dien thoai", "chọn số"],
      reply:
        "Bạn đang cần **tìm số điện thoại mới** theo tiêu chí — một lộ: xem bảng phí theo cấp + tiền sim tại https://sdt.thuanthienkinhdich.com/timsdt, rồi nhắn Cát Tường đủ thông tin theo trang."
    },
    {
      priority: 86,
      keys: ["sim", "sdt", "so dien thoai", "số máy", "so may", "hotline", "dau so", "đầu số"],
      reply:
        "Để chỉ **một** quy trình cho đúng: bạn muốn **luận số đang dùng** hay **tìm số mới**? Nhắn lại một chữ **luận** hoặc **tìm** — mình trả đúng một đường."
    },
    {
      priority: 92,
      keys: [
        "ngay tot", "ngày tốt", "gio tot", "giờ tốt", "chon ngay", "chọn ngày", "khai truong", "cuoi hoi", "cưới hỏi", "gay nha",
        "tai lieu a z", "tu hoc ngay gio", "dat truoc tai lieu", "500k dat truoc", "khong muon hoi thay", "ngai hoi thay"
      ],
      reply:
        "Bạn muốn **tự chọn ngày — giờ tốt** mà không phụ thuộc thầy loanh quanh — hướng phù hợp là **tài liệu A–Z** (đặt trước 500k theo thông báo mốc âm lịch trên trang; luôn đối chiếu bản mới nhất)."
    },
    {
      priority: 91,
      keys: [
        "luck", "khoa luck", "khóa luck", "1190k", "1190 k", "run vi tien", "so vo tien", "quan tri tien", "quản trị tiền",
        "hoc ve tien", "khoa hoc tien", "kiem roi mat", "kiếm rồi mất"
      ],
      reply:
        "Bạn đang lo **tiền — thói quyết định tiền** mà muốn **tự chủ** ít phụ thuộc quẻ từng lần run — **một** lựa chọn phù hợp là khóa **LUCK 1190k**: CK ghi Tên + LUCK, nhắn Cát Tường bill, trang https://www.thuanthienkinhdich.com/luck"
    },
    {
      priority: 88,
      keys: [
        "so sanh quẻ", "khac quẻ", "khác gì quẻ", "quẻ với bát", "bát với tử", "tu vi va bat tu", "menh ly", "khac nhau giua", "so sanh bat tu",
        "bat tu khac tu vi", "khac tu vi cho nao", "bat tu khac que cho nao"
      ],
      reply:
        "Bạn đang cần **phân biệt công cụ** — gọn một ý: **một việc gần, cần quyết** → quẻ; **bức tranh nghề — tiền — hôn nhân theo giai đoạn** → bát tự (hiện đi cùng **sách** theo trang chính thức)."
    },
    {
      priority: 84,
      keys: [
        "bat tu", "bát tự", "tu vi", "tử vi", "la so menh", "laso menh", "lá số", "dai van", "đại vận", "nghề nghiệp dài",
        "hon nhan lau dai", "bức tranh dài", "xem boi menh", "tu van menh", "battu", "sach va bat tu"
      ],
      reply:
        "Bạn đang hướng tới **bát tự / lá số dài hơi** — một lộ hiện tại: **mua sách Thuận Thiên** (500k ebook + quà kèm có video lá số), cần **đủ năm tháng ngày giờ sinh** và form cẩn thận — trang https://www.thuanthienkinhdich.com/sachthuanthien"
    },
    {
      priority: 83,
      keys: [
        "sach", "ebook", "mua sach thuan", "sach thuan thien", "combo sach", "video la so", "video lá số", "battu kem sach"
      ],
      reply:
        "Bạn đang hỏi về **sách Thuận Thiên** — một gói: **500k** ebook + quà kèm (có video lá số), form → chuyển khoản → nhắn Cát Tường bill — https://www.thuanthienkinhdich.com/sachthuanthien"
    },
    {
      priority: 86,
      keys: [
        "nam sinh", "tuoi th", "chi nam", "chi co nam", "khong co gio", "gio sinh", "thieu gio", "khong nho gio", "không nhớ giờ",
        "ngay thang nam", "nmns", "day du thong tin", "du lieu sinh", "laso nhung khong co gio",
        "chi cho minh nam sinh", "nam sinh xem duoc khong", "tuoi thi xem duoc khong", "chi co tuoi thoi"
      ],
      reply:
        "Bạn đang thiếu dữ liệu cho **lá số bát tự** — một hướng: **đủ năm tháng ngày giờ sinh** (tra giấy khai sinh hoặc hỏi nhà) rồi đăng ký theo **sách + video lá số** trên trang chính thức; chưa đủ giờ thì chưa nên chốt sâu bát tự."
    },
    {
      priority: 78,
      keys: [
        "800k", "800 k", "1500k", "1500 k", "zoom", "goi zoom", "vo chong", "vợ chồng", "cap doi", "phu phi", "gồm hết", "gom het",
        "sau buoi", "co bi gai them khong", "800k da gom het chua", "gom het chua", "phu phi sau buoi", "sau buoi xem"
      ],
      reply:
        "Bạn đang lo **phụ phí / gói Zoom** — một ý: bên mình **một mức một việc**, không gài phong thủy — lễ; gói **800k / 1500k Zoom** hiện **không nhận**, lá số đi qua **mua sách** — luôn đối chiếu trang đang live."
    },
    {
      priority: 76,
      keys: [
        "dọa", "phong thuy", "phong thủy", "lam le", "bua", "gài thêm", "so bi ep", "lo bi lua",
        "xem xong co bi", "lam them gi", "lam them gi khong"
      ],
      reply:
        "Bạn đang lo **xem xong bị gài thêm** — đúng một ranh giới Thuận Thiên: **không** dọa để bán phong thủy / lễ / bùa; nội dung dừng đúng phần đã thỏa thuận."
    },
    {
      priority: 72,
      keys: [
        "form", "landing", "zalo form", "dang ky o dau", "dang ky ở đâu", "link form", "google form", "cat tuong", "cát tường",
        "nhan tin cho ai", "lien he ai", "tro ly", "nham form", "nhầm form", "hai form", "khac nhau form",
        "landing form zalo", "form zalo khac", "khac voi form bat tu", "form tren web khac"
      ],
      reply:
        "Bạn đang lẫn **form / chỗ nhắn** — gọn một bước: nói **một tên món** bạn muốn (quẻ / sách / LUCK) — mình chỉ **một** link hoặc một kênh (Cát Tường) tương ứng; form đỏ cuối trang này chỉ để **danh sách chờ**."
    },
    {
      priority: 70,
      keys: [
        "bao lau", "bao lâu", "may ngay", "mấy ngày", "cho doi", "cho bao lau", "bao gio co ket qua", "khi nao xong", "hen lich", "xếp lịch",
        "bao gio toi luot", "co lau khong", "bao lau thi co lich", "khi nao co lich"
      ],
      reply:
        "Thời gian **phụ thuộc đúng món** bạn đặt — để mình trả **một** khung: bạn đang hỏi sau khi chốt **quẻ** hay sau khi đặt **sách + video lá số**? Nhắn **quẻ** hoặc **sách**."
    },
    {
      priority: 68,
      keys: [
        "chu nhat", "chủ nhật", "cn ", " cuoi tuan", "cuối tuần", "t7", "thứ 7", "thu bay", "thứ bảy", "rang sang", "chi ranh cn",
        "lich ranh", "co gap cuoi tuan khong", "cuoi tuan co xem duoc khong", "chu nhat co xem duoc khong"
      ],
      reply:
        "Bạn đang hỏi **lịch rảnh / cuối tuần** — một ý: lịch làm việc kiểu **chiều T2–T7**; chỉ rảnh **Chủ nhật** thì ghi rõ trong form hoặc nhắn Cát Tường để khỏi hẹn trật."
    },
    {
      priority: 62,
      keys: [
        "khong phu hop", "từ chối", "tu choi", "co nhan khong", "co nhận không", "so khong duoc nhan", "case khong fit", "khong nhan loai nay",
        "khong phu hop thi co bi nhan khong"
      ],
      reply:
        "Bạn đang lo **không được nhận / bị từ chối** — một ranh giới: bên mình **có thể từ chối** case không fit để khỏi phí tiền và cảm xúc hai bên; từ chối là chuyện thẳng, không để bạn tự ái."
    },
    {
      priority: 58,
      keys: [
        "doi van", "đổi vận", "bat luc", "bất lực", "xem roi", "xem roi van the", "biet roi nhung van", "co thay doi gi khong", "cau duoc khong",
        "co doi van duoc khong", "xem roi co doi van"
      ],
      reply:
        "Bạn đang nói **xem rồi vẫn bất lực / đổi vận** — mình không bán đổi vận bằng lễ. Để chỉ **một** hướng tiếp: bạn đang đau vì **một quyết định sắp tới** (nên hỏi **quẻ**), hay vì **túi tiền — thói quyết định dài** (nên xem **LUCK**)? Nhắn **quẻ** hoặc **LUCK**."
    },
    {
      priority: 56,
      keys: [
        "me tin", "mê tín", "khoa hoc", "khoa học", "co dung khong", "co tin khong", "that hay lua", "co bi lua khong", "khong tin", "không tin",
        "huyen hoc", "huyền học", "xem bat tu co phai me tin", "bat tu co phai me tin"
      ],
      reply:
        "Bạn đang ngại **mê tín / có tin được không** — một góc thực dụng: đây là **công cụ nhìn xu hướng và thời điểm** để bớt quyết định nóng — không thay bác sĩ hay luật sư; không tranh luận tin hay không."
    },
    {
      priority: 32,
      keys: [
        "gia", "phí", "phi ", "bao nhieu tien", "het bao nhieu", "muc phi", "chi phi", "bao tien", "xin gia", "200k", "500k", "800k", "1500k",
        "phi tim sim", "bao nhieu mot lan"
      ],
      reply:
        "Bạn đang hỏi **giá** mà chưa gắn rõ món — để mình báo **một** mức đúng trang: bạn chốt **một tên** trong các món đang mở (quẻ / sách / LUCK / luận số / tìm sim / tài liệu ngày giờ) rồi nhắn lại **một chữ** — mình trả đúng một mức."
    }
  ];

  function pickReply(userText) {
    var raw = (userText || "").trim();
    if (!raw) return null;
    var u = norm(raw);
    if (u.length < 2) return null;

    var rows = [];
    var i;
    for (i = 0; i < INTENTS.length; i++) {
      rows.push({ i: i, s: faqScore(u, INTENTS[i]), p: INTENTS[i].priority });
    }
    rows.sort(function (a, b) {
      if (b.s !== a.s) return b.s - a.s;
      return b.p - a.p;
    });

    var top = rows[0];
    var sec = rows[1];
    if (!top || top.s < 6) return null;

    if (sec && top.s >= 6 && top.s < 15 && top.s - sec.s <= 2 && sec.s >= 5) return SOFT_CLARIFY;
    if (top.s < 8 && sec && top.s - sec.s < 2) return SOFT_CLARIFY;

    return INTENTS[top.i].reply;
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
    "lay suat",
    "lấy suất",
    "toi muon",
    "tôi muon",
    "em muon",
    "giúp em đăng",
    "giup em dang",
    "huong dan",
    "hướng dẫn",
    "mua sach",
    "mua sách",
    "hoc luck",
    "học luck",
    "cho minh hoi",
    "cho mình hỏi",
    "xin link",
    "gui stk",
    "gửi stk",
    "cat tuong nao",
    "nhan tin cat tuong",
    "muon de lai thong tin",
    "để lại zalo"
  ];

  function detectInterest(text) {
    return matches(text, INTEREST_KEYS);
  }

  var userMsgCount = 0;
  var ctaShown = false;

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
      '<div><div class="tt-chat-header-title">Thuận Thiên</div><div class="tt-chat-header-sub">Gợi ý theo kiến thức Thuận Thiên — không thay tư vấn từng ca 1-1</div></div>' +
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
      "Nếu bạn đã rõ hướng hoặc muốn giữ chỗ cho team đọc kỹ hơn — điền form danh sách chờ ngay trên trang này (kéo xuống phần đỏ).";
    var a = document.createElement("a");
    a.className = "tt-chat-cta";
    a.href = "#contact-form";
    a.textContent = "Mở form đăng ký / danh sách chờ";
    a.addEventListener("click", function () {
      var root = document.getElementById("thuan-thien-chat-root");
      if (root && root.classList.contains("tt-chat-open")) {
        root.classList.remove("tt-chat-open");
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

  function init() {
    var root = buildWidget();
    if (!root) return;

    var launcher = root.querySelector(".tt-chat-launcher");
    var panel = root.querySelector(".tt-chat-panel");
    var closeBtn = root.querySelector(".tt-chat-close");
    var messages = root.querySelector("#tt-chat-messages");
    var input = root.querySelector("#tt-chat-input");
    var sendBtn = root.querySelector("#tt-chat-send");

    var openedOnce = false;

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

      var reply = pickReply(text);
      if (!reply) reply = FALLBACK;
      appendBubble(messages, reply, "bot");

      if (detectInterest(text)) {
        if (!ctaShown) {
          appendCta(messages);
          ctaShown = true;
        }
      } else if (userMsgCount >= 4 && !ctaShown) {
        appendCta(messages);
        ctaShown = true;
      }
    }

    sendBtn.addEventListener("click", sendMessage);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    /* accessibility: focus trap lite */
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
