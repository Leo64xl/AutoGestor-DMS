import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { cambiarPassword, cerrarSesion, limpiarError } from "../store/authSlice";
import PantallaAcceso from "../components/PantallaAcceso";

const MINIMO = 8;

/** RF-002: pantalla obligatoria en el primer inicio de sesion. */
export default function CambiarPassword() {
  const dispatch = useDispatch();
  const { usuario, cargando, error } = useSelector((state) => state.auth);
  const [datos, setDatos] = useState({ passwordActual: "", passwordNueva: "", confirmacion: "" });
  const [validacion, setValidacion] = useState(null);

  const cambiar = (campo) => (evento) => {
    if (error) dispatch(limpiarError());
    setValidacion(null);
    setDatos({ ...datos, [campo]: evento.target.value });
  };

  const enviar = (evento) => {
    evento.preventDefault();
    if (datos.passwordNueva.length < MINIMO) {
      return setValidacion(`La nueva contrasena debe tener al menos ${MINIMO} caracteres`);
    }
    if (datos.passwordNueva !== datos.confirmacion) {
      return setValidacion("La confirmacion no coincide con la nueva contrasena");
    }
    dispatch(cambiarPassword({ passwordActual: datos.passwordActual, passwordNueva: datos.passwordNueva }));
  };

  return (
    <PantallaAcceso
      titulo="Define tu contrasena"
      descripcion={`Hola ${usuario?.nombre ?? ""}. Por seguridad debes sustituir la contrasena temporal antes de usar el sistema.`}
    >
      <form className="acceso-formulario" onSubmit={enviar}>
        <label className="campo">
          <span>Contrasena temporal</span>
          <input
            type="password"
            value={datos.passwordActual}
            onChange={cambiar("passwordActual")}
            autoComplete="current-password"
            autoFocus
            required
          />
        </label>

        <label className="campo">
          <span>Nueva contrasena (minimo {MINIMO} caracteres)</span>
          <input
            type="password"
            value={datos.passwordNueva}
            onChange={cambiar("passwordNueva")}
            autoComplete="new-password"
            required
          />
        </label>

        <label className="campo">
          <span>Confirma la nueva contrasena</span>
          <input
            type="password"
            value={datos.confirmacion}
            onChange={cambiar("confirmacion")}
            autoComplete="new-password"
            required
          />
        </label>

        {(validacion || error) && <p className="mensaje-error">{validacion || error}</p>}

        <button type="submit" className="boton boton-primario boton-bloque" disabled={cargando}>
          {cargando ? "Guardando..." : "Guardar y continuar"}
        </button>

        <button type="button" className="boton boton-texto" onClick={() => dispatch(cerrarSesion())}>
          Cerrar sesion
        </button>
      </form>
    </PantallaAcceso>
  );
}
