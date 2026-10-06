# Fuentes de prospección · relevamiento del 2026-10-06

Este documento acompaña a `prospectos.csv` (126 filas), `descartados.csv` (68 filas) y `partners-ferias.csv` (72 ferias). Lo usa el fundador para saber qué rindió cada fuente, qué no funcionó y cómo pasar de estas filas a 100 prospectos con score ≥ 6 en una semana.

Convenciones: **[H]** es un hecho con URL en el CSV. **[Hip]** es una hipótesis o estimación. Ningún campo se completó a ojo: si un dato no se pudo verificar, quedó vacío o dice "sin dato".

---

## 1. Resumen

| Fuente | Qué se leyó | Prospectos | Descartados | Calidad de la señal |
| --- | --- | --- | --- | --- |
| EmprenZona · directorio de emprendedores (`/emprendedores?type=Indumentaria` + barrido de los 716 perfiles) | 72 perfiles de indumentaria y 6 de ropa cargados en otros rubros, cada uno abierto | 49 | 28 | Alta en identidad (lo carga la marca, con su @ y a veces WhatsApp), baja en señal de dolor |
| EmprenZona · ferias y organizadores | 159 fichas de ferias, 97 organizadores | 72 partners (65 de EmprenZona + 7 de Rosario y Córdoba buscados aparte) | 43 organizadores excluidos (solidarias, anime, municipios, gastronomía, sin IG o fuera de zona) | Alta para partners |
| Feria Puro Diseño 2026 · 11 notas "expositores 2026" de purodiseno.lat | ~230 expositores con su @ | 26 (24 de ropa o calzado, 2 de accesorios textiles) | 18 | Alta en identidad y dueña; sin señal de canal. **Valor: los vas a ver en persona del 9 al 11/10** |
| Linktree (páginas públicas leídas completas) | 42 páginas | 10 | 13 | **La mejor señal literal**: muestra si hay sólo WhatsApp, catálogo en Drive o Canva, o tienda |
| Google acotado a instagram.com (15 queries) | ~140 resultados | 41 | 9 | Media: el perfil existe, pero la señal es un **resumen del buscador**, no el texto literal de la bio |
| Prensa 2025-2026 (La Capital, Los Andes/TN, Ohlalá, iProfesional, Infonegocios, La Voz) | 7 notas abiertas, unas 6 búsquedas | 0 con @ verificable | 0 | Baja para filas, útil para partners (CEC Rosario) y para casos |
| Directorios (Feria Honduras, Mercado de Diseño, Ferias de la Ciudad) | búsquedas + ficha EZ | 0 | 0 | No hay listas públicas con @ |

**Score:** el 94 % de las filas tiene score 4 y todas dicen "score provisorio". No es un error. Como Instagram no se pudo abrir (login y HTTP 429), faltan los criterios de seguidores (+2) y de posteo en los últimos 7 días (+1). Siguiendo la consigna, todo score con datos faltantes quedó entre 4 y 6. Antes de mandar mensajes hay que hacer la verificación de 2 minutos por fila de la sección 4.

**Las 8 filas con mejor score (5-6) para empezar** [H, todas por Linktree o por tienda caída]:

| Score | Prospecto | Por qué |
| --- | --- | --- |
| 6 | @my_closet.ar | Linktree: "Para pedidos comunicarse al MD del IG o WhatsApp.", sin tienda |
| 6 | @indumentaria.laposta | Catálogo y guía de talles en Google Drive, contacto por wa.me |
| 6 | @carola_chic (Córdoba) | "Pedi el Catálogo", sólo IG y WhatsApp |
| 6 | Piero De Monzi (CABA, mayorista de camisas) | Sólo catálogo de WhatsApp; falta encontrar su @ |
| 5 | @sydney.shop_ (Lanús) | Su tienda Tiendanegocio dice "Este sitio está temporalmente suspendido." |
| 5 | @t.i.e.n.d.a.r (Maschwitz) | Local, Linktree con WhatsApp y sin tienda online |
| 5 | @lolaindumentariarosario | Linktree con sólo WhatsApp, IG y TikTok |
| 5 | @disenado_para_vos (Rosario) | Guardapolvos docentes, WhatsApp, "Envíos a todo el país" |

Fuera del CSV por falta de @, pero con señal fuerte: **La Juana Pituca** (talles grandes, "Ventas por Whatsapp, con Gladis.", catálogo wa.me/c) está en `descartados.csv` con la nota "buscarla a mano".

---

## 2. Detalle por fuente

### 2.1 EmprenZona (ferias.emprenzona.com.ar)

