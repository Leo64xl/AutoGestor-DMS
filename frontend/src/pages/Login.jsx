import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { iniciarSesion, limpiarError } from "../store/authSlice";
import PantallaAcceso from "../components/PantallaAcceso";

/** RF-001 (UC-06): inicio de sesion con usuario y contrasena. */
export default function Login() {
  const dispatch = useDispatch();
  const { cargando, error } = useSelector((state) => state.auth);
  const [credenciales, setCredenciales] = useState({ username: "", password: "" });

  const cambiar = (campo) => (evento) => {
    if (error) dispatch(limpiarError());
    setCredenciales({ ...credenciales, [campo]: evento.target.value });
  };

  const enviar = (evento) => {
    evento.preventDefault();
    dispatch(iniciarSesion(credenciales));
  };

  return (
    <PantallaAcceso titulo="Bienvenido de nuevo" descripcion="Entra con la cuenta que te asigno el administrador.">
      <form className="acceso-formulario" onSubmit={enviar}>
        <label className="campo">
          <span>Usuario</span>
          <input value={credenciales.username} onChange={cambiar("username")} autoComplete="username" autoFocus required />
        </label>

        <label className="campo">
          <span>Contrasena</span>
          <input
            type="password"
            value={credenciales.password}
            onChange={cambiar("password")}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="mensaje-error">{error}</p>}

        <button type="submit" className="boton boton-primario boton-bloque" disabled={cargando}>
          {cargando ? "Verificando..." : "Entrar"}
        </button>
      </form>
    </PantallaAcceso>
  );
}
