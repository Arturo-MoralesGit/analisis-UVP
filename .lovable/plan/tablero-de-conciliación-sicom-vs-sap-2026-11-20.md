# Tablero de Conciliación SICOM vs SAP

Aplicación web para cargar archivos SAP (.txt) y SICOM, ver los tableros (ZONA + una por AGENCIA) y exportarlos a Excel con el mismo formato que `tablero.xlsx`.

## Pantallas
- **Encabezado**: Comisión Federal de Electricidad, División Centro Oriente, Zona Comercial Puebla Poniente, periodo editable (ej. "OCTUBRE 2026").
- **Módulo "Archivo SAP"**: zona para arrastrar/subir el .txt. Muestra cuántos registros se leyeron, cuántos se asignaron y una lista de cuentas no encontradas en el catálogo.
- **Módulo "Archivo SICOM"**: permite subir uno o varios archivos; cada uno se suma al acumulado.
- **Tableros**: pestañas "ZONA PUEBLA PONIENTE" y una por agencia. Cada una con las mismas columnas que el Excel: TARIFA | SICOM (Usuarios, Ventas, Productos, Precio medio) | SAP (mismas 4) | DIFERENCIAS (mismas 4) | Observación.
- Filas de tarifa fijas: 1, 1A–1F, DAC, 9CU, 9N, DB1, DB2, PDBT, GDBT, RABT, RAMT, APBT, APMT, GDMTH, GDMTO, DIST, DIT, UR, TOTAL.
- Botón **Exportar a Excel** y botón **Limpiar datos**.
- Estilo moderno y profesional: verde institucional oscuro con acentos claros, números alineados y formateados.

## Reglas de llenado SAP
- Se leen las filas con `|` debajo del encabezado; se ignoran líneas de título y separadores.
- Cuenta = columna LibrMay → se busca en el catálogo (primera pestaña "TOTAL DIVISIONES", columna Tarifa). Si no aparece, se busca en "Ajustes Nuevas".
- Clave ref.1 → VENTAS; Clave ref.2 → USUARIOS; Importe en ML → PRODUCTOS (el signo "-" final se interpreta como negativo; los totales se muestran en positivo, igual que el tablero de ejemplo).
- Agencia = campo Texto (ej. B5521). Se crea un tablero "AGENCIA B5521" si no existe; todo se acumula por agencia y tarifa. ZONA = suma de todas las agencias.
- Precio medio = Productos / Ventas.

## Reglas de llenado SICOM
- Agencia por código: 07A→B5520, 07B→B5521, 07C→B5522, 07D→B5523.
- Tarifa por la columna TFSB: PB→PDBT, GB→GDBT, AB→APMT, DS→DIST, DT→DIT, RB→RABT, RM→RAMT, GO→GDMTO, GH→GDMTH.
- Se suman todas las columnas tituladas "usuarios", "ventas" y "productos" respectivamente; se acumula en la agencia y en ZONA.
- Formatos aceptados: .xlsx, .xls, .csv y .txt.

## Exportación
- Un .xlsx con hoja principal igual al ejemplo: bloque ZONA arriba y bloques de cada agencia abajo, con títulos, celdas combinadas, colores y fórmulas (ZONA = suma de agencias, Precio medio y Diferencias como fórmulas).

## Pendiente de confirmar
- No tengo un ejemplo del archivo SICOM; programaré la lectura buscando los encabezados por nombre (agencia, TFSB, usuarios, ventas, productos). Si me compartes uno, ajusto la lectura.
- Los nombres de agencia (ej. "AGENCIA NORTE" en el ejemplo) se mostrarán como "AGENCIA B5521"; se puede agregar el nombre descriptivo después.

## Detalles técnicos
- Todo se procesa en el navegador (sin servidor ni base de datos); el catálogo se incluye en la app como JSON generado de `catalogos.xlsx`.
- Librerías: `xlsx` (lectura SICOM) y `exceljs` (exportación con estilos y fórmulas).
- Módulos: `lib/sap-parser.ts`, `lib/sicom-parser.ts`, `lib/catalog.ts`, `lib/export.ts`, estado en un store React; pruebas unitarias para el parseo SAP (signo, mapeo cuenta→tarifa, acumulado por agencia) y mapeos SICOM.
