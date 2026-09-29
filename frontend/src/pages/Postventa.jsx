import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { cargarPostventa, cargarHistorial, agendarServicio, cerrarServicio, cancelarServicio, limpiarHistorial } from "../store/postventaSlice";
import { mostrarAviso } from "../store/uiSlice";
import { tienePermiso } from "../store/authSlice";
import { Campo, Panel, Etiqueta, Vacio, Modal } from "../components/ui";
import { moneda, fechaHora } from "../components/formato";

const ESTATUS = {
  agendado: { texto: "Agendado", tipo: "aviso" },
  realizado: { texto: "Realizado", tipo: "exito" },
  cancelado: { texto: "Cancelado", tipo: "error" },
};

const TIPOS = {
  mantenimiento_menor: "Mantenimiento menor",
  mantenimiento_mayor: "Mantenimiento mayor",
  garantia: "Garantia",
  revision_general: "Revision general",
};

/** Modulo de Postventa: RF-035 y RF-036 (HU-10, HU-23). */
export default function Postventa() {
  const dispatch = useDispatch();
  const { servicios = [], elegibles = [], historial = null, cargando } = useSelector((state) => state.postventa) ?? {};
  const puedeGestionar = useSelector((state) => tienePermiso(state, "postventa.gestionar"));

  const [agenda, setAgenda] = useState(null);
  const [cierre, setCierre] = useState(null);

  useEffect(() => {
    dispatch(cargarPostventa());
  }, [dispatch]);

  const guardarAgenda = async (evento) => {
    evento.preventDefault();
    const accion = await dispatch(
      agendarServicio({
        ventaId: Number(agenda.ventaId),
        tipo: agenda.tipo,
        fechaCita: agenda.fechaCita,
        kilometraje: agenda.kilometraje || null,
        descripcion: agenda.descripcion,
      })
    );
    if (accion.meta.requestStatus === "fulfilled") {
      dispatch(mostrarAviso(`Servicio ${accion.payload.folio} agendado; se notifico al area correspondiente`));
      setAgenda(null);
    }
  };

  const guardarCierre = async (evento) => {
    evento.preventDefault();
    const accion = await dispatch(
      cerrarServicio({
        id: cierre.id,
        datos: { observaciones: cierre.observaciones, costo: cierre.costo || null, kilometraje: cierre.kilometraje || null },
      })
    );
    if (accion.meta.requestStatus === "fulfilled") {
      dispatch(mostrarAviso("Servicio marcado como realizado"));
      setCierre(null);
    }
  };

  const cancelar = async (servicio) => {
    const accion = await dispatch(cancelarServicio({ id: servicio.id, motivo: "Cancelado por el cliente" }));
    if (accion.meta.requestStatus === "fulfilled") dispatch(mostrarAviso("Servicio cancelado"));
  };

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1>Servicios postventa</h1>
          <p>Agendamiento y registro de mantenimientos de unidades vendidas por la agencia.</p>
        </div>
        {puedeGestionar && (
          <button
            className="boton boton-primario"
            onClick={() => setAgenda({ ventaId: "", tipo: "mantenimiento_menor", fechaCita: "", kilometraje: "", descripcion: "" })}
          >
            Agendar servicio
          </button>
        )}
      </div>

      <Panel titulo={`Servicios (${servicios.length})`}>
        {cargando ? (
          <Vacio texto="Cargando servicios..." />
        ) : servicios.length === 0 ? (
          <Vacio texto="Aun no se han agendado servicios postventa." />
        ) : (
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Fecha de la cita</th>
                  <th>Cliente</th>
                  <th>Vehiculo</th>
                  <th>Tipo</th>
                  <th className="derecha">Costo</th>
                  <th>Estatus</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {servicios.map((s) => {
                  const e = ESTATUS[s.estatus] || { texto: s.estatus, tipo: "neutro" };
                  return (
                    <tr key={s.id}>
                      <td className="monoespaciado">{s.folio}</td>
                      <td>{fechaHora(s.fechaCita)}</td>
                      <td>
                        {s.cliente?.nombre} {s.cliente?.apellidos}
                      </td>
                      <td>
                        {s.vehiculo?.marca} {s.vehiculo?.modelo}
                        <br />
                        <small className="monoespaciado">{s.vehiculo?.vin}</small>
                      </td>
                      <td>
                        {TIPOS[s.tipo] || s.tipo}
                        {s.kilometraje ? (
                          <>
                            <br />
                            <small>{s.kilometraje.toLocaleString("es-MX")} km</small>
                          </>
                        ) : null}
                      </td>
                      <td className="derecha">{s.costo ? moneda(s.costo) : "—"}</td>
                      <td>
                        <Etiqueta valor={e.texto} tipo={e.tipo} />
                      </td>
                      <td className="celda-acciones">
                        {/* RF-036 */}
                        <button className="boton boton-texto" onClick={() => dispatch(cargarHistorial(s.vehiculo.id))}>
                          Historial
                        </button>
                        {puedeGestionar && s.estatus === "agendado" && (
                          <>
                            <button
                              className="boton boton-texto"
                              onClick={() => setCierre({ id: s.id, observaciones: "", costo: "", kilometraje: s.kilometraje || "" })}
                            >
                              Marcar realizado
                            </button>
                            <button className="boton boton-texto peligro" onClick={() => cancelar(s)}>
                              Cancelar
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {agenda && (
        <Modal titulo="Agendar servicio postventa" onCerrar={() => setAgenda(null)}>
          <form className="rejilla-formulario" onSubmit={guardarAgenda}>
            <Campo etiqueta="Vehiculo vendido por la agencia" ancho={2}>
              <select value={agenda.ventaId} onChange={(e) => setAgenda({ ...agenda, ventaId: e.target.value })} required>
                <option value="">Selecciona una unidad</option>
                {elegibles.map((v) => (
                  <option key={v.ventaId} value={v.ventaId}>
                    {v.vehiculo?.marca} {v.vehiculo?.modelo} {v.vehiculo?.anio} — {v.vehiculo?.vin} — {v.cliente?.nombre}{" "}
                    {v.cliente?.apellidos}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Tipo de servicio">
              <select value={agenda.tipo} onChange={(e) => setAgenda({ ...agenda, tipo: e.target.value })}>
                {Object.entries(TIPOS).map(([valor, texto]) => (
                  <option key={valor} value={valor}>
                    {texto}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Fecha y hora">
              <input
                type="datetime-local"
                value={agenda.fechaCita}
                onChange={(e) => setAgenda({ ...agenda, fechaCita: e.target.value })}
                required
              />
            </Campo>
            <Campo etiqueta="Kilometraje">
              <input type="number" min="0" value={agenda.kilometraje} onChange={(e) => setAgenda({ ...agenda, kilometraje: e.target.value })} />
            </Campo>
            <Campo etiqueta="Descripcion del servicio solicitado" ancho={2}>
              <textarea rows="3" value={agenda.descripcion} onChange={(e) => setAgenda({ ...agenda, descripcion: e.target.value })} />
            </Campo>
            {elegibles.length === 0 && <p className="nota">Aun no hay unidades vendidas por la agencia.</p>}
            <div className="acciones-modal">
              <button type="button" className="boton" onClick={() => setAgenda(null)}>
                Cancelar
              </button>
              <button type="submit" className="boton boton-primario">
                Agendar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {cierre && (
        <Modal titulo="Cerrar servicio" onCerrar={() => setCierre(null)}>
          <form className="rejilla-formulario" onSubmit={guardarCierre}>
            <Campo etiqueta="Kilometraje">
              <input type="number" min="0" value={cierre.kilometraje} onChange={(e) => setCierre({ ...cierre, kilometraje: e.target.value })} />
            </Campo>
            <Campo etiqueta="Costo del servicio">
              <input type="number" min="0" step="0.01" value={cierre.costo} onChange={(e) => setCierre({ ...cierre, costo: e.target.value })} />
            </Campo>
            <Campo etiqueta="Observaciones del trabajo realizado" ancho={2}>
              <textarea rows="3" value={cierre.observaciones} onChange={(e) => setCierre({ ...cierre, observaciones: e.target.value })} />
            </Campo>
            <div className="acciones-modal">
              <button type="button" className="boton" onClick={() => setCierre(null)}>
                Cancelar
              </button>
              <button type="submit" className="boton boton-primario">
                Marcar realizado
              </button>
            </div>
          </form>
        </Modal>
      )}

      {historial && (
        <Modal
          titulo={`Historial de ${historial.vehiculo.marca} ${historial.vehiculo.modelo} — ${historial.vehiculo.vin}`}
          onCerrar={() => dispatch(limpiarHistorial())}
        >
          {historial.servicios.length === 0 ? (
            <Vacio texto="Esta unidad no tiene servicios registrados." />
          ) : (
            <ol className="linea-tiempo">
              {historial.servicios.map((s) => (
                <li key={s.id}>
                  <span className="linea-tiempo-fecha">{fechaHora(s.fechaCita)}</span>
                  <div>
                    <strong>
                      {TIPOS[s.tipo] || s.tipo} · {s.folio}
                    </strong>
                    <p>{s.descripcion || "Sin descripcion"}</p>
                    {s.observaciones && <p>{s.observaciones}</p>}
                    <small>
                      {ESTATUS[s.estatus]?.texto || s.estatus}
                      {s.kilometraje ? ` · ${s.kilometraje.toLocaleString("es-MX")} km` : ""}
                      {s.costo ? ` · ${moneda(s.costo)}` : ""}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Modal>
      )}
    </>
  );
}
