/**
 * Chat Thuận Thiên — tư vấn theo 2 nguồn: (1) toàn bộ file .md trong /data, (2) giọng & quy tắc trong data/brandvoice_dump.txt (ID 8–9).
 * Không tự bịa ngoài hai nguồn; bubble dùng textContent. Tải corpus khi mở trang; cốt lõi trả lời vẫn khớp intent + điểm neo trong data.
 */
(function () {
  "use strict";

  var KB = {
    faqLoaded: false,
    brandvoiceOk: false,
    brandvoiceText: "",
    corpusNorm: "",
    corpusReady: false
  };

  var GREETING =
    "Chào bạn, mình là trợ lý Thuận Thiên, bạn quan tâm điều gì, hãy đặt câu hỏi cho mình nhé.";

  var SOFT_CLARIFY =
    "Mình chưa chắc bạn đang cần nhánh nào. Bạn cho mình biết gần đây bạn đang lo việc gì, hay muốn hỏi về quẻ, bát tự / lá số, sách, số điện thoại, ngày giờ — mình trả lời gọn theo đúng phần đó nhé.";

  function fallbackReply() {
    if (!KB.corpusReady) {
      return "Mình chưa tải xong dữ liệu trên trang — bạn thử tải lại giúp mình nhé. Hoặc điền form đỏ cuối trang để team liên hệ lại.";
    }
    return "Mình chưa hiểu đúng ý lần này. Bạn gửi thêm một câu nói rõ bạn đang cần gì nhé, mình sẽ trả lời đúng phần mình nắm trong dữ liệu.";
  }

  function asksPriceWords(u) {
    return (
      u.indexOf("gia") !== -1 ||
      u.indexOf("phi") !== -1 ||
      u.indexOf("bao nhieu") !== -1 ||
      u.indexOf("bao nhieu tien") !== -1 ||
      u.indexOf("het bao nhieu") !== -1 ||
      u.indexOf("muc phi") !== -1 ||
      u.indexOf("chi phi") !== -1
    );
  }

  /** Hỏi giá / phí mà không hỏi quy trình — mới được trả một dòng giá. */
  function isPriceOnlyQuestion(u) {
    if (
      u.indexOf("lam sao") !== -1 ||
      u.indexOf("cac buoc") !== -1 ||
      u.indexOf("huong dan") !== -1 ||
      u.indexOf("quy trinh") !== -1 ||
      u.indexOf("nhu the nao") !== -1
    ) {
      return false;
    }
    return asksPriceWords(u);
  }

  function mentionsBatTuFamily(u) {
    return (
      u.indexOf("bat tu") !== -1 ||
      u.indexOf("battu") !== -1 ||
      u.indexOf("tu vi") !== -1 ||
      u.indexOf("la so") !== -1 ||
      u.indexOf("dai van") !== -1
    );
  }

  /** Giá bát tự / lá số — theo data/products/02-bat-tu-tu-van.md */
  function isBatTuPriceOnly(u) {
    if (!isPriceOnlyQuestion(u)) return false;
    if (!mentionsBatTuFamily(u)) return false;
    return true;
  }

  /** Chỉ hỏi giá quẻ Kinh Dịch — «quẻ» đứng một mình (không kèm bát tự / lá số) vẫn tính là quẻ KD. */
  function isKinhDichPriceOnly(u) {
    if (!isPriceOnlyQuestion(u)) return false;
    if (u.indexOf("dang ky") !== -1 && (u.indexOf("que") !== -1 || u.indexOf("kinh dich") !== -1)) {
      return false;
    }
    if (mentionsBatTuFamily(u)) return false;
    return (
      u.indexOf("kinh dich") !== -1 ||
      u.indexOf("iching") !== -1 ||
      u.indexOf("i ching") !== -1 ||
      (u.indexOf("que") !== -1 && u.indexOf("kinh") !== -1) ||
      (u.indexOf("que") !== -1 && u.indexOf("dich") !== -1) ||
      u.indexOf("que") !== -1
    );
  }

  function getStaticBase() {
    var scripts = document.getElementsByTagName("script");
    var i;
    for (i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src || "";
      if (src.indexOf("chat-widget.js") !== -1) {
        return src.replace(/chat-widget\.js(\?.*)?$/i, "");
      }
    }
    return "";
  }

  function fetchText(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      return r.text();
    });
  }

  /** Toàn bộ .md trong /data (kiến thức) — đồng bộ khi thêm file. */
  var DATA_MARKDOWN_URLS = [
    "data/faq/cau-hoi-thuong-gap.md",
    "data/faq/tom-tat-dung-huyen-hoc-hieu-qua-tu-reading.md",
    "data/faq/tom-tat-sach-quy-luat-tai-loc-va-hanh-phuc-tu-reading.md",
    "data/products/00-muc-luc-san-pham.md",
    "data/products/01-kinh-dich-tu-van.md",
    "data/products/02-bat-tu-tu-van.md",
    "data/products/03-sach-thuan-thien.md",
    "data/products/04-tai-lieu-ngay-gio-tot.md",
    "data/products/05-xem-so-dien-thoai.md",
    "data/products/06-chon-so-dien-thoai-dep.md",
    "data/products/07-khoa-hoc-luck.md",
    "data/objections/tu-choi-va-cach-xu-ly.md",
    "data/customers/feedback-va-chuyen-khach-mau.md"
  ];

  function loadDataCorpus(base) {
    var list = DATA_MARKDOWN_URLS.map(function (p) {
      return { path: p, url: base + p };
    });
    return Promise.all(
      list.map(function (item) {
        return fetchText(item.url).then(function (t) {
          return { path: item.path, text: t || "" };
        }).catch(function () {
          return { path: item.path, text: "" };
        });
      })
    ).then(function (pairs) {
      var faqMd = "";
      var rawParts = [];
      var i;
      for (i = 0; i < pairs.length; i++) {
        rawParts.push(pairs[i].text);
        if (pairs[i].path === "data/faq/cau-hoi-thuong-gap.md") faqMd = pairs[i].text;
      }
      KB.corpusNorm = norm(rawParts.join("\n\n---\n\n")).slice(0, 200000);
      KB.corpusReady = KB.corpusNorm.length > 500;
      if (faqMd) applyFaqHeadingsToIntents(faqMd);
      KB.faqLoaded = !!faqMd;
    });
  }

  function intentCorpusBoost(item) {
    if (!KB.corpusReady || !KB.corpusNorm) return 0;
    var extra = 0;
    var j;
    for (j = 0; j < item.keys.length; j++) {
      var nk = norm(item.keys[j]);
      if (nk.length < 5) continue;
      if (KB.corpusNorm.indexOf(nk) !== -1) extra += 2;
    }
    return extra > 10 ? 10 : extra;
  }

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
      if (item.matchFullKeyOnly) continue;
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
        "Quẻ Kinh Dịch hợp khi bạn cần quyết một việc cụ thể trong giai đoạn gần (thường vài tháng), một câu là 200k. Bạn muốn mình nói giá hay các bước để được xem quẻ — mình trả đúng phần bạn chọn nhé."
    },
    {
      priority: 94,
      keys: ["luận số", "luan so", "xem so dang dung", "so dang dung", "luansdt", "xem số điện thoại", "danh gia số"],
      reply:
        "Luận số đang (hoặc sắp) dùng: 200k một số. Chi tiết và mẫu tin nằm trên trang Thuận Thiên (mục luận số điện thoại). Không ép đổi số."
    },
    {
      priority: 93,
      keys: ["tim sim", "tim sdt", "chon sim", "sim moi", "tim so dep", "tim so dien thoai", "chọn số"],
      reply:
        "Tìm số mới: bảng phí và từng bước nằm trên trang Thuận Thiên (mục tìm số). Có chỗ chưa rõ thì nhắn lại mình nhé."
    },
    {
      priority: 86,
      keys: ["sim", "sdt", "so dien thoai", "số máy", "so may", "hotline", "dau so", "đầu số"],
      reply:
        "Bạn cần luận số đang dùng hay tìm số mới? Trả lời một chữ: luận hoặc tìm."
    },
    {
      priority: 92,
      keys: [
        "ngay tot", "ngày tốt", "gio tot", "giờ tốt", "chon ngay", "chọn ngày", "khai truong", "cuoi hoi", "cưới hỏi", "gay nha",
        "tai lieu a z", "tu hoc ngay gio", "dat truoc tai lieu", "500k dat truoc", "khong muon hoi thay", "ngai hoi thay"
      ],
      reply:
        "Tự chọn ngày giờ: tài liệu A–Z, đặt trước 500k theo mốc âm lịch trên trang (đối chiếu bản mới nhất)."
    },
    {
      priority: 91,
      keys: [
        "luck", "khoa luck", "khóa luck", "1190k", "1190 k", "run vi tien", "so vo tien", "quan tri tien", "quản trị tiền",
        "hoc ve tien", "khoa hoc tien", "kiem roi mat", "kiếm rồi mất"
      ],
      reply:
        "Khóa LUCK 1190k (tiền, tự quyết): chuyển khoản ghi rõ Tên + LUCK, gửi bill cho trợ lý theo hướng dẫn trên trang Thuận Thiên (mục LUCK)."
    },
    {
      priority: 88,
      keys: [
        "so sanh quẻ", "khac quẻ", "khác gì quẻ", "quẻ với bát", "bát với tử", "tu vi va bat tu", "menh ly", "khac nhau giua", "so sanh bat tu",
        "bat tu khac tu vi", "khac tu vi cho nao", "bat tu khac que cho nao"
      ],
      reply:
        "Việc gần cần quyết → quẻ. Nghề–tiền–hôn nhân theo giai đoạn dài → bát tự; hiện đi qua mua sách trên trang chính thức."
    },
    {
      priority: 84,
      keys: [
        "bat tu", "bát tự", "tu vi", "tử vi", "la so menh", "laso menh", "lá số", "dai van", "đại vận", "nghề nghiệp dài",
        "hon nhan lau dai", "bức tranh dài", "xem boi menh", "tu van menh", "battu", "sach va bat tu"
      ],
      reply:
        "Lá số dài: mình khuyên đi qua sách Thuận Thiên (500k gồm ebook và phần quà có video lá số), cần đủ giờ sinh. Chi tiết trên trang Thuận Thiên (mục sách và mục bát tự)."
    },
    {
      priority: 83,
      keys: [
        "sach", "ebook", "mua sach thuan", "sach thuan thien", "combo sach", "video la so", "video lá số", "battu kem sach"
      ],
      reply:
        "Sách Thuận Thiên 500k (ebook + quà có video lá số): làm theo form và chuyển khoản trên trang Thuận Thiên (mục sách), gửi bill cho trợ lý đúng hướng dẫn."
    },
    {
      priority: 86,
      keys: [
        "nam sinh", "tuoi th", "chi nam", "chi co nam", "khong co gio", "gio sinh", "thieu gio", "khong nho gio", "không nhớ giờ",
        "ngay thang nam", "nmns", "day du thong tin", "du lieu sinh", "laso nhung khong co gio",
        "chi cho minh nam sinh", "nam sinh xem duoc khong", "tuoi thi xem duoc khong", "chi co tuoi thoi"
      ],
      reply:
        "Chỉ năm/tuổi chưa đủ xem bát tự chuẩn; cần đủ năm tháng ngày giờ (giấy khai sinh). Chưa có giờ thì đừng vội chốt sâu."
    },
    {
      priority: 78,
      keys: [
        "800k", "800 k", "1500k", "1500 k", "zoom", "goi zoom", "vo chong", "vợ chồng", "cap doi", "phu phi", "gồm hết", "gom het",
        "sau buoi", "co bi gai them khong", "800k da gom het chua", "gom het chua", "phu phi sau buoi", "sau buoi xem"
      ],
      reply:
        "Không phụ phí kiểu phong thủy. Zoom 800k/1500k hiện không nhận; lá số đi qua mua sách — xem trang đang live."
    },
    {
      priority: 76,
      keys: [
        "dọa", "phong thuy", "phong thủy", "lam le", "bua", "gài thêm", "so bi ep", "lo bi lua",
        "xem xong co bi", "lam them gi", "lam them gi khong"
      ],
      reply:
        "Thuận Thiên không dọa bán thêm phong thủy/lễ/bùa; nội dung dừng đúng đã thỏa thuận."
    },
    {
      priority: 72,
      keys: [
        "form", "landing", "zalo form", "dang ky o dau", "dang ky ở đâu", "link form", "google form", "cat tuong", "cát tường",
        "nhan tin cho ai", "lien he ai", "tro ly", "nham form", "nhầm form", "hai form", "khac nhau form",
        "landing form zalo", "form zalo khac", "khac voi form bat tu", "form tren web khac"
      ],
      reply:
        "Mỗi món có cổng riêng trên trang Thuận Thiên. Bạn nói rõ quẻ, sách hay LUCK, mình gợi đúng nhánh. Form đỏ trên trang này là danh sách chờ."
    },
    {
      priority: 70,
      keys: [
        "bao lau", "bao lâu", "may ngay", "mấy ngày", "cho doi", "cho bao lau", "bao gio co ket qua", "khi nao xong", "hen lich", "xếp lịch",
        "bao gio toi luot", "co lau khong", "bao lau thi co lich", "khi nao co lich"
      ],
      reply:
        "Tùy món: quẻ thường vài ngày sau đủ bước; sách + video theo trang sách. Bạn đang hỏi quẻ hay sách?"
    },
    {
      priority: 68,
      keys: [
        "chu nhat", "chủ nhật", "cn ", " cuoi tuan", "cuối tuần", "t7", "thứ 7", "thu bay", "thứ bảy", "rang sang", "chi ranh cn",
        "lich ranh", "co gap cuoi tuan khong", "cuoi tuan co xem duoc khong", "chu nhat co xem duoc khong"
      ],
      reply:
        "Lịch chiều thứ Hai đến thứ Bảy. Chỉ rảnh chủ nhật thì ghi rõ trong form để trợ lý xếp cho khỏi trật lịch nhé."
    },
    {
      priority: 62,
      keys: [
        "khong phu hop", "từ chối", "tu choi", "co nhan khong", "co nhận không", "so khong duoc nhan", "case khong fit", "khong nhan loai nay",
        "khong phu hop thi co bi nhan khong"
      ],
      reply:
        "Có thể từ chối case không phù hợp để khỏi phí tiền và cảm xúc. Nói thẳng, không làm bạn khó chịu."
    },
    {
      priority: 58,
      keys: [
        "doi van", "đổi vận", "bat luc", "bất lực", "xem roi", "xem roi van the", "biet roi nhung van", "co thay doi gi khong", "cau duoc khong",
        "co doi van duoc khong", "xem roi co doi van"
      ],
      reply:
        "Không hứa đổi vận bằng lễ. Việc gần cần siết rủi ro thì hay cân nhắc quẻ; nền tiền và quyết định dài hơi thì có hướng LUCK. Bạn đang kẹt đoạn nào hơn?"
    },
    {
      priority: 56,
      keys: [
        "me tin", "mê tín", "khoa hoc", "khoa học", "co dung khong", "co tin khong", "that hay lua", "co bi lua khong", "khong tin", "không tin",
        "huyen hoc", "huyền học", "xem bat tu co phai me tin", "bat tu co phai me tin"
      ],
      reply:
        "Mình không tranh luận tin hay không. Đây là công cụ xu hướng — không thay bác sĩ hay luật sư."
    },
    {
      priority: 32,
      keys: [
        "gia", "phí", "phi ", "bao nhieu", "bao nhieu tien", "het bao nhieu", "muc phi", "chi phi", "bao tien", "xin gia", "200k", "500k", "800k", "1500k",
        "phi tim sim", "bao nhieu mot lan"
      ],
      reply:
        "Mình chưa biết bạn đang hỏi món nào nên chưa báo đúng một mức được. Bạn cho mình biết quẻ Kinh Dịch, bát tự / lá số, sách, LUCK, luận số, tìm sim hay ngày giờ — mình báo giá gọn trong một câu nhé."
    },
    {
      priority: 100,
      matchFullKeyOnly: true,
      keys: [
        "lam sao de xem que kinh",
        "lam sao de xem que",
        "lam sao de duoc xem que",
        "lam sao de duoc xem kinh dich",
        "cac buoc xem que",
        "cac buoc dang ky xem",
        "cac buoc hoi kinh dich",
        "huong dan gieo que",
        "huong dan xem que",
        "quy trinh xem que",
        "dang ky xem que kinh",
        "lam the nao de hoi que",
        "lam the nao de duoc luận que",
        "bieu mau xem que",
        "lam sao de duoc luận",
        "nhu the nao de xem kinh dich"
      ],
      reply:
        "Để được xem quẻ Kinh Dịch, bạn làm lần lượt nhé: (1) Trao đổi với trợ lý để chốt một câu hỏi rõ — chưa rút quẻ vội. (2) Gieo quẻ đúng quy tắc: rút tiền ngẫu nhiên, ghi số seri và ngày giờ rút. (3) Gửi tin Facebook Thuận Thiên: câu hỏi, seri, ngày giờ rút (có thể kèm ngày giờ sinh nếu có). (4) Chuyển khoản phí 200k trước khi xếp lịch — đối chiếu tên thụ hưởng và STK trên trang chính thức khi chuyển. (5) Nhận luận qua tin nhắn (thường 1–3 ngày sau khi đủ bước), chỗ nào chưa hiểu thì hỏi thêm. Chi tiết bạn đối chiếu trên trang Thuận Thiên (mục quẻ) nếu cần."
    },
    {
      priority: 99,
      matchFullKeyOnly: true,
      keys: [
        "lam sao xem bat tu",
        "cac buoc xem bat tu",
        "cac buoc dang ky bat tu",
        "huong dan bat tu",
        "quy trinh xem bat tu",
        "lam sao de xem bat tu",
        "nhu the nao de xem bat tu",
        "dang ky xem bat tu",
        "cac buoc lam bat tu",
        "lam the nao de xem la so"
      ],
      reply:
        "Theo trang bát tự: (1) Điền form đăng ký. (2) Nếu gói có phí: chuyển khoản rồi nhắn trợ lý họ tên trong form kèm ảnh chuyển khoản. (3) Nhận lịch cụ thể; thường 1–2 tuần từ lúc đăng ký (theo trang). Hiện lá số chủ yếu qua mua sách — đối chiếu trang đang live."
    }
  ];

  /** Map số thứ tự câu FAQ (## trong data/faq) → chỉ số intent. */
  function applyFaqHeadingsToIntents(faqMd) {
    var re = /^##\s*(\d+)\.\s*(.+)$/gm;
    var map = { 1: 9, 2: 10, 3: 11, 4: 6, 5: 17, 6: 13, 7: 14, 8: 15, 9: 16, 10: 12 };
    var match;
    var seen = {};
    while ((match = re.exec(faqMd)) !== null) {
      var num = parseInt(match[1], 10);
      var title = (match[2] || "").replace(/\?+$/, "").trim();
      if (!title) continue;
      var idx = map[num];
      if (idx === undefined || !INTENTS[idx]) continue;
      var keys = INTENTS[idx].keys;
      var add = function (phrase) {
        var t = (phrase || "").trim();
        if (t.length < 3) return;
        var k = idx + ":" + norm(t);
        if (seen[k]) return;
        seen[k] = 1;
        keys.push(t);
      };
      add(title);
      var head = title.split(/[/|—–:]/)[0].trim();
      if (head.length > 6 && head !== title) add(head);
    }
  }

  function pickReply(userText) {
    var raw = (userText || "").trim();
    if (!raw) return null;
    var u = norm(raw);
    if (u.length < 2) return null;

    if (isBatTuPriceOnly(u)) {
      return "Xem bát tự hiện gắn với sách Thuận Thiên 500k (ebook + phần quà có video lá số). Trang vẫn ghi gói Zoom 800k một lá và 1500k hai lá nhưng đang tạm không nhận — bạn xem mục bát tự trên trang để khớp cập nhật nhé.";
    }
    if (isKinhDichPriceOnly(u)) {
      return "Xem một quẻ Kinh Dịch giá là 200k bạn nhé";
    }

    var rows = [];
    var i;
    for (i = 0; i < INTENTS.length; i++) {
      var item = INTENTS[i];
      rows.push({ i: i, s: faqScore(u, item) + intentCorpusBoost(item), p: item.priority });
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
      '<div><div class="tt-chat-header-title">Thuận Thiên</div><div class="tt-chat-header-sub">Tư vấn ngắn gọn, thân thiện — không thay tư vấn từng ca 1-1</div></div>' +
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

  function wireWidget(root) {
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
      if (!reply) reply = fallbackReply();
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
    var base = getStaticBase();
    var voiceUrl = base + "data/brandvoice_dump.txt";

    Promise.all([
      loadDataCorpus(base).catch(function (e) {
        console.warn("[Thuận Thiên chat] Không tải đủ corpus /data:", e);
      }),
      fetchText(voiceUrl)
        .then(function (t) {
          KB.brandvoiceText = t || "";
          KB.brandvoiceOk = KB.brandvoiceText.length > 80;
        })
        .catch(function (e) {
          console.warn("[Thuận Thiên chat] Không tải brandvoice:", voiceUrl, e);
        })
    ]).finally(function () {
      wireWidget(root);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
