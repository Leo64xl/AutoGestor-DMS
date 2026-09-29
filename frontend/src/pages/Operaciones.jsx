import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  cargarOperaciones,
  registrarVenta,
  agregarDocumento,
  registrarEntrega,
  timbrarFactura,
  cargarEstadoCfdi,
} from "../store/operacionesSlice";
import { cargarModuloVentas } from "../store/ventasSlice";
import { mostrarAviso } from "../store/uiSlice";
import { tienePermiso } from "../store/authSlice";
import { abrirDocumento, descargar } from "../api/client";
import { Campo, Panel, Etiqueta, Vacio, Modal } from "../components/ui";
import { moneda, fechaHora } from "../components/formato";
import Icono from "../components/Icono";

const ESTATUS = {
  registrada: { texto: "Registrada", tipo: "aviso" },
  entregada: { texto: "Entregada", tipo: "exito" },
  cancelada: { texto: "Cancelada", tipo: "error" },
};

const TIPOS_DOCUMENTO = {
  identificacion: "Identificacion oficial",
  comprobante_domicilio: "Comprobante de domicilio",
  comprobante_ingresos: "Comprobante de ingresos",
  otro: "Otro",
};

/** Referencia estable mientras el store no trae la configuracion del timbrado. */
const ESTADO_CFDI = { entorno: "sandbox", simulado: true, emisorConfigurado: false };

const ESTATUS_CFDI = {
  sin_timbrar: { texto: "Sin timbrar", tipo: "neutro" },
  timbrada: { texto: "Timbrada", tipo: "exito" },
  cancelada: { texto: "CFDI cancelado", tipo: "error" },
  error: { texto: "Error al timbrar", tipo: "error" },
};

const DOCUMENTOS_INICIALES = [
  { tipo: "identificacion", referencia: "" },
  { tipo: "comprobante_domicilio", referencia: "" },
];

