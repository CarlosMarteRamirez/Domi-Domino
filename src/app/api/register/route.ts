import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { registerUser } from "@/application/users";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await registerUser(body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Datos invalidos", details: error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
