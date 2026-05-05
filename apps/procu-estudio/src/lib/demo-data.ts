export const demoCases = [
  {
    id: "demo_mev_12345_2026",
    portal: "mev",
    normalizedNumber: "12345-2026",
    caption: "PEREZ JUAN C/ GOMEZ ANA S/ DANOS Y PERJUICIOS",
    courtName: "Juzgado Civil y Comercial Nro. 1 - La Plata",
    movements: [
      {
        id: "mov_1",
        date: "2026-05-02",
        title: "PROVEIDO",
        description: "Se tiene presente la documentacion acompanada."
      },
      {
        id: "mov_2",
        date: "2026-04-29",
        title: "PRESENTACION ELECTRONICA",
        description: "Se agrega escrito presentado por la parte actora."
      }
    ],
    suggestions: [
      {
        id: "sug_1",
        label: "Actor probable",
        value: "PEREZ JUAN",
        confidence: 0.72
      },
      {
        id: "sug_2",
        label: "Demandado probable",
        value: "GOMEZ ANA",
        confidence: 0.72
      },
      {
        id: "sug_3",
        label: "Materia probable",
        value: "DANOS Y PERJUICIOS",
        confidence: 0.68
      }
    ]
  },
  {
    id: "demo_pjn_98765_2025",
    portal: "pjn",
    normalizedNumber: "98765-2025",
    caption: "ACME SA C/ RIVERA MARIA S/ EJECUTIVO",
    courtName: "Juzgado Nacional en lo Comercial Nro. 8",
    movements: [
      {
        id: "mov_3",
        date: "2026-05-01",
        title: "DESPACHO SIMPLE",
        description: "Se ordena traslado por el plazo de ley."
      }
    ],
    suggestions: [
      {
        id: "sug_4",
        label: "Tipo de proceso probable",
        value: "EJECUTIVO",
        confidence: 0.81
      }
    ]
  }
];

export const demoDailyItems = [
  {
    id: "daily_1",
    kind: "movement",
    title: "Nuevo proveido detectado",
    caseCaption: demoCases[0].caption,
    caseId: demoCases[0].id,
    date: "2026-05-02"
  },
  {
    id: "daily_2",
    kind: "movement",
    title: "Despacho simple en PJN",
    caseCaption: demoCases[1].caption,
    caseId: demoCases[1].id,
    date: "2026-05-01"
  },
  {
    id: "daily_3",
    kind: "task",
    title: "Confirmar partes detectadas",
    caseCaption: demoCases[0].caption,
    caseId: demoCases[0].id,
    date: "Hoy"
  }
];
