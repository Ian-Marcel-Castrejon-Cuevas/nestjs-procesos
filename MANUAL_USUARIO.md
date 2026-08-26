# 1. Propósito y alcance

## 1.1. Propósito

Este manual explica cómo utilizar la aplicación para consultar y procesar información de carven, generar archivos de Leyendas, cambiar status y registrar devoluciones.

La guía está escrita para el usuario operativo. Incluye qué hace cada opción, qué datos se deben capturar, qué archivos se pueden cargar, cómo interpretar los resultados y qué hacer cuando se presenta un error.

Los procesos disponibles son:

1. **Verificación EDOMEX:** consulta si los carven pertenecen a las zonas del Estado de México configuradas en el sistema.
2. **Botar Carven:** elimina los ingresos registrados desde la fecha actual de la base de datos.
3. **Leyendas:** convierte y divide archivos de Excel para generar archivos listos para trabajar o enviar.
4. **Status:** cambia el status de varios carven.
5. **Devoluciones:** actualiza el status y la fecha de devolución de registros identificados por carven o número de crédito.

## 1.2. Alcance

Este manual cubre solamente las pantallas y funciones siguientes:

| Funcion                     | Pantalla             | Proyecto relacionado               |
| --------------------------- | -------------------- | ---------------------------------- |
| Verificacion y Botar Carven | `/` o `/proyect-one` | `proyecto-one` y `nestjs-procesos` |
| Leyendas                    | `/leyendas`          | `proyecto-one` y `nestjs-procesos` |
| Status                      | `/status`            | `proyecto-one` y `nestjs-procesos` |
| Devoluciones                | `/devoluciones`      | `proyecto-one` y `nestjs-procesos` |

No incluye otros procesos del backend, como reportes inbound, phishing, automatizaciones o módulos que no aparezcan en esta tabla.

## 1.3. Usuarios a quienes aplica

- Operadores que consultan carven.
- Personal que prepara archivos de Leyendas o Gestiones.
- Usuarios autorizados para cambiar status.
- Usuarios autorizados para procesar devoluciones.
- Supervisores que revisan resultados y archivos generados.

Las opciones **Botar Carven**, **Status** y **Devoluciones** modifican información en la base de datos. Solo deben utilizarlas personas autorizadas.

---

# 2. Conocer la aplicación

## 2.1. Menú principal

Al abrir la ruta principal se muestra la pantalla de Verificación EDOMEX. En la parte superior se encuentran las opciones:

- **Botar Carven**
- **Leyendas**
- **Status**
- **Devoluciones**

La pantalla también contiene controles para cliente, nombre de envío, fecha, tipo de pago, tipo de suscripción y modo de procesamiento.

## 2.2. Alcance funcional

La aplicación permite:

- Cargar uno o varios archivos Excel.
- Leer columnas de la primera hoja del archivo.
- Consultar carven contra la base de datos.
- Mostrar resultados en pantalla.
- Descargar resultados en Excel.
- Convertir columnas a texto para conservar ceros iniciales.
- Dividir archivos de Leyendas en partes de hasta 64,999 registros.
- Actualizar status por carven.
- Actualizar devoluciones por carven o número de crédito.
- Identificar registros actualizados y no encontrados.

La aplicación no sustituye la validación operativa. Antes de confirmar una eliminación o actualización, el usuario debe revisar los datos capturados y contar con la autorización correspondiente.

## 2.3. Requisitos para comenzar

Antes de utilizar la aplicación:

1. Tener acceso a la red donde se encuentra el sistema.
2. Abrir la direccion proporcionada por el responsable de la aplicacion.
3. Confirmar que la pantalla cargue sin mensajes de error.
4. Tener listos los archivos de Excel en formato `.xlsx` o `.xls`, cuando el proceso lo requiera.
5. Conocer el carven, número de crédito, status o fecha que se van a procesar.
6. Contar con autorización para las operaciones que modifican datos.

Si la pantalla muestra un error de conexión, no repitas una operación de escritura hasta confirmar si la solicitud llegó al servidor.

---

# 3. Reglas generales de uso

