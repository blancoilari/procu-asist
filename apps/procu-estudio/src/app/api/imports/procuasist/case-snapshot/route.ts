import { NextResponse } from "next/server";
import {
  buildDemoImportResult,
  validateCaseSnapshot
} from "@/lib/case-snapshot";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        code: "invalid_json",
        message: "El cuerpo de la solicitud no es JSON valido."
      },
      { status: 400 }
    );
  }

  const validation = validateCaseSnapshot(body);

  if (!validation.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: validation.code,
        message: validation.message
      },
      { status: 400 }
    );
  }

  const demoMode = process.env.PROCU_ESTUDIO_DEMO_MODE !== "false";

  if (demoMode) {
    return NextResponse.json(buildDemoImportResult(validation.snapshot));
  }

  return NextResponse.json(
    {
      ok: false,
      code: "persistence_not_configured",
      message:
        "La validacion funciona, pero falta conectar Supabase para persistir la importacion."
    },
    { status: 501 }
  );
}
