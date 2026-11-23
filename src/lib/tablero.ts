import catalogo from "@/data/catalogo.json";

export const TARIFAS = [
  "1",
  "1A",
  "1B",
  "1C",
  "1D",
  "1E",
  "1F",
  "DAC",
  "9CU",
  "9N",
  "DB1",
  "DB2",
  "PDBT",
  "GDBT",
  "RABT",
  "RAMT",
  "APBT",
  "APMT",
  "GDMTH",
  "GDMTO",
  "DIST",
  "DIT",
  "UR",
] as const;
export type Valores = { usuarios: number; ventas: number; productos: number };
export type Acumulado = Record<string, Record<string, Valores>>; // agencia -> tarifa -> valores
export type Registro = Valores & {
  origen: "SAP" | "SICOM";
  archivo: string;
  fila: number;
  agencia: string;
  tarifa: string;
  campos: { nombre: string; valor: string }[];
};

export function registrosDeFila(
  registros: Registro[],
  agencia: string,
  tarifa: string,
  origen: "SAP" | "SICOM" | "DIFERENCIAS",
) {
  return registros.filter(
    (r) =>
      (agencia === "ZONA" || r.agencia === agencia) &&
      (tarifa === "TOTAL" || r.tarifa === tarifa) &&
      (origen === "DIFERENCIAS" || r.origen === origen),
  );
}

const CAT = catalogo as Record<string, string>;
export const tarifaDeCuenta = (cuenta: string): string | undefined => CAT[cuenta.trim()];

export const SICOM_AGENCIAS: Record<string, string> = {
  "07A": "B5520",
  "07B": "B5521",
  "07C": "B5522",
  "07D": "B5523",
};
export const NOMBRES_AGENCIAS: Record<string, string> = {
  B5520: "NORTE",
  B5521: "METROPOLITANA",
  B5522: "PONIENTE",
  B5523: "CHOLULA",
};
export const nombreAgencia = (codigo: string) => `AGENCIA ${NOMBRES_AGENCIAS[codigo] ?? codigo}`;
export const SICOM_TARIFAS: Record<string, string> = {
  PB: "PDBT",
  GB: "GDBT",
  AB: "APBT",
  AM: "APMT",
  DS: "DIST",
  DT: "DIT",
  RB: "RABT",
  RM: "RAMT",
  GO: "GDMTO",
  GH: "GDMTH",
  "9C": "9CU",
  "9A": "9CU",
};

export function sumar(acc: Acumulado, agencia: string, tarifa: string, v: Valores) {
  const a = (acc[agencia] ??= {});
  const t = (a[tarifa] ??= { usuarios: 0, ventas: 0, productos: 0 });
  t.usuarios += v.usuarios;
  t.ventas += v.ventas;
  t.productos += v.productos;
}

/** Decodifica texto detectando UTF-16 (BOM) y cayendo a windows-1252 si hay caracteres inválidos. */
export function decodificar(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf);
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder("utf-16be").decode(buf);
  const t = new TextDecoder("utf-8").decode(buf);
  return t.includes("\uFFFD") ? new TextDecoder("windows-1252").decode(buf) : t;
}

export function parseNumeroSAP(s: string): number {
  const t = s.trim().replace(/,/g, "");
  if (!t) return 0;
  const neg = t.endsWith("-") || t.startsWith("-");
  const n = parseFloat(t.replace(/-/g, ""));
  return isNaN(n) ? 0 : neg ? -n : n;
}

export type ResultadoSAP = {
  acumulado: Acumulado;
  registros: Registro[];
  leidos: number;
  asignados: number;
  sinCuenta: string[];
};

/** Productos: signo final "-" del importe, invertido (× -1).
 *  Usuarios y ventas no traen signo: manda la columna CT (40 resta, 50 suma). */
export function parseSAP(texto: string, archivo = "SAP"): ResultadoSAP {
  const lines = texto.split(/\r?\n/);
  const acumulado: Acumulado = {};
  const registros: Registro[] = [];
  let idx: Record<string, number> | null = null;
  let leidos = 0,
    asignados = 0;
  const sin = new Set<string>();
  for (const [numero, line] of lines.entries()) {
    if (!line.includes("|")) continue;
    const cols = line.split("|").map((c) => c.trim());
    if (!idx) {
      if (cols.includes("LibrMay")) {
        idx = {};
        for (const [i, c] of cols.entries()) idx[c] = i;
      }
      continue;
    }
    if (cols.includes("LibrMay")) continue;
    const indices = idx;
    const campo = (nombre: string) => {
      const i = indices[nombre];
      return i === undefined ? "" : (cols[i] ?? "");
    };
    const cuenta = campo("LibrMay");
    if (!/^\d+$/.test(cuenta)) continue;
    leidos++;
    const tarifa = tarifaDeCuenta(cuenta);
    if (!tarifa) {
      sin.add(cuenta);
      continue;
    }
    const agencia = campo("Texto").split(/\s+/)[0] || "SIN AGENCIA";
    const ct = campo("CT").trim();
    const signoCT = ct === "40" ? -1 : 1; // 40 resta, 50 suma; sin CT se asume positivo
    const valores = {
      ventas: signoCT * Math.abs(parseNumeroSAP(campo("Clave ref.1"))),
      usuarios: signoCT * Math.abs(parseNumeroSAP(campo("Clave ref.2"))),
      productos: -parseNumeroSAP(campo("Importe en ML")),
    };
    sumar(acumulado, agencia, tarifa, valores);
    registros.push({
      origen: "SAP",
      archivo,
      fila: numero + 1,
      agencia,
      tarifa,
      ...valores,
      campos: Object.entries(indices)
        .filter(([nombre]) => nombre !== "")
        .map(([nombre, i]) => ({ nombre, valor: cols[i] ?? "" })),
    });
    asignados++;
  }
  return { acumulado, registros, leidos, asignados, sinCuenta: [...sin] };
}

