import IlustracionVehiculo from "./IlustracionVehiculo";

/**
 * Estructura comun de las pantallas de acceso: el formulario a la izquierda y
 * el panel de marca a la derecha. Lo comparten el inicio de sesion y el cambio
 * obligatorio de contrasena (RF-001, RF-002) para que se vean como una sola pieza.
 */
export default function PantallaAcceso({ titulo, descripcion, children }) {
  return (
    <div className="acceso">
      <section className="acceso-panel">
        <div className="acceso-contenido">
          <div className="marca">
            <span className="marca-sigla">AG</span>
            <div>
              <strong>AutoGestor DMS</strong>
              <small>Concesionaria Automotriz del Valle</small>
            </div>
          </div>

          <header className="acceso-encabezado">
            <h1>{titulo}</h1>
            <p>{descripcion}</p>
          </header>

          {children}
        </div>
        
      </section>

      <aside className="acceso-marca" aria-hidden="true">
        <div className="acceso-marca-contenido">
          <IlustracionVehiculo />
          <h2>Tu piso de venta, bajo control</h2>
          <p>
            Inventario, prospectos, cotizaciones, apartados y ventas en un solo sistema, con trazabilidad completa de cada
            operacion.
          </p>
          <ul className="acceso-puntos">
            <li>Catalogo y disponibilidad en tiempo real</li>
            <li>Del prospecto a la entrega, sin perder el hilo</li>
            <li>Indicadores del negocio siempre a la mano</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