- **Rindió mucho más de lo que preveía el plan.** Además de la agenda de ferias, tiene un directorio de 716 perfiles de emprendedores con filtro "Indumentaria" (3 páginas, 72 perfiles). Cada perfil trae el @ de Instagram, a menudo un botón de WhatsApp, la zona y las ferias donde expone. Lo carga el propio emprendedor, así que la identidad es confiable.
- Las fichas de feria tienen un bloque "Emprendedores confirmados" (por ejemplo, la de Feria Honduras lista a "Segundapiel Bsas" y a "Votma tejidos"). Vale revisarlo feria por feria la semana que viene, porque cambia con cada fecha.
- Limitaciones: la mayoría de los perfiles son marcas chicas o recién empezadas (muchas descripciones son el mensaje con el que le piden un puesto al organizador). Sin seguidores no hay forma de saber si llegan a 1.000. [Hip] Entre un tercio y la mitad va a quedar por debajo de 1.000 seguidores.
- Cobertura geográfica: casi todo es AMBA. Córdoba y Rosario sólo aparecen con 1 o 2 ferias cada una y 2 perfiles de ropa (Vybes Sport en Cruz del Eje y Romperissimo en Rosario, este último descartado por vender vintage de pieza única).
- Descartes típicos: servicios de estampado (GEA Textil, Tinta del Puerto), merchandising anime, ropa usada o fardo, una ONG y un grupo de canto cargados como "indumentaria".

### 2.2 Feria Puro Diseño 2026 (purodiseno.lat)

- El plan esperaba "26 expositores". En la web hay **11 notas** "expositores 2026" con unos 230 expositores, cada uno con su @ (por ejemplo, el formato "En Instagram: @x").
- Se tomaron los de indumentaria, calzado y accesorios textiles. Quedaron afuera la joyería, la cerámica, el arte, los objetos y las carteras de cuero (no tienen talle).
- Muchos se descartaron porque la propia nota dice "piezas únicas" (Maleinka, Birdie, Juana Diez, Eli Denegri, Customizate y otros). Es artesanía de pieza única y queda fuera del ICP.
- Las marcas con trayectoria (Jesús Fernández, 2003; Mariana Arbusti, 2007; Rocas Company, 2009; Analoge, con 16 empleados) probablemente tengan tienda propia [Hip]. Conviene revisarlas antes de contarlas.
- Acción: el sábado 10/10 recorrer el Pabellón Ocre con las 26 filas filtradas por `fuente_url` que contenga "purodiseno". [Hip] 2 horas para 15 a 20 conversaciones.

### 2.3 Linktree

- La única fuente que muestra **literalmente** el link en bio: si hay sólo WhatsApp, un catálogo en Drive o Canva, o una tienda (Tiendanube, web propia, Mercado Libre).
- Problema: cuando WebSearch se acota a `linktr.ee`, más de la mitad de los resultados son de Brasil, Venezuela, Perú, Colombia o Paraguay, o son sex shops. De 42 páginas leídas, sólo 10 fueron prospectos argentinos de ropa.
- Sirvió también para descartar con datos: Nadin Lencería tiene Tiendanube con "1463 productos".

### 2.4 Google acotado a instagram.com

- **El operador `site:` no funciona en la herramienta de búsqueda.** Las tres queries del plan escritas con `site:instagram.com` devolvieron artículos de blogs y 0 perfiles. Se repitieron limitando el dominio a instagram.com y ahí sí devuelven perfiles.
- La herramienta resume los snippets (a veces en inglés) en vez de mostrarlos literales. En estas filas el campo `senales_detectadas` empieza con "[resumen del buscador, no literal; verificar bio en IG]" y trae el título literal cuando aporta algo.
- Abrir los perfiles para confirmar no fue posible: Instagram respondió HTTP 429 a curl y a WebFetch.

