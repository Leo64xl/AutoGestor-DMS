import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { cargarUsuarios, crearUsuario, editarUsuario, cambiarEstadoUsuario, resetearPassword } from "../store/usuariosSlice";
import { mostrarAviso } from "../store/uiSlice";
import { Campo, Panel, Etiqueta, Vacio, Modal } from "../components/ui";
import { fechaHora } from "../components/formato";

const FORMULARIO_VACIO = { username: "", nombre: "", email: "", rolId: "", passwordTemporal: "" };

/** Modulo de Usuarios y Seguridad: RF-003, RF-004, RF-005 (UC-06). */
export default function Usuarios() {
  const dispatch = useDispatch();
  const { lista = [], roles = [], cargando } = useSelector((state) => state.usuarios) ?? {};
  const usuarioActual = useSelector((state) => state.auth.usuario);
  const [formulario, setFormulario] = useState(null);
  const [reset, setReset] = useState(null);
  const [passwordTemporal, setPasswordTemporal] = useState("");

  useEffect(() => {
    dispatch(cargarUsuarios());
  }, [dispatch]);

  const guardar = async (evento) => {
    evento.preventDefault();
    const accion = formulario.id
      ? await dispatch(
          editarUsuario({ id: formulario.id, datos: { nombre: formulario.nombre, email: formulario.email, rolId: Number(formulario.rolId) } })
        )
      : await dispatch(crearUsuario({ ...formulario, rolId: Number(formulario.rolId) }));

    if (accion.meta.requestStatus === "fulfilled") {
      dispatch(
        mostrarAviso(
          formulario.id ? "Usuario actualizado" : "Usuario creado; debera definir su contrasena en el primer acceso"
        )
      );
      setFormulario(null);
      dispatch(cargarUsuarios());
    }
  };

  const alternarEstado = async (usuario) => {
    const accion = await dispatch(cambiarEstadoUsuario({ id: usuario.id, activo: !usuario.activo }));
    if (accion.meta.requestStatus === "fulfilled") {
      dispatch(mostrarAviso(usuario.activo ? "Cuenta desactivada: el acceso queda revocado" : "Cuenta reactivada"));
      dispatch(cargarUsuarios());
    }
  };

  const confirmarReset = async (evento) => {
    evento.preventDefault();
    const accion = await dispatch(resetearPassword({ id: reset.id, passwordTemporal }));
    if (accion.meta.requestStatus === "fulfilled") {
      dispatch(mostrarAviso("Contrasena temporal asignada; se pedira el cambio en el siguiente acceso"));
      setReset(null);
      setPasswordTemporal("");
    }
  };

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1>Usuarios y permisos</h1>
          <p>Altas, perfiles y control de acceso al sistema.</p>
        </div>
        <button className="boton boton-primario" onClick={() => setFormulario({ ...FORMULARIO_VACIO })}>
          Registrar usuario
        </button>
      </div>

      <Panel titulo={`Cuentas (${lista.length})`}>
        {cargando ? (
          <Vacio texto="Cargando usuarios..." />
        ) : (
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Nombre</th>
                  <th>Perfil</th>
                  <th>Estado</th>
                  <th>Ultimo acceso</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((u) => (
                  <tr key={u.id}>
                    <td className="monoespaciado">{u.username}</td>
                    <td>
                      {u.nombre}
                      <br />
                      <small>{u.email || "sin correo"}</small>
                    </td>
                    <td>{u.rol?.nombre}</td>
                    <td>
                      <Etiqueta valor={u.activo ? "Activo" : "Desactivado"} tipo={u.activo ? "exito" : "error"} />
                      {u.requiereCambioPassword && <Etiqueta valor="Password temporal" tipo="aviso" />}
                    </td>
                    <td>{fechaHora(u.ultimoAcceso)}</td>
                    <td className="celda-acciones">
                      <button className="boton boton-texto" onClick={() => setFormulario({ ...u, rolId: u.rol?.id || u.rolId })}>
                        Editar
                      </button>
                      <button className="boton boton-texto" onClick={() => setReset(u)}>
                        Restablecer contrasena
                      </button>
                      {u.id !== usuarioActual?.id && (
                        <button className={`boton boton-texto ${u.activo ? "peligro" : ""}`} onClick={() => alternarEstado(u)}>
                          {u.activo ? "Desactivar" : "Reactivar"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel titulo="Perfiles y permisos">
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th>Perfil</th>
                <th>Descripcion</th>
                <th>Permisos</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.nombre}</strong>
                  </td>
                  <td>{r.descripcion}</td>
                  <td>
                    {(r.permisos || []).map((p) => (
                      <Etiqueta key={p} valor={p === "*" ? "todos los permisos" : p} tipo="info" />
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {formulario && (
        <Modal titulo={formulario.id ? "Editar usuario" : "Registrar usuario"} onCerrar={() => setFormulario(null)}>
          <form className="rejilla-formulario" onSubmit={guardar}>
            <Campo etiqueta="Nombre de usuario">
              <input
                value={formulario.username}
                onChange={(e) => setFormulario({ ...formulario, username: e.target.value })}
                disabled={Boolean(formulario.id)}
                required
              />
            </Campo>
            <Campo etiqueta="Nombre completo">
              <input value={formulario.nombre} onChange={(e) => setFormulario({ ...formulario, nombre: e.target.value })} required />
            </Campo>
            <Campo etiqueta="Correo electronico">
              <input type="email" value={formulario.email || ""} onChange={(e) => setFormulario({ ...formulario, email: e.target.value })} />
            </Campo>
            {/* RF-004 */}
            <Campo etiqueta="Perfil (rol)">
              <select value={formulario.rolId} onChange={(e) => setFormulario({ ...formulario, rolId: e.target.value })} required>
                <option value="">Selecciona un perfil</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </Campo>
            {!formulario.id && (
              <Campo etiqueta="Contrasena temporal (minimo 8 caracteres)" ancho={2}>
                <input
                  value={formulario.passwordTemporal}
                  onChange={(e) => setFormulario({ ...formulario, passwordTemporal: e.target.value })}
                  minLength={8}
                  required
                />
              </Campo>
            )}
            <p className="nota">El usuario debera definir su propia contrasena en el primer inicio de sesion.</p>
            <div className="acciones-modal">
              <button type="button" className="boton" onClick={() => setFormulario(null)}>
                Cancelar
              </button>
              <button type="submit" className="boton boton-primario">
                Guardar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {reset && (
        <Modal titulo={`Restablecer contrasena de ${reset.username}`} onCerrar={() => setReset(null)}>
          <form className="rejilla-formulario" onSubmit={confirmarReset}>
            <Campo etiqueta="Nueva contrasena temporal" ancho={2}>
              <input value={passwordTemporal} onChange={(e) => setPasswordTemporal(e.target.value)} minLength={8} required />
            </Campo>
            <div className="acciones-modal">
              <button type="button" className="boton" onClick={() => setReset(null)}>
                Cancelar
              </button>
              <button type="submit" className="boton boton-primario">
                Restablecer
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
