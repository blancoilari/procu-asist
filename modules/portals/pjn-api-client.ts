/**
 * REST client for api.pjn.gov.ar.
 *
 * Uses the bearer token captured by the webRequest listener (see
 * pjn-token-store). If no token is available or the API returns 401, returns
 * a typed `no-session` error so the caller can prompt the user to revisit
 * portalpjn.pjn.gov.ar.
 */

import { getToken, clearToken } from './pjn-token-store';

const API_BASE = 'https://api.pjn.gov.ar';

export type PjnEventLink = {
  app: string;
  url: string;
};

export type PjnEventPayload = {
  id: number;
  caratulaExpediente: string;
  claveExpediente: string;
  fechaFirma: number;
  tipoEvento: string;
};

export type PjnEvent = {
  id: number;
  categoria: string;
  fechaCreacion: number;
  fechaAccion: number;
  fechaFirma: number;
  tipo: string;
  hasDocument: boolean;
  link: PjnEventLink;
  payload: PjnEventPayload;
};

export type PjnEventsPage = {
  hasNext: boolean;
  numberOfItems: number;
  page: number;
  pageSize: number;
  items: PjnEvent[];
};

export type PjnApiError =
  | { kind: 'no-session'; message: string }
  | { kind: 'http'; status: number; message: string }
  | { kind: 'network'; message: string };

export type PjnApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: PjnApiError };

type GetEventsParams = {
  page?: number;
  pageSize?: number;
  categoria?: string;
  fechaHasta?: number;
};

export async function getEvents(
  params: GetEventsParams = {}
): Promise<PjnApiResult<PjnEventsPage>> {
  const { page = 0, pageSize = 20, categoria = 'judicial', fechaHasta } = params;

  const url = new URL(`${API_BASE}/eventos/`);
  url.searchParams.set('page', String(page));
  url.searchParams.set('pageSize', String(pageSize));
  url.searchParams.set('categoria', categoria);
  if (fechaHasta !== undefined) {
    url.searchParams.set('fechaHasta', String(fechaHasta));
  }

  return fetchWithAuth<PjnEventsPage>(url.toString());
}

async function fetchWithAuth<T>(url: string): Promise<PjnApiResult<T>> {
  const token = getToken();
  if (!token) {
    return {
      ok: false,
      error: {
        kind: 'no-session',
        message:
          'No hay token PJN capturado. Abrí portalpjn.pjn.gov.ar e iniciá sesión para que ProcuAsist pueda usar el feed.',
      },
    };
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: token.bearer,
        Accept: 'application/json',
      },
    });
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: 'network',
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }

  if (response.status === 401 || response.status === 403) {
    clearToken();
    return {
      ok: false,
      error: {
        kind: 'no-session',
        message:
          'El token PJN expiró o fue rechazado. Volvé a abrir portalpjn.pjn.gov.ar.',
      },
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: {
        kind: 'http',
        status: response.status,
        message: `API PJN respondió ${response.status} ${response.statusText}`,
      },
    };
  }

  try {
    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: 'network',
        message: `No se pudo parsear la respuesta JSON: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }
}
