"use client";

import { useState } from "react";
import { sendContactForm } from "@/app/actions";

type FormState = "idle" | "sending" | "success" | "error";

export default function ContactForm() {
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = new FormData(form);

    const result = await sendContactForm(data);

    if (result.success) {
      setState("success");
      form.reset();
    } else {
      setState("error");
      setErrorMsg(result.error || "送信に失敗しました。");
    }
  }

  if (state === "success") {
    return (
      <div className="bg-white rounded-2xl p-8 sm:p-12 border border-gray-100 shadow-sm text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold mb-2">送信完了</h3>
        <p className="text-muted mb-6">
          お問い合わせありがとうございます。<br />
          最短翌営業日にご返信いたします。
        </p>
        <button
          onClick={() => setState("idle")}
          className="text-sm font-medium text-primary hover:underline"
        >
          新しいお問い合わせ
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl p-8 sm:p-12 border border-gray-100 shadow-sm"
    >
      <h3 className="text-2xl font-bold mb-6">お問い合わせフォーム</h3>

      <div className="grid sm:grid-cols-2 gap-6 mb-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2">
            お名前 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors text-sm"
            placeholder="山田 太郎"
          />
        </div>
        <div>
          <label htmlFor="company" className="block text-sm font-medium mb-2">
            会社名・団体名
          </label>
          <input
            type="text"
            id="company"
            name="company"
            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors text-sm"
            placeholder="株式会社〇〇"
          />
        </div>
      </div>

      <div className="mb-6">
        <label htmlFor="email" className="block text-sm font-medium mb-2">
          メールアドレス <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors text-sm"
          placeholder="example@email.com"
        />
      </div>

      <div className="mb-6">
        <label htmlFor="category" className="block text-sm font-medium mb-2">
          ご相談内容 <span className="text-red-500">*</span>
        </label>
        <select
          id="category"
          name="category"
          required
          className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors text-sm bg-white"
        >
          <option value="">選択してください</option>
          <option value="web-app">Webアプリ開発</option>
          <option value="line-app">LINEミニアプリ構築</option>
          <option value="dx">自治体DX支援</option>
          <option value="other">その他</option>
        </select>
      </div>

      <div className="mb-6">
        <label htmlFor="message" className="block text-sm font-medium mb-2">
          お問い合わせ内容 <span className="text-red-500">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors text-sm resize-vertical"
          placeholder="ご相談内容をお書きください"
        />
      </div>

      {state === "error" && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={state === "sending"}
        className="w-full bg-primary text-white font-semibold py-4 rounded-full hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {state === "sending" ? "送信中..." : "送信する"}
      </button>

      <p className="text-xs text-muted mt-4 text-center">
        送信いただいた内容は、ご返信およびサービスのご案内にのみ使用いたします。
      </p>
    </form>
  );
}
