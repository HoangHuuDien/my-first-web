import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import {
  getHtmlSection,
  stripHtmlTags,
  SECTION_IDS,
} from "../lib/landing-sections.js";
import {
  readPaymentAmount,
  writePaymentAmount,
  parsePriceFromText,
} from "../lib/env-price.js";

function toolResult(payload, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

function backupFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const bak = filePath + ".bak." + Date.now();
  fs.copyFileSync(filePath, bak);
  return bak;
}

function maybeRestartMywebsite() {
  try {
    execSync("systemctl restart mywebsite", { stdio: "ignore", timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * edit_landing_page — preview (confirm=false) hoặc ghi file (confirm=true).
 */
export async function editLandingPage(args, siteRoot) {
  const { instruction, section, new_text, confirm = false, remove = false } = args;
  const warnings = [];

  if (!section && !new_text && instruction) {
    warnings.push(
      "Có instruction nhưng thiếu section/new_text — agent nên map section rồi gọi lại."
    );
  }

  if (section === "price") {
    return handlePriceEdit(siteRoot, new_text, instruction, confirm, warnings);
  }

  if (!section) {
    return toolResult(
      {
        ok: false,
        error: "Cần section (hoặc section=price cho giá).",
        available_sections: SECTION_IDS,
        instruction: instruction || null,
        warnings,
      },
      true
    );
  }

  const def = getHtmlSection(section);
  if (!def) {
    return toolResult(
      {
        ok: false,
        error: "Section không hỗ trợ: " + section,
        available_sections: SECTION_IDS.filter((s) => s !== "price"),
      },
      true
    );
  }

  const wantsRemove = remove === true;
  if (!wantsRemove && (!new_text || !String(new_text).trim())) {
    return toolResult(
      {
        ok: false,
        error:
          "Cần new_text để đổi nội dung, hoặc remove=true để xóa hẳn (hiện chỉ section quote).",
        section,
        instruction: instruction || null,
        warnings,
      },
      true
    );
  }

  if (wantsRemove && typeof def.remove !== "function") {
    return toolResult(
      {
        ok: false,
        error: "Section " + section + " chưa hỗ trợ xóa; chỉ dùng new_text để thay.",
        section,
        warnings,
      },
      true
    );
  }

  const indexPath = path.join(siteRoot, "index.html");
  if (!fs.existsSync(indexPath)) {
    return toolResult({ ok: false, error: "Không tìm thấy index.html" }, true);
  }

  const html = fs.readFileSync(indexPath, "utf8");
  const beforeRaw = def.extract(html);
  if (beforeRaw == null && !wantsRemove) {
    return toolResult(
      { ok: false, error: "Không đọc được vùng " + section + " trong index.html" },
      true
    );
  }

  let formatted;
  let afterHtml;
  if (wantsRemove) {
    formatted = "";
    afterHtml = def.remove(html);
  } else {
    formatted = def.formatNewText(new_text);
    afterHtml = def.replace(html, formatted);
  }
  if (!afterHtml) {
    return toolResult(
      {
        ok: false,
        error: wantsRemove
          ? "Không xóa được vùng " + section + " (có thể đã bị xóa trước đó)"
          : "Không thay thế được vùng " + section,
      },
      true
    );
  }

  const preview = {
    ok: true,
    mode: confirm ? "applied" : "preview",
    section,
    label: def.label,
    removed: wantsRemove,
    instruction: instruction || null,
    before: beforeRaw ? stripHtmlTags(beforeRaw).slice(0, 500) : null,
    after: wantsRemove ? "(đã xóa khối HTML)" : stripHtmlTags(formatted).slice(0, 500),
    preview_url:
      (process.env.SITE_URL || "https://xembattu.thuanthienkinhdich.com").replace(
        /\/$/,
        ""
      ),
    warnings,
  };

  if (!confirm) {
    preview.hint = "Gọi lại với confirm=true để ghi index.html.";
    return toolResult(preview);
  }

  try {
    const backup = backupFile(indexPath);
    fs.writeFileSync(indexPath, afterHtml, "utf8");
    preview.applied = true;
    preview.backup = backup;
    preview.file = indexPath;
    return toolResult(preview);
  } catch (err) {
    const code = err && err.code;
    const permissionHint =
      code === "EACCES" || code === "EPERM"
        ? "MCP (user goclaw uid 1000) không ghi được file. Trên VPS chạy: bash /opt/my-website/deploy/mcp-fix-permissions.sh"
        : null;
    return toolResult(
      {
        ok: false,
        error: "Không ghi được index.html: " + (err && err.message ? err.message : String(err)),
        code: code || null,
        file: indexPath,
        permission_hint: permissionHint,
      },
      true
    );
  }
}

function handlePriceEdit(siteRoot, newText, instruction, confirm, warnings) {
  const envPath = process.env.DOTENV_PATH || path.join(siteRoot, ".env");
  const current = readPaymentAmount(envPath);
  const parsed =
    parsePriceFromText(newText) ||
    parsePriceFromText(instruction) ||
    null;

  if (!parsed) {
    return toolResult(
      {
        ok: false,
        error: "Cần số tiền trong new_text (vd. 450000 hoặc 450k).",
        current_payment_amount: current,
        warnings,
      },
      true
    );
  }

  const preview = {
    ok: true,
    mode: confirm ? "applied" : "preview",
    section: "price",
    before_amount: current,
    after_amount: parsed,
    env_path: envPath,
    instruction: instruction || null,
    warnings,
  };

  if (!confirm) {
    preview.hint =
      "confirm=true sẽ ghi PAYMENT_AMOUNT vào .env và restart mywebsite (nếu có systemd).";
    return toolResult(preview);
  }

  const backup = backupFile(envPath);
  const written = writePaymentAmount(envPath, parsed);
  const restarted = maybeRestartMywebsite();
  preview.applied = true;
  preview.payment_amount = written;
  preview.backup = backup;
  preview.service_restarted = restarted;
  if (!restarted) {
    preview.hint = "Chạy: systemctl restart mywebsite (để client-env.js đọc giá mới).";
  }
  return toolResult(preview);
}
