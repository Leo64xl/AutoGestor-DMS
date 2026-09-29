import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { cargarReporte, exportarReporte, fijarTipo, fijarFiltro } from "../store/reportesSlice";
import { Campo, Panel, Vacio } from "../components/ui";
import { moneda, soloFecha } from "../components/formato";

const TIPOS = {
  ventas: "Ventas por periodo, vendedor y modelo",
  inventario: "Inventario disponible",
  prospectos: "Efectividad de prospectos",
};

const ORIGENES = { showroom: "Showroom", redes_sociales: "Redes sociales", referido: "Referido", sitio_web: "Sitio web" };
const FORMA_PAGO = { contado: "Contado", financiamiento: "Financiamiento" };
const porcentaje = (valor) => `${Number(valor || 0).toFixed(1)}%`;

/** Modulo de Reportes: RF-037, RF-038, RF-039 y RF-041 (HU-11, HU-24). */
export default function Reportes() {
  const dispatch = useDispatch();
  const { tipo = "ventas", filtros = {}, datos = null, cargando, exportando } = useSelector((state) => state.reportes) ?? {};

  useEffect(() => {
    dispatch(cargarReporte({ tipo, filtros }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, tipo]);

  const generar = (evento) => {
    evento.preventDefault();
    dispatch(cargarReporte({ tipo, filtros }));
  };

  const cambiarFiltro = (campo) => (evento) => dispatch(fijarFiltro({ campo, valor: evento.target.value }));
  const porPeriodo = tipo !== "inventario";

  return (
    <>
      <div className="encabezado-pagina">
        <div>
          <h1>Reportes y estadisticas</h1>
          <p>Indicadores comerciales del periodo, exportables a Excel.</p>
        </div>
        <button
          className="boton boton-primario"
          onClick={() => dispatch(exportarReporte({ tipo, filtros }))}
          disabled={exportando || !datos}
        >
          {exportando ? "Generando..." : "Exportar a Excel"}
        </button>
      </div>

      <nav className="pestanias">
        {Object.entries(TIPOS).map(([valor, texto]) => (
          <button key={valor} className={tipo === valor ? "activa" : ""} onClick={() => dispatch(fijarTipo(valor))}>
            {texto}
          </button>
        ))}
      </nav>

      <Panel titulo="Parametros del reporte">
        <form className="rejilla-filtros" onSubmit={generar}>
          {porPeriodo ? (
            <>
              <Campo etiqueta="Desde">
                <input type="date" value={filtros.desde} onChange={cambiarFiltro("desde")} />
              </Campo>
              <Campo etiqueta="Hasta">
                <input type="date" value={filtros.hasta} onChange={cambiarFiltro("hasta")} />
              </Campo>
            </>
          ) : (
            <>
              <Campo etiqueta="Marca">
                <input value={filtros.marca} onChange={cambiarFiltro("marca")} />
              </Campo>
              <Campo etiqueta="Modelo">
                <input value={filtros.modelo} onChange={cambiarFiltro("modelo")} />
              </Campo>
              <Campo etiqueta="Estatus">
                <select value={filtros.estatus} onChange={cambiarFiltro("estatus")}>
                  <option value="">Disponible (por omision)</option>
                  <option value="disponible">Disponible</option>
                  <option value="apartado">Apartado</option>
                  <option value="vendido">Vendido</option>
                  <option value="en_transito">En transito</option>
                </select>
              </Campo>
            </>
          )}
          <div className="acciones-filtros">
            <button type="submit" className="boton boton-primario">
              Generar
            </button>
          </div>
        </form>
      </Panel>

      {cargando && <Vacio texto="Generando reporte..." />}

      {!cargando && datos && tipo === "ventas" && (
        <>
          <div className="tablero-indicadores">
            <div className="indicador">
              <span className="indicador-valor">{datos.totales.unidades}</span>
              <span className="indicador-etiqueta">Unidades vendidas</span>
            </div>
            <div className="indicador">
              <span className="indicador-valor">{moneda(datos.totales.importe)}</span>
              <span className="indicador-etiqueta">Importe total</span>
            </div>
            <div className="indicador">
              <span className="indicador-valor">{moneda(datos.totales.ticketPromedio)}</span>
              <span className="indicador-etiqueta">Ticket promedio</span>
            </div>
          </div>

          <div className="columnas">
            <Panel titulo="Ventas por vendedor">
              {datos.porVendedor.length === 0 ? (
                <Vacio texto="Sin ventas en el periodo." />
              ) : (
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Vendedor</th>
                      <th className="derecha">Unidades</th>
                      <th className="derecha">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.porVendedor.map((f) => (
                      <tr key={f.concepto}>
                        <td>{f.concepto}</td>
                        <td className="derecha">{f.unidades}</td>
                        <td className="derecha">{moneda(f.importe)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            <Panel titulo="Ventas por modelo">
              {datos.porModelo.length === 0 ? (
                <Vacio texto="Sin ventas en el periodo." />
              ) : (
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Modelo</th>
                      <th className="derecha">Unidades</th>
                      <th className="derecha">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.porModelo.map((f) => (
                      <tr key={f.concepto}>
                        <td>{f.concepto}</td>
                        <td className="derecha">{f.unidades}</td>
                        <td className="derecha">{moneda(f.importe)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>

          <Panel titulo={`Detalle de ventas (${datos.detalle.length})`}>
            {datos.detalle.length === 0 ? (
              <Vacio texto="Sin ventas en el periodo seleccionado." />
            ) : (
              <div className="tabla-contenedor">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Folio</th>
                      <th>Fecha</th>
                      <th>Cliente</th>
                      <th>Vendedor</th>
                      <th>Vehiculo</th>
                      <th>Pago</th>
                      <th className="derecha">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.detalle.map((f) => (
                      <tr key={f.folio}>
                        <td className="monoespaciado">{f.folio}</td>
                        <td>{soloFecha(f.fecha)}</td>
                        <td>{f.cliente}</td>
                        <td>{f.vendedor}</td>
                        <td>
                          {f.marca} {f.modelo} {f.anio}
                        </td>
                        <td>{FORMA_PAGO[f.formaPago] || f.formaPago}</td>
                        <td className="derecha">{moneda(f.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}

      {!cargando && datos && tipo === "inventario" && (
        <>
          <div className="tablero-indicadores">
            <div className="indicador">
              <span className="indicador-valor">{datos.totales.unidades}</span>
              <span className="indicador-etiqueta">Unidades en existencia</span>
            </div>
            <div className="indicador">
              <span className="indicador-valor">{moneda(datos.totales.valorInventario)}</span>
              <span className="indicador-etiqueta">Valor del inventario</span>
            </div>
          </div>

          <Panel titulo="Existencias por modelo">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th className="derecha">Unidades</th>
                  <th className="derecha">Valor</th>
                </tr>
              </thead>
              <tbody>
                {datos.resumen.map((f) => (
                  <tr key={`${f.marca}-${f.modelo}`}>
                    <td>{f.marca}</td>
                    <td>{f.modelo}</td>
                    <td className="derecha">{f.unidades}</td>
                    <td className="derecha">{moneda(f.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel titulo={`Detalle del inventario (${datos.detalle.length})`}>
            <div className="tabla-contenedor">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>VIN</th>
                    <th>Marca</th>
                    <th>Modelo</th>
                    <th>Anio</th>
                    <th>Color</th>
                    <th>Estatus</th>
                    <th className="derecha">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.detalle.map((f) => (
                    <tr key={f.vin}>
                      <td className="monoespaciado">{f.vin}</td>
                      <td>{f.marca}</td>
                      <td>{f.modelo}</td>
                      <td>{f.anio}</td>
                      <td>{f.color}</td>
                      <td>{f.estatus}</td>
                      <td className="derecha">{moneda(f.precio)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      {!cargando && datos && tipo === "prospectos" && (
        <>
          <div className="tablero-indicadores">
            <div className="indicador">
              <span className="indicador-valor">{datos.totales.prospectos}</span>
              <span className="indicador-etiqueta">Prospectos captados</span>
            </div>
            <div className="indicador">
              <span className="indicador-valor">{datos.totales.convertidos}</span>
              <span className="indicador-etiqueta">Convertidos en venta</span>
            </div>
            <div className="indicador">
              <span className="indicador-valor">{porcentaje(datos.totales.tasaConversion)}</span>
              <span className="indicador-etiqueta">Tasa de conversion</span>
            </div>
            <div className="indicador">
              <span className="indicador-valor">{datos.totales.perdidos}</span>
              <span className="indicador-etiqueta">Prospectos perdidos</span>
            </div>
          </div>

          <div className="columnas">
            <Panel titulo="Conversion por origen">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Origen</th>
                    <th className="derecha">Prospectos</th>
                    <th className="derecha">Convertidos</th>
                    <th className="derecha">Tasa</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.porOrigen.map((f) => (
                    <tr key={f.origen}>
                      <td>{ORIGENES[f.origen] || f.origen}</td>
                      <td className="derecha">{f.prospectos}</td>
                      <td className="derecha">{f.convertidos}</td>
                      <td className="derecha">{porcentaje(f.tasaConversion)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>

            <Panel titulo="Distribucion por estatus">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Estatus</th>
                    <th className="derecha">Prospectos</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.porEstatus.map((f) => (
                    <tr key={f.estatus}>
                      <td>{f.estatus.replace(/_/g, " ")}</td>
                      <td className="derecha">{f.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
