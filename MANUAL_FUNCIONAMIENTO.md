# Manual de funcionamiento
## Verificacion EDOMEX, Botar Carven, Leyendas, Status y Devoluciones

**Version del manual:** 1.0  
**Fecha de elaboracion:** 21/08/2026  
**Proyectos documentados:** `nestjs-procesos` y `proyecto-one`

---

## 1. Objetivo del sistema

El sistema permite operar cinco procesos principales desde una interfaz web:

1. **Verificacion EDOMEX:** busca carven en la base de datos y devuelve las cuentas que pertenecen al Estado de Mexico y a los municipios configurados.
2. **Botar Carven:** elimina de `tbingresos` los ingresos cuya fecha es igual o posterior a la fecha actual de la base de datos.
3. **Leyendas:** prepara archivos Excel para envio, convierte columnas seleccionadas a texto y divide archivos grandes en partes de hasta 64,999 registros.
4. **Status:** cambia el status de varios carven en una sola operacion.
5. **Devoluciones:** actualiza status y fecha de devolucion usando carven o numero de credito como identificador.

La interfaz esta implementada en `proyecto-one` con React. Los procesos de Verificacion, Botar Carven, Status y Devoluciones son atendidos por NestJS y PostgreSQL. El modulo de Leyendas tiene dos implementaciones: la pantalla actual procesa el archivo directamente en el navegador y NestJS tambien expone un endpoint para procesamiento en servidor.

---

## 2. Arquitectura y componentes

### 2.1 Frontend: `proyecto-one`

La ruta principal se encuentra en `/` y tambien en `/proyect-one`. Desde ella se puede acceder a:

| Funcion | Ruta de pantalla | Componente |
|---|---|---|
| Verificacion EDOMEX | `/` o `/proyect-one` | `App.jsx` |
| Leyendas | `/leyendas` | `Leyendas.jsx` |
| Status | `/status` | `Status.jsx` |
| Devoluciones | `/devoluciones` | `Devoluciones.jsx` |

La interfaz usa archivos `.xlsx` y `.xls` y genera algunos archivos de salida directamente en el navegador.

### 2.2 Backend: `nestjs-procesos`

El modulo raiz registra los modulos `VerificacionModule`, `LeyendasModule`, `StatusModule` y `DevolucionesModule`.

Endpoints principales:

| Funcion | Metodo y endpoint |
|---|---|
| Verificar carven | `POST /verificacion/verificar` |
| Comprobar backend activo | `GET /verificacion` |
| Botar ingresos | `DELETE /verificacion/borrar-ingresos` |
| Procesar Leyendas en servidor | `POST /leyendas/procesar` |
| Descargar parte de Leyendas | `GET /leyendas/download/:sessionId/:fileIndex` |
| Consultar sesion de Leyendas | `GET /leyendas/session/:sessionId` |
| Cambiar status | `POST /status/cambiar` |
| Procesar devoluciones | `POST /devoluciones/procesar` |

---

## 3. Puesta en marcha

### 3.1 Backend

Desde la carpeta raiz de `nestjs-procesos`:

```bash
npm install
npm run start:dev
```

Para compilar y ejecutar:

```bash
npm run build
npm run start:prod
```

El backend escucha en todas las interfaces de red. El puerto se obtiene de `PORT`; si no existe, `main.ts` usa `3001`.

Al iniciar, la consola muestra variables de entorno y los endpoints disponibles. No se deben compartir contrasenas ni credenciales copiadas desde esos mensajes.

### 3.2 Frontend

Desde la carpeta `proyecto-one`:

```bash
npm install
npm run dev
```

Para construir la version de produccion:

```bash
npm run build
npm run preview
```

### 3.3 Configuracion de base de datos

El modulo `database` crea un pool de PostgreSQL compartido para Verificacion, Status y Devoluciones. Son obligatorias estas variables:

```dotenv
PG_HOST=servidor-postgresql
PG_PORT=5432
PG_USER=usuario
PG_PASSWORD=contrasena
PG_DATABASE=base_de_datos
```

Si falta cualquiera, el backend detiene el arranque con el mensaje `Faltan variables de entorno para PostgreSQL`.