## 3.1. Formatos de archivo

Las pantallas de archivos aceptan:

- `.xlsx`
- `.xls`

El archivo debe tener:

- Una primera hoja con datos.
- Encabezados en la primera fila util.
- Columnas identificables.
- Datos sin protecciones que impidan su lectura.

## 3.2. Reglas para identificadores

- Captura un carven por linea cuando uses un area de texto.
- No agregues comas ni puntos y coma.
- Puedes dejar espacios al inicio o al final; el sistema intenta recortarlos.
- Conserva los ceros iniciales de los identificadores.
- Revisa que no hayas seleccionado una columna equivocada.

## 3.3. Descargas

Los archivos generados se descargan desde el navegador. Si no inicia la descarga:

- Revisa si el navegador bloqueo ventanas o descargas multiples.
- Revisa la carpeta de Descargas.
- Intenta descargar un archivo individual.
- No cierres la pantalla antes de completar la descarga de Leyendas.

## 3.4. Resultados no encontrados

Un registro no encontrado no siempre significa que el sistema fallo. Puede indicar que:

- El identificador no existe.
- Se selecciono el tipo equivocado.
- El carven no pertenece al filtro de Verificacion EDOMEX.
- Hay ceros iniciales o espacios diferentes.
- El dato esta en otro ambiente o base de datos.

---

# 4. Verificacion EDOMEX

## 4.1. Que hace

La Verificacion busca los carven proporcionados en la base de datos y devuelve solamente los registros relacionados con el Estado de Mexico y los municipios configurados en el sistema.

Actualmente la consulta considera:

- Estado de Mexico con clave `15`.
- Municipios con claves `025`, `020` y `122`.

El resultado muestra:

- **Clave:** carven encontrado.
- **CP:** codigo postal.
- **Municipio:** nombre del municipio.
- **Estado:** nombre del estado.

## 4.2. Verificacion usando un archivo Excel

1. Abre la pantalla principal en `/` o `/proyect-one`.
2. En **Modo**, selecciona **Analizar columna**.
3. Pulsa **Anadir archivos**.
4. Selecciona uno o varios archivos `.xlsx` o `.xls`.
5. Espera a que la pantalla lea el primer archivo.
6. Revisa las columnas detectadas.
7. En **Columna a analizar**, selecciona la columna que contiene los carven.
8. Pulsa **Procesar N archivo(s)**.
9. Para cada archivo, captura la hora en formato `HHMM`.
10. Revisa la tabla de resultados.
11. Pulsa **Descargar** para un archivo o **Descargar todos** para todos los archivos.

La columna seleccionada se utiliza para todos los archivos cargados. Si los archivos tienen encabezados diferentes, revisalos antes de procesarlos.

## 4.3. Verificacion manual

1. Pulsa **Buscar manual**.
2. Escribe un carven por linea.
3. Revisa el contador de carven ingresados.
4. Pulsa **Verificar carven**.
5. Espera la respuesta.
6. Revisa los datos encontrados.
7. Si hay resultados, descarga el Excel.

Ejemplo:

```text
100000001
100000002
100000003
```

Las lineas vacias no se consideran.

## 4.4. Modo Solo renombrar

La pantalla tiene el modo **Solo renombrar**. Esta opcion no consulta carven ni envia datos al backend.

Uso:

1. Selecciona **Solo renombrar** en el campo **Modo**.
2. Pulsa **Anadir archivos**.
3. Selecciona los archivos.
4. Pulsa **Procesar N archivo(s)**.
5. Captura una hora para cada archivo.
6. Descarga los archivos con el nombre generado.

Este modo conserva el contenido del archivo original. Solo se utiliza para generar la nomenclatura de salida.

## 4.5. Datos para el nombre de descarga

Antes de descargar, revisa:

- **Cliente:** ATT, GMF o TOYOTA.
- **Quien envia:** hasta cuatro caracteres.
- **Fecha:** seis digitos en formato `DDMMYY`.
- **P1 / P2:** aplica para ATT.
- **SUS / CAN:** aplica para ATT.
- **Hora:** cuatro digitos en formato `HHMM`.

