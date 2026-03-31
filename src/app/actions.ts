"use server";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const TO_EMAIL = process.env.CONTACT_TO_EMAIL || "contact@cfjapan.co.jp";

export async function sendContactForm(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const name = formData.get("name") as string;
  const company = formData.get("company") as string;
  const email = formData.get("email") as string;
  const category = formData.get("category") as string;
  const message = formData.get("message") as string;

  if (!name || !email || !category || !message) {
    return { success: false, error: "必須項目を入力してください。" };
  }

  const categoryLabels: Record<string, string> = {
    "web-app": "Webアプリ開発",
    "line-app": "LINEミニアプリ構築",
    dx: "自治体DX支援",
    other: "その他",
  };

  try {
    await resend.emails.send({
      from: "CFJapan Portfolio <onboarding@resend.dev>",
      to: TO_EMAIL,
      replyTo: email,
      subject: `【お問い合わせ】${categoryLabels[category] || category} - ${name}様`,
      html: `
        <h2>新しいお問い合わせ</h2>
        <table style="border-collapse:collapse;width:100%;max-width:600px;">
          <tr>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:bold;width:140px;">お名前</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;">${escapeHtml(name)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:bold;">会社名</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;">${escapeHtml(company || "未入力")}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:bold;">メール</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:bold;">相談内容</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;">${escapeHtml(categoryLabels[category] || category)}</td>
          </tr>
          <tr>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:bold;">メッセージ</td>
            <td style="padding:8px 12px;border:1px solid #e2e8f0;white-space:pre-wrap;">${escapeHtml(message)}</td>
          </tr>
        </table>
      `,
    });

    return { success: true };
  } catch (err) {
    console.error("Resend error:", err);
    return { success: false, error: "メールの送信に失敗しました。時間をおいて再度お試しください。" };
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
