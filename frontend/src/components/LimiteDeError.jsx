import { Component } from "react";

/**
 * Evita la pantalla en blanco: si una vista lanza un error durante el render,
 * React 19 desmonta todo el arbol. Este limite atrapa el error, lo muestra
 * y permite volver al inicio sin recargar la aplicacion.
 */
export default class LimiteDeError extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Error en la vista:", error, info);
  }

  componentDidUpdate(prevProps) {
    // Al cambiar de vista se limpia el error para poder reintentar.
    if (prevProps.vista !== this.props.vista && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <section className="panel">
        <h2>No se pudo mostrar esta seccion</h2>
        <p className="nota">
          Ocurrio un error al dibujar la vista. El detalle tambien queda en la consola del navegador (F12).
        </p>
        <pre className="detalle-error">{String(this.state.error?.message || this.state.error)}</pre>
        <div className="panel-acciones">
          <button className="boton boton-primario" onClick={() => this.props.onVolver?.()}>
            Volver al inicio
          </button>
          <button className="boton" onClick={() => window.location.reload()}>
            Recargar la aplicacion
          </button>
        </div>
      </section>
    );
  }
}