Ejemplos de nombres:

```text
ATT_210826_IAN_SUS_P2_1245.xlsx
GMF_210826_IAN_1245.xlsx
TYT_210826_IAN_1245.xlsx
```

El nombre se genera al momento de descargar. Si cambias los selectores antes de descargar, el nombre puede cambiar.

## 4.6. Mensajes de la Verificacion

- **No se enviaron claves:** no se proporcionaron carven.
- **No se encontraron datos:** los carven no cumplen los filtros o no existen.
- **Error al verificar:** revisa la conexion con el servidor.
- **Hora invalida:** usa exactamente cuatro digitos, por ejemplo `0830`.
- **La columna no contiene datos:** selecciona otra columna o revisa el archivo.

---

# 5. Botar Carven

## 5.1. Que hace

El boton **Botar Carven** elimina los registros de ingresos cuya fecha es igual o posterior a la fecha actual de la base de datos.

La operacion utiliza:

```text
DELETE /verificacion/borrar-ingresos
```

No elimina una lista especifica de carven. Puede afectar todos los registros de `tbingresos` que cumplan la condicion de fecha.

## 5.2. Procedimiento

1. Verifica que no haya procesos de carga o consulta pendientes.
2. Confirma con el responsable que la limpieza esta autorizada.
3. Pulsa **Botar Carven**.
4. Lee el mensaje de confirmacion.
5. Si estas seguro, confirma la operacion.
6. Espera el resultado.
7. Guarda la cantidad de registros eliminados.

Respuesta esperada:

```text
Registros botados exitosamente
Registros botados: N
```

## 5.3. Advertencia importante

Esta accion es destructiva. Antes de confirmarla:

- Asegurate de que los registros del dia ya no sean necesarios.
- Verifica que exista un respaldo o una forma autorizada de recuperacion.
- No la uses como prueba de conexion.
- No la ejecutes varias veces por si la pantalla tarda en responder.

Si se ejecuto por error, informa de inmediato al responsable de base de datos. No intentes corregirlo realizando cambios manuales.

## 5.4. Si aparece un error

- **Error de conexion:** confirma que el backend este activo.
- **Error del servidor:** guarda el mensaje y la hora.
- **No cambia la pantalla:** revisa si la operacion pudo haberse ejecutado antes de volver a pulsar.
- **Se eliminaron cero registros:** puede no haber registros con fecha actual o posterior.

---

# 6. Leyendas

## 6.1. Que hace

Leyendas prepara archivos Excel para los tipos **Leyendas** o **Gestiones**. Ademas:

- Convierte las columnas seleccionadas a texto.
- Conserva ceros iniciales y codigos.
- Divide archivos grandes.
- Genera archivos `.xls`.
- Permite descargar cada parte o todas las partes.

El limite de cada archivo generado es de **64,999 registros**.

## 6.2. Cargar un archivo

1. Entra a `/leyendas`.
2. Selecciona una cartera.
3. Selecciona el tipo de archivo.
4. Captura la fecha.
5. Carga o arrastra el archivo Excel.
6. Espera a que se muestren las columnas.

Carteras disponibles:

- Scotiabank.
- BBVA.
- ATT.
- GMF.
- Toyota.

Tipos disponibles:

- Leyendas.
- Gestiones.

## 6.3. Seleccionar la cartera

La cartera determina parte del nombre del archivo:

| Opcion     | Codigo de salida |
| ---------- | ---------------- |
| Scotiabank | `SCOT`           |
| BBVA       | `BBVA`           |
| ATT        | `ATT`            |
| GMF        | `GMF`            |
| Toyota     | `TYT`            |

Si seleccionas GMF, aparece el campo **Tipo GMF** con estas opciones:

- `HER`
- `VIS`
- `DEV`

## 6.4. Seleccionar el tipo de archivo

En **Tipo de archivo**, elige:

- **Leyendas:** genera nombres con prefijo `LEY`.
- **Gestiones:** genera nombres con prefijo `GEST`.

## 6.5. Capturar la fecha

