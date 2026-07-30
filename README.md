# Laboratorio JMeter — API de demo

Proyecto de ejemplo para exponer pruebas de carga con Apache JMeter, con una API mínima en Node.js y un pipeline de integración continua en GitHub Actions.

## 1. Requisitos (instalación única)

| Herramienta | Enlace | Verificación |
|---|---|---|
| Java 17 | https://adoptium.net/temurin/releases/?version=17 | `java -version` |
| Apache JMeter 5.6.3 | https://jmeter.apache.org/download_jmeter.cgi | descomprimir el `.zip` en `C:\jmeter` |
| Node.js LTS | https://nodejs.org | `node -v` |

## 2. Levantar la API de prueba

Abre una terminal (CMD/PowerShell) en la carpeta `api/`:

```
cd api
npm install
npm start
```

Deberías ver el mensaje: `API de prueba corriendo en http://localhost:3000`

Deja esa ventana abierta durante toda la demo. Puedes probar la API directamente en el navegador entrando a `http://localhost:3000/health`.

### Endpoints disponibles

| Endpoint | Método | Qué demuestra |
|---|---|---|
| `/health` | GET | Caso exitoso simple (200) |
| `/users` | GET | Respuesta con body en JSON |
| `/users/:id` | GET | Uso de variables en la URL |
| `/users` | POST | Envío de body en JSON |
| `/slow?ms=1500` | GET | Tiempo de respuesta alto (visible en el reporte) |
| `/error` | GET | Siempre responde 500 (visible el % de error) |
| `/heavy?n=35` | GET | Cálculo intensivo en CPU, bloquea el event loop a propósito |
| `/status` | GET | Estado en vivo del contador de solicitudes concurrentes |

## 3. Abrir JMeter (modo gráfico) y cargar el plan

1. Doble clic en `C:\jmeter\bin\jmeter.bat` (tarda unos segundos en abrir).
2. Ir a `File → Open` y seleccionar `demo-test-plan.jmx`.
3. En el árbol lateral verás: **Test Plan → HTTP Request Defaults → Header Manager → Thread Group → (6 samplers + 2 listeners)**.

### Qué mostrar en la interfaz gráfica durante la exposición

- **Thread Group**: haz clic ahí para mostrar *Number of Threads* (usuarios), *Ramp-up* y *Loop Count*. Es literalmente "cuántos usuarios simulo y qué tan rápido los voy metiendo".
- Abre un **sampler** (por ejemplo `GET /users`) para mostrar el método, el path, y el **Response Assertion** que tiene como hijo.
- Ejecuta con pocos threads (por ejemplo 2) usando el botón ▶ verde, y muestra el **View Results Tree** con la solicitud y la respuesta real de cada llamada.

## 4. Ejecutar en modo consola (headless)

El modo gráfico **no se utiliza para medir carga real**, porque consume recursos propios y distorsiona los resultados. Para una medición real:

1. Sube el Thread Group a valores más representativos, por ejemplo 50 threads / ramp-up 10 / loops 10, antes de correr en consola (así se nota la diferencia frente al modo gráfico).
2. Abre una terminal en la carpeta donde está el `.jmx` y ejecuta:

```
C:\jmeter\bin\jmeter.bat -n -t demo-test-plan.jmx -l resultado.jtl -e -o reporte
```

| Parámetro | Función |
|---|---|
| `-n` | Modo no-GUI |
| `-t` | Archivo del test plan |
| `-l` | Archivo donde se guardan los resultados en crudo |
| `-e -o` | Genera un reporte HTML en la carpeta `reporte/` |

3. Al finalizar, abre `reporte/index.html` en el navegador. Ahí están los gráficos de tiempos de respuesta, throughput, porcentaje de errores y percentiles — este es el cierre más visual de la exposición.

## 5. Automatización con GitHub Actions

Este repositorio incluye un workflow (`.github/workflows/load-test.yml`) que ejecuta la prueba de carga automáticamente cada vez que se abre un **Pull Request hacia `main`**. El objetivo es que la prueba de rendimiento sea parte del control de calidad antes de fusionar cambios, no un paso manual aparte.

### Cómo probarlo en vivo

```bash
# Parado sobre main, actualizado
git checkout main
git pull origin main

# Crear una branch nueva para el cambio de prueba
git checkout -b demo/prueba-carga

# Hacer cualquier cambio pequeño (ej. un comentario o un endpoint nuevo)
git add .
git commit -m "demo: disparar pipeline de carga"
git push origin demo/prueba-carga
```

Luego, desde GitHub, abre un Pull Request de `demo/prueba-carga` hacia `main`. En cuanto lo abras, el workflow se dispara automáticamente en la pestaña **Actions** del repositorio — ahí puedes mostrar en vivo cómo corre JMeter en modo consola, genera el reporte, y aprueba o bloquea el PR según los umbrales configurados.

### Qué valida el workflow

- Porcentaje de error total (`errorPct`), leído del `statistics.json` que genera el propio reporte HTML de JMeter.
- Tiempo de respuesta promedio (`meanResTime`).

Si alguno de los dos supera el umbral definido en el workflow, el job termina en rojo y el Pull Request queda bloqueado para fusionar (si además se configura la protección de rama, ver sección 6).

## 6. Proteger la rama `main` (recomendado para la demo)

En GitHub: `Settings → Branches → Add branch protection rule` sobre `main`, y activar *Require status checks to pass before merging*, seleccionando el job del workflow. Con esto, nadie puede fusionar un Pull Request si la prueba de carga falla — es el "quality gate" real del que se habla en la exposición.

## 7. Temas para preguntas frecuentes

- **CSV Data Set Config**: permite parametrizar con datos externos (por ejemplo 1000 usuarios distintos desde un `.csv`) en vez de una única variable fija. No está armado en este ejemplo, pero es el paso natural siguiente a la variable `userId` que ya se usa.
- **Correlación**: extraer un valor de una respuesta (un token o un id) con un extractor (Regex/JSON) y reutilizarlo en la siguiente solicitud. Útil en flujos tipo login → uso de token.
- **Pruebas distribuidas**: ejecutar JMeter desde varias máquinas al mismo tiempo cuando una sola no genera carga suficiente.