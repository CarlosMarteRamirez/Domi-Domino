import Link from "next/link";
import { Button } from "@/presentation/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 felt p-4 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">No encontramos esta página o sala.</p>
      <Button asChild>
        <Link href="/dashboard">Volver al dashboard</Link>
      </Button>
    </main>
  );
}
