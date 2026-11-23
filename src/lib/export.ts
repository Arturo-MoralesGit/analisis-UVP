import ExcelJS from "exceljs";
import { TARIFAS, nombreAgencia, type Acumulado } from "./tablero";

const VERDE = "FF0F5132",
  CLARO = "FFE8F3EE";

export async function exportarExcel(sap: Acumulado, sicom: Acumulado, periodo: string) {
  const agencias = [...new Set([...Object.keys(sap), ...Object.keys(sicom)])].sort();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("PPE");
  ws.columns = [{ width: 12 }, ...Array(12).fill({ width: 15 }), { width: 40 }];
  const BLOCK = 8 + 3 + TARIFAS.length + 1 + 4;
  const start = (i: number) => 1 + i * BLOCK; // i=0 zona
  const firstData = (i: number) => start(i) + 11;

  const bloque = (
    i: number,
    nombre: string,
    data?: { sap: Acumulado[string]; sicom: Acumulado[string] },
  ) => {
    const s = start(i);
    [
      "COMISIÓN FEDERAL DE ELECTRICIDAD",
      "División Centro Oriente",
      "Zona Comercial Puebla Poniente",
      "",
      "Informe de ventas de energía eléctrica",
      periodo,
      "",
      "CONCILIACIÓN UVP SICOM vs SAP",
    ].forEach((t, k) => {
      const c = ws.getCell(s + k, 1);
      c.value = t;
      c.font = { bold: true, size: k === 0 ? 14 : 11, color: { argb: VERDE } };
      ws.mergeCells(s + k, 1, s + k, 14);
      c.alignment = { horizontal: "center" };
    });
    const h1 = s + 8,
      h2 = s + 9,
      h3 = s + 10;
    ws.getCell(h1, 1).value = "TARIFA";
    ws.mergeCells(h1, 1, h3, 1);
    ws.getCell(h1, 2).value = nombre;
    ws.mergeCells(h1, 2, h1, 14);
    [
      ["SICOM", 2],
      ["SAP", 6],
      ["DIFERENCIAS", 10],
    ].forEach(([t, c]) => {
      ws.getCell(h2, c as number).value = t;
      ws.mergeCells(h2, c as number, h2, (c as number) + 3);
    });
    ws.getCell(h2, 14).value = "OBSERVACIÓN/DOCTO CORRECIÓN SAP";
    ws.mergeCells(h2, 14, h3, 14);
    for (let g = 0; g < 3; g++)
      ["USUARIOS", "VENTAS", "PRODUCTOS", "PRECIO MEDIO"].forEach(
        (t, k) => (ws.getCell(h3, 2 + g * 4 + k).value = t),
      );
    for (let r = h1; r <= h3; r++)
      for (let c = 1; c <= 14; c++) {
        const cell = ws.getCell(r, c);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      }
    const f0 = firstData(i);
    TARIFAS.forEach((t, k) => {
      const r = f0 + k;
      ws.getCell(r, 1).value = isNaN(Number(t)) ? t : Number(t);
      [
        ["usuarios", 0],
        ["ventas", 1],
        ["productos", 2],
      ].forEach(([key, o]) => {
        const off = o as number,
          kk = key as "usuarios";
        for (const [g, src] of [
          [2, "sicom"],
          [6, "sap"],
        ] as const) {
          const col = g + off;
          const L = ws.getColumn(col).letter;
          ws.getCell(r, col).value = data
            ? (data[src]?.[t]?.[kk] ?? 0)
            : { formula: agencias.map((_, j) => `${L}${firstData(j + 1) + k}`).join("+") || "0" };
        }
        const a = ws.getColumn(2 + off).letter,
          b = ws.getColumn(6 + off).letter;
        ws.getCell(r, 10 + off).value = { formula: `${a}${r}-${b}${r}` };
      });
      for (const g of [2, 6, 10]) {
        const v = ws.getColumn(g + 1).letter,
          p = ws.getColumn(g + 2).letter;
        ws.getCell(r, g + 3).value = { formula: `IFERROR(ROUND(${p}${r}/${v}${r},2),0)` };
      }
      if (k % 2)
        for (let c = 1; c <= 14; c++)
          ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: CLARO } };
    });
    const tr = f0 + TARIFAS.length;
    ws.getCell(tr, 1).value = "TOTAL";
    for (let c = 2; c <= 13; c++) {
      const L = ws.getColumn(c).letter;
      ws.getCell(tr, c).value =
        (c - 1) % 4 === 0
          ? {
              formula: `IFERROR(ROUND(${ws.getColumn(c - 1).letter}${tr}/${ws.getColumn(c - 2).letter}${tr},2),0)`,
            }
          : { formula: `SUM(${L}${f0}:${L}${tr - 1})` };
    }
    for (let c = 1; c <= 14; c++) {
      const x = ws.getCell(tr, c);
      x.font = { bold: true };
      x.border = { top: { style: "medium", color: { argb: VERDE } } };
    }
    for (let r = f0; r <= tr; r++)
      for (let c = 2; c <= 13; c++)
        ws.getCell(r, c).numFmt =
          c % 4 === 1 ? "#,##0.00" : c % 4 === 0 ? "#,##0.00;(#,##0.00);-" : "#,##0;(#,##0);-";
  };

  bloque(0, "ZONA PUEBLA PONIENTE");
  agencias.forEach((a, j) =>
    bloque(j + 1, nombreAgencia(a), { sap: sap[a] ?? {}, sicom: sicom[a] ?? {} }),
  );

  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
  );
  const el = document.createElement("a");
  el.href = url;
  el.download = `tablero_${periodo.replace(/\s+/g, "_")}.xlsx`;
  el.click();
  URL.revokeObjectURL(url);
}