| Query (dominio instagram.com salvo aclaración) | Filas útiles | Comentario |
| --- | --- | --- |
| `site:instagram.com "pedidos por whatsapp" indumentaria "Buenos Aires"` (literal) | 0 | `site:` ignorado |
| `site:instagram.com "showroom" "turnos por dm"` (literal) | 0 | `site:` ignorado |
| `site:instagram.com "lista de precios" "por privado" ropa` (literal) | 0 | `site:` ignorado |
| "pedidos por whatsapp" ropa showroom envíos a todo el país | 1 | 7 de 10 resultados de otros países |
| "consultar stock" ropa mujer Argentina envíos | 3 | Muchos mayoristas y cadenas |
| showroom ropa Córdoba "pedidos por whatsapp" Nueva Córdoba | 2 | El resto son shoppings o locales grandes |
| showroom ropa Rosario "envíos a todo el país" whatsapp | 3 | Brava (51K) a descartados |
| showroom ropa Mendoza pedidos whatsapp envíos | 3 | |
| showroom ropa Tucumán pedidos por whatsapp | 5 | **La que mejor rindió del interior** |
| "lista de precios por whatsapp" ropa por mayor Flores Avellaneda | 3 | Mayoristas: segmento distinto, ver nota |
| "catálogo por whatsapp" indumentaria femenina emprendimiento Argentina talles | 4 | |
| emprendimiento ropa mujer "pedidos por dm" "envíos a todo el país" CABA | 1 | Moda Petite, buen fit |
| showroom ropa La Plata "pedidos por whatsapp" indumentaria | 4 | |
| "pedidos por dm" ropa Rosario emprendimiento talles envíos | 3 | |
| "talles reales" ropa mujer emprendimiento "whatsapp" envíos Buenos Aires showroom | 4 | Nicho de talles reales: buen fit (muchas variantes) [Hip] |
| showroom ropa "turnos por dm" Palermo | 2 | Espacio PH es showroom multimarca, también potencial partner |
| "wa.me" showroom ropa Buenos Aires | 3 | |
| "lista de precios" "por privado" ropa Argentina | 0 | Mayoristas ya listados y ruido |
| `site:linktr.ee whatsapp pedidos ropa argentina` (dominio linktr.ee) y 8 variantes con Córdoba, Rosario, Mendoza, Tucumán, infantil y lencería | 10 | Ver 2.3 |
| `"envios a todo el pais" showroom ropa` y `"consultar stock" ropa argentina` | incluidas arriba | |
| `"mercadoshops"` ropa (señal de tienda muerta) | 0 | Sólo trajo mayoristas grandes. La señal Mercado Shops no se puede buscar por Google; hay que mirarla a mano en bios |

Nota sobre mayoristas (Flores y Avellaneda): se dejaron 12 en prospectos porque el dolor citado en el plan sale de un mayorista de Flores, pero venden por curva y en volumen. Es otro pitch [Hip]. El Billete, ON STYLE e Indumentaria Mayorista (102K) quedaron en descartados por tamaño.

### 2.5 Prensa 2025-2026

- **Te Mimo Mucho** (La Capital) es de 2023 y las notas de Infonegocios sobre showrooms de Córdoba son de 2018: fuera de rango, no se usaron.
- **Los Andes/TN, 14/07/2025:** Flor de Seda (Flor Barandiaran, Burzaco). Talles del 34 al 70, "Ahora venden ropa online y las entregas no paran". Es un buen caso, pero no se encontró su @, así que no entró en filas. Buscar "Flor de Seda" en la app de Instagram (2 minutos).
- **La Capital, 22/04/2026:** desfile del CEC en el Mes del Diseño con marcas rosarinas (Antipop, Azul Icardi, NV, Catalina Maure, Uoux, Buscapleitos, Beta Proyect, Impermanente…). No trae @. [Hip] Son marcas de diseño con algo más de escala: buscarlas en la app.
- **La Capital, 27/07/2026:** Rosario Outlet, 40 marcas rosarinas. Son marcas medianas con local y tienda [Hip], así que no entran como ICP. El CEC quedó como partner.
- **Ohlalá, 09/06/2026:** "10 showrooms made in Argentina". Casi todos tienen web propia y precios altos, y la nota no trae @. No se usó.
- **iProfesional:** notas de influencers que lanzan marca (Marina Señuk, Cami Homs). No son ICP.
- **No se encontraron** notas 2025-2026 de Clarín, Cadena 3, La Voz o Para Ti con marcas chicas y su @ en las búsquedas hechas.

### 2.6 Directorios de ferias

- **Feria Honduras:** no publica lista de expositores fuera de Instagram. La ficha de EmprenZona lista algunos "confirmados".
- **Mercado de Diseño:** no se encontró un directorio público.
- **Ferias de la Ciudad (GCBA):** sólo ferias de artesanos y manualistas de BA Data, sin @. Es artesanía y queda fuera del ICP.

---

## 3. Lo que no funcionó (para no repetirlo)

1. Abrir instagram.com: HTTP 429 sin login, tanto con curl como con WebFetch.
2. El operador `site:` en WebSearch: hay que usar el filtro de dominio.
3. DuckDuckGo HTML: conexión rechazada por el proxy. Bing con `site:` devuelve resultados de PedidosYa.
4. Notas de prensa como fuente de filas: casi nunca traen @ y las que sí son de 2018-2023.
5. Buscar marcas por nombre sin @ ("Flor de Seda", "La Juana Pituca"): el buscador devuelve ruido. Se resuelve en 30 segundos en la app.

---

## 4. Trabajo manual del fundador en la app de Instagram (de 126 filas provisorias a 100 con score ≥ 6)

### Paso 0 · Verificar las filas existentes (día 1, ~3 h)

Por cada fila, en el celular (90 segundos cada una [Hip]):