La fecha debe tener seis digitos en formato `DDMMYY`.

Ejemplos:

```text
210826
010926
311226
```

No uses diagonales ni guiones en este campo.

## 6.6. Columnas a texto

Al cargar el archivo, todas las columnas se seleccionan como texto por defecto.

Puedes:

- Dejar todas seleccionadas.
- Desmarcar columnas individuales.
- Pulsar **Deseleccionar todas**.
- Pulsar **Seleccionar todas**.

Conviene seleccionar como texto las columnas que contengan:

- Carven.
- Numeros de credito.
- Codigos con ceros iniciales.
- Telefonos.
- Folios.
- Identificadores largos.

Ejemplo: el valor `000123` debe conservarse como `000123` y no convertirse en `123`.

## 6.7. Procesar y descargar

1. Confirma cartera, tipo y fecha.
2. Revisa las columnas seleccionadas.
3. Pulsa **Procesar**.
4. Espera el mensaje de avance.
5. Revisa la cantidad de archivos generados.
6. Descarga cada archivo o pulsa **Descargar todos**.

Nombres de ejemplo:

```text
LEY_SCOT_210826.xls
LEY_SCOT_210826_1.xls
LEY_SCOT_210826_2.xls
GEST_GMF_HER_210826.xls
```

## 6.8. Division de archivos

La division funciona de la siguiente manera:

| Registros | Archivos esperados |
| --------: | -----------------: |
|    10,000 |                  1 |
|    64,999 |                  1 |
|    65,000 |                  2 |
|   130,000 |                  2 |
|   130,001 |                  3 |

Los encabezados se incluyen en cada parte.

## 6.9. Problemas frecuentes

- **No se detectan columnas:** revisa que la primera hoja tenga encabezados.
- **Archivo no soportado:** usa `.xls` o `.xlsx`.
- **Archivo vacio:** agrega datos en la primera hoja.
- **Se pierden ceros iniciales:** selecciona la columna como texto.
- **El navegador se congela:** intenta con un archivo mas pequeno o usa la ruta de procesamiento en servidor.
- **No aparece la descarga:** revisa los bloqueos de descarga del navegador.

---

# 7. Status

## 7.1. Que hace

La pantalla **Status** cambia el valor de `STNCVESTATUS` para los carven que captures.

El identificador utilizado es el carven o `DEACVEDEUDOR`.

## 7.2. Procedimiento

1. Entra a `/status`.
2. En **Status**, captura el codigo que deseas asignar.
3. En **Carven**, escribe un carven por linea.
4. Revisa que no haya lineas incorrectas.
5. Pulsa **Cambiar Status**.
6. Espera el resultado.
7. Revisa cuantos fueron actualizados y cuantos no fueron encontrados.
8. Descarga el Excel si necesitas conservar evidencia.

Ejemplo:

```text
123456789
123456790
123456791
```

## 7.3. Capturar el status

El sistema acepta cualquier status que no este vacio. El usuario debe confirmar que el codigo sea valido de acuerdo con el catalogo operativo de la empresa.

Ejemplo:

```text
42
```

## 7.4. Interpretar el resultado

- **Actualizado:** el carven se encontro y se cambio el status.
- **No encontrado:** el carven no existe en la base de datos o no coincide con el valor capturado.
- **Total enviado:** cantidad de carven validos enviados.
- **Actualizadas:** cantidad de carven encontrados y actualizados.
- **Claves no encontradas:** lista de carven que no se actualizaron.

La pantalla muestra una tabla y permite descargar:

```text
cambio_status_YYYY-MM-DD.xlsx
```

## 7.5. Precauciones

Antes de pulsar **Cambiar Status**:

- Confirma el codigo de status.
- Revisa la lista completa.
- Verifica que estas en el ambiente correcto.
- Guarda el archivo original si proviene de otra fuente.
- No recargues ni cierres la pagina mientras se procesa.

## 7.6. Mensajes comunes

- **Por favor, ingresa el status:** falta el codigo.
- **Por favor, ingresa al menos un carven:** el area esta vacia.
- **No se encontraron carven validos:** solo habia lineas vacias.
- **Error al procesar los carven:** revisa conexion y respuesta del backend.

