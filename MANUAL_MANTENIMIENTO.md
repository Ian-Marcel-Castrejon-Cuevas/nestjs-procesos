# Manual de mantenimiento

## Sistema de verificación EDOMEX, Botar Carven, Leyendas, Status y Devoluciones

**Versión:** 1.0  
**Fecha:** 21/08/2026  
**Alcance:** `nestjs-procesos` y `proyecto-one`  
**Nivel:** Operación técnica, soporte y mantenimiento

---

## 1. Propósito

Este manual describe cómo mantener disponible, seguro y operable el sistema que contiene los procesos de:

- Verificación EDOMEX.
- Botar Carven.
- Procesamiento de Leyendas.
- Cambio de Status.
- Procesamiento de devoluciones.

El documento está dirigido a personal de soporte, administradores de aplicaciones, responsables de bases de datos y operadores con permisos de mantenimiento.

El manual se limita a estas superficies:

### Backend `nestjs-procesos`

- `src/database`.
- `src/verificacion`.
- `src/leyendas`.
- `src/status`.
- `src/devoluciones`.
- Registro de modulos y arranque relacionado.

### Frontend `proyecto-one`

- `src/App.jsx`.
- `src/components/Leyendas.jsx`.
- `src/components/Status.jsx`.
- `src/components/Devoluciones.jsx`.

No se documentan aquí otros procesos del repositorio, aunque existan en la misma aplicación.

---

## 2. Resumen técnico de la arquitectura

```text
Navegador
   |
   | HTTP / JSON / multipart-form-data
   v
proyecto-one (React + Vite)
   |
  | debe apuntar al endpoint definido por el entorno
   v
nestjs-procesos (NestJS)
   |
  +--> PostgreSQL: Verificación, Botar Carven, Status, Devoluciones
   |
   +--> Sistema de archivos: Leyendas y temporales
   |
  +--> MSSQL/TypeORM: configuración de otros módulos del proyecto
```

### 2.1 Componentes de frontend

| Funcion      | Ruta                 | Archivo principal                              |
| ------------ | -------------------- | ---------------------------------------------- |
| Verificación | `/` y `/proyect-one` | `proyecto-one/src/App.jsx`                     |
| Leyendas     | `/leyendas`          | `proyecto-one/src/components/Leyendas.jsx`     |
| Status       | `/status`            | `proyecto-one/src/components/Status.jsx`       |
| Devoluciones | `/devoluciones`      | `proyecto-one/src/components/Devoluciones.jsx` |

### 2.2 Componentes de backend

| Funcion      | Controller                   | Service                   | Persistencia        |
| ------------ | ---------------------------- | ------------------------- | ------------------- |
| Verificación | `verificacion.controller.ts` | `verificacion.service.ts` | PostgreSQL          |
| Botar Carven | `verificacion.controller.ts` | `verificacion.service.ts` | PostgreSQL          |
| Leyendas     | `leyendas.controller.ts`     | `leyendas.service.ts`     | Archivos temporales |
| Status       | `status.controller.ts`       | `status.service.ts`       | PostgreSQL          |
| Devoluciones | `devoluciones.controller.ts` | `devoluciones.service.ts` | PostgreSQL          |

---

## 3. Inventario de operaciones y nivel de riesgo

| Operación    | Método                                 |  Riesgo | Acción de mantenimiento                   |
| ------------ | -------------------------------------- | ------: | ----------------------------------------- |
| Verificación | `POST /verificacion/verificar`         |   Medio | Revisar consultas, índices y conectividad |
| Botar Carven | `DELETE /verificacion/borrar-ingresos` | Crítico | Respaldo y autorización antes de ejecutar |
| Leyendas     | `POST /leyendas/procesar` o navegador  |   Medio | Vigilar disco, temporales y memoria       |
| Status       | `POST /status/cambiar`                 |    Alto | Validar catálogo, respaldo y resultados   |
| Devoluciones | `POST /devoluciones/procesar`          |    Alto | Validar fecha, identificador y resultado  |

`Botar Carven`, Status y Devoluciones modifican datos o eliminan registros. No deben probarse contra producción sin una ventana de mantenimiento, respaldo y aprobación.

---

## 4. Requisitos de infraestructura

### 4.1 Backend

