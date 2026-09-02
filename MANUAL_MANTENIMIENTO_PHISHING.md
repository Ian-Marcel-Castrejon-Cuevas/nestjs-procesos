# Manual de mantenimiento

## Módulo de phishing educativo Carven2

**Proyectos:** `nestjs-procesos` y `proyecto-one`  
**Versión:** 1.0  
**Fecha:** 21/08/2026

> Este módulo se utiliza únicamente para capacitación y pruebas autorizadas. No deben capturarse credenciales reales.

## 1. Propósito y alcance

### 1.1. Propósito

Definir las tareas básicas para mantener funcionando el módulo Carven2, sus registros, exportaciones y panel administrativo.

### 1.2. Alcance

Aplica únicamente a:

- `proyecto-one/src/components/Carven2.jsx`
- `proyecto-one/src/components/AdminPanel.jsx`
- `proyecto-one/src/App.jsx`
- `nestjs-procesos/src/phishing`
- `phishing_registros.json`
- Carpeta `temp/`

## 2. Componentes que se deben revisar

| Componente                | Revisión principal                   |
| ------------------------- | ------------------------------------ |
| `/carven2`                | Registro de visitas e intentos       |
| `/carven2/admin`          | Consulta, estadísticas y eliminación |
| `PhishingService`         | Lectura y escritura del JSON         |
| `phishing_registros.json` | Integridad de los registros          |
| `temp/`                   | Archivos CSV temporales              |

## 3. Arranque y verificación

Backend:

```powershell
npm run start:dev
```

Frontend:

```powershell
npm run dev
```

Verificar que:

- `/carven2` cargue correctamente.
- Se registre una visita al abrir la pantalla.
- `/carven2/admin` permita consultar datos.
- El frontend y backend utilicen el host y puerto correctos.
- El frontend debe apuntar al endpoint configurado para el entorno; usa `http://localhost:3001` en desarrollo local.
- NestJS usa `PORT` o `3001` por defecto.

## 4. Respaldo

Antes de eliminar registros o modificar el módulo:

1. Detén las operaciones activas.
2. Copia `phishing_registros.json`.
3. Agrega fecha y hora al nombre del respaldo.
4. Valida que el archivo sea JSON válido.
5. Guarda la copia en una ubicación protegida.

Ejemplo:

```text
phishing_registros_backup_2026-08-21.json
```

El archivo `phishing_registros.db` no reemplaza este respaldo, porque el servicio actual utiliza el archivo JSON.

## 5. Limpieza de archivos

Revisa periódicamente la carpeta:

```text
temp/
```

Elimina únicamente CSV que ya no sean necesarios y conserva los archivos solicitados como evidencia. No borres archivos mientras exista una descarga en curso.

## 6. Diagnóstico rápido

### No se registran visitas o intentos

- Revisa la consola del navegador.
- Confirma que el backend esté activo.
- Verifica IP, puerto y CORS.
- Revisa permisos de escritura.
- Confirma que `phishing_registros.json` exista y sea válido.

### El panel no carga datos

- Confirma la ruta `/phishing/registros`.
- Revisa que el backend use el mismo `process.cwd()` donde está el JSON.
- Verifica que el archivo tenga la propiedad `registros`.

### Falla una exportación

- Revisa permisos y espacio en `temp/`.
- Confirma que el navegador permita descargas.
- Revisa los logs del backend.

### Se perdieron registros

No sobrescribas el archivo actual. Haz una copia, conserva los logs y revisa respaldos y exportaciones antes de reiniciar o restaurar.

## 7. Mantenimiento preventivo

### Diario

- Confirmar que el frontend cargue.
- Confirmar que el backend responda.
- Revisar errores recientes.
- Revisar espacio en disco.

### Semanal

- Respaldar `phishing_registros.json`.
- Revisar y limpiar CSV temporales.
- Confirmar que las estadísticas sean razonables.
- Verificar permisos del archivo JSON.

### Antes de publicar cambios

```powershell
npm run build
```

Después prueba `/carven2`, el registro de visita y `/carven2/admin`.

## 8. Seguridad

- No uses credenciales reales.
- La contraseña administrativa se configura mediante `PHISHING_ADMIN_PASSWORD` y nunca debe escribirse en el código.
- Protege los endpoints administrativos.
- No expongas `/phishing/ver` sin autenticación.
- No compartas exportaciones sin autorización.
- Restringe el acceso por red o proxy.
- Usa HTTPS en ambientes productivos.
- Define una política de retención y eliminación.

## 9. Checklist de cierre

- [ ] El ejercicio o cambio fue autorizado.
- [ ] Existe respaldo del JSON.
- [ ] Frontend y backend están disponibles.
- [ ] `/carven2` registra visitas.
- [ ] El panel administrativo carga estadísticas.
- [ ] Las exportaciones funcionan.
- [ ] No quedan CSV innecesarios en `temp/`.
- [ ] No se modificaron datos sin autorización.
- [ ] Se registró cualquier error o cambio realizado.
