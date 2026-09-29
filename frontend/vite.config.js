import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// React Compiler queda desactivado a proposito.
//
// El compilador toma las dependencias de cada bloque memoizado a nivel de propiedad y
// emite las comparaciones en el cuerpo del componente, fuera de las guardas. Con el
// patron habitual de esta aplicacion —un formulario en estado null que solo se dibuja
// cuando esta abierto, {formulario && <Modal>...formulario.campo...</Modal>}— genera
// lecturas como  $[n] !== formulario.campo  que se evaluan siempre y lanzan
// "Cannot read properties of null" en cuanto el formulario esta cerrado, dejando la
// vista en blanco. Afectaba a Cotizaciones, Ventas, Financiamiento, Postventa y Usuarios.
//
// Para reactivarlo hay que dar un valor inicial no nulo a cada estado de formulario
// (o extraer cada modal a su propio componente) y volver a verificar el bundle.
export default defineConfig({
  plugins: [react()],
  server: {
    // Dentro de Docker hay que escuchar en todas las interfaces, no solo en
    // el localhost del contenedor, para que el puerto publicado responda.
    host: true,
    port: 5173,
    strictPort: true,
    // En un volumen montado desde Windows o macOS los eventos del sistema de
    // archivos no llegan al contenedor: el sondeo es lo que hace funcionar la
    // recarga en caliente. Fuera de Docker se deja el modo nativo, mas eficiente.
    watch: process.env.VITE_POLLING === 'true' ? { usePolling: true, interval: 300 } : undefined,
  },
})
