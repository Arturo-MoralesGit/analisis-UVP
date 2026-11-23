import { describe, it, expect } from "vitest";
import {
  parseSAP,
  parseSICOM,
  parseNumeroSAP,
  zona,
  NOMBRES_AGENCIAS,
  registrosDeFila,
} from "./tablero";

const txt = `|    St |Asign.|Soc.|Div.|Nº doc.  |Clase|Fecha doc.|CT|     Importe en ML|ML |Doc.comp. |Texto |Referencia |Clave ref.1 |Clave ref.2 |LibrMay|
-----
|  |51SP1|SB01|B138|1|SA|01.10.2026|50| 60.59-|MXP| |B5521 |6GPB01|0000000010|000001|448539|
|  |51SP1|SB01|B138|1|SA|01.10.2026|50| 1,000.00-|MXP| |B5521 |6GPB01|0000000005|000002|448539|
|  |51111|SB01|B138|1|SC|01.10.2026|50| 213.15-|MXP| |B5523 |165B01|0000000139|000004|430000|
|  |x|SB01|B138|1|SC|01.10.2026|50| 1.00-|MXP| |B5523 |165B01|0|0|999999|`;

describe("SAP", () => {
  it("lee importe con signo final", () => expect(parseNumeroSAP("1,226.15-")).toBe(-1226.15));
  it("acumula por agencia y tarifa", () => {
    const r = parseSAP(txt);
    expect(r.acumulado["B5521"]?.["PDBT"]).toEqual({ ventas: 15, usuarios: 3, productos: 1060.59 });
    expect(r.acumulado["B5523"]?.["1"]?.ventas).toBe(139);
    expect(r.sinCuenta).toEqual(["999999"]);
    expect(zona(r.acumulado)["PDBT"]?.usuarios).toBe(3);
  });
  it("productos invierte el signo del importe; usuarios y ventas usan CT (40 resta, 50 suma)", () => {
    const r = parseSAP(
      `|LibrMay|Texto|CT|Importe en ML|Clave ref.1|Clave ref.2|\n|448539|B5521|50|60.59-|10|1|\n|448539|B5521|40|100.00|5|2|`,
    );
    expect(r.acumulado["B5521"]?.["PDBT"]).toEqual({ ventas: 5, usuarios: -1, productos: -39.41 });
  });
});

describe("SICOM", () => {
  it("acumula cancelaciones y reposiciones conservando sus signos", () => {
    const r = parseSICOM([
      [
        "AGENCIA",
        "TFSB",
        "USUARIOS_CANC",
        "VENTAS_CANC",
        "PRODUCTOS_CANC",
        "USUARIOS_REPOS",
        "VENTAS_REPOS",
        "PRODUCTOS_REPOS",
      ],
      ["07B", "PB", -1, -926, -7393.43, 1, 926, 3286.72],
      ["07C", "PB", -2, -27, -163.55, 2, 16, 103.91],
    ]);
    expect(r.acumulado["B5521"]?.["PDBT"]?.usuarios).toBe(0);
    expect(r.acumulado["B5521"]?.["PDBT"]?.ventas).toBe(0);
    expect(r.acumulado["B5521"]?.["PDBT"]?.productos).toBeCloseTo(-4106.71);
    expect(r.acumulado["B5522"]?.["PDBT"]?.usuarios).toBe(0);
    expect(r.acumulado["B5522"]?.["PDBT"]?.ventas).toBe(-11);
    expect(r.acumulado["B5522"]?.["PDBT"]?.productos).toBeCloseTo(-59.64);
  });
  it("mapea AB a APBT y AM a APMT", () => {
    const r = parseSICOM([
      ["AGE", "TFSB", "USUARIOS", "VENTAS", "PRODUCTOS"],
      ["07B", "AB", 1, 10, 100],
      ["07B", "AM", 2, 20, 200],
    ]);
    expect(r.acumulado["B5521"]?.["APBT"]).toEqual({ usuarios: 1, ventas: 10, productos: 100 });
    expect(r.acumulado["B5521"]?.["APMT"]).toEqual({ usuarios: 2, ventas: 20, productos: 200 });
  });
  it("lee la columna TA y mapea 01 a la tarifa 1", () => {
    const r = parseSICOM([
      ["AGENCIA", "TA", "USUARIOS", "VENTAS", "PRODUCTOS"],
      ["07D", "01", -3, -91747, -370798.62],
    ]);
    expect(r.acumulado["B5523"]?.["1"]).toEqual({
      usuarios: -3,
      ventas: -91747,
      productos: -370798.62,
    });
  });
  it("archivo con DAC en el nombre asigna todos sus registros a la tarifa DAC", () => {
    const r = parseSICOM(
      [
        ["AGE", "TFSB", "USUARIOS", "VENTAS", "PRODUCTOS"],
        ["07B", "PB", 4, 500, 9000],
        ["07C", "GB", 2, 300, 6000],
      ],
      "GENERALES_DAC_2",
    );
    expect(r.acumulado["B5521"]?.["DAC"]).toEqual({ usuarios: 4, ventas: 500, productos: 9000 });
    expect(r.acumulado["B5522"]?.["DAC"]).toEqual({ usuarios: 2, ventas: 300, productos: 6000 });
    expect(r.acumulado["B5521"]?.["PDBT"]).toBeUndefined();
  });
  it("mapea 9C y 9A a la tarifa 9CU", () => {
    const r = parseSICOM([
      ["AGE", "TFSB", "USUARIOS", "VENTAS", "PRODUCTOS"],
      ["07B", "9C", 1, 10, 100],
      ["07C", "9A", 2, 20, 200],
    ]);
    expect(r.acumulado["B5521"]?.["9CU"]).toEqual({ usuarios: 1, ventas: 10, productos: 100 });
    expect(r.acumulado["B5522"]?.["9CU"]).toEqual({ usuarios: 2, ventas: 20, productos: 200 });
  });
  it("mapea agencia y tarifa y suma columnas repetidas", () => {
    const r = parseSICOM([
      ["AGE", "TFSB", "USUARIOS", "VENTAS", "PRODUCTOS", "USUARIOS"],
      ["07C", "GH", 2, 100, 50, 3],
    ]);
    expect(r.acumulado["B5522"]?.["GDMTH"]).toEqual({ usuarios: 5, ventas: 100, productos: 50 });
  });
});

