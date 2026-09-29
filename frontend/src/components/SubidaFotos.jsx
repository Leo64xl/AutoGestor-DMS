import { useRef, useState } from "react";
import { subirImagen, urlArchivo } from "../api/client";
import Icono from "./Icono";

const MAXIMO_MB = 5;
const FORMATOS = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * RF-011: carga de fotografias del vehiculo desde el equipo del usuario.
 * Sube cada archivo al backend y devuelve al formulario las rutas resultantes.
 * La primera imagen de la lista es la que representa a la unidad en el catalogo.
 */
export default function SubidaFotos({ fotos = [], onCambio, deshabilitado = false }) {
  const entrada = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState(null);
  const [arrastrando, setArrastrando] = useState(false);

  const procesar = async (archivos) => {
    const lista = [...archivos];
    if (lista.length === 0) return;

    setError(null);
    const invalido = lista.find((a) => !FORMATOS.includes(a.type));
    if (invalido) return setError(`"${invalido.name}" no es una imagen admitida. Usa JPG, PNG, WebP o AVIF.`);

    const pesado = lista.find((a) => a.size > MAXIMO_MB * 1024 * 1024);
    if (pesado) return setError(`"${pesado.name}" supera los ${MAXIMO_MB} MB.`);

    setSubiendo(true);
    try {
      const subidas = [];
      for (const archivo of lista) {
        const { url } = await subirImagen("/vehiculos/fotos", archivo);
        subidas.push(url);
      }
      onCambio([...fotos, ...subidas]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  const quitar = (url) => {
    setError(null);
    onCambio(fotos.filter((f) => f !== url));
  };

  const mover = (desde, hacia) => {
    if (hacia < 0 || hacia >= fotos.length) return;
    const copia = [...fotos];
    [copia[desde], copia[hacia]] = [copia[hacia], copia[desde]];
    onCambio(copia);
  };

  const soltar = (evento) => {
    evento.preventDefault();
    setArrastrando(false);
    if (!deshabilitado && !subiendo) procesar(evento.dataTransfer.files);
  };

  return (
    <div className="subida-fotos">
      <button
        type="button"
        className={`zona-soltar ${arrastrando ? "arrastrando" : ""}`}
        onClick={() => entrada.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={soltar}
        disabled={deshabilitado || subiendo}
      >
        <Icono nombre="imagen" tamano={26} />
        <span>
          <strong>{subiendo ? "Subiendo imagen..." : "Arrastra una imagen o haz clic para elegirla"}</strong>
          <small>JPG, PNG, WebP o AVIF · maximo {MAXIMO_MB} MB por archivo</small>
        </span>
      </button>

      <input
        ref={entrada}
        type="file"
        accept={FORMATOS.join(",")}
        multiple
        hidden
        onChange={(e) => procesar(e.target.files)}
      />

      {error && <p className="mensaje-error">{error}</p>}

      {fotos.length > 0 && (
        <ul className="miniaturas">
          {fotos.map((url, indice) => (
            <li key={url} className="miniatura">
              <img src={urlArchivo(url)} alt={`Fotografia ${indice + 1}`} />
              {indice === 0 && <span className="miniatura-principal">Principal</span>}
              <div className="miniatura-acciones">
                <button type="button" onClick={() => mover(indice, indice - 1)} disabled={indice === 0} title="Mover antes">
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => mover(indice, indice + 1)}
                  disabled={indice === fotos.length - 1}
                  title="Mover despues"
                >
                  ›
                </button>
                <button type="button" className="quitar" onClick={() => quitar(url)} title="Quitar imagen">
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
