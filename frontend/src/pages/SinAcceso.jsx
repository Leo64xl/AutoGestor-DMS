import { useDispatch, useSelector } from "react-redux";
import { navegar } from "../store/uiSlice";
import { Panel } from "../components/ui";

/** RF-004: respuesta visible cuando el perfil no tiene permiso sobre el modulo. */
export default function SinAcceso() {
  const dispatch = useDispatch();
  const rol = useSelector((state) => state.auth.usuario?.rol?.nombre);

  return (
    <Panel titulo="Seccion no disponible para tu perfil">
      <p className="nota">
        El perfil <strong>{rol}</strong> no tiene acceso a esta seccion del sistema. Si necesitas consultarla, solicitalo al
        administrador para que ajuste los permisos de tu cuenta.
      </p>
      <div className="panel-acciones">
        <button className="boton boton-primario" onClick={() => dispatch(navegar("inicio"))}>
          Ir al inicio
        </button>
      </div>
    </Panel>
  );
}