describe("Catálogo de agencias", () => {
  it.each([
    ["B5520", "NORTE"],
    ["B5521", "METROPOLITANA"],
    ["B5522", "PONIENTE"],
    ["B5523", "CHOLULA"],
  ])("asigna %s a %s", (codigo, nombre) => {
    expect(NOMBRES_AGENCIAS[codigo]).toBe(nombre);
  });
});

describe("Registros del tablero", () => {
  it("conserva filas SAP asignadas con importes y campos originales", () => {
    const r = parseSAP(txt, "partidas.txt");
    expect(r.registros).toHaveLength(3);
    const detalle = registrosDeFila(r.registros, "B5521", "PDBT", "SAP");
    expect(detalle.map((d) => d.fila)).toEqual([3, 4]);
    expect(detalle.every((d) => d.archivo === "partidas.txt")).toBe(true);
    expect(detalle.reduce((s, d) => s + d.usuarios, 0)).toBe(3);
    expect(detalle[0]?.campos).toContainEqual({ nombre: "Importe en ML", valor: "60.59-" });
  });
  it("incluye cancelaciones con saldo cero y conserva columnas SICOM repetidas", () => {
    const r = parseSICOM(
      [
        ["AGE", "TFSB", "USUARIOS", "USUARIOS", "VENTAS", "PRODUCTOS"],
        ["07C", "PB", -2, 2, -11, -59.64],
      ],
      "general",
    );
    const detalle = registrosDeFila(r.registros, "B5522", "PDBT", "SICOM");
    expect(detalle).toHaveLength(1);
    expect(detalle[0]?.usuarios).toBe(0);
    expect(detalle[0]?.campos.filter((c) => c.nombre === "USUARIOS").map((c) => c.valor)).toEqual([
      "-2",
      "2",
    ]);
    expect(detalle[0]?.fila).toBe(2);
  });
  it("filtra tarifa, agencia y origen y muestra ambos orígenes en diferencias", () => {
    const registros = [
      ...parseSAP(txt).registros,
      ...parseSICOM([
        ["AGE", "TA", "USUARIOS"],
        ["07B", "PB", 8],
        ["07D", "01", 2],
      ]).registros,
    ];
    expect(registrosDeFila(registros, "ZONA", "TOTAL", "DIFERENCIAS")).toHaveLength(5);
    expect(registrosDeFila(registros, "B5521", "PDBT", "DIFERENCIAS")).toHaveLength(3);
    expect(registrosDeFila(registros, "ZONA", "PDBT", "SICOM")).toHaveLength(1);
    expect(registrosDeFila(registros, "B5523", "TOTAL", "SAP")).toHaveLength(1);
    expect(registrosDeFila(registros, "B5520", "1", "SAP")).toEqual([]);
  });
});
