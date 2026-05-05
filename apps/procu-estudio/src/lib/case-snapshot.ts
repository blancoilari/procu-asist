export type CaseSnapshotPortal = "mev" | "pjn" | "eje";

export type CaseSnapshot = {
  schemaVersion: "case-snapshot.v1";
  capturedAt: string;
  source: {
    app: "procu-asist";
    extensionVersion: string;
    portal: CaseSnapshotPortal;
    jurisdiction: string;
    originUrl: string;
    captureMode: "manual" | "bulk" | "scheduled";
  };
  case: {
    externalId?: string | null;
    caseNumber?: string | null;
    caseYear?: string | null;
    normalizedNumber?: string | null;
    caption: string;
    courtName?: string | null;
    courtCode?: string | null;
    venue?: string | null;
    matter?: string | null;
    status?: string | null;
    startedAt?: string | null;
  };
  movements?: CaseSnapshotMovement[];
  documents?: CaseSnapshotDocument[];
  suggestions?: CaseSnapshotSuggestion[];
  raw?: {
    portalPayload?: unknown;
    htmlSnapshotStored?: boolean;
  };
};

export type CaseSnapshotMovement = {
  externalId?: string | null;
  date?: string | null;
  title?: string | null;
  description?: string | null;
  fullText?: string | null;
  folio?: string | null;
  signedBy?: string[];
  documentRefs?: CaseSnapshotDocumentRef[];
};

export type CaseSnapshotDocumentRef = {
  externalId?: string | null;
  title: string;
  url?: string | null;
  mimeType?: string | null;
  sha256?: string | null;
};

export type CaseSnapshotDocument = CaseSnapshotDocumentRef & {
  capturedAt?: string | null;
  storageMode?: "remote-reference" | "uploaded" | "generated";
};

export type CaseSnapshotSuggestion = {
  field: string;
  value: string;
  confidence: number;
  sourcePath: string;
  reason: string;
  status?: "pending" | "accepted" | "rejected" | "superseded";
};

type ValidationResult =
  | {
      ok: true;
      snapshot: CaseSnapshot;
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

export function validateCaseSnapshot(input: unknown): ValidationResult {
  if (!isRecord(input)) {
    return fail("invalid_schema", "El payload debe ser un objeto.");
  }

  if (input.schemaVersion !== "case-snapshot.v1") {
    return fail("invalid_schema", "schemaVersion debe ser case-snapshot.v1.");
  }

  if (!isIsoDateLike(input.capturedAt)) {
    return fail("invalid_schema", "capturedAt debe ser una fecha ISO.");
  }

  if (!isRecord(input.source)) {
    return fail("invalid_schema", "source es obligatorio.");
  }

  const source = input.source;

  if (source.app !== "procu-asist") {
    return fail("invalid_schema", "source.app debe ser procu-asist.");
  }

  if (!isNonEmptyString(source.extensionVersion)) {
    return fail("invalid_schema", "source.extensionVersion es obligatorio.");
  }

  if (!isSupportedPortal(source.portal)) {
    return fail("portal_not_supported", "Portal no soportado.");
  }

  if (!isNonEmptyString(source.jurisdiction)) {
    return fail("invalid_schema", "source.jurisdiction es obligatorio.");
  }

  if (!isNonEmptyString(source.originUrl)) {
    return fail("invalid_schema", "source.originUrl es obligatorio.");
  }

  if (!isRecord(input.case)) {
    return fail("invalid_schema", "case es obligatorio.");
  }

  const caseInput = input.case;

  if (!isNonEmptyString(caseInput.caption)) {
    return fail("invalid_schema", "case.caption es obligatorio.");
  }

  if (
    !isNonEmptyString(caseInput.externalId) &&
    !isNonEmptyString(caseInput.normalizedNumber)
  ) {
    return fail(
      "missing_case_identity",
      "La causa necesita externalId o normalizedNumber."
    );
  }

  const movements = Array.isArray(input.movements) ? input.movements : [];

  for (const movement of movements) {
    if (!isRecord(movement)) {
      return fail("invalid_schema", "Cada movimiento debe ser un objeto.");
    }

    if (!isNonEmptyString(movement.title) && !isNonEmptyString(movement.description)) {
      return fail(
        "invalid_schema",
        "Cada movimiento necesita title o description."
      );
    }
  }

  const suggestions = Array.isArray(input.suggestions) ? input.suggestions : [];

  for (const suggestion of suggestions) {
    if (!isRecord(suggestion)) {
      return fail("invalid_schema", "Cada sugerencia debe ser un objeto.");
    }

    if (!isNonEmptyString(suggestion.field) || !isNonEmptyString(suggestion.value)) {
      return fail(
        "invalid_schema",
        "Cada sugerencia necesita field y value."
      );
    }

    if (
      typeof suggestion.confidence !== "number" ||
      suggestion.confidence < 0 ||
      suggestion.confidence > 1
    ) {
      return fail(
        "invalid_schema",
        "Cada sugerencia necesita confidence entre 0 y 1."
      );
    }
  }

  return {
    ok: true,
    snapshot: input as CaseSnapshot
  };
}

export function buildDemoImportResult(snapshot: CaseSnapshot) {
  const normalizedNumber =
    snapshot.case.normalizedNumber || snapshot.case.externalId || "sin-numero";
  const caseId = `demo_${slugify(`${snapshot.source.portal}_${normalizedNumber}`)}`;

  return {
    ok: true,
    workspaceId: "demo_workspace",
    caseId,
    created: true,
    stats: {
      movementsCreated: snapshot.movements?.length ?? 0,
      movementsSkipped: 0,
      documentsCreated: snapshot.documents?.length ?? 0,
      suggestionsCreated: snapshot.suggestions?.length ?? 0
    },
    caseUrl: `/cases/${caseId}`
  };
}

function fail(code: string, message: string): ValidationResult {
  return {
    ok: false,
    code,
    message
  };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

function isNonEmptyString(input: unknown): input is string {
  return typeof input === "string" && input.trim().length > 0;
}

function isIsoDateLike(input: unknown): input is string {
  return isNonEmptyString(input) && !Number.isNaN(Date.parse(input));
}

function isSupportedPortal(input: unknown): input is CaseSnapshotPortal {
  return input === "mev" || input === "pjn" || input === "eje";
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
