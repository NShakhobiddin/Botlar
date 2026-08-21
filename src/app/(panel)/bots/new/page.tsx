import { PageHeader } from "@/components/ui";
import { NewBotForm } from "./form";

export default function NewBotPage() {
  // Ochiq HTTPS manzil bo'lmasa webhook baribir ishlamaydi.
  const canWebhook = /^https:\/\//.test(process.env.APP_URL ?? "");

  return (
    <div className="max-w-xl">
      <PageHeader
        eyebrow="Ulash"
        title="Bot qo'shish"
        description="Token kiritilgandan so'ng bot tekshiriladi, Telegram bilan ulanadi va /start ekrani tayyor holda yaratiladi."
      />
      <NewBotForm canWebhook={canWebhook} />
    </div>
  );
}
