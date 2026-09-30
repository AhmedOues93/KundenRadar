import Link from "next/link";
import { buttonClasses } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-3xl font-semibold text-slate-900">404</p>
      <h1 className="text-lg font-semibold text-slate-800">Seite nicht gefunden</h1>
      <p className="text-sm text-slate-500">
        Die aufgerufene Adresse existiert nicht oder der Datensatz gehört nicht zu dieser
        Organisation.
      </p>
      <Link href="/dashboard" className={buttonClasses("primary")}>
        Zum Dashboard
      </Link>
    </main>
  );
}