/** Modulo de Ventas y Documentacion: RF-026 a RF-030 (UC-03). */
export default function Operaciones() {
  const dispatch = useDispatch();
  const { lista = [], cfdi = ESTADO_CFDI, cargando } = useSelector((state) => state.operaciones) ?? {};
  const { cotizaciones = [], apartados = [] } = useSelector((state) => state.ventas) ?? {};
  const puedeGestionar = useSelector((state) => tienePermiso(state, "ventas.gestionar"));

  const [formulario, setFormulario] = useState(null);
  const [documento, setDocumento] = useState(null);
  const [entrega, setEntrega] = useState(null);

  useEffect(() => {
    dispatch(cargarOperaciones());
    dispatch(cargarModuloVentas());
    dispatch(cargarEstadoCfdi());
  }, [dispatch]);

  const apartadosVigentes = apartados.filter((a) => a.estatus === "vigente");
  const cotizacionesVigentes = cotizaciones.filter((c) => c.estatus === "vigente");

  const abrir = () =>
    setFormulario({ origen: "apartado", referencia: "", formaPago: "contado", documentos: DOCUMENTOS_INICIALES.map((d) => ({ ...d })) });

  const guardar = async (evento) => {
    evento.preventDefault();
    const cuerpo = {
      formaPago: formulario.formaPago,
      documentos: formulario.documentos.filter((d) => d.referencia.trim()),
    };
    if (formulario.origen === "apartado") cuerpo.apartadoId = Number(formulario.referencia);
    else cuerpo.cotizacionId = Number(formulario.referencia);

    const accion = await dispatch(registrarVenta(cuerpo));
    if (accion.meta.requestStatus === "fulfilled") {
      const venta = accion.payload;
      dispatch(mostrarAviso(`Venta ${venta.folio} registrada. Contrato ${venta.folioContrato} y factura ${venta.folioFactura} generados.`));
      setFormulario(null);
      dispatch(cargarModuloVentas());
    }
  };

  const guardarDocumento = async (evento) => {
    evento.preventDefault();
    const accion = await dispatch(agregarDocumento({ id: documento.ventaId, datos: documento }));
    if (accion.meta.requestStatus === "fulfilled") {
      dispatch(mostrarAviso("Documento asociado a la venta"));
      setDocumento(null);
    }
  };

  /** RF-028: timbra el CFDI ante el SAT a traves de Facturama. */
  const timbrar = async (venta) => {
    const accion = await dispatch(timbrarFactura(venta.id));
    if (accion.meta.requestStatus === "fulfilled") {
      const timbrada = accion.payload;
      dispatch(
        mostrarAviso(
          timbrada.cfdiSimulado
            ? `CFDI generado en modo simulado. Folio fiscal ${timbrada.cfdiUuid}`
            : `Factura timbrada ante el SAT. Folio fiscal ${timbrada.cfdiUuid}`
        )
      );
    }
  };

  const descargarCfdi = async (venta, formato) => {
    try {
      await descargar(`/operaciones/${venta.id}/cfdi/${formato}`, { nombrePorDefecto: `${venta.folioFactura}.${formato}` });
    } catch (err) {
      dispatch(mostrarAviso({ tipo: "error", texto: err.message }));
    }
  };

  const guardarEntrega = async (evento) => {
    evento.preventDefault();
    const accion = await dispatch(registrarEntrega({ id: entrega.id, observaciones: entrega.observaciones }));
    if (accion.meta.requestStatus === "fulfilled") {
      dispatch(mostrarAviso("Traspaso y entrega registrados"));
      setEntrega(null);
    }
  };

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1>Ventas y documentacion</h1>
          <p>Formalizacion de la operacion, contrato, factura y entrega de la unidad.</p>
        </div>
        {puedeGestionar && (
          <button className="boton boton-primario" onClick={abrir}>
            Registrar venta
          </button>
        )}
      </div>

      {cfdi.simulado && (
        <div className="alerta-inventario">
          <Icono nombre="alerta" tamano={20} />
          <div>
            <strong>Timbrado en modo simulado</strong>
            <p>
              No hay credenciales de Facturama configuradas, asi que los CFDI se generan con un folio fiscal ficticio y sin
              validez fiscal. Captura FACTURAMA_USUARIO y FACTURAMA_PASSWORD en el servidor para timbrar de verdad contra el{" "}
              {cfdi.entorno}.
            </p>
          </div>
        </div>
      )}

      <Panel titulo={`Ventas (${lista.length})`}>
        {cargando ? (
          <Vacio texto="Cargando ventas..." />
        ) : lista.length === 0 ? (
          <Vacio texto="Aun no se han registrado ventas." />
        ) : (
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Cliente</th>
                  <th>Vehiculo</th>
                  <th>Pago</th>
                  <th className="derecha">Total</th>
                  <th className="derecha">Saldo</th>
                  <th>Documentos</th>
                  <th>Estatus</th>
                  <th>CFDI</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((v) => {
                  const e = ESTATUS[v.estatus] || { texto: v.estatus, tipo: "neutro" };
                  return (
                    <tr key={v.id}>
                      <td>
                        <span className="monoespaciado">{v.folio}</span>
                        <br />
                        <small>{fechaHora(v.fechaVenta)}</small>
                      </td>
                      <td>
                        {v.cliente?.nombre} {v.cliente?.apellidos}
                      </td>
                      <td>
                        {v.vehiculo?.marca} {v.vehiculo?.modelo} {v.vehiculo?.anio}
                        <br />
                        <small className="monoespaciado">{v.vehiculo?.vin}</small>
                      </td>
                      <td>{v.formaPago === "contado" ? "Contado" : "Financiamiento"}</td>
                      <td className="derecha">
                        <strong>{moneda(v.total)}</strong>
                      </td>
                      <td className="derecha">
                        {v.pendiente > 0.009 ? (
                          <Etiqueta valor={moneda(v.pendiente)} tipo="aviso" />
                        ) : (
                          <Etiqueta valor="Liquidada" tipo="exito" />
                        )}
                      </td>
                      <td>
                        {(v.documentos || []).map((d) => (
                          <Etiqueta key={d.id} valor={TIPOS_DOCUMENTO[d.tipo] || d.tipo} tipo="info" />
                        ))}
                      </td>
                      <td>
                        <Etiqueta valor={e.texto} tipo={e.tipo} />
                        {v.entregaCompletada && <Etiqueta valor="Entregado" tipo="exito" />}
                      </td>
                      {/* RF-028: situacion del comprobante fiscal */}
                      <td>
                        {(() => {
                          const cf = ESTATUS_CFDI[v.cfdiEstatus] || ESTATUS_CFDI.sin_timbrar;
                          return (
                            <>
                              <Etiqueta valor={cf.texto} tipo={cf.tipo} />
                              {v.cfdiSimulado && <Etiqueta valor="Simulado" tipo="aviso" />}
                              {v.cfdiUuid && (
                                <>
                                  <br />
                                  <small className="monoespaciado" title={v.cfdiUuid}>
                                    {v.cfdiUuid.slice(0, 18)}…
                                  </small>
                                </>
                              )}
                              {v.cfdiEstatus === "error" && v.cfdiError && (
                                <>
                                  <br />
                                  <small title={v.cfdiError}>{v.cfdiError.slice(0, 60)}…</small>
                                </>
                              )}
                            </>
                          );
                        })()}
                      </td>
                      <td className="celda-acciones">
                        {/* RF-027 / RF-028 */}
                        <button className="boton boton-texto" onClick={() => abrirDocumento(`/operaciones/${v.id}/contrato`)}>
                          Contrato
                        </button>
                        <button className="boton boton-texto" onClick={() => abrirDocumento(`/operaciones/${v.id}/factura`)}>
                          Comprobante
                        </button>

                        {/* RF-028: timbrado y descarga del CFDI 4.0 */}
                        {puedeGestionar && ["sin_timbrar", "error"].includes(v.cfdiEstatus) && (
                          <button className="boton boton-texto" onClick={() => timbrar(v)}>
                            {v.cfdiEstatus === "error" ? "Reintentar timbrado" : "Timbrar factura"}
                          </button>
                        )}
                        {v.cfdiEstatus === "timbrada" && !v.cfdiSimulado && (
                          <>
                            <button className="boton boton-texto" onClick={() => descargarCfdi(v, "pdf")}>
                              CFDI PDF
                            </button>
                            <button className="boton boton-texto" onClick={() => descargarCfdi(v, "xml")}>
                              XML
                            </button>
                          </>
                        )}
                        {puedeGestionar && v.estatus === "registrada" && (
                          <>
                            {/* RF-029 */}
                            <button
                              className="boton boton-texto"
                              onClick={() => setDocumento({ ventaId: v.id, tipo: "otro", referencia: "", archivoUrl: "" })}
                            >
                              Agregar documento
                            </button>
                            {/* RF-030 */}
                            <button className="boton boton-texto" onClick={() => setEntrega({ id: v.id, observaciones: "" })}>
                              Registrar entrega
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

      {formulario && (
        <Modal titulo="Registrar venta" onCerrar={() => setFormulario(null)}>
          <form className="rejilla-formulario" onSubmit={guardar}>
            <Campo etiqueta="Formalizar a partir de">
              <select
                value={formulario.origen}
                onChange={(e) => setFormulario({ ...formulario, origen: e.target.value, referencia: "" })}
              >
                <option value="apartado">Apartado vigente</option>
                <option value="cotizacion">Cotizacion vigente</option>
              </select>
            </Campo>
            <Campo etiqueta={formulario.origen === "apartado" ? "Apartado" : "Cotizacion"}>
              <select
                value={formulario.referencia}
                onChange={(e) => setFormulario({ ...formulario, referencia: e.target.value })}
                required
              >
                <option value="">Selecciona una opcion</option>
                {formulario.origen === "apartado"
                  ? apartadosVigentes.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.folio} — {a.cliente?.nombre} {a.cliente?.apellidos} — {a.vehiculo?.marca} {a.vehiculo?.modelo}
                      </option>
                    ))
                  : cotizacionesVigentes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.folio} — {c.cliente?.nombre} {c.cliente?.apellidos} — {moneda(c.total)}
                      </option>
                    ))}
              </select>
            </Campo>
            <Campo etiqueta="Forma de pago" ancho={2}>
              <select value={formulario.formaPago} onChange={(e) => setFormulario({ ...formulario, formaPago: e.target.value })}>
                <option value="contado">Contado</option>
                <option value="financiamiento">Financiamiento</option>
              </select>
            </Campo>

            {/* RF-029: sin identificacion y comprobante de domicilio la venta no procede. */}
            <div className="grupo-accesorios">
              <span className="etiqueta-grupo">Documentacion del cliente (obligatoria)</span>
              {formulario.documentos.map((d, indice) => (
                <div key={d.tipo} className="renglon-documento">
                  <span>{TIPOS_DOCUMENTO[d.tipo]}</span>
                  <input
                    value={d.referencia}
                    placeholder="Numero o folio del documento"
                    onChange={(e) => {
                      const documentos = [...formulario.documentos];
                      documentos[indice] = { ...d, referencia: e.target.value };
                      setFormulario({ ...formulario, documentos });
                    }}
                    required
                  />
                </div>
              ))}
            </div>

            <p className="nota">
              Al confirmar, el sistema genera el contrato y la factura, marca el vehiculo como vendido y actualiza al cliente a
              &quot;comprador&quot;.
            </p>
            <div className="acciones-modal">
              <button type="button" className="boton" onClick={() => setFormulario(null)}>
                Cancelar
              </button>
              <button type="submit" className="boton boton-primario">
                Confirmar venta
              </button>
            </div>
          </form>
        </Modal>
      )}

      {documento && (
        <Modal titulo="Agregar documentacion" onCerrar={() => setDocumento(null)}>
          <form className="rejilla-formulario" onSubmit={guardarDocumento}>
            <Campo etiqueta="Tipo de documento">
              <select value={documento.tipo} onChange={(e) => setDocumento({ ...documento, tipo: e.target.value })}>
                {Object.entries(TIPOS_DOCUMENTO).map(([valor, texto]) => (
                  <option key={valor} value={valor}>
                    {texto}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo etiqueta="Referencia">
              <input value={documento.referencia} onChange={(e) => setDocumento({ ...documento, referencia: e.target.value })} required />
            </Campo>
            <Campo etiqueta="Enlace al archivo (opcional)" ancho={2}>
              <input value={documento.archivoUrl} onChange={(e) => setDocumento({ ...documento, archivoUrl: e.target.value })} />
            </Campo>
            <div className="acciones-modal">
              <button type="button" className="boton" onClick={() => setDocumento(null)}>
                Cancelar
              </button>
              <button type="submit" className="boton boton-primario">
                Guardar
              </button>
            </div>
          </form>
        </Modal>
      )}

      {entrega && (
        <Modal titulo="Traspaso y entrega del vehiculo" onCerrar={() => setEntrega(null)}>
          <form className="rejilla-formulario" onSubmit={guardarEntrega}>
            <p className="nota">
              La entrega requiere que la venta este liquidada (pago de contado) o que el financiamiento este aprobado.
            </p>
            <Campo etiqueta="Observaciones de la entrega" ancho={2}>
              <textarea rows="3" value={entrega.observaciones} onChange={(e) => setEntrega({ ...entrega, observaciones: e.target.value })} />
            </Campo>
            <div className="acciones-modal">
              <button type="button" className="boton" onClick={() => setEntrega(null)}>
                Cancelar
              </button>
              <button type="submit" className="boton boton-primario">
                Confirmar entrega
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
