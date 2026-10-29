# Mis Finanzas

App personal para administrar ingresos, gastos, cuentas y presupuestos en el iPhone. Es una app web instalable (PWA): no necesita Mac, App Store ni cuenta de Apple Developer, y funciona sin internet.

Tus datos se guardan **solo en tu iPhone** (IndexedDB). Nada se envía a ningún servidor.

## Instalar en el iPhone

1. Abre en **Safari** la dirección: `https://emiroa21.github.io/finanzas-app/`
2. Toca el botón **Compartir** (el cuadro con la flecha hacia arriba).
3. Elige **Agregar a pantalla de inicio** y luego **Agregar**.
4. Abre la app siempre desde ese icono. La app instalada guarda sus datos aparte de Safari, así que si la abres en una pestaña de Safari verás datos distintos.

## Respaldo

En **Cuentas → Respaldo**, toca **Guardar respaldo** y elige **Guardar en Archivos → iCloud Drive**. Si borras la app o cambias de iPhone, usa **Restaurar respaldo** con ese archivo.

## Qué incluye (MVP)

- Cuentas: efectivo, débito, tarjeta de crédito, ahorro e inversión, con saldo calculado.
- Movimientos: gastos, ingresos y transferencias, con teclado numérico rápido, categoría, fecha y nota.
- Categorías editables con emoji y color.
- Presupuestos mensuales por categoría con alertas al 80% y 100%.
- Reportes: gastos por categoría y comparativo de los últimos 6 meses.
- Ocultar saldo, modo oscuro y exportación a CSV.

## Desarrollo

```bash
npm install
npm run dev      # servidor local
npm run build    # compila a dist/
```

Stack: React 19, TypeScript, Vite, vite-plugin-pwa y Dexie (IndexedDB). Los montos se guardan en centavos (enteros) y en MXN.

Cada push a `main` se publica solo en GitHub Pages con el workflow `.github/workflows/deploy.yml`.