- Node.js compatible con las dependencias instaladas.
- Acceso de red al servidor PostgreSQL.
- Permisos de lectura y escritura en `temp`.
- Puerto TCP disponible para NestJS.
- Espacio en disco suficiente para archivos Excel temporales.
- Acceso de lectura al archivo `.env` del backend.

### 4.2 Frontend

- Navegador moderno con soporte para File API, Blob y descarga de archivos.
- Memoria suficiente para abrir archivos Excel grandes.
- Conectividad desde el navegador a la IP y puerto configurados en `fetch`.
- Permiso del navegador para descargar uno o varios archivos.

### 4.3 Base de datos

El módulo `database` crea un pool compartido de PostgreSQL con estas variables obligatorias:

```dotenv
PG_HOST=servidor
PG_PORT=5432
PG_USER=usuario
PG_PASSWORD=contrasena
PG_DATABASE=base
```

Si falta una variable, el backend falla durante el arranque con `Faltan variables de entorno para PostgreSQL`.

La aplicación también carga una conexión MSSQL mediante TypeORM con `DB_SERVER`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_DATABASE`. Esa configuración pertenece a otros módulos, pero puede impedir que el módulo raíz inicie correctamente.

---

## 5. Gestión de configuración

### 5.1 Reglas del archivo `.env`

1. Mantener una copia protegida del archivo de configuración.
2. No subir `.env` a Git.
3. No pegar contrasenas en tickets, capturas o chats.
4. Registrar cambios de configuración con fecha, responsable y motivo.
5. Reiniciar el backend después de cambiar variables.
6. Probar conectividad después de cada cambio.

### 5.2 Puerto y URL del frontend

`main.ts` utiliza `process.env.PORT` y, si no existe, `3001`.

Las pantallas revisadas tienen llamadas fijas a:

```text
http://localhost:3001
```

Este desajuste debe resolverse antes de desplegar. Las alternativas son:

- Definir `PORT=3002` para NestJS.
- Configurar un proxy en `3002` hacia el puerto real.
- Cambiar las URLs del frontend a una variable de entorno o al endpoint correcto.

### 5.3 Configuración recomendada para entornos

Separar, como minimo:

```text
.env.desarrollo
.env.pruebas
.env.produccion
```

Cada entorno debe tener:

- Host y base de datos propios.
- Usuario con permisos minimos.
- Puerto propio o proxy documentado.
- Carpeta temporal propia.
- Politica de respaldo definida.

---

## 6. Arranque y parada controlada

### 6.1 Arranque de desarrollo

En `nestjs-procesos`:

```powershell
npm install
npm run start:dev
```

En `proyecto-one`:

```powershell
npm install
npm run dev
```

### 6.2 Validación después del arranque

1. Confirmar que NestJS no reporte variables PostgreSQL faltantes.
2. Confirmar el puerto escuchando.
3. Ejecutar:

```text
GET /verificacion
```

Respuesta esperada:

```json
{ "mensaje": "Servidor backend activo" }
```

4. Abrir la ruta principal del frontend.
5. Probar una consulta de verificación con un registro controlado.
6. Revisar la consola del navegador y la consola de NestJS.

### 6.3 Producción

Compilar el backend:

```powershell
npm run build
```

Ejecutar:

```powershell
npm run start:prod
```

Compilar el frontend:

```powershell
npm run build
```

El directorio de salida de Vite debe publicarse mediante el servidor web definido por la infraestructura. Confirmar que las rutas SPA (`/leyendas`, `/status`, `/devoluciones`) redirijan a `index.html` cuando se acceden directamente.

### 6.4 Parada

Antes de detener el backend:

- Confirmar que no haya Devoluciones o cambios de Status en progreso.
- Confirmar que no existan descargas de Leyendas pendientes.
- Avisar a los operadores.
- Registrar hora y motivo.

No finalizar el proceso de forma forzada durante un `UPDATE`, `DELETE` o escritura de archivos si puede evitarse.

---

## 7. Monitoreo diario

### 7.1 Lista de verificación diaria

- [ ] Backend responde en `/verificacion`.
- [ ] Frontend carga correctamente.
- [ ] PostgreSQL acepta conexiones.
- [ ] Existe espacio libre en disco.
- [ ] La carpeta `temp` puede crear y eliminar subcarpetas.
- [ ] No hay errores repetidos en logs.
- [ ] No existen sesiones temporales antiguas acumuladas.
- [ ] El puerto usado por frontend y backend coincide.
- [ ] Los respaldos recientes estan disponibles.

### 7.2 Indicadores utiles

Registrar diariamente:

- Cantidad de solicitudes por operación.
- Cantidad de registros enviados y actualizados.
- Cantidad de no encontrados.
- Tiempo de respuesta de verificación.
- Tiempo de procesamiento de Leyendas.
- Errores HTTP 400 y 500.
- Espacio usado por `temp`.
- Estado del pool PostgreSQL.

### 7.3 Alertas recomendadas

Generar alerta cuando:

- `/verificacion` no responda.
- El porcentaje de errores 500 aumente.
- PostgreSQL rechace conexiones.
- `temp` supere un umbral de espacio.
- Haya demasiadas sesiones de Leyendas activas.
- Una operación de Status o Devoluciones actualice cero registros de forma inesperada.
- Se ejecute Botar Carven fuera de la ventana autorizada.

---

## 8. Respaldos y recuperación

### 8.1 Antes de cambios destructivos

Antes de ejecutar Botar Carven, Status masivo o Devoluciones masivas:

1. Exportar los registros que serán afectados.
2. Guardar el archivo original enviado por el operador.
3. Registrar el status y las fechas anteriores si se requiere reversibilidad.
4. Crear un respaldo de la base o snapshot aprobado.
5. Registrar operador, fecha, hora y motivo.
6. Ejecutar primero una muestra controlada en pruebas.

### 8.2 Botar Carven

La consulta ejecutada es:

```sql
DELETE FROM tbingresos
WHERE infingreso >= CURRENT_DATE;
```

Antes de ejecutarla, consultar la cantidad candidata:

```sql
SELECT COUNT(*) AS candidatos
FROM tbingresos
WHERE infingreso >= CURRENT_DATE;
```

Guardar una copia de los datos que seran eliminados, de acuerdo con la politica de la base de datos. La consulta no recibe una lista de carven y puede afectar muchos registros.

### 8.3 Status

Antes de cambiar status, guardar los valores actuales:

```sql
SELECT DEACVEDEUDOR, STNCVESTATUS
FROM TBDEUDOR
WHERE DEACVEDEUDOR IN ('CARVEN_1', 'CARVEN_2');
```

La lista debe conservarse junto con el nuevo status solicitado.

### 8.4 Devoluciones

Antes de procesar, consultar los valores actuales:

```sql
SELECT DEACVEDEUDOR, DEANUMCREDITO,
       STNCVESTATUS, DEFFECDEVOLUCION
