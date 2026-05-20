#!/usr/bin/env node
/**
 * Thuận Thiên — MCP server (stdio) cho goClaw.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadProjectEnv } from "./lib/env.js";

async function main() {
  const siteRoot = loadProjectEnv();

  const { getDailyOpsBriefing } = await import("./tools/briefing.js");
  const { lookupOrder } = await import("./tools/lookup.js");
  const { editLandingPage } = await import("./tools/landing.js");
  const { getBusinessAlerts } = await import("./tools/alerts.js");

  const server = new McpServer({
    name: "thuan-thien-web",
    version: "1.0.0",
  });

  server.registerTool(
    "get_daily_ops_briefing",
    {
      title: "Daily ops briefing",
      description:
        "Tổng quan đơn pending/paid, đơn chờ >24h, số đơn đủ điều kiện email nurture 2/3.",
      inputSchema: z.object({
        date: z
          .string()
          .optional()
          .describe("YYYY-MM-DD, mặc định hôm nay Asia/Ho_Chi_Minh"),
      }),
    },
    async (args) => getDailyOpsBriefing(args)
  );

  server.registerTool(
    "lookup_order",
    {
      title: "Lookup order",
      description:
        "Tra đơn hàng theo order_id, transaction_code (TVBT_...), phone hoặc email.",
      inputSchema: z.object({
        order_id: z.number().int().positive().optional(),
        transaction_code: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
      }),
    },
    async (args) => lookupOrder(args)
  );

  server.registerTool(
    "edit_landing_page",
    {
      title: "Edit landing page",
      description:
        "Sửa landing index.html hoặc giá PAYMENT_AMOUNT. confirm=false: preview; confirm=true: ghi file. section=quote + remove=true: xóa hẳn khối trích dẫn (không cần new_text).",
      inputSchema: z.object({
        instruction: z.string().optional(),
        section: z
          .enum([
            "hero_title",
            "hero_intro",
            "offer",
            "register_headline",
            "quote",
            "page_title",
            "price",
            "cta_button",
          ])
          .optional(),
        new_text: z.string().optional(),
        remove: z.boolean().optional().default(false),
        confirm: z.boolean().optional().default(false),
      }),
      annotations: {
        destructiveHint: true,
      },
    },
    async (args) => editLandingPage(args, siteRoot)
  );

  server.registerTool(
    "get_business_alerts",
    {
      title: "Business alerts",
      description:
        "Tín hiệu business cho agent chủ động nhắn Telegram: new_pending, new_paid (poll 15–30 phút + since), daily_summary (tổng kết 24h — cron 8h sáng).",
      inputSchema: z.object({
        since: z
          .string()
          .optional()
          .describe("ISO datetime — chỉ sự kiện sau mốc này (nên dùng lần poll trước)"),
        lookback_minutes: z
          .number()
          .optional()
          .describe("Nếu không có since: cửa sổ phút cho new_pending/new_paid (mặc định 30)"),
        lookback_hours: z
          .number()
          .optional()
          .describe("Cho daily_summary (mặc định 24)"),
        signals: z
          .array(z.enum(["new_pending", "new_paid", "daily_summary"]))
          .optional()
          .describe("Mặc định cả 3; cron sáng chỉ [daily_summary]; poll chỉ [new_pending,new_paid]"),
      }),
    },
    async (args) => getBusinessAlerts(args)
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[mcp-server] fatal:", err && (err.stack || err.message || err));
  process.exit(1);
});
