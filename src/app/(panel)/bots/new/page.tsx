import { PageHeader } from "@/components/ui";
import { NewBotForm } from "./form";

export default function NewBotPage() {
  return (
    <div className="max-w-xl">
      <PageHeader
        eyebrow="Ulash"
        title="Bot qo'shish"
        description="Token kiritilgandan so'ng bot tekshiriladi, webhook o'rnatiladi va /start ekrani tayyor holda yaratiladi."
      />
      <NewBotForm />
    </div>
  );
}
