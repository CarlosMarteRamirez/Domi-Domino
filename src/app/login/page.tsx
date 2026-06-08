import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/infrastructure/auth/auth";
import { isGoogleAuthEnabled } from "@/config/env";
import { LoginForm } from "@/presentation/components/auth/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/presentation/components/ui/card";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center p-4 felt">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Dominó Online</CardTitle>
          <CardDescription>Inicia sesión para jugar por parejas en tiempo real</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm googleEnabled={isGoogleAuthEnabled()} />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Regístrate
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
