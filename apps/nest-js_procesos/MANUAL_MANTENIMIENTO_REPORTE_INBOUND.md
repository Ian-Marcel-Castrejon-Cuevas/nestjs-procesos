# Manual de Mantenimiento — Reporte Inbound (envio-inbound y reporte)

Fecha: 2026-08-13

## 1. Propósito

Este documento provee instrucciones de mantenimiento operativo y técnico para los módulos `envio-inbound` y `reporte` del proyecto `nest-js_procesos`. Contiene procedimientos de verificación, ejecución, resolución de incidentes, pasos de despliegue y recomendaciones para cambios y actualizaciones.

## 2. Alcance

- Mantenimiento de los procesos que:
  - obtienen y normalizan datos desde portal Nuxiba (Excel) y base SQL origen (`reporte`);
  - combinan, deduplican y cargan los datos a la tabla destino (`reporte_inbound`);
  - generan archivos Excel/ZIP, guardan en ruta de red y envían correo con el reporte (`envio-inbound`).
- No cubre módulos fuera de `reporte` o `envio-inbound`.

## 3. Documentos y código relevantes

- `apps/nest-js_procesos/src/reporte/reporte.service.ts`
- `apps/nest-js_procesos/src/envio-inbound/envio-inbound.service.ts`
- `apps/nest-js_procesos/src/envio-inbound/envio-inbound.controller.ts`
- `apps/nest-js_procesos/src/envio-inbound/entities/llamada-inbound.entity.ts`
- `apps/nest-js_procesos/src/envio-inbound/utils/excel-helper.ts`
- `apps/nest-js_procesos/src/envio-inbound/utils/chart-api-helper.ts`

## 4. Responsabilidades operativas

- Mantener las credenciales actualizadas en el `.env` (portal, DB destino, SMTP).
- Verificar acceso de la aplicación a la ruta de red `NETWORK_REPORTE_INB_` y permisos de escritura.
- Monitorear logs diarios para detectar fallos en la descarga, inserción o envío.
- Aplicar actualizaciones de dependencias con pruebas en staging antes de producción.

## 5. Requisitos previos para intervención

- Acceso al repositorio y permisos para modificar/crear archivos.
- Credenciales para:
  - Base de datos destino (`DB_*` variables).
  - Portal Nuxiba (`PORTAL_BASE_URL`, `PORTAL_USER`, `PORTAL_PASSWORD`).
  - SMTP (`SMTP_HOST2`, `SMTP_PORT2`, `SMTP_FROM2`, `SMTP_TO2`).
  - Ruta de red (`NETWORK_REPORTE_INB_`).
- Entorno Node.js compatible (ver `package.json`).
- Herramientas: `curl`, `telnet` (para pruebas SMTP), cliente SQL para pruebas directas.

## 6. Variables de entorno importantes

- DB destino: `DB_USER`, `DB_PASSWORD`, `DB_SERVER`, `DB_DATABASE`, `DB_PORT`
- Portal Nuxiba: `PORTAL_BASE_URL`, `PORTAL_USER`, `PORTAL_PASSWORD`
- SMTP: `SMTP_HOST2`, `SMTP_PORT2`, `SMTP_FROM2`, `SMTP_TO2`, `SMTP_CC2`
- Ruta red: `NETWORK_REPORTE_INB_`

> Recomendación: usar un gestor de secretos (KeyVault, AWS Secrets Manager) o variables de entorno en el orquestador (Kubernetes Secrets) en vez de `.env` en producción.

## 7. Procedimientos operativos

### 7.1. Inicio rápido (verificación básica)

1. Ver logs del servicio (stdout/systemd/pm2): buscar errores relacionados con `reporte` o `envio-inbound`.
2. Comprobar conectividad DB destino:

```bash
# desde la máquina que ejecuta la app
# si usa sqlcmd o mssql-cli
# ejemplo con telnet para puerto MS SQL
telnet $DB_SERVER $DB_PORT
```

3. Probar autenticación portal Nuxiba (método expuesto):
   - Llamar a `probarAutenticacionPortal()` o usar endpoint si existe.
4. Probar envío SMTP:

```bash
# ejemplo con swaks si está disponible
swaks --to $SMTP_TO2 --from $SMTP_FROM2 --server $SMTP_HOST2:$SMTP_PORT2
```

5. Verificar espacio y permisos en `NETWORK_REPORTE_INB_`:

```bash
# desde la máquina donde corre la app
ls -la "/ruta/de/red"
```

### 7.2. Generar reporte manual (runbook)

- Para generar y enviar inmediatamente (controlador HTTP):

```bash
curl -X POST "http://localhost:3000/envio-inbound/generar?fecha=YYYY-MM-DD"
```

- Para procesar datos (reporte) manualmente ejecutar método (si existe endpoint) o invocar `procesarFechaEspecifica('DD-MM-YYYY')` desde un script/REPL.

### 7.3. Reintentos y comportamiento esperado

- `reporte` implementa hasta 10 reintentos con espera de 60s entre intentos para descarga e inserción.
- `envio-inbound` no reintenta envío SMTP automáticamente; errores quedan en logs para intervención.

## 8. Mantenimiento periódico

- Diario:
  - Ver logs de la ejecución programada (07:00 y 08:00) y confirmar envíos.
  - Verificar que los archivos `Repo_INB_YYYY-MM-DD.zip` aparezcan en la ruta de red.
- Semanal:
  - Ejecutar `listarArchivosDisponibles()` para comprobar disponibilidad en portal Nuxiba.
  - Revisar tamaño y consistencia de archivos generados.