export type ResultadoSICOM = {
  acumulado: Acumulado;
  registros: Registro[];
  leidos: number;
  asignados: number;
  error?: string;
};

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
const num = (s: unknown) => {
  const n = typeof s === "number" ? s : parseFloat(String(s ?? "").replace(/[,$\s]/g, ""));
  return isNaN(n) ? 0 : n;
};

/** Tarifa SICOM: por TFSB (PB, GB…) o por TA (01→1, 1A, DAC…). */
const tarifaSICOM = (tf: string): string | undefined =>
  SICOM_TARIFAS[tf.slice(0, 2)] ??
  (tf === "01" ? "1" : (TARIFAS as readonly string[]).includes(tf) ? tf : undefined);

/** filas: matriz ya leída (primera fila con TFSB o TA es el encabezado). */
export function parseSICOM(filas: unknown[][], archivo = "SICOM"): ResultadoSICOM {
  const acumulado: Acumulado = {};
  const registros: Registro[] = [];
  const esEncabezado = (r: unknown[]) =>
    r.some((c) => {
      const n = norm(c);
      return n.includes("TFSB") || n === "TA";
    });
  const h = filas.findIndex(esEncabezado);
  if (h < 0)
    return {
      acumulado,
      registros,
      leidos: 0,
      asignados: 0,
      error: "No se encontró el encabezado TFSB/TA",
    };
  const encabezado = filas[h];
  if (!encabezado)
    return {
      acumulado,
      registros,
      leidos: 0,
      asignados: 0,
      error: "No se encontró el encabezado TFSB/TA",
    };
  const head = encabezado.map(norm);
  // Si el nombre del archivo contiene "DAC", todos sus registros son tarifa DAC.
  const tarifaForzada = norm(archivo).includes("DAC") ? "DAC" : undefined;
  const iT = head.findIndex((c) => c.includes("TFSB") || c === "TA");
  const cols = (k: string) => head.map((c, i) => (c.includes(k) ? i : -1)).filter((i) => i >= 0);
  const iU = cols("USUARIO"),
    iV = cols("VENTA"),
    iP = cols("PRODUCTO");
  let leidos = 0,
    asignados = 0;
  for (const [numero, r] of filas.slice(h + 1).entries()) {
    const tf = norm(r[iT]);
    if (!tf) continue;
    leidos++;
    const ag = r
      .map(norm)
      .map((c) => c.match(/^07[A-D]/)?.[0])
      .find(Boolean);
    const agencia = ag ? SICOM_AGENCIAS[ag] : undefined;
    const tarifa = tarifaForzada ?? tarifaSICOM(tf);
    if (!agencia || !tarifa) continue;
    const s = (ix: number[]) => ix.reduce((a, i) => a + num(r[i]), 0);
    const valores = { usuarios: s(iU), ventas: s(iV), productos: s(iP) };
    sumar(acumulado, agencia, tarifa, valores);
    registros.push({
      origen: "SICOM",
      archivo,
      fila: h + numero + 2,
      agencia,
      tarifa,
      ...valores,
      campos: encabezado
        .map((nombre, i) => ({ nombre: String(nombre ?? ""), valor: String(r[i] ?? "") }))
        .filter((c) => c.nombre.trim() !== ""),
    });
    asignados++;
  }
  return { acumulado, registros, leidos, asignados };
}

export function fusionar(a: Acumulado, b: Acumulado): Acumulado {
  const out: Acumulado = structuredClone(a);
  for (const [ag, ts] of Object.entries(b))
    for (const [t, v] of Object.entries(ts)) sumar(out, ag, t, v);
  return out;
}

export function zona(acc: Acumulado): Record<string, Valores> {
  const z: Acumulado = {};
  for (const ts of Object.values(acc)) for (const [t, v] of Object.entries(ts)) sumar(z, "Z", t, v);
  return z["Z"] ?? {};
}
