(function () {
  var STATS_URL = "/api/admin/stats";
  var RECORDS_URL = "/api/admin/records";
  var LOADING_MS = 15000;

  var VIEWS = {
    products: {
      kind: "content",
      table: "products",
      label: "Sản phẩm",
      listColumns: [
        { key: "id", label: "ID" },
        { key: "title", label: "Tiêu đề" },
        { key: "slug", label: "Slug" },
        { key: "price_hint", label: "Giá gợi ý" },
      ],
    },
    customers: {
      kind: "content",
      table: "customers",
      label: "Khách hàng",
      listColumns: [
        { key: "id", label: "ID" },
        { key: "title", label: "Tiêu đề" },
        { key: "slug", label: "Slug" },
        { key: "tags", label: "Tags" },
      ],
    },
    knowledge: {
      kind: "content",
      table: "knowledge",
      label: "Kiến thức / FAQ",
      listColumns: [
        { key: "id", label: "ID" },
        { key: "title", label: "Tiêu đề" },
        { key: "category", label: "Loại" },
        { key: "slug", label: "Slug" },
      ],
    },
    orders: {
      kind: "sales",
      table: "orders",
      label: "Đơn hàng",
      listColumns: [
        { key: "id", label: "ID" },
        { key: "transaction_code", label: "Mã CK" },
        { key: "customer_name", label: "Khách hàng" },
        { key: "amount", label: "Số tiền" },
        { key: "status", label: "Trạng thái" },
        { key: "created_at", label: "Ngày mua" },
      ],
    },
  };

  var state = {
    currentView: "products",
    rows: [],
    stats: null,
    statsLoading: false,
    listLoading: false,
  };

  var elStats;
  var elBanner;
  var elHead;
  var elBody;
  var elEmpty;
  var elEditor;
  var elFormContent;
  var elFormOrder;
  var elMsg;
  var btnNew;

  function apiUrl(path) {
    return new URL(path, window.location.origin).href;
  }

  function cfg() {
    return VIEWS[state.currentView];
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  function formatMoney(n) {
    return (Number(n) || 0).toLocaleString("vi-VN") + "đ";
  }

  function formatDate(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString("vi-VN");
    } catch (e) {
      return String(iso);
    }
  }

  function formatError(err) {
    if (!err) return "Lỗi không xác định";
    if (typeof err === "string") return err;
    return err.message || String(err);
  }

  function showBanner(text, isError) {
    if (!elBanner) return;
    if (!text) {
      elBanner.classList.add("hidden");
      elBanner.textContent = "";
      return;
    }
    elBanner.textContent = text;
    elBanner.classList.remove("hidden");
    elBanner.classList.toggle("err", !!isError);
  }

  function applyStatsToUi() {
    if (!elStats) return;
    var s = state.stats;
    if (!s) {
      if (state.statsLoading) {
        elStats.textContent = "Đang tải thống kê…";
        elStats.className = "stats loading";
      }
      return;
    }
    elStats.textContent =
      "SP: " +
      (s.products || 0) +
      " · KH: " +
      (s.customers || 0) +
      " · FAQ: " +
      (s.knowledge || 0) +
      " · Đơn: " +
      (s.orders || 0);
    elStats.className = "stats ok";
  }

  function setStatsError(message) {
    state.statsLoading = false;
    state.stats = null;
    if (!elStats) return;
    elStats.textContent = message;
    elStats.className = "stats err";
  }

  function fetchJson(url, options) {
    var timeout = new Promise(function (_, reject) {
      setTimeout(function () {
        reject(
          new Error(
            "Không thể kết nối dữ liệu, vui lòng kiểm tra lại API Key"
          )
        );
      }, LOADING_MS);
    });

    var request = fetch(url, options || {}).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        if (text) {
          try {
            data = JSON.parse(text);
          } catch (e) {
            if (!res.ok) {
              throw new Error("HTTP " + res.status + " — phản hồi không phải JSON");
            }
            throw e;
          }
        }
        if (!res.ok) {
          throw new Error(
            (data && data.error) || "HTTP " + res.status
          );
        }
        return data;
      });
    });

    return Promise.race([request, timeout]);
  }

  function fetchStats() {
    state.statsLoading = true;
    applyStatsToUi();

    var url = apiUrl(STATS_URL);
    console.log("[Admin] Fetch stats:", url);

    return fetchJson(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
      .then(function (data) {
        console.log("Data from API:", data);
        state.statsLoading = false;
        state.stats = {
          products: data.products || 0,
          customers: data.customers || 0,
          knowledge: data.knowledge || 0,
          orders: data.orders || 0,
        };
        applyStatsToUi();
        showBanner("", false);
      })
      .catch(function (err) {
        console.error("[Admin] Stats error:", err);
        var msg = "Lỗi thống kê: " + formatError(err);
        setStatsError(msg);
        showBanner(msg, true);
      });
  }

  function renderStatusBadge(status) {
    var s = String(status || "pending").toLowerCase();
    var cls = "status-badge pending";
    if (s === "success" || s === "paid") cls = "status-badge success";
    else if (s === "cancelled") cls = "status-badge cancelled";
    return '<span class="' + cls + '">' + escapeHtml(s) + "</span>";
  }

  function renderOrderActions(row) {
    var status = String(row.status || "pending").toLowerCase();
    if (status !== "pending") {
      return '<span class="actions-muted">—</span>';
    }
    return (
      '<div class="order-actions">' +
      '<button type="button" class="btn-order-action btn-confirm" data-order-action="confirm" data-id="' +
      row.id +
      '">Xác nhận Thành công</button>' +
      '<button type="button" class="btn-order-action btn-cancel-order" data-order-action="cancel" data-id="' +
      row.id +
      '">Hủy đơn</button>' +
      "</div>"
    );
  }

  function patchOrderStatus(orderId, newStatus) {
    return fetchJson(apiUrl(RECORDS_URL), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        view: "orders",
        id: orderId,
        payload: {
          status: newStatus,
          updated_at: new Date().toISOString(),
        },
      }),
    }).then(function () {
      return fetchList().then(fetchStats);
    });
  }

  function handleOrderActionClick(btn) {
    var action = btn.getAttribute("data-order-action");
    var orderId = Number(btn.getAttribute("data-id"));
    if (!orderId) return;

    var msg =
      action === "confirm"
        ? "Xác nhận đơn #" + orderId + " đã thanh toán thành công?"
        : "Hủy đơn #" + orderId + "?";
    if (!confirm(msg)) return;

    btn.disabled = true;
    var siblings = btn.parentElement
      ? btn.parentElement.querySelectorAll("button")
      : [];
    siblings.forEach(function (b) {
      b.disabled = true;
    });

    var nextStatus = action === "confirm" ? "paid" : "cancelled";
    patchOrderStatus(orderId, nextStatus)
      .then(function () {
        showBanner("", false);
      })
      .catch(function (err) {
        siblings.forEach(function (b) {
          b.disabled = false;
        });
        showBanner("Cập nhật đơn: " + formatError(err), true);
      });
  }

  function cellValue(row, col) {
    var v = row[col.key];
    if (col.key === "amount") return formatMoney(v);
    if (col.key === "created_at") return formatDate(v);
    if (col.key === "status") return renderStatusBadge(v);
    if (v == null) return "";
    var s = String(v);
    if (s.length > 48) return escapeHtml(s.slice(0, 45) + "…");
    return escapeHtml(s);
  }

  function setEmptyMessage(text, show, isError) {
    if (!elEmpty) return;
    elEmpty.textContent = text || "Không có dữ liệu";
    elEmpty.classList.toggle("hidden", !show);
    elEmpty.classList.toggle("err", !!isError);
  }

  function renderList() {
    var view = cfg();
    if (!elHead || !elBody) return;

    var isSales = view.kind === "sales";
    elHead.innerHTML =
      "<tr>" +
      view.listColumns
        .map(function (c) {
          return "<th>" + escapeHtml(c.label) + "</th>";
        })
        .join("") +
      (isSales ? "<th>Hành động</th>" : "") +
      "</tr>";

    elBody.innerHTML = state.rows
      .map(function (row) {
        var cells = view.listColumns
          .map(function (col) {
            return "<td>" + cellValue(row, col) + "</td>";
          })
          .join("");
        if (isSales) {
          cells +=
            '<td class="td-actions">' + renderOrderActions(row) + "</td>";
        }
        return "<tr data-id=\"" + row.id + "\">" + cells + "</tr>";
      })
      .join("");

    setEmptyMessage("Không có dữ liệu", state.rows.length === 0, false);
  }

  function bindListRowEvents() {
    if (!elBody || elBody._listEventsBound) return;
    elBody._listEventsBound = true;
    elBody.addEventListener("click", function (e) {
      var actionBtn = e.target.closest("[data-order-action]");
      if (actionBtn) {
        e.preventDefault();
        e.stopPropagation();
        handleOrderActionClick(actionBtn);
        return;
      }
      var tr = e.target.closest("tr[data-id]");
      if (tr) {
        openRow(Number(tr.getAttribute("data-id")));
      }
    });
  }

  function fetchList() {
    state.listLoading = true;
    if (elBody) elBody.innerHTML = "";
    setEmptyMessage("Đang tải…", true, false);

    var qEl = document.getElementById("search");
    var q = qEl ? qEl.value.trim() : "";
    var path =
      RECORDS_URL +
      "?view=" +
      encodeURIComponent(state.currentView) +
      (q ? "&q=" + encodeURIComponent(q) : "");
    var url = apiUrl(path);

    console.log("[Admin] Fetch list:", url);

    return fetchJson(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
      .then(function (res) {
        state.listLoading = false;
        state.rows = (res && res.data) || [];
        renderList();
      })
      .catch(function (err) {
        console.error("[Admin] List error:", err);
        state.listLoading = false;
        state.rows = [];
        renderList();
        var msg = "Lỗi: " + formatError(err);
        setEmptyMessage(msg, true, true);
        showBanner("Danh sách (" + cfg().label + "): " + msg, true);
      });
  }

  function showContentForm() {
    elFormContent.classList.remove("hidden");
    elFormOrder.classList.add("hidden");
  }

  function showOrderForm() {
    elFormContent.classList.add("hidden");
    elFormOrder.classList.remove("hidden");
  }

  function updateFieldVisibility() {
    document.body.setAttribute("data-view", state.currentView);
    var isSales = cfg().kind === "sales";
    if (btnNew) btnNew.style.display = isSales ? "none" : "block";
    var search = document.getElementById("search");
    if (search) {
      search.placeholder = isSales
        ? "Tìm khách, SĐT, trạng thái…"
        : "Tìm tiêu đề, slug, đường dẫn…";
    }
  }

  function openRow(id) {
    elMsg.textContent = "";
    elMsg.className = "msg";
    var view = cfg();
    var url = apiUrl(
      RECORDS_URL +
        "?view=" +
        encodeURIComponent(state.currentView) +
        "&id=" +
        encodeURIComponent(String(id))
    );

    fetchJson(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
      .then(function (res) {
        var row = res && res.data;
        if (!row) throw new Error("Không tìm thấy bản ghi.");

        if (view.kind === "sales") {
          showOrderForm();
          document.getElementById("o-id").value = row.id;
          document.getElementById("o-name").value = row.customer_name || "";
          document.getElementById("o-phone").value = row.customer_phone || "";
          document.getElementById("o-email").value = row.customer_email || "";
          document.getElementById("o-amount").value = row.amount || 0;
          var st = String(row.status || "pending").toLowerCase();
          var sel = document.getElementById("o-status");
          if (["pending", "success", "paid", "cancelled"].indexOf(st) !== -1) {
            sel.value = st;
          } else {
            sel.value = "pending";
          }
          document.getElementById("o-note").value = row.product_note || "";
          var txEl = document.getElementById("o-txcode");
          if (txEl) txEl.value = row.transaction_code || "";
          document.getElementById("o-transfer").value =
            row.transfer_content || "";
          document.getElementById("o-created").textContent =
            "Ngày mua: " + formatDate(row.created_at);
          document.getElementById("editor-title").textContent =
            "Đơn #" + row.id + " — " + (row.customer_name || "Khách");
        } else {
          showContentForm();
          document.getElementById("f-id").value = row.id;
          document.getElementById("f-slug").value = row.slug || "";
          document.getElementById("f-source").value = row.source_path || "";
          document.getElementById("f-title").value = row.title || "";
          document.getElementById("f-content").value = row.content || "";
          document.getElementById("f-price").value = row.price_hint || "";
          document.getElementById("f-tags").value = row.tags || "";
          document.getElementById("f-category").value = row.category || "";
          document.getElementById("f-related").value =
            row.related_product_slug || "";
          document.getElementById("editor-title").textContent =
            row.title || "Chi tiết";
        }

        elEditor.classList.remove("hidden");
        elBody.querySelectorAll("tr").forEach(function (tr) {
          tr.classList.toggle(
            "selected",
            Number(tr.getAttribute("data-id")) === id
          );
        });
      })
      .catch(function (e) {
        elMsg.className = "msg err";
        elMsg.textContent = formatError(e);
      });
  }

  function closeEditor() {
    elEditor.classList.add("hidden");
    elFormContent.reset();
    elFormOrder.reset();
    document.getElementById("f-id").value = "";
    document.getElementById("o-id").value = "";
  }

  function setView(viewKey) {
    if (!VIEWS[viewKey]) return;
    state.currentView = viewKey;
    document.querySelectorAll("#tabs button").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-view") === viewKey);
    });
    updateFieldVisibility();
    closeEditor();
    fetchList();
    fetchStats();
  }

  function bindEvents() {
    document.getElementById("tabs").addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-view]");
      if (btn) setView(btn.getAttribute("data-view"));
    });

    document
      .getElementById("search")
      .addEventListener("input", debounce(fetchList, 300));

    document.getElementById("btn-refresh").addEventListener("click", function () {
      showBanner("", false);
      fetchList();
      fetchStats();
    });

    document.getElementById("btn-cancel").addEventListener("click", closeEditor);
    document
      .getElementById("btn-cancel-order")
      .addEventListener("click", closeEditor);

    btnNew.addEventListener("click", function () {
      if (cfg().kind === "sales") return;
      closeEditor();
      showContentForm();
      document.getElementById("f-id").value = "";
      document.getElementById("f-slug").value = "moi-" + Date.now();
      document.getElementById("f-source").value =
        "manual/" + cfg().table + "/" + Date.now() + ".md";
      document.getElementById("editor-title").textContent = "Thêm mới";
      elEditor.classList.remove("hidden");
      elMsg.textContent = "";
    });

    elFormContent.addEventListener("submit", function (e) {
      e.preventDefault();
      if (cfg().kind !== "content") return;

      var id = document.getElementById("f-id").value;
      var payload = {
        source_path: document.getElementById("f-source").value,
        slug: document.getElementById("f-slug").value,
        title: document.getElementById("f-title").value,
        content: document.getElementById("f-content").value,
        updated_at: new Date().toISOString(),
      };
      if (state.currentView === "products") {
        payload.price_hint = document.getElementById("f-price").value || null;
      } else if (state.currentView === "customers") {
        payload.tags = document.getElementById("f-tags").value || null;
      } else if (state.currentView === "knowledge") {
        payload.category = document.getElementById("f-category").value || null;
        payload.related_product_slug =
          document.getElementById("f-related").value || null;
      }

      var req = id
        ? fetchJson(apiUrl(RECORDS_URL), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              view: state.currentView,
              id: Number(id),
              payload: payload,
            }),
          })
        : fetchJson(apiUrl(RECORDS_URL), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ view: state.currentView, payload: payload }),
          });

      req
        .then(function () {
          elMsg.className = "msg ok";
          elMsg.textContent = "Đã lưu.";
          return fetchList().then(fetchStats);
        })
        .then(function () {
          if (!id) closeEditor();
        })
        .catch(function (err) {
          elMsg.className = "msg err";
          elMsg.textContent = formatError(err);
        });
    });

    elFormOrder.addEventListener("submit", function (e) {
      e.preventDefault();
      var id = document.getElementById("o-id").value;
      if (!id) return;
      var payload = {
        customer_name: document.getElementById("o-name").value,
        customer_phone: document.getElementById("o-phone").value || null,
        customer_email: document.getElementById("o-email").value || null,
        amount: Number(document.getElementById("o-amount").value) || 0,
        status: document.getElementById("o-status").value,
        product_note: document.getElementById("o-note").value || null,
        updated_at: new Date().toISOString(),
      };

      fetchJson(apiUrl(RECORDS_URL), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ view: "orders", id: Number(id), payload: payload }),
      })
        .then(function () {
          elMsg.className = "msg ok";
          elMsg.textContent = "Đã cập nhật đơn.";
          return fetchList().then(fetchStats);
        })
        .catch(function (err) {
          elMsg.className = "msg err";
          elMsg.textContent = formatError(err);
        });
    });

    document.getElementById("btn-delete").addEventListener("click", function () {
      if (cfg().kind !== "content") return;
      var id = document.getElementById("f-id").value;
      if (!id || !confirm("Xóa bản ghi này?")) return;

      fetchJson(
        apiUrl(
          RECORDS_URL +
            "?view=" +
            encodeURIComponent(state.currentView) +
            "&id=" +
            encodeURIComponent(id)
        ),
        { method: "DELETE" }
      )
        .then(function () {
          closeEditor();
          return fetchList().then(fetchStats);
        })
        .catch(function (err) {
          elMsg.className = "msg err";
          elMsg.textContent = formatError(err);
        });
    });

    document
      .getElementById("btn-delete-order")
      .addEventListener("click", function () {
        var id = document.getElementById("o-id").value;
        if (!id || !confirm("Xóa đơn hàng này?")) return;

        fetchJson(
          apiUrl(RECORDS_URL + "?view=orders&id=" + encodeURIComponent(id)),
          { method: "DELETE" }
        )
          .then(function () {
            closeEditor();
            return fetchList().then(fetchStats);
          })
          .catch(function (err) {
            elMsg.className = "msg err";
            elMsg.textContent = formatError(err);
          });
      });
  }

  function init() {
    elStats = document.getElementById("stats");
    elBanner = document.getElementById("admin-banner");
    elHead = document.getElementById("list-head");
    elBody = document.getElementById("list-body");
    elEmpty = document.getElementById("list-empty");
    elEditor = document.getElementById("editor");
    elFormContent = document.getElementById("form-content");
    elFormOrder = document.getElementById("form-order");
    elMsg = document.getElementById("form-msg");
    btnNew = document.getElementById("btn-new");

    if (!elStats) {
      console.error("[Admin] Không tìm thấy #stats");
      return;
    }

    console.log("[Admin] Khởi động — API:", apiUrl(STATS_URL));
    bindListRowEvents();
    bindEvents();
    setView("products");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
