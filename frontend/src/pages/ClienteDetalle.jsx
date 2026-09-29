import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { cargarCliente, agregarSeguimiento, cambiarEstatusCliente, limpiarDetalle } from "../store/clientesSlice";
import { mostrarAviso, navegar } from "../store/uiSlice";
import { tienePermiso } from "../store/authSlice";
import { Campo, Panel, Etiqueta, Vacio } from "../components/ui";
import { moneda, fechaHora, soloFecha, ESTATUS_CLIENTE, ORIGEN_CLIENTE, ESTATUS_OPERACION } from "../components/formato";

const TIPOS = { llamada: "Llamada", visita: "Visita", mensaje: "Mensaje", correo: "Correo" };

/** RF-015 / RF-016 / RF-017 (HU-09, HU-18): historial completo del cliente. */
export default function ClienteDetalle() {
  const dispatch = useDispatch();
  const clienteId = useSelector((state) => state.ui.parametro);
  const { detalle = null, cargando } = useSelector((state) => state.clientes) ?? {};
  const puedeGestionar = useSelector((state) => tienePermiso(state, "clientes.gestionar"));
  // Las operaciones comerciales del cliente solo se muestran a quien tiene el modulo de ventas.
  const puedeVerVentas = useSelector((state) => tienePermiso(state, "ventas.ver"));
  const [nuevo, setNuevo] = useState({ tipo: "llamada", nota: "" });

  useEffect(() => {
    dispatch(cargarCliente(clienteId));
    return () => dispatch(limpiarDetalle());
  }, [dispatch, clienteId]);

  if (cargando || !detalle) return <Vacio texto="Cargando historial del cliente..." />;

  const estatus = ESTATUS_CLIENTE[detalle.estatus] || { texto: detalle.estatus, tipo: "neutro" };
  const seguimientos = [...(detalle.seguimientos || [])].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  const registrarSeguimiento = async (evento) => {
    evento.preventDefault();
    const accion = await dispatch(agregarSeguimiento({ id: detalle.id, datos: nuevo }));
    if (accion.meta.requestStatus === "fulfilled") {
      dispatch(mostrarAviso("Actividad de seguimiento registrada"));
      setNuevo({ tipo: "llamada", nota: "" });
    }
  };

  const actualizarEstatus = async (evento) => {
    const accion = await dispatch(cambiarEstatusCliente({ id: detalle.id, estatus: evento.target.value }));
    if (accion.meta.requestStatus === "fulfilled") dispatch(mostrarAviso("Estatus del prospecto actualizado"));
  };

  return (
    <>
      <button className="boton boton-texto" onClick={() => dispatch(navegar("clientes"))}>
        ← Volver a la cartera
      </button>

      <div className="encabezado-pagina">
        <div>
          <h1>
            {detalle.nombre} {detalle.apellidos}
          </h1>
          <p>
            {detalle.email || "sin correo"} · {detalle.telefono || "sin telefono"} · Origen:{" "}
            {ORIGEN_CLIENTE[detalle.origen] || detalle.origen}
          </p>
        </div>
        <div className="estatus-cliente">
          <Etiqueta valor={estatus.texto} tipo={estatus.tipo} />
          {puedeGestionar && (
            /* RF-017 */
            <select value={detalle.estatus} onChange={actualizarEstatus} aria-label="Cambiar estatus">
              {Object.entries(ESTATUS_CLIENTE).map(([valor, { texto }]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {puedeGestionar && (
        <Panel titulo="Registrar actividad de seguimiento">
          <form className="rejilla-filtros" onSubmit={registrarSeguimiento}>
            <Campo etiqueta="Tipo">
              <select value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })}>
                {Object.entries(TIPOS).map(([valor, texto]) => (
                  <option key={valor} value={valor}>
                    {texto}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Nota" ancho={3}>
              <input
                value={nuevo.nota}
                onChange={(e) => setNuevo({ ...nuevo, nota: e.target.value })}
                placeholder="Que se acordo con el cliente"
                required
              />
            </Campo>
            <div className="acciones-filtros">
              <button type="submit" className="boton boton-primario">
                Registrar
              </button>
            </div>
          </form>
        </Panel>
      )}

      <Panel titulo={`Historial de interacciones (${seguimientos.length})`}>
        {seguimientos.length === 0 ? (
          <Vacio texto="Aun no hay actividades de seguimiento registradas." />
        ) : (
          <ol className="linea-tiempo">
            {seguimientos.map((s) => (
              <li key={s.id}>
                <span className="linea-tiempo-fecha">{fechaHora(s.fecha)}</span>
                <div>
                  <strong>{TIPOS[s.tipo] || s.tipo}</strong>
                  <p>{s.nota}</p>
                  <small>Registro de {s.usuario?.nombre || "usuario dado de baja"}</small>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <div className="columnas" hidden={!puedeVerVentas}>
        <Panel titulo={`Cotizaciones (${detalle.cotizaciones?.length || 0})`}>
          {!detalle.cotizaciones?.length ? (
            <Vacio texto="Sin cotizaciones." />
          ) : (
            <ul className="lista-simple">
              {detalle.cotizaciones.map((c) => {
                const e = ESTATUS_OPERACION[c.estatus] || { texto: c.estatus, tipo: "neutro" };
                return (
                  <li key={c.id}>
                    <span className="monoespaciado">{c.folio}</span>
                    <span>
                      {c.vehiculo?.marca} {c.vehiculo?.modelo} {c.vehiculo?.anio}
                    </span>
                    <span>{moneda(c.total)}</span>
                    <Etiqueta valor={e.texto} tipo={e.tipo} />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel titulo={`Apartados (${detalle.apartados?.length || 0})`}>
          {!detalle.apartados?.length ? (
            <Vacio texto="Sin apartados." />
          ) : (
            <ul className="lista-simple">
              {detalle.apartados.map((a) => {
                const e = ESTATUS_OPERACION[a.estatus] || { texto: a.estatus, tipo: "neutro" };
                return (
                  <li key={a.id}>
                    <span className="monoespaciado">{a.folio}</span>
                    <span>
                      {a.vehiculo?.marca} {a.vehiculo?.modelo}
                    </span>
                    <span>Anticipo {moneda(a.anticipo)}</span>
                    <span>Vence {soloFecha(a.fechaLimite)}</span>
                    <Etiqueta valor={e.texto} tipo={e.tipo} />
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
