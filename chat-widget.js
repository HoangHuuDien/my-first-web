/**
 * Chat tư vấn Thuận Thiên — giọng theo my-brain/brandvoice_dump.txt (mục ID 8: chuyên gia bát tự / lá số,
 * đồng cảm → giải pháp → lời khuyên; tránh liệt kê khô; bubble dùng textContent nên không markdown).
 * Ý định khớp FAQ + sales_script + data/products; mỗi lần chỉ một hướng dịch vụ.
 */
(function () {
  "use strict";

  var GREETING =
    "Chào bạn, mình là trợ lý Thuận Thiên — bên cạnh người thầy chuyên về bát tự và lá số. Mình biết đôi khi trong lòng có điều chưa nói hết được; bạn đang quan tâm chuyện gì nhỉ? Cứ nhắn tự nhiên như đang trò chuyện, mình lắng nghe.";

  var SOFT_CLARIFY =
    "Mình đọc kỹ dòng tin của bạn mà trong lòng vẫn thấy hai ba hướng, nên mình không muốn đoán vội làm bạn thêm rối. Bạn chống giúp mình một nhịp: bạn đang canh cánh nhất là một việc gần cần quyết, hay là cả một chặng dài về nghề nghiệp và tiền bạc, hay là chuyện số điện thoại, ngày giờ, hay form đăng ký? Nhắn lại một dòng chân thành, mình sẽ trả một hướng cho thật sát tâm.";

  var FALLBACK =
    "Mình chưa nắm được ý bạn lần này — có thể do câu chữ ngắn quá hoặc mình chưa đủ ngữ cảnh; đừng giận mình nhé. Bạn thử nhắn một câu vừa đủ: đang cần quyết việc gì, hoặc đang lo nhất điều gì, mình sẽ dắt bạn đúng một lối đi phù hợp. Nếu muốn team đọc kỹ và liên hệ lại, kéo xuống form đỏ cuối trang (họ tên, email, Zalo) — đó cũng là cách để mình không bỏ sót bạn.";

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
        "Khi trong đầu đang có một việc cụ thể sắp phải quyết — ký kết, bung tiền, hay chọn hướng trong vài tháng tới — cảm giác hồi hộp là rất thật. Với tình huống đó, lộ Thuận Thiên hợp nhất là hỏi quẻ Kinh Dịch: 200k một câu, nhưng trước hết hãy nhắn Cát Tường để chốt câu hỏi cho rõ rồi mới rút quẻ, làm đúng như hướng dẫn trên kinhdich.thuanthienkinhdich.com; thường sau khi đủ bước chừng một đến ba ngày sẽ có luận. Hãy cứ chậm một nhịp: hỏi đúng một lần còn hơn vội vàng rồi lại day dứt."
    },
    {
      priority: 94,
      keys: ["luận số", "luan so", "xem so dang dung", "so dang dung", "luansdt", "xem số điện thoại", "danh gia số"],
      reply:
        "Mình cảm nhận bạn đang cần một lời thật về số điện thoại mình đang hoặc sắp dùng, chứ không phải lời khơi khơi. Bên Thuận Thiên có một lộ duy nhất cho việc đó: luận số 200k một số, làm đúng hướng dẫn trên luansdt.thuanthienkinhdich.com, không ép bạn đổi số. Bạn cứ đi từng bước như trang ghi; khi đã rõ, tâm cũng nhẹ đi phần nào."
    },
    {
      priority: 93,
      keys: ["tim sim", "tim sdt", "chon sim", "sim moi", "tim so dep", "tim so dien thoai", "chọn số"],
      reply:
        "Tìm một số mới cho đúng ý mình đôi khi mệt hơn cả chọn nghề, vì vừa tiền sim vừa phí tìm. Nếu bạn đã chắc muốn đi con đường đó, hãy mở bảng phí theo cấp và tiền sim trên sdt.thuanthienkinhdich.com/timsdt, rồi nhắn Cát Tường đủ thông tin như trang hướng dẫn. Chọn số cũng là chọn nhịp sống; làm tỉnh táo thì sau này ít hối hận."
    },
    {
      priority: 86,
      keys: ["sim", "sdt", "so dien thoai", "số máy", "so may", "hotline", "dau so", "đầu số"],
      reply:
        "Chữ “số điện thoại” mở ra hai cửa khác nhau: một là luận số đang dùng, hai là tìm số mới. Mình không muốn chỉ nhầm một chữ mà bạn đi sai cả quy trình. Bạn nhắn lại một tiếng thôi, “luận” nếu muốn xem số hiện tại, hoặc “tìm” nếu muốn tìm số mới; mình sẽ nói tiếp đúng một đường cho bạn."
    },
    {
      priority: 92,
      keys: [
        "ngay tot", "ngày tốt", "gio tot", "giờ tốt", "chon ngay", "chọn ngày", "khai truong", "cuoi hoi", "cưới hỏi", "gay nha",
        "tai lieu a z", "tu hoc ngay gio", "dat truoc tai lieu", "500k dat truoc", "khong muon hoi thay", "ngai hoi thay"
      ],
      reply:
        "Nhiều bạn muốn tự chọn ngày giờ cho việc quan trọng mà không muốn chạy loanh quanh hỏi thầy từng chút một; tâm lý đó mình hiểu. Hướng Thuận Thiên đang mở cho nhu cầu đó là tài liệu A–Z, đặt trước 500k theo mốc âm lịch thông báo trên trang — luôn đối chiếu bản mới nhất trước khi chốt. Biết cách tự giữ nhịp cho đời mình cũng là một dạng an tâm."
    },
    {
      priority: 91,
      keys: [
        "luck", "khoa luck", "khóa luck", "1190k", "1190 k", "run vi tien", "so vo tien", "quan tri tien", "quản trị tiền",
        "hoc ve tien", "khoa hoc tien", "kiem roi mat", "kiếm rồi mất"
      ],
      reply:
        "Chuyện tiền đôi khi không phải vì thiếu cơ hội mà vì mình cứ hỏi quẻ rồi lại run, rồi lại sợ, nên trong lòng không yên. Khóa LUCK 1190k là lộ Thuận Thiên dành cho bạn muốn tự chủ hơn trong tư duy và quyết định tiền: chuyển khoản ghi Tên và LUCK, nhắn Cát Tường kèm bill, chi tiết trên thuanthienkinhdich.com/luck. Dựng nội lực dần còn bền hơn trông chờ một phép màu."
    },
    {
      priority: 88,
      keys: [
        "so sanh quẻ", "khac quẻ", "khác gì quẻ", "quẻ với bát", "bát với tử", "tu vi va bat tu", "menh ly", "khac nhau giua", "so sanh bat tu",
        "bat tu khac tu vi", "khac tu vi cho nao", "bat tu khac que cho nao"
      ],
      reply:
        "Lúc đầu ai cũng hơi choáng vì nhiều công cụ cùng một chữ “xem”. Mình gói gọn như người thầy hay nói với học trò: việc gần, cần quyết trong vài tháng, thì quẻ Kinh Dịch hay chạm đúng nhịp; còn bức tranh nghề nghiệp, tiền bạc, hôn nhân theo từng giai đoạn dài, thì bát tự và lá số là tấm bản đồ lớn hơn — hiện Thuận Thiên đưa bát tự đi cùng lộ sách trên trang chính thức. Chọn đúng cửa thì đỡ tốn cả tiền lẫn cảm xúc."
    },
    {
      priority: 84,
      keys: [
        "bat tu", "bát tự", "tu vi", "tử vi", "la so menh", "laso menh", "lá số", "dai van", "đại vận", "nghề nghiệp dài",
        "hon nhan lau dai", "bức tranh dài", "xem boi menh", "tu van menh", "battu", "sach va bat tu"
      ],
      reply:
        "Khi bạn muốn nhìn cả một chặng đường — nghề, tiền, hôn nhân — chứ không chỉ một quyết định nho nhỏ, thì tâm mình thường cần một tấm bản đồ rộng; đó là lúc bát tự và lá số lên tiếng. Hiện tại Thuận Thiên mở lộ qua mua sách Thuận Thiên: ebook 500k kèm quà có video lá số, cần đủ năm tháng ngày giờ sinh và form cẩn thận, chi tiết trên thuanthienkinhdich.com/sachthuanthien. Đừng vội: điền đúng một lần còn hơn sửa đi sửa lại rồi buồn."
    },
    {
      priority: 83,
      keys: [
        "sach", "ebook", "mua sach thuan", "sach thuan thien", "combo sach", "video la so", "video lá số", "battu kem sach"
      ],
      reply:
        "Sách Thuận Thiên không chỉ là file đọc cho qua chuyện; nó là cửa vào để bạn vừa có tài liệu vừa có video lá số đi cùng. Gói đang mở là 500k ebook cùng quà kèm có video lá số: làm form, chuyển khoản, nhắn Cát Tường bill, theo thuanthienkinhdich.com/sachthuanthien. Mỗi trang đọc kỹ một chút là mỗi lần mình hiểu mình rõ hơn — đó là điều mình mong cho bạn."
    },
    {
      priority: 86,
      keys: [
        "nam sinh", "tuoi th", "chi nam", "chi co nam", "khong co gio", "gio sinh", "thieu gio", "khong nho gio", "không nhớ giờ",
        "ngay thang nam", "nmns", "day du thong tin", "du lieu sinh", "laso nhung khong co gio",
        "chi cho minh nam sinh", "nam sinh xem duoc khong", "tuoi thi xem duoc khong", "chi co tuoi thoi"
      ],
      reply:
        "Mình hiểu nỗi lòng muốn biết ngay mà chỉ có năm sinh hay tuổi; nhưng lá số bát tự cần đủ năm tháng ngày giờ sinh thì lời luận mới không thành đoán mò làm bạn thêm hoang mang. Bạn cố tra giấy khai sinh hoặc hỏi người nhà lấy giờ, rồi đăng ký theo lộ sách và video lá số trên trang chính thức; chưa đủ giờ thì nên đợi cho đủ, thà chậm mà chắc còn hơn vội rồi sai. Mình ở đây để dắt bạn đúng bước, không phải để nói suông cho vui."
    },
    {
      priority: 78,
      keys: [
        "800k", "800 k", "1500k", "1500 k", "zoom", "goi zoom", "vo chong", "vợ chồng", "cap doi", "phu phi", "gồm hết", "gom het",
        "sau buoi", "co bi gai them khong", "800k da gom het chua", "gom het chua", "phu phi sau buoi", "sau buoi xem"
      ],
      reply:
        "Lo lắng “xong rồi còn bị vòi thêm tiền” là tâm lý rất người, mình không coi thường điều đó. Thuận Thiên cam kết một mức một việc, không dọa để bán phong thủy hay lễ; các gói Zoom 800k hay 1500k trên web hiện đang không nhận, còn lá số đang đi qua lộ mua sách — bạn luôn nên đối chiếu trang đang live. Yên tâm đúng chỗ thì mới dám bước tiếp; mình nói vậy vì mình cũng muốn bạn bước cho vững."
    },
    {
      priority: 76,
      keys: [
        "dọa", "phong thuy", "phong thủy", "lam le", "bua", "gài thêm", "so bi ep", "lo bi lua",
        "xem xong co bi", "lam them gi", "lam them gi khong"
      ],
      reply:
        "Có những nơi khiến người ta xem xong cứ nơm nớp sợ bị “gài” thêm — mình nghe nhiều nên hiểu nỗi đó. Ở Thuận Thiên ranh giới rất rõ: không dọa để bán phong thủy, lễ hay bùa; nội dung dừng đúng phần đã thỏa thuận. Bạn cứ giữ sự tỉnh táo của mình; khi được tôn trọng ranh giới, lòng người cũng nhẹ."
    },
    {
      priority: 72,
      keys: [
        "form", "landing", "zalo form", "dang ky o dau", "dang ky ở đâu", "link form", "google form", "cat tuong", "cát tường",
        "nhan tin cho ai", "lien he ai", "tro ly", "nham form", "nhầm form", "hai form", "khac nhau form",
        "landing form zalo", "form zalo khac", "khac voi form bat tu", "form tren web khac"
      ],
      reply:
        "Lúc trên web có nhiều ô điền, dễ lòng người ta đi nhầm cửa. Bạn cứ nói cho mình một tên món bạn thật sự muốn — quẻ, sách, hay LUCK — mình sẽ chỉ đúng một link hay một kênh Cát Tường cho khỏi lạc. Còn form đỏ cuối trang này là để lại danh sách chờ cho team đọc kỹ, không phải mọi dịch vụ đều đi qua đó. Từng bước rõ ràng thì khỏi uổng công mình lẫn bạn."
    },
    {
      priority: 70,
      keys: [
        "bao lau", "bao lâu", "may ngay", "mấy ngày", "cho doi", "cho bao lau", "bao gio co ket qua", "khi nao xong", "hen lich", "xếp lịch",
        "bao gio toi luot", "co lau khong", "bao lau thi co lich", "khi nao co lich"
      ],
      reply:
        "Chờ đợi lúc nào cũng căng, nhất là khi trong lòng đang có việc. Thời gian phụ thuộc đúng món bạn chốt: quẻ thường gọn trong vài ngày sau khi đủ bước, còn sách và video lá số thì theo nhịp Cát Tường báo trên trang sách. Bạn nhắn lại một chữ “quẻ” hoặc “sách” cho mình biết bạn đang hỏi nhịp nào, để mình nói khung thời gian cho sát, không hứa suông."
    },
    {
      priority: 68,
      keys: [
        "chu nhat", "chủ nhật", "cn ", " cuoi tuan", "cuối tuần", "t7", "thứ 7", "thu bay", "thứ bảy", "rang sang", "chi ranh cn",
        "lich ranh", "co gap cuoi tuan khong", "cuoi tuan co xem duoc khong", "chu nhat co xem duoc khong"
      ],
      reply:
        "Lịch rảnh của mỗi người khác nhau, mình hiểu đặc biệt những bạn chỉ thở phào được cuối tuần. Thuận Thiên làm việc kiểu chiều thứ hai đến thứ bảy; nếu bạn chỉ rảnh chủ nhật thì ghi rõ trong form hoặc nhắn Cát Tường để khỏi hẹn trật làm bạn mất niềm tin. Sắp xếp được thời gian là đã thương nhau một phần rồi."
    },
    {
      priority: 62,
      keys: [
        "khong phu hop", "từ chối", "tu choi", "co nhan khong", "co nhận không", "so khong duoc nhan", "case khong fit", "khong nhan loai nay",
        "khong phu hop thi co bi nhan khong"
      ],
      reply:
        "Đôi khi người ta sợ nhất không phải bị từ chối mà là bị từ chối theo kiểu làm tổn thương. Thuận Thiên có thể từ chối case không phù hợp, không phải để làm khó bạn mà để khỏi phí tiền và phí cảm xúc hai bên; nói thẳng nhưng không để bạn tự ái. Mình tin rằng biết dừng đúng lúc cũng là một dạng tử tế."
    },
    {
      priority: 58,
      keys: [
        "doi van", "đổi vận", "bat luc", "bất lực", "xem roi", "xem roi van the", "biet roi nhung van", "co thay doi gi khong", "cau duoc khong",
        "co doi van duoc khong", "xem roi co doi van"
      ],
      reply:
        "Xem rồi mà vẫn thấy bất lực là cảm giác rất nặng; mình không dùng chữ “đổi vận” kiểu lễ nghi để hứa suông. Nếu đau ở một quyết định sắp tới, quẻ hay giúp bạn siết rủi ro; nếu đau ở túi tiền và thói quyết định dài hơi, khóa LUCK là hướng Thuận Thiên gợi cho bạn tự dựng lại nhịp. Bạn nhắn “quẻ” hay “LUCK” để mình đi tiếp đúng một con đường, khỏi rối thêm."
    },
    {
      priority: 56,
      keys: [
        "me tin", "mê tín", "khoa hoc", "khoa học", "co dung khong", "co tin khong", "that hay lua", "co bi lua khong", "khong tin", "không tin",
        "huyen hoc", "huyền học", "xem bat tu co phai me tin", "bat tu co phai me tin"
      ],
      reply:
        "Mình không tranh luận tin hay không tin, vì tâm mỗi người một vòng trò. Góc Thuận Thiên dùng bát tự và quẻ như kính soi xu hướng và thời điểm để giảm quyết định nóng và thử sai tốn kém; không thay thuốc men, luật pháp hay trị liệu. Bạn cứ giữ lòng sáng: hiểu mình rõ hơn một chút cũng đã là phúc rồi."
    },
    {
      priority: 32,
      keys: [
        "gia", "phí", "phi ", "bao nhieu tien", "het bao nhieu", "muc phi", "chi phi", "bao tien", "xin gia", "200k", "500k", "800k", "1500k",
        "phi tim sim", "bao nhieu mot lan"
      ],
      reply:
        "Hỏi giá mà chưa gắn rõ món đôi khi như hỏi “đi xa bao nhiêu tiền” mà chưa nói đi đâu. Bạn chốt giúp mình một tên trong các lộ đang mở — quẻ, sách, LUCK, luận số, tìm sim, hay tài liệu ngày giờ — rồi nhắn lại một chữ, mình sẽ báo đúng một mức theo trang đang live. Tiền bạc nói thật mới là thương nhau."
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
      "Nếu trong lòng bạn đã rõ hướng, hoặc muốn để team đọc kỹ rồi liên hệ lại, cứ kéo xuống form đỏ trên trang này và ghi vài dòng — đó cũng là cách bạn tự trao cho mình cơ hội được lắng nghe đầy đủ.";
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
