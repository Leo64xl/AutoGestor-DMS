import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { cerrarSesion } from "../store/authSlice";
import { navegar, ocultarAviso } from "../store/uiSlice";
import { gruposPermitidos, vistaDelMenu } from "../modulos";
import Icono from "./Icono";

/** Iniciales del usuario para el avatar del pie lateral. */
function iniciales(nombre = "") {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export default function Layout({ children }) {
  const dispatch = useDispatch();
  const usuario = useSelector((state) => state.auth.usuario);
  const { vista, aviso } = useSelector((state) => state.ui);
  const permisos = useSelector((state) => state.auth.usuario?.rol?.permisos) ?? [];

  // RF-004: el menu solo lista los modulos que corresponden al perfil,
  // agrupados por area de la agencia para que la navegacion se lea de un vistazo.
  const grupos = gruposPermitidos(permisos);
  const activa = vistaDelMenu(vista);

  useEffect(() => {
    if (!aviso) return undefined;
    const temporizador = setTimeout(() => dispatch(ocultarAviso()), 5000);
    return () => clearTimeout(temporizador);
  }, [aviso, dispatch]);

  return (
    <div className="aplicacion">
      <aside className="barra-lateral">
        <div className="marca">
          <span className="marca-sigla">AG</span>
          <div>
            <strong>AutoGestor DMS</strong>
            <small>Automotriz del Valle</small>
          </div>
        </div>

        <nav className="menu" aria-label="Modulos del sistema">
          {grupos.map((grupo) => (
            <div className="menu-grupo" key={grupo.titulo || "principal"}>
              {grupo.titulo && <div className="menu-grupo-titulo">{grupo.titulo}</div>}
              {grupo.modulos.map((m) => (
                <button
                  key={m.vista}
                  className={activa === m.vista ? "activa" : ""}
                  aria-current={activa === m.vista ? "page" : undefined}
                  onClick={() => dispatch(navegar(m.vista))}
                >
                  <Icono nombre={m.icono} tamano={18} />
                  {m.texto}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="pie-lateral">
          <span className="avatar" aria-hidden="true">
            {iniciales(usuario?.nombre)}
          </span>
          <div className="usuario-actual">
            <strong title={usuario?.nombre}>{usuario?.nombre}</strong>
            <small>{usuario?.rol?.nombre}</small>
          </div>
          <button className="salir" onClick={() => dispatch(cerrarSesion())} title="Cerrar sesion" aria-label="Cerrar sesion">
            <Icono nombre="salir" tamano={18} />
          </button>
        </div>
      </aside>

      <main className="contenido">
        {aviso && (
          <div className={`aviso aviso-${aviso.tipo}`} role="status">
            <span>{aviso.texto}</span>
            <button className="boton-icono" onClick={() => dispatch(ocultarAviso())} aria-label="Cerrar aviso">
              ×
            </button>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