El mismo backend tambien configura una conexion MSSQL mediante TypeORM para otros modulos del proyecto. Para esa conexion se utilizan, entre otras, `DB_SERVER`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_DATABASE`. Para las cinco funciones de este manual, la conexion que realmente ejecuta las consultas de negocio es PostgreSQL.

### 3.4 Conexion frontend-backend

Las pantallas de `proyecto-one` tienen actualmente las llamadas escritas hacia:

```text
http://192.168.28.35:3002
```

Sin embargo, el backend NestJS usa `PORT` y por defecto escucha en `3001`. Antes de operar se debe confirmar una de estas situaciones:

- NestJS esta configurado con `PORT=3002`.
- Existe un proxy o servicio intermedio en el puerto `3002`.
- Las URLs del frontend fueron ajustadas al puerto real del backend.

Prueba rapida del backend:

```text
GET http://192.168.28.35:3002/verificacion
```

Respuesta esperada:

```json
{"mensaje":"Servidor backend activo"}
```

Si la prueba falla, no iniciar cargas ni actualizaciones: la pantalla no podra completar las operaciones.

---

## 4. Flujo 1: Verificacion EDOMEX

### 4.1 Que hace

La verificacion consulta `tbdeudor`, `tbdirecciones`, `tbmunicipios` y `tbestados`. Solo devuelve registros que cumplen simultaneamente:

- Estado de Mexico: `cpacveestado = '15'`.
- Municipio `025`, `020` o `122`.
- El carven recibido existe y coincide con `DEACVEDEUDOR`.

La respuesta incluye:

- `Clave`: carven.
- `CP`: codigo postal.
- `Municipio`: nombre del municipio.
- `Estado`: nombre del estado.

Un carven valido que no aparece en la respuesta no necesariamente es un error de captura: puede no pertenecer a los filtros EDOMEX configurados o no existir en las tablas relacionadas.

### 4.2 Verificacion mediante archivo

1. Abrir la pantalla principal `/`.
2. Revisar los selectores de nombre, fecha, cliente y modo.
3. En **Modo**, dejar **Analizar columna**.
4. Pulsar **Anadir archivos**.
5. Seleccionar uno o varios archivos `.xlsx` o `.xls`.
6. La pantalla lee el primer archivo y muestra sus encabezados.
7. Seleccionar la columna que contiene los carven.
8. Pulsar **Procesar N archivo(s)**.
9. Para cada archivo, indicar la hora en formato `HHMM`, por ejemplo `1245`.
10. Revisar los resultados.
11. Descargar cada archivo o pulsar **Descargar todos**.

La misma columna seleccionada se usa para todos los archivos pendientes. Por eso los archivos deben tener encabezados compatibles.

### 4.3 Verificacion manual

1. Pulsar **Buscar manual**.
2. Escribir un carven por linea.
3. Pulsar **Verificar carven**.
4. Revisar la tabla devuelta.
5. Si existen resultados, descargar el Excel generado.

Las lineas vacias se eliminan. Los espacios al inicio y al final se recortan.

Ejemplo de entrada:

```text
100000001
100000002
100000003
```

### 4.4 Modo solo renombrar

El selector **Modo** tiene una segunda opcion: **Solo renombrar**.

Este modo no consulta el backend ni analiza carven. Conserva el contenido original del archivo, lo muestra como pendiente y permite asignar una hora para generar el nombre de descarga. Es util cuando solo se necesita preparar la nomenclatura de los archivos.

### 4.5 Nombre de los archivos de verificacion

El nombre se genera al descargar, usando los valores vigentes en ese momento:

```text
ATT_DDMMYY_NOMBRE_SUS_o_CAN_P1_o_P2_HHMM.ext
GMF_DDMMYY_NOMBRE_HHMM.ext
TYT_DDMMYY_NOMBRE_HHMM.ext
VER_DDMMYY_NOMBRE_HHMM.ext
```

Ejemplo:

```text
ATT_210826_IAN_SUS_P2_1245.xlsx
```

Reglas:

- `NOMBRE` acepta hasta cuatro caracteres y se convierte a mayusculas.
- `DDMMYY` debe tener seis digitos.
- Para ATT se incluyen suscripcion y pago.
- La extension conserva la extension original.
- El nombre se calcula con los selectores actuales al descargar, no necesariamente con los que estaban seleccionados al procesar.

### 4.6 Respuestas y problemas frecuentes

Respuesta de API para una consulta exitosa: un arreglo de filas, por ejemplo:

```json
[
  {
    "Clave": "100000001",
    "CP": "50000",
    "Municipio": "Toluca",
    "Estado": "MEXICO"
  }
]
```

Mensajes comunes:

- `No se enviaron claves`: la solicitud no contiene carven.
- `Error en la base de datos`: PostgreSQL no respondio o la consulta fallo.
- `No se encontraron datos en la columna`: la columna elegida esta vacia o no coincide con los encabezados.
- `Error de conexion con el servidor`: revisar IP, puerto, CORS y que NestJS este activo.

---

## 5. Flujo 2: Botar Carven

### 5.1 Que hace exactamente

El boton **Botar Carven** de la pantalla principal llama a:

```text
DELETE /verificacion/borrar-ingresos
```

El backend ejecuta:

```sql
DELETE FROM tbingresos
WHERE infingreso >= CURRENT_DATE;
```

Por lo tanto, elimina los registros de `tbingresos` cuya fecha de ingreso es hoy o posterior segun la fecha del servidor de base de datos. No elimina directamente registros de `tbdeudor`.

### 5.2 Procedimiento operativo

1. Confirmar que la pantalla principal esta conectada al backend correcto.
2. Verificar que ya no se necesitan los ingresos del dia o posteriores.
3. Pulsar **Botar Carven**.
4. Leer cuidadosamente la ventana de confirmacion.
5. Confirmar solo si la limpieza es intencional.
6. Revisar el mensaje con la cantidad eliminada.

Respuesta esperada:

```json
{
  "mensaje": "Registros botados exitosamente",
  "registrosEliminados": 25,
  "fechaActual": "2026-08-21T..."
}
```

### 5.3 Advertencia

Esta operacion es destructiva y no solicita una lista de carven. Afecta todos los registros de `tbingresos` que cumplan el filtro de fecha. Antes de ejecutarla debe existir un respaldo o una autorizacion operativa clara.

Si la respuesta indica cero registros eliminados, puede significar que no hay ingresos para la fecha, que la fecha de la base de datos es distinta a la esperada o que los registros no cumplen el filtro.

---

## 6. Flujo 3: Leyendas

### 6.1 Objetivo

El procesador prepara un Excel para **Leyendas** o **Gestiones**. Convierte las columnas elegidas a texto para conservar valores como ceros iniciales, codigos y claves. Si el archivo tiene mas de 64,999 registros, lo divide en varios archivos.

### 6.2 Uso de la pantalla

1. Ir a `/leyendas`.
2. Seleccionar la **Cartera**:
   - Scotiabank.
   - BBVA.
   - ATT.
   - GMF.
   - Toyota.
3. Seleccionar el **Tipo de archivo**:
   - Leyendas.
   - Gestiones.
4. Escribir la fecha en formato `DDMMYY`, por ejemplo `210826`.
5. Si la cartera es GMF, seleccionar el tipo GMF:
   - `HER`.
   - `VIS`.
   - `DEV`.
6. Cargar o arrastrar un archivo `.xlsx` o `.xls`.
7. Esperar a que se detecten las columnas.
8. Por defecto, todas las columnas quedan seleccionadas como texto.
9. Desmarcar las columnas que no deban convertirse a texto, o usar **Seleccionar todas/Deseleccionar todas**.
10. Pulsar **Procesar**.
11. Descargar cada archivo generado o usar **Descargar todos**.

El archivo de entrada debe tener encabezados en la primera hoja y al menos una fila de datos.

### 6.3 Nomenclatura de salida

| Cartera | Codigo usado |
|---|---|
| Scotiabank | `SCOT` |
| BBVA | `BBVA` |
| ATT | `ATT` |
| GMF | `GMF` |
| Toyota | `TYT` |

El nombre se forma asi:

```text
LEY_CARTERA_DDMMYY.xls
GEST_CARTERA_DDMMYY.xls
```

Para GMF:

```text
LEY_GMF_HER_DDMMYY.xls
GEST_GMF_VIS_DDMMYY.xls
```

Si se generan varias partes, se agrega el numero:

```text
LEY_SCOT_210826_1.xls
LEY_SCOT_210826_2.xls
```

### 6.4 Division de archivos

El limite es de 64,999 registros por archivo. Ejemplos:

- 10,000 registros: 1 archivo.
- 64,999 registros: 1 archivo.
- 65,000 registros: 2 archivos.
- 130,000 registros: 2 archivos.
- 130,001 registros: 3 archivos.

Los encabezados se incluyen en cada archivo generado. El total de registros no incluye la fila de encabezados.

### 6.5 Que significa convertir a texto

Una columna convertida a texto conserva valores que Excel podria alterar automaticamente, por ejemplo:

- `000123` no se convierte en `123`.
- Codigos largos no se muestran en notacion cientifica.
- Identificadores se manejan como texto.

Las columnas no seleccionadas conservan su tratamiento normal en la hoja generada.

### 6.6 Implementacion actual y endpoint de servidor

La pantalla `Leyendas.jsx` procesa el archivo en el navegador: no llama a `POST /leyendas/procesar`. Esto significa que el limite practico depende de la memoria disponible en el equipo y del navegador.

NestJS tambien ofrece una implementacion de servidor:

```text
POST /leyendas/procesar
Content-Type: multipart/form-data
Campo de archivo: file
```

Campos del formulario:

```text
banco=SCOTIABANK
 tipo=LEYENDAS
 fecha=210826
 columnas=CARVEN
 columnas=TELEFONO
 tipoGMF=HER
 file=<archivo.xls o archivo.xlsx>
