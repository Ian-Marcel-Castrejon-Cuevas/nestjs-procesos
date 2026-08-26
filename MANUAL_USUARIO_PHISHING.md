# Manual de usuario
## Módulo de phishing educativo Carven2

**Proyectos:** `nestjs-procesos` y `proyecto-one`  
**Versión:** 1.0  
**Fecha:** 21/08/2026

> El módulo se utiliza únicamente para capacitación y pruebas autorizadas. No captures contraseñas reales.

## 1. Propósito y alcance

### 1.1. Propósito

Explicar cómo utilizar Carven2 para registrar visitas e intentos de una simulación educativa de phishing y consultar sus resultados.

### 1.2. Alcance

Este manual cubre:

- Pantalla de simulación: `/carven2`.
- Panel administrativo: `/carven2/admin`.
- Consulta de registros.
- Estadísticas.
- Exportación de información.
- Eliminación de registros autorizada.

## 2. Requisitos básicos

- Tener acceso a la aplicación y a la red correspondiente.
- Utilizar un navegador actualizado.
- Contar con autorización para realizar el ejercicio.
- No usar información ni credenciales reales.
- Tener habilitadas las descargas del navegador si se necesitan reportes.

## 3. Pantalla Carven2

Ruta:

```text
/carven2
```

Al abrir la pantalla, el sistema registra automáticamente una **visita**.

La pantalla muestra un formulario con:

- **CH**
- **Contraseña de Carven**

### 3.1. Capturar un intento

1. Escribe un CH con el formato `CH` seguido de números.
2. Escribe una contraseña de prueba de al menos cuatro caracteres.
3. Pulsa **Verificar Acceso**.
4. Espera el mensaje educativo.

Ejemplo de CH válido:

```text
CH1234
```

El sistema guarda el tipo de actividad, fecha y hora, IP, navegador y página de origen.

## 4. Panel administrativo

Ruta:

```text
/carven2/admin
```

El panel es únicamente para personal autorizado.

### 4.1. Acceder

1. Abre `/carven2/admin`.
2. Captura la contraseña administrativa proporcionada por el responsable.
3. Pulsa **Acceder**.
4. Espera a que carguen los registros y estadísticas.

La contraseña configurada actualmente es `admin123`. Debe cambiarse y protegerse antes de usar el sistema en un ambiente real.

### 4.2. Información disponible

El panel muestra:

- **Total de registros.**
- **Registros de hoy.**
- **Intentos de login.**
- **Visitas.**
- Detalle de cada registro: ID, CH, contraseña capturada, IP, fecha/hora y tipo.

Los registros aparecen del más reciente al más antiguo.

## 5. Exportar información

El panel cuenta con estas opciones:

### Exportar a TXT

Genera un archivo de texto con el detalle de los registros.

### Exportar a Excel

Genera un archivo CSV que puede abrirse con Excel. Aunque el botón dice Excel, el archivo descargado es `.csv`.

### Ver JSON

Abre los registros en formato JSON en otra pestaña del navegador.

### Descargar JSON

Descarga el archivo original de registros.

Las exportaciones contienen información sensible. Guárdalas únicamente en ubicaciones autorizadas y no las compartas por canales personales.

## 6. Eliminar registros

### 6.1. Eliminar un registro

1. Localiza el registro en la tabla.
2. Pulsa **Eliminar**.
3. Confirma la acción.
4. Verifica que el registro ya no aparezca.

### 6.2. Eliminar todos los registros

1. Pulsa **Eliminar todos**.
2. Confirma que cuentas con autorización.
3. Exporta o respalda la información si debe conservarse.
4. Confirma la eliminación.

Esta acción es irreversible desde la pantalla y elimina todos los registros guardados.

## 7. Problemas comunes

### La pantalla no carga

- Revisa la conexión de red.
- Confirma que el servidor esté activo.
- Recarga la página.
- Reporta la hora y el mensaje mostrado.

### No se registra la visita o el intento

- Confirma que el CH tenga el formato correcto.
- Revisa la conexión con el servidor.
- Informa al soporte sin repetir muchas veces el envío.

### El panel aparece vacío

- Confirma que el backend esté activo.
- Verifica que estés en la dirección correcta.
- Solicita al responsable revisar el archivo de registros.

### No se descarga el archivo

- Revisa la carpeta de Descargas.
- Permite las descargas del sitio.
- Intenta descargar un archivo a la vez.

## 8. Buenas prácticas

- Usa únicamente datos de prueba.
- No compartas la contraseña administrativa.
- Exporta los resultados antes de eliminar información.
- No elimines registros sin autorización.
- Guarda los reportes en una ubicación protegida.
- Informa cualquier error con la fecha, hora y pantalla donde ocurrió.

## 9. Checklist rápido

- [ ] El ejercicio está autorizado.
- [ ] No se usan credenciales reales.
- [ ] `/carven2` carga correctamente.
- [ ] Se registra una visita al abrir la pantalla.
- [ ] El intento de prueba aparece en el panel.
- [ ] Las estadísticas se muestran correctamente.
- [ ] Las exportaciones funcionan.
- [ ] Las eliminaciones fueron autorizadas.
