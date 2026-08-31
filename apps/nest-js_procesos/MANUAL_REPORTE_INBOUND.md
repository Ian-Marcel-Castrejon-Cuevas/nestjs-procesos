# Manual de Funcionamiento — Reporte Inbound (envio-inbound y reporte)

Fecha: 2026-08-13

## Propósito

Describir detalladamente el funcionamiento, despliegue y operación de los procesos relacionados con la generación y envío de reportes Inbound (`envio-inbound`) y el procesamiento/obtención de datos (`reporte`) en el proyecto NestJS.

## Alcance

- Incluye arquitectura, responsabilidades de los módulos `reporte` y `envio-inbound`.
- Cobertura de flujos de obtención (portal Excel + SQL), normalización, deduplicación, persistencia en DB destino, generación de Excel y ZIP, guardado en red y envío por correo.
- Incluye endpoints, variables de configuración, despliegue y troubleshooting básico.

## Estructura y archivos clave

- Módulos y servicios:
  - `apps/nest-js_procesos/src/reporte/reporte.service.ts` — extracción, normalización y carga de datos.
  - `apps/nest-js_procesos/src/envio-inbound/envio-inbound.service.ts` — generación Excel/ZIP, guardado en red y envío SMTP.
  - `apps/nest-js_procesos/src/envio-inbound/envio-inbound.controller.ts` — endpoints de invocación manual y utilidades.
  - `apps/nest-js_procesos/src/envio-inbound/entities/llamada-inbound.entity.ts` — entidad que mapea `Reporte_Inbound`.
  - `apps/nest-js_procesos/src/envio-inbound/utils/excel-helper.ts` — formato y construcción del Excel.
  - `apps/nest-js_procesos/src/envio-inbound/utils/chart-api-helper.ts` — generación de gráficos (QuickChart).

## Resumen de responsabilidades

- `reporte.service.ts`:
  - Autentica y descarga archivos Excel desde portal Nuxiba.
  - Consulta tabla origen SQL (`RepInCallsDetail`) en ventana horaria configurada.
  - Normaliza campos (fechas, hora, DID, IDs, textos) y corrige errores comunes.
  - Combina datos Excel + SQL, elimina duplicados por `ID_LLAMADA` y escribe en la tabla destino `reporte_inbound`.
  - Implementa reintentos (10 intentos por defecto) con espera entre ellos.

- `envio-inbound.service.ts`:
  - Consulta `Reporte_Inbound` por rango de fecha y filtra (excluye HERRAMIENTA like '%OTRO%').
  - Transforma registros, genera un Excel con formato y gráficas, compacta a ZIP y guarda en ruta de red.
  - Envía correo con adjunto ZIP usando `nodemailer`.
  - Ejecuta job cron diario a las 08:00 (hora Ciudad de México).

## Flujos detallados

1. Extracción (módulo `reporte`):
   - Autenticación portal Nuxiba (login POST con manejo de token CSRF y cookies).
   - `obtenerUrlDescargaExcel(fecha)` busca y corrige enlaces encontrados en HTML.
   - `descargarExcelDesdePortalConReintentos(fecha)` descarga con retries y validaciones de tamaño.
   - `obtenerDatosSQL(fecha)` consulta `RepInCallsDetail` en el origen SQL y transforma filas.
   - `combinarYLimpiarDuplicados(excel, sql)` une ambas fuentes y quita duplicados por `ID_LLAMADA`.
   - `insertarDatosEnTabla(datos)` inserta en `dbo.reporte_inbound` y corrige textos comunes.

2. Generación/Envío (módulo `envio-inbound`):
   - Consulta registros entre `YYYY-MM-DDT00:00:00` y `YYYY-MM-DDT23:59:59`.
   - `ExcelHelper.generarReporteExcel()` crea libro con resumen por área/herramienta y estilos.
   - `ChartApiHelper` genera imágenes de gráficas (vía QuickChart) usadas en el Excel.
   - Archiva: `Repo_INB_YYYY-MM-DD.xlsx` y `Repo_INB_YYYY-MM-DD.zip`.
   - Guarda en ruta de red configurada en `NETWORK_REPORTE_INB_`.
   - Envía correo configurado (`SMTP_HOST2`, `SMTP_PORT2`, `SMTP_FROM2`, `SMTP_TO2`).

## Endpoints relevantes

- Envio Inbound (controlador):
  - `POST /envio-inbound/generar?fecha=YYYY-MM-DD` — genera y envía reporte para la fecha indicada; si no se pasa `fecha`, usa ayer (zona America/Mexico_City).
  - `GET /envio-inbound/probar/:fecha` — prueba y devuelve resultado inmediato.
  - `GET /envio-inbound/probar-ayer` — prueba para ayer.
  - `GET /envio-inbound/fecha-actual` — devuelve fecha actual (utilidad).

- Reporte (service methods expuestos internamente o vía cron):
  - `procesarReporteAyer()` / `procesarFechaEspecifica(fechaStr)` — procesos con reintentos.
  - Utilidades: `probarConexionDestino()`, `probarConexionOrigen()`, `probarTablaOrigen()`, `probarAutenticacionPortal()`, `probarDescargaExcel(fecha)`, `listarArchivosDisponibles()`.

