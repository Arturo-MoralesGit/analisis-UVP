import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileText, FileSpreadsheet, Download, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetalleRegistros, type SeleccionDetalle } from "@/components/detalle-registros";
import {
  TARIFAS,
  nombreAgencia,
  parseSAP,
  parseSICOM,
  fusionar,
  zona,
  decodificar,
  registrosDeFila,
  type Registro,
  type Acumulado,
  type Valores,
} from "@/lib/tablero";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Conciliación UVP SICOM vs SAP — Zona Puebla Poniente" },
      {
        name: "description",
        content:
          "Carga archivos SAP y SICOM, concilia ventas por agencia y tarifa y exporta el tablero a Excel.",
      },
      { property: "og:title", content: "Conciliación UVP SICOM vs SAP" },
      {
        property: "og:description",
        content: "Tablero de conciliación de ventas de energía por agencia y tarifa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const fmt = (n: number, d = 0) =>
  n === 0 ? "–" : n.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d });
const vacio: Valores = { usuarios: 0, ventas: 0, productos: 0 };

function Index() {
  const [periodo, setPeriodo] = useState("OCTUBRE 2026");
  const [sap, setSap] = useState<Acumulado>({});
  const [sicom, setSicom] = useState<Acumulado>({});
  const [msgSap, setMsgSap] = useState<string>("");
  const [sinCuenta, setSinCuenta] = useState<string[]>([]);
  const [msgSicom, setMsgSicom] = useState<string[]>([]);
  const [tab, setTab] = useState("ZONA");
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [detalle, setDetalle] = useState<SeleccionDetalle | null>(null);

  const agencias = [...new Set([...Object.keys(sap), ...Object.keys(sicom)])].sort();

  async function cargarSap(files: FileList | null) {
    if (!files?.length) return;
    let acc = sap;
    const notas: string[] = [];
    const cuentas = new Set(sinCuenta);
    const nuevos: Registro[] = [];
    for (const f of Array.from(files)) {
      const r = parseSAP(decodificar(await f.arrayBuffer()), f.name);
      nuevos.push(...r.registros);
      acc = fusionar(acc, r.acumulado);
      r.sinCuenta.forEach((cuenta) => cuentas.add(cuenta));
      notas.push(`${f.name}: ${r.leidos} registros, ${r.asignados} asignados`);
    }
    setSap(acc);
    setMsgSap(notas.join(" · "));
    setSinCuenta([...cuentas].sort());
    setRegistros((prev) => [...prev, ...nuevos]);
  }

  async function cargarSicom(files: FileList | null) {
    if (!files?.length) return;
    const archivos = Array.from(files);
    const XLSX = await import("xlsx");
    let acc = sicom;
    const notas: string[] = [];
    const nuevos: Registro[] = [];
    for (const f of archivos) {
      let hojas: { nombre: string; filas: unknown[][] }[];
      if (/\.(xlsx|xls)$/i.test(f.name)) {
        const wb = XLSX.read(await f.arrayBuffer());
        hojas = wb.SheetNames.flatMap((n) => {
          const sheet = wb.Sheets[n];
          return sheet
            ? [
                {
                  nombre: `${f.name} · ${n}`,
                  filas: XLSX.utils.sheet_to_json<unknown[]>(sheet, {
                    header: 1,
                    defval: "",
                    blankrows: true,
                  }),
                },
              ]
            : [];
        });
      } else {
        const t = decodificar(await f.arrayBuffer());
        const sep = t.includes("|") ? "|" : t.includes("\t") ? "\t" : t.includes(";") ? ";" : ",";
        hojas = [
          { nombre: f.name, filas: t.split(/\r?\n/).map((l) => l.split(sep).map((c) => c.trim())) },
        ];
      }
      for (const hoja of hojas) {
        const r = parseSICOM(hoja.filas, hoja.nombre);
        nuevos.push(...r.registros);
        acc = fusionar(acc, r.acumulado);
        notas.push(
          r.error
            ? `${hoja.nombre}: ${r.error}`
            : `${hoja.nombre}: ${r.leidos} registros, ${r.asignados} asignados`,
        );
      }
    }
    setSicom(acc);
    setMsgSicom((m) => [...m, ...notas]);
    setRegistros((prev) => [...prev, ...nuevos]);
  }

  const datos =
    tab === "ZONA"
      ? { sap: zona(sap), sicom: zona(sicom) }
      : { sap: sap[tab] ?? {}, sicom: sicom[tab] ?? {} };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-[1500px] px-6 py-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] opacity-80">
              Comisión Federal de Electricidad · División Centro Oriente
            </p>
            <h1 className="font-display text-3xl mt-1">Conciliación UVP SICOM vs SAP</h1>
            <p className="text-sm opacity-80">
              Zona Comercial Puebla Poniente · Informe de ventas de energía eléctrica
            </p>
          </div>
          <label className="text-sm">
            Periodo
            <input
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value.toUpperCase())}
              className="ml-2 rounded-md bg-primary-foreground/10 border border-primary-foreground/30 px-3 py-1.5 font-semibold"
            />
          </label>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-6 py-6 space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <Carga
            titulo="Archivo SAP"
            desc="Archivo .txt de partidas abiertas"
            icon={<FileText />}
            accept=".txt"
            onFiles={cargarSap}
            notas={msgSap ? [msgSap] : []}
          />
          <Carga
            titulo="Archivo SICOM"
            desc="Uno o varios archivos (.xlsx, .xls, .csv, .txt)"
            icon={<FileSpreadsheet />}
            accept=".xlsx,.xls,.csv,.txt"
            multiple
            onFiles={cargarSicom}
            notas={msgSicom}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {["ZONA", ...agencias].map((a) => (
            <Button
              key={a}
              onClick={() => setTab(a)}
              variant={tab === a ? "default" : "outline"}
              className={`rounded-full px-4 py-1.5 text-sm font-medium border transition ${tab === a ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent"}`}
            >
              {a === "ZONA" ? "ZONA PUEBLA PONIENTE" : nombreAgencia(a)}
            </Button>
          ))}
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSap({});
                setSicom({});
                setMsgSap("");
                setSinCuenta([]);
                setMsgSicom([]);
                setTab("ZONA");
                setRegistros([]);
                setDetalle(null);
              }}
            >
              <Trash2 /> Limpiar datos
            </Button>
            <Button
              onClick={async () =>
                (await import("@/lib/export")).exportarExcel(sap, sicom, periodo)
              }
            >
              <Download /> Exportar a Excel
            </Button>
          </div>
        </div>

        <Tabla
          titulo={tab === "ZONA" ? "ZONA PUEBLA PONIENTE" : nombreAgencia(tab)}
          {...datos}
          onDetalle={(tarifa, origen) => setDetalle({ agencia: tab, tarifa, origen })}
        />
        <DetalleRegistros
          seleccion={detalle}
          registros={
            detalle
              ? registrosDeFila(registros, detalle.agencia, detalle.tarifa, detalle.origen)
              : []
          }
          onClose={() => setDetalle(null)}
        />
        {sinCuenta.length > 0 && (
          <section aria-label="Cuentas sin tarifa" className="border-t border-border pt-4">
            <h2 className="font-display text-lg">Cuentas sin tarifa ({sinCuenta.length})</h2>
            <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm tabular-nums">
              {sinCuenta.map((cuenta) => (
                <li key={cuenta}>{cuenta}</li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

function Carga(p: {
  titulo: string;
  desc: string;
  icon: React.ReactNode;
  accept: string;
  multiple?: boolean;
  onFiles: (f: FileList | null) => void;
  notas: string[];
}) {
  return (
    <label className="block cursor-pointer rounded-xl border-2 border-dashed border-border bg-card p-5 hover:border-primary transition">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-accent p-2.5 text-primary">{p.icon}</div>
        <div className="flex-1">
          <h2 className="font-display text-lg">{p.titulo}</h2>
          <p className="text-sm text-muted-foreground">{p.desc}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
          <Upload className="size-4" /> Cargar
        </span>
      </div>
      <input
        type="file"
        className="hidden"
        accept={p.accept}
        multiple={p.multiple}
        onChange={(e) => {
          p.onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {p.notas.length > 0 && (
        <ul className="mt-3 text-xs text-muted-foreground space-y-1">
          {p.notas.map((n, i) => (
            <li key={i}>✓ {n}</li>
          ))}
        </ul>
      )}
    </label>
  );
}

function Tabla({
  titulo,
  sap,
  sicom,
  onDetalle,
}: {
  titulo: string;
  sap: Record<string, Valores>;
  sicom: Record<string, Valores>;
  onDetalle: (tarifa: string, origen: SeleccionDetalle["origen"]) => void;
}) {
  const tot = (src: Record<string, Valores>) =>
    TARIFAS.reduce((a, t) => {
      const v = src[t] ?? vacio;
      return {
        usuarios: a.usuarios + v.usuarios,
        ventas: a.ventas + v.ventas,
        productos: a.productos + v.productos,
      };
    }, vacio);
  const celdas = (v: Valores) => [
    fmt(v.usuarios),
    fmt(v.ventas),
    fmt(v.productos, 2),
    fmt(v.ventas ? v.productos / v.ventas : 0, 2),
  ];
  const dif = (a: Valores, b: Valores): Valores => ({
    usuarios: a.usuarios - b.usuarios,
    ventas: a.ventas - b.ventas,
    productos: a.productos - b.productos,
  });
  const fila = (t: string, s: Valores, p: Valores, total = false) => {
    const d = dif(s, p);
    return (
      <tr
        key={t}
        className={total ? "bg-secondary font-bold border-t-2 border-primary" : "even:bg-muted/50"}
      >
        <td className="px-3 py-1.5 font-semibold text-left sticky left-0 bg-inherit">{t}</td>
        {celdas(s).map((c, i) => (
          <td key={"s" + i} className="px-3 py-1.5">
            {i === 0 ? (
              <Button
                variant="link"
                className="h-auto p-0 min-w-6 font-inherit tabular-nums underline"
                aria-label={`Ver registros SICOM ${t}`}
                onClick={() => onDetalle(t, "SICOM")}
              >
                {c}
              </Button>
            ) : (
              c
            )}
          </td>
        ))}
        {celdas(p).map((c, i) => (
          <td key={"p" + i} className="px-3 py-1.5 border-l-0">
            {i === 0 ? (
              <Button
                variant="link"
                className="h-auto p-0 min-w-6 tabular-nums underline"
                aria-label={`Ver registros SAP ${t}`}
                onClick={() => onDetalle(t, "SAP")}
              >
                {c}
              </Button>
            ) : (
              c
            )}
          </td>
        ))}
        {celdas(d).map((c, i) => (
          <td
            key={"d" + i}
            className={`px-3 py-1.5 ${c !== "–" ? "text-destructive font-medium" : ""}`}
          >
            {i === 0 ? (
              <Button
                variant="link"
                className="h-auto p-0 min-w-6 text-inherit tabular-nums underline"
                aria-label={`Ver registros DIFERENCIAS ${t}`}
                onClick={() => onDetalle(t, "DIFERENCIAS")}
              >
                {c}
              </Button>
            ) : (
              c
            )}
          </td>
        ))}
      </tr>
    );
  };
  const grupo = ["USUARIOS", "VENTAS", "PRODUCTOS", "PRECIO MEDIO"];
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
      <table className="w-full text-sm text-right tabular-nums">
        <thead className="bg-primary text-primary-foreground text-xs text-center">
          <tr>
            <th rowSpan={3} className="px-3">
              TARIFA
            </th>
            <th colSpan={12} className="py-2 font-display text-base">
              {titulo}
            </th>
          </tr>
          <tr>
            {["SICOM", "SAP", "DIFERENCIAS"].map((g) => (
              <th key={g} colSpan={4} className="py-1.5 border-l border-primary-foreground/20">
                {g}
              </th>
            ))}
          </tr>
          <tr>
            {[0, 1, 2].flatMap((g) =>
              grupo.map((h) => (
                <th key={g + h} className="px-3 py-1.5 font-medium opacity-90">
                  {h}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {TARIFAS.map((t) => fila(t, sicom[t] ?? vacio, sap[t] ?? vacio))}
          {fila("TOTAL", tot(sicom), tot(sap), true)}
        </tbody>
      </table>
    </div>
  );
}