FROM TBDEUDOR
WHERE DEACVEDEUDOR IN ('CARVEN_1', 'CARVEN_2');
```

Cuando la búsqueda sea por número de crédito, usar `DEANUMCREDITO` en el filtro de respaldo.

### 8.5 Recuperación

La recuperación debe hacerse desde el respaldo autorizado, no improvisando un `UPDATE` inverso. Un status previo o una fecha previa pueden ser nulos y no deben sustituirse por valores inventados.

---

## 9. Mantenimiento del módulo de base de datos

### 9.1 Responsabilidad

`database.module.ts`:

- Carga variables de entorno.
- Valida que existan las cinco variables de PostgreSQL.
- Crea un `Pool` de `pg`.
- Expone el pool con el token `PG_POOL`.

Verificación, Status y Devoluciones reciben ese pool mediante inyección.

### 9.2 Mantenimiento preventivo

- Validar que el usuario tenga solo permisos requeridos.
- Revisar conexiones abiertas y sesiones inactivas.
- Revisar crecimiento de tablas.
- Revisar índices de las columnas utilizadas en filtros.
- Verificar que los tipos y nombres de columnas no hayan cambiado.
- Probar una consulta de lectura antes de una operación de escritura.
- Mantener `synchronize: false` en producción.

Columnas criticas:

```text
TBDEUDOR.DEACVEDEUDOR
TBDEUDOR.DEANUMCREDITO
TBDEUDOR.STNCVESTATUS
TBDEUDOR.DEFFECDEVOLUCION
TBINGRESOS.INFINGRESO
TBDIRECCIONES.DEACVEDEUDOR
TBDIRECCIONES.DIACODPOSTAL
TBMUNICIPIOS.CPACVEMUNICIPIO
TBESTADOS.CPACVEESTADO
```

### 9.3 Prueba de conectividad

La prueba mas segura es una consulta de lectura ejecutada con un identificador controlado. No usar Botar Carven para validar la conexion.

Validar tambien:

- DNS o IP del host.
- Puerto PostgreSQL.
- Usuario y password.
- Nombre de la base.
- Firewall.
- Certificados o reglas de red si aplican.

### 9.4 Sintomas de problema de pool

- El backend inicia pero todas las operaciones devuelven 500.
- Las primeras solicitudes funcionan y luego fallan.
- Errores de timeout o conexiones agotadas.
- Latencia alta en operaciones simples.

Acciones:

1. Revisar logs de NestJS.
2. Revisar logs de PostgreSQL.
3. Confirmar conectividad desde el servidor de NestJS.
4. Revisar cantidad de conexiones del usuario.
5. Reiniciar solo si se descarta una operación de escritura activa.
6. Escalar al administrador de base de datos si hay bloqueos o limites.

---

## 10. Mantenimiento de verificación

### 10.1 Flujo técnico

`POST /verificacion/verificar` recibe:

```json
{ "claves": ["123456789", "123456790"] }
```

El servicio consulta las tablas relacionadas y filtra:

```text
Estado = 15
Municipio IN (025, 020, 122)
DEACVEDEUDOR = ANY(lista)
```

### 10.2 Mantenimiento preventivo

- Revisar índices en las columnas de joins y filtros.
- Medir el tiempo de respuesta con listas pequeñas y grandes.
- Revisar si el catálogo de municipios continúa vigente.
- Confirmar que el formato de `DEACVEDEUDOR` no haya cambiado.
- Probar carven conocido que debe aparecer y otro que no debe aparecer.

### 10.3 Diagnóstico

**Devuelve un arreglo vacío:**

- El carven no existe.
- No tiene direccion relacionada.
- No pertenece al estado o a los municipios configurados.
- Hay diferencias de espacios o de formato.

**Devuelve 400:** no se envió `claves` o la lista está vacía.

**Devuelve 500:** falló la consulta o la conexión a PostgreSQL.

**La pantalla no muestra datos:** revisar que la columna elegida del Excel tenga valores y que la misma columna exista en todos los archivos seleccionados.

---

## 11. Mantenimiento de Botar Carven

### 11.1 Función técnica

El boton de `App.jsx` solicita confirmacion y llama:

```text
DELETE /verificacion/borrar-ingresos
```

El backend borra todos los registros de `tbingresos` donde `infingreso >= CURRENT_DATE`.

### 11.2 Procedimiento autorizado

1. Solicitar aprobación.
2. Consultar cantidad candidata.
3. Crear un respaldo o una exportación.
4. Confirmar la fecha del servidor PostgreSQL.
5. Ejecutar la operación en la ventana autorizada.
6. Registrar `registrosEliminados`.
7. Verificar que la cantidad sea razonable.
8. Conservar evidencia.

### 11.3 Incidente posterior

Si se elimino de forma incorrecta:

- No ejecutar nuevamente la operación.
- No intentar reconstruir datos manualmente.
- Identificar la hora y la cantidad eliminada.
- Preservar los registros de bitácora y la evidencia.
- Restaurar desde el respaldo según el procedimiento del DBA.
- Informar el impacto.

### 11.4 Mejora recomendada

Para reducir el riesgo operativo, el endpoint debería evolucionar a una operación con:

- Autenticación y autorización.
- Vista previa de la cantidad.
- Fecha explicita.
- Confirmacion del lado servidor.
- Auditoría de usuario, IP, motivo y cantidad.
- Soft delete o respaldo automatico cuando sea posible.

---

## 12. Mantenimiento de Leyendas

### 12.1 Dos rutas de procesamiento

Existen dos rutas distintas:

1. **Frontend:** `Leyendas.jsx` lee el archivo en el navegador, convierte columnas, divide a 64,999 y crea Blob para descargar.
2. **Backend:** `POST /leyendas/procesar` recibe multipart, procesa en NestJS, escribe en `temp` y administra sesiones de descarga.

Antes de investigar un incidente se debe identificar qué ruta usó el operador.

### 12.2 Mantenimiento del frontend

Revisar:

- Memoria del navegador al abrir archivos grandes.
- Objet URLs sin liberar si se procesan muchas veces.
- Permisos de descarga múltiple.
- Primera hoja y encabezados del Excel.
- Extensión real del archivo.
- Cantidad de columnas seleccionadas.

La pantalla selecciona todas las columnas como texto por defecto. Cambiar esa regla puede alterar identificadores y ceros iniciales; probar con archivos representativos.

### 12.3 Mantenimiento del backend

El servicio:

- Admite archivos de hasta 500 MB.
- Limpia datos y elimina filas vacías.
- Usa bloques de 64,999 registros.
- Crea `temp/<sessionId>`.
- Conserva la sesión aproximadamente una hora.
- Elimina automáticamente la sesión al expirar.

Revisar periodicamente:

```text
nestjs-procesos/temp
```

Si existen carpetas antiguas, confirmar que no correspondan a descargas activas y limpiarlas conforme a la política. No borrar una carpeta mientras el operador esté descargando un archivo.

### 12.4 Nomenclatura

La salida usa:

```text
LEY_<cartera>_<fecha>.xls
GEST_<cartera>_<fecha>.xls
```

Para GMF se agrega `HER`, `VIS` o `DEV`.

La nomenclatura se construye a partir de cartera, tipo y fecha. Un cambio en las abreviaturas debe revisarse con los consumidores de los archivos.

### 12.5 Fallas frecuentes

**No se genera archivo:** revisar si el Excel está corrupto, si la primera hoja está vacía, los permisos de escritura y el espacio en disco.

**Se genera una sola parte inesperada:** comprobar si el archivo incluye filas vacías o si la fila de encabezados fue interpretada incorrectamente.

**No se puede descargar:** revisar `sessionId`, índice de archivo y expiración de una hora.

**El archivo tarda o bloquea el navegador:** reducir el tamaño, usar la ruta de servidor o dividirlo previamente.

**Se pierden ceros iniciales:** seleccionar la columna como texto y validar el archivo resultante.

### 12.6 Limpieza segura de archivos temporales

1. Listar las sesiones y la fecha de modificación.
2. Identificar las sesiones activas.
3. Confirmar que no haya descargas pendientes.
4. Eliminar solo las sesiones expiradas.
5. Registrar la cantidad y el espacio liberado.
6. Revisar que pueda crearse una nueva sesión.

---

## 13. Mantenimiento de Status

### 13.1 Función técnica

`POST /status/cambiar` recibe `status` y `claves`. Actualiza:

```sql
UPDATE TBDEUDOR
SET STNCVESTATUS = $1
WHERE DEACVEDEUDOR IN (...)
RETURNING DEACVEDEUDOR;
```

Los valores se envian como parametros; los placeholders no deben reemplazarse por concatenacion de valores.

### 13.2 Procedimiento de mantenimiento

- Confirmar el catálogo de status vigente.
- Verificar que `DEACVEDEUDOR` tenga índice.
- Probar con un carven controlado.
- Revisar `clavesActualizadas` y `clavesNoEncontradas`.
- Guardar el Excel de resultados.
- Comparar antes y después en una muestra.

### 13.3 Diagnóstico

**Todas no encontradas:** revisar si se cargaron carven en vez de números de crédito, espacios, ceros iniciales, el ambiente de base de datos o la tabla correcta.

**Actualizadas menos filas que las enviadas:** es comportamiento esperado si algunos identificadores no existen.

**Error 500:** revisar permisos de `UPDATE`, conexión y bloqueos.

**Resultado visual inconsistente:** la pantalla forma su tabla usando la lista enviada y `clavesActualizadas`; validar la respuesta original del backend.

### 13.4 Recuperación

No cambiar nuevamente el status sin conocer el valor anterior. Usar el respaldo o la auditoría obtenida antes de la operación.

---

## 14. Mantenimiento de devoluciones

### 14.1 Función técnica

`POST /devoluciones/procesar` acepta:

```json
{
  "tipo": "carven",
  "registros": [
    {
      "identificador": "123456789",
      "codStatus": "69",
      "fecha": "19/08/2026"
    }
  ]
}
```

El servicio elige el campo de búsqueda:

```text
carven     -> DEACVEDEUDOR
numcredito -> DEANUMCREDITO
```

Después ejecuta una actualización por registro:

```sql
UPDATE TBDEUDOR
SET STNCVESTATUS = $1,
    DEFFECDEVOLUCION = $2