1. Abrir el @ y anotar **seguidores**: +2 si están entre 1.000 y 30.000.
2. Mirar la fecha del **último post o historia**: +1 si es de los últimos 7 días.
3. Copiar la **bio literal** y el **link en bio**. Sumar señales fuertes si dice "pedidos por DM/WhatsApp", si hay destacadas "CATÁLOGO", "PRECIOS" o "CÓMO COMPRAR", si el link es wa.me o un Linktree sólo con WhatsApp, o si menciona Mercado Shops.
4. Si el link es Tiendanube: abrir `/productos/`. Si tiene más de 50 productos activos, pasar la fila a `descartados.csv`.
5. Recalcular el score, borrar "score provisorio" de `senales_detectadas` y completar `canal_contacto`.

[Hip] Entre el 40 % y el 55 % de las 126 va a quedar en 6 o más. Son unas 50 a 70 filas prospectables al terminar el día 1.

### Paso 1 · Seguidos y etiquetados de las ferias partner (días 2 y 3, ~2 h por día)

En `partners-ferias.csv`, empezar por las ferias con más fechas y foco en moda, que tienen más expositores de ropa [Hip]:

- **CABA:** @feriaelmercadito (Palermo; de ahí salieron Chaos, Tossa y Así es amar), @ojosnegros.feria (Chacarita; de ahí salieron Tisha, Patas Chidas y Salem Colors), @feriahonduras_plazaserrano, @creativomercado ("Moda·Arte-Diseño"), @ferialacasonaemprendedores, @abuana__, @feriaaesthetic.arg (indumentaria y concurso de outfits), @designplaza.ok, @mercadodeloslecheros.
- **GBA:** @lumina.feria (15 fechas; de ahí salieron Sydney Shop, Littleboutique y Empora), @ferias.delsur, @zetah.feria, @feriaclub12deoctubre, @power.eventos (21 fechas), @alma.deferia, @expoamorpuro.
- **Interior:** @feriamarea.rosario, @feriarosariodiseno, @expo_rosario, @feriadeemprendedorescba, @feriascordoba.

Método: abrir la feria, ir a **Etiquetados** (fotos donde la feria arroba a sus expositores) y a **Seguidos**, filtrar las cuentas con foto de prenda o nombre de ropa, y anotarlas con `fuente_url` = la feria. El plan estima 25 a 40 perfiles calificados por hora [Hip, PLAN §8.1]. Con 4 horas en dos días salen 60 a 100 candidatos nuevos. Después del Paso 0 quedarían 30 a 50 con score ≥ 6 [Hip].

### Paso 2 · Puro Diseño en persona (sábado 10/10, ~2,5 h + 30 min de carga)

Las 26 filas de Puro Diseño más el resto de los ~350 expositores del Pabellón Ocre. Llevar la demo de ropa abierta. Por cada stand de ropa con talles, preguntar cómo toman los pedidos y anotar el @ y la respuesta en `objecion`. [Hip, PLAN §8.1] 20 a 30 contactos cara a cara.

### Paso 3 · Instagram Map por barrio (día 4, ~2 h)

En el mapa de Instagram, buscar "Tienda de ropa" o "Boutique" con el mapa centrado en **Palermo, Villa Crespo, Flores, Nueva Córdoba y Pichincha** (Rosario). Abrir sólo los perfiles sin link a tienda o con wa.me. [Hip, PLAN §8.1] 10 a 20 por barrio, unos 50 en total y 20 a 25 con score ≥ 6.

### Paso 4 · Hashtags (día 5, ~1,5 h)

Revisar los 50 posts recientes de #showroomargentina, #emprendedorasargentinas, #pedidosporwhatsapp, #ventaporcatalogo, #feriahonduras y #tallesreales (este último sumado porque rindió en Google). Sumar #showroompalermo, #showroomcordoba y #showroomrosario para cubrir el interior. [Hip] 10 a 15 calificados por hashtag.

### Paso 5 · Pendientes puntuales (15 min)

Buscar en la app el @ de Flor de Seda (Burzaco), La Juana Pituca y Piero De Monzi y pasarlos a prospectos. Revisar si @espacioph (showroom multimarca, más de 50 marcas) acepta un acuerdo como partner.

### Tiempo total estimado [Hip]

| Día | Tarea | Horas | Prospectos ≥ 6 acumulados |
| --- | --- | --- | --- |
| 1 (mar 6/10) | Verificar las 126 filas | 3 | 50-70 |
| 2-3 | Etiquetados y seguidos de 15 ferias | 4 | 80-110 |
| 4 (sáb 10/10) | Puro Diseño en La Rural | 3 | +15-20 conversaciones |
| 5 | Instagram Map en 5 barrios | 2 | +20 |
| 6 | Hashtags | 1,5 | +10-15 |
| **Total** | | **~13,5 h** | **≥ 100** |

Regla del plan que se mantiene: interactuar (historia o comentario) antes del DM y no mandar más de 20 a 30 DMs por día (PLAN §8.5).
