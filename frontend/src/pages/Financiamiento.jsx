import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { cargarFinanciamiento, crearSolicitud, enviarSolicitud, registrarRespuesta, registrarPago } from "../store/financiamientoSlice";
import { cargarOperaciones } from "../store/operacionesSlice";
import { mostrarAviso } from "../store/uiSlice";
import { tienePermiso } from "../store/authSlice";
import { Campo, Panel, Etiqueta, Vacio, Modal } from "../components/ui";
import { moneda, fechaHora } from "../components/formato";

/** Referencia estable: evita invalidar los useMemo en cada render. */
const SIN_DATOS = [];

const ESTATUS = {
  capturada: { texto: "Capturada", tipo: "neutro" },
  enviada: { texto: "Enviada", tipo: "aviso" },
  aprobada: { texto: "Aprobada", tipo: "exito" },
  rechazada: { texto: "Rechazada", tipo: "error" },
};

const TIPOS_PAGO = { contado: "Contado", enganche: "Enganche", abono: "Abono" };
const METODOS = { efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta", cheque: "Cheque" };

/** Modulo de Financiamiento y Pagos: RF-031 a RF-034. */
export default function Financiamiento() {
  const dispatch = useDispatch();
  const { solicitudes = [], pagos = [], cargando } = useSelector((state) => state.financiamiento) ?? {};
  const ventas = useSelector((state) => state.operaciones?.lista) ?? SIN_DATOS;
  const puedeGestionar = useSelector((state) => tienePermiso(state, "financiamiento.gestionar"));

  const [pestania, setPestania] = useState("solicitudes");
  const [solicitud, setSolicitud] = useState(null);
  const [respuesta, setRespuesta] = useState(null);
  const [pago, setPago] = useState(null);

  useEffect(() => {
    dispatch(cargarFinanciamiento());
    dispatch(cargarOperaciones());
  }, [dispatch]);

  const ventasACredito = ventas.filter((v) => v.formaPago === "financiamiento" && !v.financiamiento);
  const ventasConSaldo = ventas.filter((v) => v.estatus !== "cancelada" && v.pendiente > 0.009);

  const guardarSolicitud = async (evento) => {
    evento.preventDefault();
    const accion = await dispatch(
      crearSolicitud({
        ventaId: Number(solicitud.ventaId),
        entidadFinanciera: solicitud.entidadFinanciera,
        montoSolicitado: Number(solicitud.montoSolicitado),
        observaciones: solicitud.observaciones,
      })
    );
    if (accion.meta.requestStatus === "fulfilled") {
      dispatch(mostrarAviso(`Solicitud ${accion.payload.folio} capturada`));
      setSolicitud(null);
      dispatch(cargarOperaciones());
    }
  };

  const enviar = async (id) => {
    const accion = await dispatch(enviarSolicitud(id));
    if (accion.meta.requestStatus === "fulfilled") dispatch(mostrarAviso("Solicitud enviada a la entidad financiera"));
  };

  const guardarRespuesta = async (evento) => {
    evento.preventDefault();
    const datos =
      respuesta.estatus === "aprobada"
        ? {
            estatus: "aprobada",
            enganche: Number(respuesta.enganche),
            plazoMeses: Number(respuesta.plazoMeses),
            tasaAnual: Number(respuesta.tasaAnual),
            observaciones: respuesta.observaciones,
          }
        : { estatus: "rechazada", observaciones: respuesta.observaciones };

    const accion = await dispatch(registrarRespuesta({ id: respuesta.id, datos }));
    if (accion.meta.requestStatus === "fulfilled") {
      dispatch(mostrarAviso("Respuesta de la entidad financiera registrada"));
      setRespuesta(null);
      dispatch(cargarOperaciones());
    }
  };

  const guardarPago = async (evento) => {
    evento.preventDefault();
    const accion = await dispatch(
      registrarPago({
        ventaId: Number(pago.ventaId),
        tipo: pago.tipo,
        metodo: pago.metodo,
        monto: Number(pago.monto),
        referencia: pago.referencia,
      })
    );
    if (accion.meta.requestStatus === "fulfilled") {
      dispatch(mostrarAviso(`Pago registrado. Saldo pendiente: ${moneda(accion.payload.pendiente)}`));
      setPago(null);
      dispatch(cargarFinanciamiento());
      dispatch(cargarOperaciones());
    }
  };

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1>Financiamiento y pagos</h1>
          <p>Solicitudes de credito, condiciones aprobadas y control de saldos.</p>
        </div>
        {puedeGestionar && (
          <div className="panel-acciones">
            <button
              className="boton"
              onClick={() => setPago({ ventaId: "", tipo: "abono", metodo: "transferencia", monto: "", referencia: "" })}
            >
              Registrar pago
            </button>
            <button
              className="boton boton-primario"
              onClick={() => setSolicitud({ ventaId: "", entidadFinanciera: "", montoSolicitado: "", observaciones: "" })}
            >
              Nueva solicitud
            </button>
          </div>
        )}
      </div>

      <nav className="pestanias">
        <button className={pestania === "solicitudes" ? "activa" : ""} onClick={() => setPestania("solicitudes")}>
          Solicitudes ({solicitudes.length})
        </button>
        <button className={pestania === "pagos" ? "activa" : ""} onClick={() => setPestania("pagos")}>
          Pagos ({pagos.length})
        </button>
      </nav>

      {cargando && <Vacio texto="Cargando informacion..." />}

      {!cargando && pestania === "solicitudes" && (
        <Panel>
          {solicitudes.length === 0 ? (
            <Vacio texto="Aun no hay solicitudes de financiamiento." />
          ) : (
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Venta</th>
                    <th>Entidad financiera</th>
                    <th className="derecha">Monto solicitado</th>
                    <th>Condiciones</th>
                    <th>Estatus</th>
                    {puedeGestionar && <th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {solicitudes.map((s) => {
                    const e = ESTATUS[s.estatus] || { texto: s.estatus, tipo: "neutro" };
                    return (
                      <tr key={s.id}>
                        <td className="monoespaciado">{s.folio}</td>
                        <td>
                          <span className="monoespaciado">{s.venta?.folio}</span>
                          <br />
                          <small>
                            {s.venta?.cliente?.nombre} {s.venta?.cliente?.apellidos}
                          </small>
                        </td>
                        <td>{s.entidadFinanciera}</td>
                        <td className="derecha">{moneda(s.montoSolicitado)}</td>
                        <td>
                          {/* RF-033 */}
                          {s.estatus === "aprobada" ? (
                            <>
                              Enganche {moneda(s.enganche)}
                              <br />
                              <small>
                                {s.plazoMeses} meses · tasa {Number(s.tasaAnual).toFixed(2)}% anual
                              </small>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <Etiqueta valor={e.texto} tipo={e.tipo} />
                          {s.fechaRespuesta && (
                            <>
                              <br />
                              <small>{fechaHora(s.fechaRespuesta)}</small>
                            </>
                          )}
                        </td>
                        {puedeGestionar && (
                          <td className="celda-acciones">
                            {/* RF-032 */}
                            {s.estatus === "capturada" && (
                              <button className="boton boton-texto" onClick={() => enviar(s.id)}>
                                Enviar a la entidad
                              </button>
                            )}
                            {s.estatus === "enviada" && (
                              <button
                                className="boton boton-texto"
                                onClick={() =>
                                  setRespuesta({
                                    id: s.id,
                                    estatus: "aprobada",
                                    enganche: "",
                                    plazoMeses: "",
                                    tasaAnual: "",
                                    observaciones: "",
                                  })
                                }
                              >
                                Registrar respuesta
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {!cargando && pestania === "pagos" && (
        <Panel>
          {pagos.length === 0 ? (
            <Vacio texto="Aun no se han registrado pagos." />
          ) : (
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Venta</th>
                    <th>Tipo</th>
                    <th>Metodo</th>
                    <th>Fecha</th>
                    <th className="derecha">Monto</th>
                    <th>Referencia</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p) => (
                    <tr key={p.id}>
                      <td className="monoespaciado">{p.folio}</td>
                      <td>
                        <span className="monoespaciado">{p.venta?.folio}</span>
                        <br />
                        <small>
                          {p.venta?.cliente?.nombre} {p.venta?.cliente?.apellidos}
                        </small>
                      </td>
                      <td>{TIPOS_PAGO[p.tipo] || p.tipo}</td>
                      <td>{METODOS[p.metodo] || p.metodo}</td>
                      <td>{fechaHora(p.fecha)}</td>
                      <td className="derecha">
                        <strong>{moneda(p.monto)}</strong>
                      </td>
                      <td>{p.referencia || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {solicitud && (
        <Modal titulo="Nueva solicitud de financiamiento" onCerrar={() => setSolicitud(null)}>
          <form className="rejilla-formulario" onSubmit={guardarSolicitud}>
            <Campo etiqueta="Venta a financiar" ancho={2}>
              <select
                value={solicitud.ventaId}
                onChange={(e) => {
                  const venta = ventas.find((v) => v.id === Number(e.target.value));
                  setSolicitud({ ...solicitud, ventaId: e.target.value, montoSolicitado: venta ? venta.total : "" });
                }}
                required
              >
                <option value="">Selecciona una venta a credito</option>
                {ventasACredito.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.folio} — {v.cliente?.nombre} {v.cliente?.apellidos} — {moneda(v.total)}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Entidad financiera">
              <input
                value={solicitud.entidadFinanciera}
                onChange={(e) => setSolicitud({ ...solicitud, entidadFinanciera: e.target.value })}
                placeholder="Banco o financiera"
                required
              />
            </Campo>
            <Campo etiqueta="Monto solicitado">
              <input
                type="number"
                min="1"
                step="0.01"
                value={solicitud.montoSolicitado}
                onChange={(e) => setSolicitud({ ...solicitud, montoSolicitado: e.target.value })}
                required
              />
            </Campo>
            <Campo etiqueta="Observaciones" ancho={2}>
              <textarea rows="2" value={solicitud.observaciones} onChange={(e) => setSolicitud({ ...solicitud, observaciones: e.target.value })} />
            </Campo>
            {ventasACredito.length === 0 && (
              <p className="nota">
                No hay ventas a credito sin solicitud. Registra primero una venta con forma de pago &quot;financiamiento&quot;.
              </p>
            )}
            <div className="acciones-modal">
              <button type="button" className="boton" onClick={() => setSolicitud(null)}>
                Cancelar
              </button>
              <button type="submit" className="boton boton-primario">
                Capturar solicitud
              </button>
            </div>
          </form>
        </Modal>
      )}

      {respuesta && (
        <Modal titulo="Respuesta de la entidad financiera" onCerrar={() => setRespuesta(null)}>
          <form className="rejilla-formulario" onSubmit={guardarRespuesta}>
            <Campo etiqueta="Resolucion" ancho={2}>
              <select value={respuesta.estatus} onChange={(e) => setRespuesta({ ...respuesta, estatus: e.target.value })}>
                <option value="aprobada">Credito aprobado</option>
                <option value="rechazada">Credito rechazado</option>
              </select>
            </Campo>
            {respuesta.estatus === "aprobada" && (
              <>
                {/* RF-033 */}
                <Campo etiqueta="Enganche">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={respuesta.enganche}
                    onChange={(e) => setRespuesta({ ...respuesta, enganche: e.target.value })}
                    required
                  />
                </Campo>
                <Campo etiqueta="Plazo (meses)">
                  <input
                    type="number"
                    min="1"
                    max="96"
                    value={respuesta.plazoMeses}
                    onChange={(e) => setRespuesta({ ...respuesta, plazoMeses: e.target.value })}
                    required
                  />
                </Campo>
                <Campo etiqueta="Tasa anual (%)" ancho={2}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={respuesta.tasaAnual}
                    onChange={(e) => setRespuesta({ ...respuesta, tasaAnual: e.target.value })}
                    required
                  />
                </Campo>
              </>
            )}
            <Campo etiqueta="Observaciones" ancho={2}>
              <textarea rows="2" value={respuesta.observaciones} onChange={(e) => setRespuesta({ ...respuesta, observaciones: e.target.value })} />
            </Campo>
            <div className="acciones-modal">
              <button type="button" className="boton" onClick={() => setRespuesta(null)}>
                Cancelar
              </button>
              <button type="submit" className="boton boton-primario">
                Guardar respuesta
              </button>
            </div>
          </form>
        </Modal>
      )}

      {pago && (
        <Modal titulo="Registrar pago" onCerrar={() => setPago(null)}>
          <form className="rejilla-formulario" onSubmit={guardarPago}>
            <Campo etiqueta="Venta" ancho={2}>
              <select value={pago.ventaId} onChange={(e) => setPago({ ...pago, ventaId: e.target.value })} required>
                <option value="">Selecciona una venta con saldo</option>
                {ventasConSaldo.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.folio} — {v.cliente?.nombre} {v.cliente?.apellidos} — saldo {moneda(v.pendiente)}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Tipo de pago">
              <select value={pago.tipo} onChange={(e) => setPago({ ...pago, tipo: e.target.value })}>
                {Object.entries(TIPOS_PAGO).map(([valor, texto]) => (
                  <option key={valor} value={valor}>
                    {texto}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Metodo">
              <select value={pago.metodo} onChange={(e) => setPago({ ...pago, metodo: e.target.value })}>
                {Object.entries(METODOS).map(([valor, texto]) => (
                  <option key={valor} value={valor}>
                    {texto}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Monto">
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={pago.monto}
                onChange={(e) => setPago({ ...pago, monto: e.target.value })}
                required
              />
            </Campo>
            <Campo etiqueta="Referencia">
              <input value={pago.referencia} onChange={(e) => setPago({ ...pago, referencia: e.target.value })} />
            </Campo>
            <p className="nota">El sistema no permite registrar un pago mayor al saldo pendiente de la venta.</p>
            <div className="acciones-modal">
              <button type="button" className="boton" onClick={() => setPago(null)}>
                Cancelar
              </button>
              <button type="submit" className="boton boton-primario">
                Registrar pago
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
