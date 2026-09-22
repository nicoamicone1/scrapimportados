/**
 * Datos de ejemplo para "Cargar ejemplo" en /admin/envios (y para los tests).
 */
import type { Polygon } from "geojson";

/**
 * Contorno aproximado de la Ciudad Autónoma de Buenos Aires (22 vértices,
 * [lng, lat]): costa del Río de la Plata al noreste, Riachuelo al sur y
 * Av. General Paz al oeste. Precisión de cuadra: sirve para envíos, no para
 * catastro.
 */
export const CABA_POLYGON: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [-58.4645, -34.5355], // Núñez: Gral. Paz y el río
      [-58.4405, -34.5410], // Ciudad Universitaria
      [-58.4120, -34.5560], // Aeroparque
      [-58.3980, -34.5680], // Costanera Norte, Palermo
      [-58.3670, -34.5850], // Retiro, puerto
      [-58.3450, -34.6050], // Reserva Ecológica norte
      [-58.3400, -34.6200], // Reserva Ecológica sur
      [-58.3500, -34.6360], // Boca del Riachuelo
      [-58.3600, -34.6380], // La Boca
      [-58.3780, -34.6500], // Puente Pueyrredón
      [-58.4120, -34.6630], // Puente Alsina
      [-58.4400, -34.6720], // Villa Soldati
      [-58.4650, -34.6920], // Puente La Noria
      [-58.4615, -34.7055], // Villa Riachuelo (extremo sur)
      [-58.5000, -34.6750], // Gral. Paz, Villa Lugano
      [-58.5295, -34.6450], // Liniers
      [-58.5310, -34.6200], // Villa Real
      [-58.5285, -34.5980], // Villa Devoto, Av. San Martín
      [-58.5130, -34.5720], // Villa Pueyrredón
      [-58.4900, -34.5520], // Saavedra, Av. Cabildo
      [-58.4750, -34.5420], // Núñez, Av. del Libertador
      [-58.4645, -34.5355], // cierre
    ],
  ],
};

export const EXAMPLE_ZONES = [
  {
    name: "CABA",
    type: "polygon" as const,
    geometry: CABA_POLYGON,
    provinces: [] as string[],
    postal_prefixes: [] as string[],
    cost: 3500,
    free_over: 60000,
    eta_text: "24 a 48 hs",
    notes: "Ejemplo: polígono aproximado de la Ciudad de Buenos Aires. Ajustalo a tu recorrido real.",
  },
  {
    name: "GBA",
    type: "provinces" as const,
    geometry: null,
    provinces: ["AR-B"],
    postal_prefixes: [] as string[],
    cost: 5500,
    free_over: 90000,
    eta_text: "48 a 72 hs",
    notes: "Ejemplo: toda la provincia de Buenos Aires. Si sólo llegás al conurbano, cambiala a polígono o códigos postales.",
  },
  {
    name: "Resto del país",
    type: "everywhere" as const,
    geometry: null,
    provinces: [] as string[],
    postal_prefixes: [] as string[],
    cost: 9500,
    free_over: null,
    eta_text: "3 a 7 días hábiles",
    notes: "Ejemplo: comodín para todo lo que no entra en las zonas de arriba. Dejala última.",
  },
];

export const EXAMPLE_PICKUP = {
  name: "Local Palermo",
  address: "Av. Santa Fe 3253, Palermo, Ciudad Autónoma de Buenos Aires",
  hours_text: "Lunes a viernes de 10 a 19 h · Sábados de 10 a 14 h",
  instructions_md: "Traé el número de pedido. Retirás en el mostrador de la entrada.",
  lat: -34.588,
  lng: -58.4103,
};