---

# 8. Devoluciones

## 8.1. Que hace

Devoluciones actualiza dos datos del registro:

- `STNCVESTATUS`: codigo de status.
- `DEFFECDEVOLUCION`: fecha de devolucion.

Puedes buscar el registro por:

- **CARVEN:** busca en `DEACVEDEUDOR`.
- **NUMERO DE CREDITO:** busca en `DEANUMCREDITO`.

## 8.2. Preparar el archivo

El archivo debe ser `.xlsx` o `.xls` y tener una columna para cada dato que se va a usar.

Ejemplo:

| CARVEN    | FECHA      | COD STATUS |
| --------- | ---------- | ---------- |
| 123456789 | 19/08/2026 | 69         |
| 123456790 | 20/08/2026 | 70         |

Los nombres de las columnas pueden ser diferentes. La pantalla muestra las columnas detectadas para que selecciones la correcta.

## 8.3. Cargar el archivo

1. Entra a `/devoluciones`.
2. Selecciona o arrastra un archivo Excel.
3. Espera a que aparezca el nombre del archivo.
4. Revisa el resumen de columnas.
5. Observa la cantidad de registros y el ejemplo de cada columna.

Si el archivo no se puede leer, revisa que no este corrupto y que tenga datos en la primera hoja.

## 8.4. Elegir el tipo de identificador

En **Tipo de Identificador**, selecciona:

- **CARVEN**, si el archivo contiene carven.
- **NUMERO DE CREDITO**, si el archivo contiene numeros de credito.

Esta seleccion determina la columna de la base de datos donde se buscara cada registro.

## 8.5. Seleccionar la columna del identificador

En el campo **CARVEN** o **NUM CREDITO**:

1. Abre la lista.
2. Selecciona la columna correcta.
3. Confirma que los ejemplos mostrados coincidan con el tipo de dato.

No selecciones una columna de nombre, telefono o status por error.

## 8.6. Seleccionar la fecha

En **FECHA**, puedes:

- Elegir una columna del archivo.
- Elegir **OTRA FECHA** para aplicar una fecha fija a todas las filas.

La fecha fija debe tener este formato:

```text
dd/mm/aaaa
```

Ejemplo:

```text
19/08/2026
```

El sistema puede convertir fechas seriales de Excel automaticamente. Aun asi, revisa los datos antes de procesar.

## 8.7. Seleccionar el codigo de status

En **COD STATUS**, puedes:

- Elegir una columna del archivo.
- Elegir **OTRO STATUS** para aplicar el mismo codigo a todas las filas.

Ejemplo de status fijo:

```text
69
```

## 8.8. Procesar devoluciones

1. Confirma el tipo de identificador.
2. Confirma la columna del identificador.
3. Confirma la fecha o la fecha fija.
4. Confirma el status o el status fijo.
5. Pulsa **Procesar Devoluciones**.
6. Espera a que termine el proceso.
7. Revisa cada resultado.
8. Descarga el reporte si lo necesitas.

## 8.9. Interpretar el resultado

- **Actualizado:** el identificador fue encontrado y se actualizaron status y fecha.
- **No encontrado:** no existe un registro con ese carven o numero de credito.
- **Total enviados:** cantidad de filas validas procesadas.
- **Actualizados:** cantidad de registros encontrados.
- **No encontrados:** cantidad de identificadores sin coincidencia.

El archivo de resultados se descarga con un nombre parecido a:

```text
devoluciones_YYYY-MM-DD.xlsx
```

## 8.10. Formato de fechas aceptado

Correctos:

```text
01/08/2026
19/08/2026
31/12/2026
```

No uses:

```text
2026-08-19
19-08-2026
19/8/2026
```

## 8.11. Problemas frecuentes

- **No se encontraron registros validos:** faltan identificador, status o fecha.
- **Fecha invalida:** usa `dd/mm/aaaa`.
- **Todos aparecen como no encontrados:** revisa el tipo de identificador y la columna seleccionada.
- **No se detectan columnas:** revisa la primera hoja y los encabezados.
- **Error al procesar:** guarda el mensaje y revisa la conexion con el backend.