## Esquema de la tabla objetivo (resumen)

Entidad `LlamadaInbound` mapea `Reporte_Inbound` con campos clave:

- `ID_LLAMADA` (PK, varchar)
- `FECHA` (date)
- `HORA`, `CAMPAÑA`, `ESTADO_DE_LLAMADA`, `ESTATUS`, `AREA`, `HERRAMIENTA`, `DID`, `ORIGEN`, `TIEMPO`, `ID_GRABACION`

## Variables de entorno necesarias

- Base de datos destino:
  - `DB_USER`, `DB_PASSWORD`, `DB_SERVER`, `DB_DATABASE`, `DB_PORT`
- Base de datos origen (opcional; si no se indican, conserva los valores históricos):
  - `DB_ORIGEN_USER`, `DB_ORIGEN_PASSWORD`, `DB_ORIGEN_SERVER`, `DB_ORIGEN_DATABASE`, `DB_ORIGEN_PORT`
  - `DB_ORIGEN_SCHEMA` (por defecto `dbo`), `DB_ORIGEN_TABLE` (por defecto `RepInCallsDetail`)
- Portal Nuxiba:
  - `PORTAL_BASE_URL`, `PORTAL_USER`, `PORTAL_PASSWORD`
- SMTP / Envío:
  - `SMTP_HOST2`, `SMTP_PORT2`, `SMTP_FROM2`, `SMTP_TO2`, `SMTP_CC2` (opcional)
- Ruta de red para reportes:
  - `NETWORK_REPORTE_INB_`

> Nota: la configuración de la DB origen admite variables `DB_ORIGEN_*`. Si `RepInCallsDetail` pertenece a otra base, esquema o tabla, ajústalas antes de ejecutar el proceso.

## Cron / Programadores

- `reporte.service` registra una tarea cron `00 07 * * *` para ejecutar `procesarReporteAyerConReintentos` a las 07:00.
- `envio-inbound.service` usa decorator `@Cron('0 8 * * *', timeZone: 'America/Mexico_City')` para enviar a las 08:00.

## Instrucciones para ejecutar localmente (rápido)

1. Crear `.env` con las variables indicadas.
2. Instalar dependencias e iniciar servicio (desde la raíz del workspace o la app correspondiente):

```bash
npm install
npm run start:dev
```

3. Pruebas manuales (ejemplos):

- Generar y enviar reporte manualmente:

```bash
# Usar curl o Postman
curl -X POST "http://localhost:3000/envio-inbound/generar?fecha=2026-08-12"
```

- Verificar conexión destino y origen (si existen endpoints HTTP o usar métodos exportados desde REPL).

## Manejo de errores y recomendaciones de troubleshooting

- Descarga Excel fallida:
  - Verificar `PORTAL_BASE_URL` y credenciales.
  - Ejecutar `listarArchivosDisponibles()` para comprobar qué archivos aparecen.
  - Revisar que la página del portal no haya cambiado significativamente su HTML (el scraping es frágil).

- Inserciones en DB fallan:
  - Ejecutar `probarConexionDestino()` y `probarTablaOrigen()` para diagnosticar.
  - Verificar que las variables `DB_*` apunten al servidor correcto.

- Guardado en red falla:
  - Comprobar `NETWORK_REPORTE_INB_` y permisos del usuario que ejecuta la aplicación.
  - Revisar logs de `guardarArchivoEnRed` (muestra la ruta intentada y error).

- Envío de correo falla:
  - Verificar conectividad con `SMTP_HOST2` y `SMTP_PORT2`.
  - Probar credenciales SMTP y revisar bloqueos o autenticación requerida.

## Reglas de negocio observadas

- Solo se consideran áreas permitidas en el Excel: `BBVA, GMF, TOYOTA, AT&T`.
- Se filtran herramientas que incluyan `OTRO`.
- Orden de áreas para reporte: `AT&T, BBVA, BBVA_REF, GMF, TOYOTA`.

## Sugerencias de mejora

- Externalizar DB origen (actualmente está codificada en `reporte.service.ts`).
- Añadir configuración para áreas permitidas y filtros (archivo JSON o variables).
- Implementar API oficial del portal (si existe) en lugar de scraping HTML.
- Añadir métricas/alertas y pruebas automatizadas para parsing y deduplicación.
- Añadir validación y sanitización más robusta en puntos de inserción.

## Comprobaciones útiles (comandos)

```bash
# Instalar dependencias
npm install
# Ejecutar en modo desarrollo
npm run start:dev
# Llamada manual (ejemplo)
curl -X POST "http://localhost:3000/envio-inbound/generar?fecha=2026-08-12"
```

## Archivos de referencia

- `apps/nest-js_procesos/src/reporte/reporte.service.ts`
- `apps/nest-js_procesos/src/envio-inbound/envio-inbound.service.ts`
- `apps/nest-js_procesos/src/envio-inbound/envio-inbound.controller.ts`
- `apps/nest-js_procesos/src/envio-inbound/entities/llamada-inbound.entity.ts`
- `apps/nest-js_procesos/src/envio-inbound/utils/excel-helper.ts`
- `apps/nest-js_procesos/src/envio-inbound/utils/chart-api-helper.ts`

---
