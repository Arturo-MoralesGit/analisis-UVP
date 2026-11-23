# Conciliación UVP SICOM vs SAP

Tablero web para cargar archivos de SAP y SICOM, conciliar ventas por agencia y tarifa, consultar el detalle de registros y exportar resultados a Excel. El procesamiento se realiza en el navegador.

## Desarrollo local

Requiere Node.js 22 y npm.

```sh
npm ci
npm run dev
```

Para validar la aplicación:

```sh
npm test
npm run build
```

## Publicación en GitHub Pages

El workflow de GitHub Actions en `.github/workflows/deploy-pages.yml` genera y publica la versión estática al hacer push a `main`.

En el repositorio, abre **Settings → Pages** y selecciona **GitHub Actions** como *Build and deployment source*. El sitio se publica en:

`https://arturo-moralesgit.github.io/analisis-UVP/`

El build activa el prerender de la página principal y configura la base `/analisis-UVP/`, necesaria para los recursos y el enrutamiento en un sitio de proyecto de GitHub Pages.