---

# 9. Resultados y evidencia

## 9.1. Que guardar

Para cada proceso que modifique datos o genere archivos, conserva:

- Archivo original.
- Fecha y hora de la operacion.
- Usuario que realizo la operacion.
- Parametros seleccionados.
- Resultado mostrado.
- Archivo de resultados.
- Lista de registros no encontrados.
- Mensaje de error, si existio.

## 9.2. Como revisar un resultado

Antes de dar por terminado un proceso:

1. Compara la cantidad enviada contra la cantidad actualizada.
2. Revisa los registros no encontrados.
3. Abre el Excel descargado.
4. Confirma que los encabezados sean correctos.
5. Verifica que los ceros iniciales se hayan conservado.
6. Reporta cualquier diferencia al responsable.

---

# 10. Solucion de problemas para el usuario

## 10.1. La pantalla no carga

- Verifica tu conexion de red.
- Recarga una sola vez.
- Confirma que la direccion sea la correcta.
- Reporta la hora y el mensaje mostrado.

## 10.2. Error de conexion con el servidor

- No repitas inmediatamente una operacion de Status, Devoluciones o Botar Carven.
- Informa al soporte.
- Indica que funcion estabas usando.
- Conserva el archivo de entrada.
- Espera confirmacion antes de volver a intentar.

## 10.3. El archivo no se puede cargar

- Confirma que sea `.xls` o `.xlsx`.
- Abre el archivo en Excel y guardalo nuevamente.
- Revisa que la primera hoja tenga encabezados.
- Elimina protecciones o celdas dañadas.
- Intenta con un archivo pequeno de prueba.

## 10.4. El archivo descargado no aparece

- Revisa la carpeta de Descargas.
- Revisa las descargas bloqueadas del navegador.
- Descarga un archivo individual.
- No cierres la pantalla mientras existan archivos pendientes.

## 10.5. Hay registros no encontrados

- Revisa el identificador.
- Confirma el tipo seleccionado.
- Revisa ceros iniciales.
- Confirma que estas en el ambiente correcto.
- No cambies datos manualmente sin autorizacion.

---

# 11. Buenas practicas

- Revisa dos veces los datos antes de procesar.
- Usa nombres de archivo claros y conserva el original.
- No compartas contrasenas ni informacion sensible.
- No cierres la pantalla durante una carga o actualizacion.
- No ejecutes Botar Carven como prueba.
- No presiones varias veces el mismo boton si la pantalla tarda.
- Descarga y conserva los resultados.
- Reporta errores con capturas y hora exacta.
- Usa archivos pequenos para validar un formato nuevo.
- Confirma con el supervisor antes de operaciones masivas.

---

# 12. Referencia rapida

| Funcion      | Ruta            | Accion principal                               |
| ------------ | --------------- | ---------------------------------------------- |
| Verificacion | `/`             | Analizar archivo o buscar carven manualmente   |
| Botar Carven | `/`             | Confirmar la limpieza de ingresos              |
| Leyendas     | `/leyendas`     | Cargar, convertir, dividir y descargar Excel   |
| Status       | `/status`       | Capturar status y carven, y actualizar         |
| Devoluciones | `/devoluciones` | Cargar Excel y actualizar por carven o credito |

## Formatos clave

```text
Fecha de Verificacion y Leyendas: DDMMYY
Hora de archivos: HHMM
Fecha de Devoluciones: dd/mm/aaaa
Archivos: .xlsx o .xls
Maximo por archivo de Leyendas: 64,999 registros
```

## Datos de soporte

Cuando solicites ayuda, proporciona:

1. Funcion utilizada.
2. Fecha y hora.
3. Nombre del archivo, sin incluir contrasenas.
4. Cantidad de registros.
5. Mensaje exacto del error.
6. Si la operacion alcanzo a mostrar resultados.

No compartas credenciales, contrasenas ni archivos con informacion sensible fuera de los canales autorizados.
