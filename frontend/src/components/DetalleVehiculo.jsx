import { useEffect, useState } from "react";
import { urlArchivo } from "../api/client";
import { Modal, Etiqueta } from "./ui";
import { moneda, fechaHora, ESTATUS_VEHICULO } from "./formato";
import Icono from "./Icono";

/**
 * Ficha completa de una unidad: galeria de fotografias y datos tecnicos.
 * Es la vista que el vendedor muestra al cliente en el piso de venta.
 */
export default function DetalleVehiculo({ vehiculo, onCerrar, onEditar, onDarDeBaja }) {
  const fotos = vehiculo.fotos || [];
  const [activa, setActiva] = useState(0);
  const [ampliada, setAmpliada] = useState(false);

  // Flechas del teclado para recorrer la galeria.
  useEffect(() => {
    if (fotos.length < 2) return undefined;
    const alPulsar = (e) => {
      if (e.key === "ArrowRight") setActiva((i) => (i + 1) % fotos.length);
      if (e.key === "ArrowLeft") setActiva((i) => (i - 1 + fotos.length) % fotos.length);
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [fotos.length]);

  const estatus = ESTATUS_VEHICULO[vehiculo.estatus] || { texto: vehiculo.estatus, tipo: "neutro" };

  const datos = [
    ["Numero de serie (VIN)", vehiculo.vin, "monoespaciado"],
    ["Marca", vehiculo.marca],
    ["Modelo", vehiculo.modelo],
    ["Anio", vehiculo.anio],
    ["Color", vehiculo.color],
    ["Alta en inventario", fechaHora(vehiculo.createdAt)],
  ];

  return (
    <Modal titulo={`${vehiculo.marca} ${vehiculo.modelo} ${vehiculo.anio}`} onCerrar={onCerrar} className="modal-detalle">
      <div className="detalle-vehiculo">
        <div className="galeria">
          <div className="galeria-principal">
            {fotos.length > 0 ? (
              <button type="button" className="galeria-ampliar" onClick={() => setAmpliada(true)} title="Ver en grande">
                <img src={urlArchivo(fotos[activa])} alt={`${vehiculo.marca} ${vehiculo.modelo}`} />
              </button>
            ) : (
              <div className="galeria-sin-foto">
                <Icono nombre="imagen" tamano={38} />
                <span>Esta unidad todavia no tiene fotografias</span>
              </div>
            )}

            {fotos.length > 1 && (
              <>
                <button
                  type="button"
                  className="galeria-flecha izquierda"
                  onClick={() => setActiva((i) => (i - 1 + fotos.length) % fotos.length)}
                  aria-label="Fotografia anterior"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="galeria-flecha derecha"
                  onClick={() => setActiva((i) => (i + 1) % fotos.length)}
                  aria-label="Fotografia siguiente"
                >
                  ›
                </button>
                <span className="galeria-contador">
                  {activa + 1} / {fotos.length}
                </span>
              </>
            )}
          </div>

          {fotos.length > 1 && (
            <div className="galeria-miniaturas">
              {fotos.map((foto, indice) => (
                <button
                  type="button"
                  key={foto}
                  className={indice === activa ? "activa" : ""}
                  onClick={() => setActiva(indice)}
                  aria-label={`Ver fotografia ${indice + 1}`}
                >
                  <img src={urlArchivo(foto)} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="detalle-datos">
          <div className="detalle-precio">
            <span>{moneda(vehiculo.precio)}</span>
            <Etiqueta valor={estatus.texto} tipo={estatus.tipo} />
          </div>

          <dl className="lista-datos">
            {datos.map(([etiqueta, valor, clase]) => (
              <div key={etiqueta}>
                <dt>{etiqueta}</dt>
                <dd className={clase}>{valor ?? "—"}</dd>
              </div>
            ))}
          </dl>

          <div className="ficha-tecnica">
            <h3>Ficha tecnica</h3>
            <p>{vehiculo.fichaTecnica || "Sin ficha tecnica capturada."}</p>
          </div>

          {!vehiculo.activo && (
            <p className="mensaje-error">
              Unidad dada de baja del catalogo activo{vehiculo.motivoBaja ? `: ${vehiculo.motivoBaja}` : ""}.
            </p>
          )}

          {(onEditar || onDarDeBaja) && (
            <div className="acciones-modal">
              {onDarDeBaja && (
                <button type="button" className="boton boton-texto peligro" onClick={() => onDarDeBaja(vehiculo)}>
                  Dar de baja
                </button>
              )}
              {onEditar && (
                <button type="button" className="boton boton-primario" onClick={() => onEditar(vehiculo)}>
                  Editar unidad
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Visor a pantalla completa de la fotografia seleccionada. */}
      {ampliada && fotos.length > 0 && (
        <div className="visor" onClick={() => setAmpliada(false)} role="dialog" aria-label="Fotografia ampliada">
          <img src={urlArchivo(fotos[activa])} alt={`${vehiculo.marca} ${vehiculo.modelo}`} onClick={(e) => e.stopPropagation()} />
          <button type="button" className="visor-cerrar" onClick={() => setAmpliada(false)} aria-label="Cerrar">
            ×
          </button>
        </div>
      )}
    </Modal>
  );
}