```

Validaciones del endpoint:

- Archivo obligatorio.
- Banco obligatorio.
- Tipo obligatorio.
- Fecha de seis digitos.
- Al menos una columna.
- Extension `.xls` o `.xlsx`.
- Tamano maximo de archivo: 500 MB.

Con un solo archivo generado, el endpoint responde como descarga directa. Con varios, devuelve `sessionId`, nombres, tamanos, registros por archivo y URLs de descarga. Las sesiones expiran aproximadamente despues de una hora.

### 6.7 Errores frecuentes

- **Archivo vacio:** revisar que la primera hoja tenga encabezados y datos.
- **No se detectan columnas:** revisar que la fila de encabezados sea la primera fila util.
- **Formato no soportado:** guardar como `.xlsx` o `.xls`.
- **No se puede descargar una parte:** la sesion de servidor pudo expirar o el indice de archivo es invalido.
- **Valores alterados:** seleccionar esas columnas en **Columnas a texto** antes de procesar.

---

## 7. Flujo 4: Cambio de Status

### 7.1 Que hace

Actualiza `TBDEUDOR.STNCVESTATUS` para los carven introducidos. La busqueda se realiza por `TBDEUDOR.DEACVEDEUDOR`.

### 7.2 Uso de la pantalla

1. Ir a `/status`.
2. Escribir el codigo en **Status**, por ejemplo `42`.
3. Introducir un carven por linea en el area de texto.
4. Pulsar **Cambiar Status**.
5. Revisar cuantos fueron actualizados y cuantos no encontrados.
6. Descargar el Excel de resultados si se requiere evidencia.

Ejemplo:

```text
123456789
123456790
123456791
```

Las lineas vacias se eliminan y los espacios se recortan.

### 7.3 Solicitud de API

```http
POST /status/cambiar
Content-Type: application/json
```

```json
{
  "status": "42",
  "claves": [
    "123456789",
    "123456790",
    "123456791"
  ]
}
```

El backend ejecuta un `UPDATE` parametrizado y devuelve las claves que PostgreSQL reporto como actualizadas.

Respuesta representativa:

```json
{
  "mensaje": "Status actualizado correctamente",
  "status": "42",
  "totalEnviadas": 3,
  "actualizadas": 2,
  "noEncontradas": ["123456791"],
  "clavesActualizadas": ["123456789", "123456790"],
  "clavesNoEncontradas": ["123456791"],
  "fecha": "2026-08-21T..."
}
```

### 7.4 Interpretacion de resultados

- **Actualizado:** el carven fue encontrado y se ejecuto el cambio.
- **No encontrado:** no existe un registro con ese `DEACVEDEUDOR` o no fue devuelto por la base de datos.
- **Error de base de datos:** la operacion completa no pudo terminar correctamente.

La pantalla genera un Excel llamado con el patron:

```text
cambio_status_YYYY-MM-DD.xlsx
```

El archivo contiene carven, status y resultado por registro.

### 7.5 Precauciones

El cambio se aplica directamente en base de datos. Confirmar el codigo de status y la lista antes de pulsar el boton. El backend no valida que el status sea numerico; acepta cualquier texto no vacio. La validacion de negocio del codigo debe realizarse con el catalogo operativo correspondiente.

---

## 8. Flujo 5: Devoluciones

### 8.1 Que hace

Actualiza dos campos de `TBDEUDOR`:

```text
STNCVESTATUS       <- codigo de status
DEFFECDEVOLUCION   <- fecha de devolucion
```

El usuario puede buscar por:

- **CARVEN:** `DEACVEDEUDOR`.
- **NUMERO DE CREDITO:** `DEANUMCREDITO`.

Cada fila se procesa individualmente.

### 8.2 Preparar el Excel

El archivo debe ser `.xlsx` o `.xls` y tener encabezados en la primera hoja. Se recomienda incluir columnas como:

| CARVEN o NUM CREDITO | FECHA | COD STATUS |
|---|---|---|
| 123456789 | 19/08/2026 | 69 |
| 123456790 | 20/08/2026 | 70 |

Los nombres exactos pueden ser diferentes: la pantalla muestra los encabezados detectados y permite elegirlos.

### 8.3 Uso paso a paso

1. Ir a `/devoluciones`.
2. Cargar o arrastrar un Excel.
3. Revisar el resumen de columnas detectadas, cantidad de registros y ejemplo de valor.
4. Elegir **CARVEN** o **NUMERO DE CREDITO**.
5. Elegir la columna que contiene el identificador.
6. En **FECHA**, elegir una columna o seleccionar **OTRA FECHA** para aplicar una fecha fija.
7. Si se usa fecha fija, escribir `dd/mm/aaaa`, por ejemplo `19/08/2026`.
8. En **COD STATUS**, elegir una columna o seleccionar **OTRO STATUS** para aplicar un status fijo.
9. Si se usa status fijo, escribir el codigo, por ejemplo `69`.
10. Pulsar **Procesar Devoluciones**.
11. Revisar cada fila como **Actualizado** o **No encontrado**.
12. Descargar el Excel de resultados si se necesita conservar evidencia.

### 8.4 Fechas

La pantalla reconoce fechas seriales de Excel y las convierte a `dd/mm/aaaa`. Por ejemplo, una celda numerica de Excel puede convertirse automaticamente a `19/08/2026`.

Si la fecha se toma de una columna y el contenido no tiene el formato esperado, la pantalla puede conservar la fecha predeterminada. Conviene revisar las muestras antes de procesar.

El backend exige la forma exacta:

```text
dd/mm/aaaa
```

Ejemplos correctos:

```text
01/08/2026
19/08/2026
31/12/2026
```

Ejemplos rechazados por formato:

```text
2026-08-19
19-08-2026
19/8/2026
```

### 8.5 Solicitud de API

```http
POST /devoluciones/procesar
Content-Type: application/json
```

Por carven:

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

Por numero de credito:

```json
{
  "tipo": "numcredito",
  "registros": [
    {
      "identificador": "CR-000123",
      "codStatus": "69",
      "fecha": "19/08/2026"
    }
  ]
}
```

Respuesta representativa:

```json
{
  "mensaje": "Devoluciones procesadas correctamente",
  "tipo": "carven",
  "totalEnviadas": 1,
  "actualizados": 1,
  "noEncontrados": 0,
  "actualizadosLista": ["123456789"],
  "resultados": [
    {
      "identificador": "123456789",
      "codStatus": "69",
      "fecha": "19/08/2026",
      "actualizado": true
    }
  ],
  "fecha": "2026-08-21T..."
}
```

### 8.6 Validaciones del backend

- `tipo` solo puede ser `carven` o `numcredito`.
- Debe existir al menos un registro.
- Se eliminan filas sin identificador, status o fecha.
- La fecha debe cumplir `dd/mm/aaaa`.
- Los identificadores y status se convierten a texto y se recortan.

Las filas no encontradas no detienen el procesamiento: aparecen en el resultado con `actualizado: false`.

El Excel de resultados de la pantalla usa el patron:

```text
devoluciones_YYYY-MM-DD.xlsx
```

---

## 9. Errores y diagnostico general

### 9.1 La pantalla dice que no hay conexion

1. Probar `GET /verificacion` en la misma IP y puerto que usa el frontend.
2. Confirmar que NestJS esta levantado.
3. Confirmar el valor de `PORT`.
4. Confirmar que el puerto del frontend coincide con `192.168.28.35:3002` o ajustar la URL.
5. Revisar firewall y conectividad de red.
6. Revisar CORS si el navegador bloquea la solicitud.

### 9.2 El backend no inicia

Revisar:

- Variables `PG_HOST`, `PG_PORT`, `PG_USER`, `PG_PASSWORD`, `PG_DATABASE`.
- Acceso de red al servidor PostgreSQL.
- Usuario y contrasena.
- Que el puerto no este ocupado.
- Logs de NestJS y PostgreSQL.

### 9.3 La respuesta es 400

Normalmente corresponde a datos faltantes o formato incorrecto:

- Archivo no enviado.
- Extension no soportada.
- Lista vacia.
- Status vacio.
- Fecha con formato incorrecto.
- Tipo de identificador invalido.
- Ninguna columna seleccionada.

### 9.4 La respuesta es 500

La solicitud supero las validaciones, pero fallo una operacion interna, generalmente por:

- Conexion a PostgreSQL.
- Permisos sobre tablas.
- Nombre o estructura inesperada de una tabla.
- Error de lectura/escritura temporal de archivos.

Guardar el mensaje mostrado y revisar la consola del backend.

### 9.5 No encontrados no significa necesariamente fallo

En Verificacion, un carven puede no pertenecer a los filtros EDOMEX. En Status y Devoluciones, puede no existir en la columna de busqueda seleccionada. En ambos casos se debe revisar el identificador, el tipo elegido y la base de datos antes de reintentar.

---

## 10. Checklist antes de una operacion

### Antes de consultar

- [ ] Backend activo.
- [ ] Frontend apuntando al puerto correcto.
- [ ] Conexion PostgreSQL disponible.
- [ ] Archivo con encabezados correctos.
- [ ] Identificadores sin espacios ni formatos alterados.

### Antes de actualizar Status o Devoluciones

- [ ] Codigo de status confirmado.
- [ ] Tipo de identificador confirmado.
- [ ] Fecha confirmada.
- [ ] Archivo o lista revisada.
- [ ] Respaldo o evidencia previa disponible cuando corresponda.

### Antes de Botar Carven

- [ ] La limpieza fue autorizada.
- [ ] Se entiende que afecta todos los registros de `tbingresos` desde `CURRENT_DATE`.
- [ ] Existe respaldo o posibilidad de recuperacion.

### Despues de procesar

- [ ] Revisar cantidad enviada.
- [ ] Revisar cantidad actualizada.
- [ ] Revisar lista de no encontrados.
- [ ] Descargar y conservar el reporte de resultados.
- [ ] Confirmar que los archivos tengan la nomenclatura correcta.

---

## 11. Resumen de impacto en base de datos

| Funcion | Tabla(s) | Operacion |
|---|---|---|
| Verificacion | `tbdeudor`, `tbdirecciones`, `tbmunicipios`, `tbestados` | `SELECT` |
| Botar Carven | `tbingresos` | `DELETE` |
| Status | `TBDEUDOR` | `UPDATE STNCVESTATUS` |
| Devoluciones | `TBDEUDOR` | `UPDATE STNCVESTATUS` y `UPDATE DEFFECDEVOLUCION` |
| Leyendas | Archivos temporales | Lectura, transformacion y escritura de Excel |

Status y Devoluciones son cambios directos en la base de datos. Botar Carven es una eliminacion directa. Estas tres acciones deben tratarse como operaciones de escritura y contar con autorizacion operativa.

---

## 12. Limitaciones conocidas

- Las URLs del frontend estan escritas de forma fija hacia `192.168.28.35:3002`.
- El backend NestJS usa `3001` por defecto si no se define `PORT`.
- La pantalla de Leyendas procesa localmente y no utiliza actualmente el endpoint de Leyendas de NestJS.
- La pantalla de Verificacion usa una misma columna para todos los archivos seleccionados.
- El backend de Devoluciones procesa cada registro uno por uno; archivos muy grandes pueden tardar.
- La validacion de fecha comprueba principalmente el formato, no todos los dias validos del calendario.
- El backend no implementa autenticacion en los endpoints documentados; el acceso debe protegerse mediante red, proxy o mecanismo de seguridad externo.
- Las sesiones de archivos de Leyendas en servidor son temporales y expiran aproximadamente en una hora.

---

## 13. Contacto y evidencia recomendada

Ante un incidente, conservar:

1. Fecha y hora de la operacion.
2. Usuario u operador.
3. Nombre del archivo de entrada.
4. Tipo de operacion.
5. Cantidad enviada y actualizada.
6. Lista de no encontrados.
7. Archivo Excel de resultados.
8. Mensaje exacto mostrado por la interfaz.
9. Mensaje de la consola del backend, ocultando credenciales.

Esta informacion permite reproducir el caso sin volver a ejecutar accidentalmente una operacion destructiva.