WHERE <campo_identificador> = $3
RETURNING <campo_identificador>;
```

### 14.2 Mantenimiento preventivo

- Revisar índices en ambos campos de identificación.
- Confirmar el tipo de dato y la longitud de cada campo.
- Validar el formato de las fechas.
- Probar con un registro conocido.
- Revisar la duración en lotes grandes.
- Confirmar que no haya duplicados en el archivo.
- Conservar el archivo de origen y el de resultados.

### 14.3 Rendimiento

El backend procesa cada fila de forma individual y espera cada consulta antes de continuar. En archivos grandes, el tiempo aumenta con el número de registros. Durante el mantenimiento:

- Medir tiempo por lote.
- Evitar varios lotes simultaneos contra la misma tabla.
- Revisar bloqueos.
- Considerar una transacción o actualización por lotes solo mediante un cambio controlado y probado.

### 14.4 Fechas

El backend exige `dd/mm/aaaa`. La interfaz transforma los seriales de Excel en fechas legibles, pero se debe validar la muestra antes de enviar.

La expresión actual valida la forma, pero no garantiza que la fecha sea real. Por ejemplo, una fecha con día o mes fuera de rango puede superar la validación textual. Si se necesita mayor rigor, debe agregarse validación de calendario en frontend y backend.

### 14.5 Diagnóstico

**Registros omitidos:** la pantalla elimina las filas sin identificador, status o fecha.

**400 Fecha invalida:** revisar `dd/mm/aaaa` y no usar `aaaa-mm-dd`.

**Todos no encontrados:** revisar el tipo de identificador seleccionado y las columnas del archivo.

**500:** revisar conexion, permisos, nombres de columnas y disponibilidad de `TBDEUDOR`.

**Actualización parcial:** revisar `resultados`, `actualizadosLista` y el archivo original. Las filas no encontradas no provocan que se cancelen las demás.

---

## 15. Pruebas de humo después de un cambio

Ejecutar esta secuencia después de actualizar código, dependencias, configuración, servidor o base de datos:

### Prueba A: salud

```text
GET /verificacion
```

Debe devolver `Servidor backend activo`.

### Prueba B: Verificación

Enviar uno o dos carven conocidos con:

```json
{ "claves": ["CARVEN_CONTROLADO"] }
```

Confirmar respuesta 200 o arreglo vacio razonado.

### Prueba C: Leyendas

Usar un archivo pequeno y verificar:

- Se detectan encabezados.
- Las columnas seleccionadas conservan texto.
- El nombre es correcto.
- El archivo abre en Excel.

### Prueba D: Status

Usar un registro de pruebas o una base de pruebas. Confirmar que el status cambie y que la evidencia muestre el resultado.

### Prueba E: Devoluciones

Usar un registro controlado y verificar status y fecha. Confirmar que el tipo `carven` y el formato de fecha funcionen.

### Prueba F: Botar Carven

No ejecutar en producción como prueba. Validar solo con una consulta `COUNT(*)` o en un ambiente de pruebas con respaldo.

---

## 16. Procedimiento ante incidentes

### 16.1 Clasificación inicial

1. Identificar la función afectada.
2. Determinar si hubo lectura, actualización o eliminación.
3. Registrar la hora, el usuario, el archivo y el endpoint.
4. Determinar si el problema afecta a todos o solo a un lote.
5. No reintentar operaciones destructivas sin confirmar el estado.

### 16.2 Evidencia mínima

Guardar:

- Mensaje exacto de la interfaz.
- Código HTTP.
- Respuesta JSON sin credenciales.
- Consola del navegador.
- Registros de NestJS.
- Nombre y copia del archivo de entrada.
- Excel de resultados.
- Hora y zona horaria.
- Host y puerto utilizados.

### 16.3 Backend caído

1. Revisar proceso Node.
2. Revisar mensaje de variables faltantes.
3. Revisar puerto ocupado.
4. Revisar conectividad PostgreSQL.
5. Revisar permisos de `temp`.
6. Corregir la configuración.
7. Reiniciar de forma controlada.
8. Ejecutar pruebas de humo.

### 16.4 Base de datos caída

1. No reintentar cambios masivos.
2. Confirmar estado del servidor PostgreSQL.
3. Revisar conexiones, bloqueos y logs.
4. Confirmar que no exista una operación parcialmente ejecutada.
5. Reanudar solo después de la validación del DBA.

### 16.5 Frontend sin respuesta

1. Confirmar que Vite o el servidor web esta activo.
2. Confirmar URL del backend en `fetch`.
3. Confirmar CORS.
4. Revisar consola del navegador.
5. Probar el endpoint directamente.
6. Revisar tamano y formato del archivo.

---

## 17. Mantenimiento de dependencias

### 17.1 Antes de actualizar

- Crear una rama o un respaldo del código.
- Guardar `package-lock.json`.
- Revisar cambios mayores de NestJS, React, Vite, `pg` y `xlsx`.
- Ejecutar pruebas y build actuales.
- Probar en ambiente de desarrollo.
- Revisar compatibilidad de Node.js.

### 17.2 Después de actualizar

En backend:

```powershell
npm run build
npm test
```

En frontend:

```powershell
npm run lint
npm run build
```

Repetir las pruebas de humo. Prestar especial atención a:

- Lectura de Excel.
- Descargas Blob.
- Multipart de Leyendas.
- Seriales de fecha.
- Parametros PostgreSQL.
- Rutas de React Router.

### 17.3 Regla de cambios

No actualizar dependencias y modificar la lógica de negocio en el mismo cambio si puede evitarse. Separar ambos cambios facilita identificar la causa de un incidente.

---

## 18. Seguridad y control de acceso

Los endpoints documentados no muestran autenticación propia. Por ello, la protección debe existir en la red, el proxy o la capa de despliegue.

Medidas mínimas:

- No exponer el backend directamente a Internet.
- Restringir acceso por red o VPN.
- Usar HTTPS mediante proxy.
- Agregar autenticación y autorización para las operaciones de escritura.
- Auditar Botar Carven, Status y Devoluciones.
- Validar tamaños y tipos de archivos.
- Evitar mostrar variables sensibles en los registros.
- Rotar las credenciales comprometidas.
- Usar un usuario de PostgreSQL con permisos mínimos.

Especialmente crítico: `DELETE /verificacion/borrar-ingresos` no recibe una lista de carven y puede eliminar todos los ingresos desde la fecha actual.

---

## 19. Plan de mantenimiento preventivo

### Diario

- Salud del backend.
- Conectividad PostgreSQL.
- Espacio de `temp`.
- Errores recientes.
- Estado de respaldos.

### Semanal

- Revisar las sesiones temporales expiradas.
- Revisar los tamaños de las tablas.
- Revisar los tiempos de Verificación, Status y Devoluciones.
- Probar descarga de Leyendas.
- Validar que las rutas del frontend sigan accesibles.

### Mensual

- Probar la restauración de un respaldo en un ambiente controlado.
- Revisar permisos de base de datos.
- Revisar las dependencias pendientes.
- Revisar el catálogo de municipios y status.
- Revisar el espacio, los registros y las políticas de retención.
- Ejecutar las pruebas de humo completas.

### Por versión

- Revisar las variables de entorno.
- Revisar las URL y los puertos.
- Ejecutar la compilación del frontend y el backend.
- Ejecutar las pruebas automatizadas disponibles.
- Validar archivos de Excel reales de muestra.
- Registrar los cambios y el plan de reversa.

---

## 20. Limitaciones y riesgos conocidos

1. El frontend usa URLs de backend escritas directamente en los componentes.
2. El backend usa `3001` por defecto, mientras el frontend apunta a `3002`.
3. Leyendas se procesa actualmente en el navegador desde la pantalla, aunque existe un endpoint de servidor.
4. Leyendas usa memoria del navegador para archivos grandes.
5. Las sesiones de Leyendas en el servidor expiran aproximadamente en una hora.
6. El backend procesa Devoluciones una fila a la vez.
7. La validación de fecha revisa principalmente el formato.
8. No se observa autenticación propia en estos endpoints.
9. Botar Carven es un `DELETE` global por fecha, no una eliminación selectiva.
10. Status y Devoluciones escriben directamente en `TBDEUDOR`.
11. No se debe asumir que una respuesta parcial es una transacción atómica.
12. Los archivos descargados deben conservarse como evidencia; los Blob del navegador son temporales.

---

## 21. Mejoras recomendadas

Prioridad alta:

- Mover las URLs del backend a variables de entorno del frontend.
- Alinear el puerto real entre frontend, proxy y NestJS.
- Agregar autenticación y roles.
- Auditar las operaciones de escritura y eliminación.
- Implementar confirmacion server-side para Botar Carven.
- Crear pruebas automatizadas para los cinco flujos.
- Validar fechas reales, no solo mediante expresiones regulares.

Prioridad media:

- Agregar un endpoint de vista previa para Botar Carven.
- Implementar procesamiento por lotes o una transacción controlada en Devoluciones.
- Agregar una comprobación de estado de PostgreSQL, no solo de NestJS.
- Registrar métricas de duración y cantidad de registros.
- Limpiar los Object URLs del frontend al finalizar las descargas o cancelar.
- Centralizar nombres de tablas, columnas y catálogos.

Prioridad baja:

- Unificar la implementación de Leyendas en el frontend y el backend.
- Agregar una página de historial de operaciones.
- Incorporar la descarga de registros de ejecución sin datos sensibles.
- Documentar los catálogos oficiales de status y municipios.

---

## 22. Formato de registro de mantenimiento

Usar una entrada por intervención:

```text
Fecha y hora:
Responsable:
Ambiente: desarrollo / pruebas / producción
Versión de código:
Función afectada:
Motivo:
Cambios realizados:
Respaldo realizado: sí / no
Resultado de la prueba de humo:
Incidencias encontradas:
Plan de reversa:
Observaciones:
```

Para operaciones de datos agregar:

```text
Cantidad candidata:
Cantidad enviada:
Cantidad actualizada:
Cantidad no encontrada:
Archivo de entrada:
Archivo de resultados:
Autorización:
```

---

## 23. Lista de verificación de cierre

- [ ] El servicio responde.
- [ ] La interfaz carga.
- [ ] El endpoint y puerto son los esperados.
- [ ] PostgreSQL esta disponible.
- [ ] No quedan procesos de escritura activos.
- [ ] No quedan archivos temporales innecesarios.
- [ ] Se guardaron logs y resultados.
- [ ] Se verificó el respaldo.
- [ ] Se ejecutaron las pruebas de humo.
- [ ] Se registró la intervención.
- [ ] Se informó a los operadores.

---

## 24. Referencia rápida de endpoints

| Operación          | Endpoint                                   | Método | Cuerpo                            |
| ------------------ | ------------------------------------------ | ------ | --------------------------------- |
| Salud              | `/verificacion`                            | GET    | Ninguno                           |
| Verificación       | `/verificacion/verificar`                  | POST   | `{ "claves": [] }`                |
| Botar Carven       | `/verificacion/borrar-ingresos`            | DELETE | Ninguno                           |
| Leyendas           | `/leyendas/procesar`                       | POST   | multipart `file` + campos         |
| Descargar Leyendas | `/leyendas/download/:sessionId/:fileIndex` | GET    | Ninguno                           |
| Sesión Leyendas    | `/leyendas/session/:sessionId`             | GET    | Ninguno                           |
| Status             | `/status/cambiar`                          | POST   | `{ "status": "", "claves": [] }`  |
| Devoluciones       | `/devoluciones/procesar`                   | POST   | `{ "tipo": "", "registros": [] }` |

---

## 25. Criterio de finalización

Un mantenimiento se considera terminado cuando:

1. Se corrigió o verificó la causa del incidente.
2. El servicio y la interfaz responden.
3. Las operaciones de lectura funcionan.
4. Las operaciones de escritura fueron validadas en un ambiente controlado.
5. No quedaron archivos temporales ni procesos pendientes.
6. Se conservaron las evidencias y los respaldos.
7. Se registró el cambio y su plan de reversa.
8. Los operadores recibieron el resultado y las restricciones conocidas.