- Mensual:
  - Verificar integridad de la tabla `reporte_inbound` (registros por día vs. expectativa).
  - Actualizar dependencias con pruebas en staging.

## 9. Troubleshooting / Runbooks (paso a paso)

Cada sección indica el síntoma, causa probable y pasos de resolución.

### 9.1. Síntoma: No se descarga el Excel del portal

Causas probables:
- Cambios en la página HTML del portal (selectores rotos).
- Credenciales inválidas o sesión expirada.
- Conectividad a `PORTAL_BASE_URL` bloqueada.

Pasos:
1. Ver logs en `reporte.service` para mensajes de error específicos (token CSRF, 401, 403).
2. Acceder manualmente a `PORTAL_BASE_URL` desde la máquina ejecutora.
3. Ejecutar `probarAutenticacionPortal()` para forzar login y comprobar cookies.
4. Si el HTML cambió, abrir la página en navegador, inspeccionar el elemento de descarga y adaptar el regex/selectores en `obtenerUrlDescargaExcel()`.
5. Registrar cambios y planificar un parche de código.

### 9.2. Síntoma: Archivos XLSX descargados vacíos o corruptos

Causas probables:
- Descarga incompleta o timeout.
- Formato de archivo distinto (xlsx vs xls) o protección.

Pasos:
1. Revisar `descargarExcelDesdePortalConReintentos` logs (tamaño en bytes).
2. Descarga manual de la URL y abrir en Excel.
3. Si es protegido, coordinar con soporte del portal para habilitar descarga sin protección.

### 9.3. Síntoma: Inserciones en DB destino fallan

Causas probables:
- Esquema de tabla cambiado.
- Constraint/limite violado (string demasiado largo, NULL no permitido).
- Conexión DB inválida.

Pasos:
1. Ejecutar `probarConexionDestino()`.
2. Revisar esquema `dbo.reporte_inbound` y comparar columnas con `LlamadaInbound`.
3. Revisar logs de errores por filas específicas y adaptar transformaciones en `transformarDatosExcel` o `transformarDatos`.
4. Si es volumen alto, considerar inserciones por lotes.

### 9.4. Síntoma: No se guarda archivo en ruta de red

Causas probables:
- Ruta `NETWORK_REPORTE_INB_` incorrecta o inaccesible.
- Permisos del usuario que ejecuta la app no permiten escritura.

Pasos:
1. Ver el log que `guardarArchivoEnRed` imprime con la ruta intentada.
2. Desde la máquina de la app, intentar escribir un archivo en la ruta con el mismo usuario.
3. Ajustar permisos NTFS/SMB o ejecutar la app con credenciales con acceso.

### 9.5. Síntoma: Correo no enviado

Causas probables:
- SMTP inaccesible o requiere autenticación/SSL que no está configurada.
- Remitente no autorizado o bloqueo por policy

Pasos:
1. Revisar logs de `nodemailer` y stacktrace.
2. Probar conexión SMTP con `telnet` o `swaks`.
3. Configurar `secure` y `auth` si el servidor SMTP lo requiere (actualmente `secure: false` y `ignoreTLS: true`).
4. Ajustar `initTransporter()` para soportar autenticación si es necesaria.

## 10. Actualizaciones y despliegues

### 10.1. Estrategia recomendada

- Usar staging idéntico a producción para pruebas.
- Crear un release branch y PR con cambios; ejecutar pruebas y despliegue automatizado.
- Verificar cron jobs y variables `.env` en target antes de activar.

### 10.2. Pasos para desplegar una actualización menor

1. Crear branch `hotfix/reporte-<descripción>`.
2. Actualizar código y tests.
3. Ejecutar `npm install` y pruebas locales.
4. Abrir PR y solicitar revisión.
5. Merge a `main` y desplegar a staging.
6. Monitorear logs y luego promover a producción.

### 10.3. Rollback

- Mantener artefactos previos disponibles; si el despliegue falla, restaurar la versión anterior del contenedor o release y revertir la migración de DB si aplica.

## 11. Pruebas y CI

- Añadir pruebas unitarias para:
  - Parsing/normalización de fechas en `reporte`.
  - Deduplicación y reglas de combinación.
  - Generación de Excel (compruebe filas y encabezados clave).
- Integración: simular descarga con un fixture (HTML y XLSX) y validar que la pipeline produce registros correctos.
- CI: ejecutar `npm test` y linters en PRs.

## 12. Seguridad

- No exponer credenciales en el repositorio.
- Restringir acceso a la ruta de red y al servidor que ejecuta la app.
- Validar datos entrantes para evitar inyección SQL (el código usa parámetros en queries, seguir esa práctica).

## 13. Métricas y alertas recomendadas

- Contador de ejecuciones exitosas/fallidas (por fecha)
- Alertas: fallos en descarga > 3 intentos seguidos, fallos en inserción DB, error SMTP
- Monitorizar tamaño de archivos generados y tiempo de ejecución de los jobs.

## 14. Cambio de alcance / mejoras futuras

- Externalizar DB origen a variables de entorno.
- Añadir API en portal Nuxiba para evitar scraping.
- Parametrizar filtros de áreas y herramientas.
- Implementar observabilidad (Prometheus + Grafana) y trazabilidad (OpenTelemetry).

## 15. Contactos y propietarios

- Propietario funcional: Ian (autor en comentarios)
- Equipo de infraestructura: (agregar responsables locales o emails aquí)

## 16. Registro de cambios

- 2026-08-13: Creación del manual de mantenimiento inicial.

---

Fin del manual de mantenimiento.
