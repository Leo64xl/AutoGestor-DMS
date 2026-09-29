import Icono from "./Icono";

/** Componentes de presentacion reutilizados por todas las paginas. */

export function Campo({ etiqueta, children, ancho }) {
  return (
    <label className="campo" style={ancho ? { gridColumn: `span ${ancho}` } : undefined}>
      <span>{etiqueta}</span>
      {children}
    </label>
  );
}

export function Panel({ titulo, acciones, children }) {
  return (
    <section className="panel">
      {(titulo || acciones) && (
        <header className="panel-encabezado">
          {titulo && <h2>{titulo}</h2>}
          {acciones && <div className="panel-acciones">{acciones}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Etiqueta({ valor, tipo = "neutro" }) {
  return <span className={`etiqueta etiqueta-${tipo}`}>{valor}</span>;
}

export function Vacio({ texto, icono = "vacio" }) {
  return (
    <div className="vacio">
      <Icono nombre={icono} tamano={30} />
      <span>{texto}</span>
    </div>
  );
}

export function Modal({ titulo, onCerrar, children, className = "" }) {
  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className={`modal ${className}`.trim()} role="dialog" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <header className="modal-encabezado">
          <h2>{titulo}</h2>
          <button type="button" className="boton-icono" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="modal-cuerpo">{children}</div>
      </div>
    </div>
  );
}
