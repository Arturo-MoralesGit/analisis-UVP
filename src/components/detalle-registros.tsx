import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { nombreAgencia, type Registro } from "@/lib/tablero";

export type SeleccionDetalle = {
  agencia: string;
  tarifa: string;
  origen: "SAP" | "SICOM" | "DIFERENCIAS";
};
const numero = (n: number, decimales = 0) =>
  n.toLocaleString("es-MX", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

export function DetalleRegistros({
  seleccion,
  registros,
  onClose,
}: {
  seleccion: SeleccionDetalle | null;
  registros: Registro[];
  onClose: () => void;
}) {
  return (
    <Dialog
      open={seleccion !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="w-[calc(100%-2rem)] max-w-6xl max-h-[85dvh] flex flex-col overflow-hidden">
        <DialogHeader className="pr-6 shrink-0">
          <DialogTitle className="leading-normal">
            Registros {seleccion?.origen} ·{" "}
            {seleccion?.tarifa === "TOTAL"
              ? "Todas las tarifas"
              : `Tarifa ${seleccion?.tarifa ?? ""}`}
          </DialogTitle>
          <DialogDescription>
            {seleccion?.agencia === "ZONA"
              ? "ZONA PUEBLA PONIENTE"
              : nombreAgencia(seleccion?.agencia ?? "")}{" "}
            · {registros.length} registros
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-auto min-h-0">
          {registros.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No hay registros cargados para esta fila.
            </p>
          ) : (
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-muted text-left sticky top-0 z-10">
                <tr>
                  {[
                    "Origen",
                    "Archivo",
                    "Fila",
                    "Agencia",
                    "Tarifa",
                    "Usuarios",
                    "Ventas",
                    "Productos",
                    "Registro original",
                  ].map((h) => (
                    <th key={h} className="px-3 py-2 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registros.map((r, i) => (
                  <tr key={i} className="border-b border-border even:bg-muted/40 align-top">
                    <td className="px-3 py-2 font-medium">{r.origen}</td>
                    <td className="px-3 py-2">{r.archivo}</td>
                    <td className="px-3 py-2 tabular-nums">{r.fila}</td>
                    <td className="px-3 py-2">{nombreAgencia(r.agencia)}</td>
                    <td className="px-3 py-2">{r.tarifa}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{numero(r.usuarios)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{numero(r.ventas)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{numero(r.productos, 2)}</td>
                    <td className="px-3 py-2">
                      <details>
                        <summary className="cursor-pointer text-primary">Ver campos</summary>
                        <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
                          {r.campos.map((c, j) => (
                            <div key={j} className="contents">
                              <dt className="font-medium">{c.nombre}</dt>
                              <dd>{c.valor || "–"}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
