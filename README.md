# Wilds Forge

Generador local de builds de **Monster Hunter Wilds**, con React, Vite, Tailwind CSS y PrimeReact (Lara oscuro, cian). Interfaz y nombres/descripciones del equipo en inglés y español.

## Ejecutar

Requiere Node.js 22.12+ o 24+.

```sh
npm install
npm run dev
```

En este equipo Windows también puedes ejecutar `./start.ps1`: localiza Node instalado mediante NVM o la copia local de desarrollo y abre el servidor en `http://127.0.0.1:5173/`.

## Compilación estática

```sh
npm run check:data
npm test
npm run check:render
npm run build
npm run check:dist
npm run preview
```

`dist/` contiene toda la web y su base de datos. Se puede alojar en cualquier servidor estático, incluso en una subcarpeta, sin backend de cálculo. No abrir `index.html` mediante `file://`: los módulos y Workers necesitan HTTP(S). Para uso sin conexión, cargar la compilación de producción una vez en HTTPS o localhost y esperar a que indique que la caché está preparada. La caché incluye datos, imágenes, fuentes y módulos.

## Funcionamiento

- Seleccionar habilidades con sus niveles mínimos. También se pueden pedir bonificaciones de conjunto y grupo.
- Buscar entre los 14 tipos de arma o acotar por tipo, familia, elemento/estado, rango y arma concreta.
- Dos órdenes: defensa → rareza; daño esperado → defensa → rareza. Se comparan builds que cumplen los requisitos.
- Talismanes fabricables y combinaciones aleatorias legales, con grupos de habilidades y huecos de arma/armadura. No hay restricción de inventario ni de cantidad de joyas.
- Artianas y Gogma Artianas teóricas: infusiones, perfiles de cinco refuerzos, enfoque y contribuciones de conjunto/grupo.
- Estadísticas, afilado, habilidades, colocación de joyas y recetas documentadas.
- Escenario con monstruo/parte o hitzones personalizados, heridas, habilidades condicionales, consumibles, efectos de arma y combos por tipo.
- Resultados progresivos en un Web Worker. Ventanas de búsqueda de 12 segundos, pausa y continuación. Conserva las mejores 20 o 50 builds encontradas.
- Guardado en el navegador y exportación/importación JSON, con validación de la build importada.
- Catálogo local navegable de equipo, habilidades, objetos y monstruos.

El buscador no hace peticiones a servicios externos. La primera carga solicita los archivos estáticos del mismo origen.

## Datos incluidos

Snapshot descargado el 9 de noviembre de 2026:

| Tipo | Entradas |
| --- | ---: |
| Habilidades | 179 |
| Armaduras | 714 |
| Armas base | 1.188 |
| Joyas | 361 |
| Talismanes fabricables (niveles individuales) | 183 |
| Plantillas de talismanes aleatorios | 29 |
| Monstruos | 34 |

Fuentes: [MHDB](https://docs.wilds.mhdb.io/), [Monster Hunter Wiki](https://monsterhunterwiki.org/wiki/Module:MHWilds), [chanleyou/mhwilds-calculator](https://github.com/chanleyou/mhwilds-calculator) y los recursos detallados en [public/attributions.txt](public/attributions.txt). Se conservaron licencia MIT y revisión del motor de combate adaptado. Los recursos del juego pertenecen a CAPCOM.

Versión objetivo: **1.042.00.03**. Hay contenido de 1.041, como Arkvulcan γ, y de Gogmazios. Esto no certifica que cada valor de cada fuente refleje todos los hotfixes 1.042. El manifiesto conserva URLs, revisiones y hashes; la interfaz comunica la cobertura.

Trascendencia contrastada con la wiki para **703 de 714 piezas**. Las otras 11 conservan el máximo estándar documentado y un aviso; no se inventan valores.

## Garantías y límites del motor

`src/engine/verify.js` reconstruye el equipo desde el catálogo y comprueba cada resultado: cinco ubicaciones distintas de armadura, tiradas de talismán permitidas, combinación legal modelada de Gogma, tipo/tamaño/uso único de hueco y todos los niveles requeridos. No confía en los niveles guardados en el JSON.

La colocación de joyas requeridas usa retroceso exacto y memoización, incluyendo joyas combinadas. Las reglas de conjunto/grupo usan sus umbrales de piezas, incluidas las contribuciones del arma Gogma. Una comprobación de viabilidad por vectores de bonificación descarta conjuntos imposibles antes de explorar el producto de equipo.

La exploración del producto de equipo es progresiva y recorre los tipos de arma por turnos. Su orden es heurístico: no basta una búsqueda parcial para demostrar imposibilidad. Un candidato del producto representa un equipo y un testigo de talismán legal, no todas las tiradas redundantes. Se proyectan las tiradas sobre habilidades requeridas y algunas estadísticas relevantes, conservando testigos de relleno distintos. El talismán elegido no se optimiza exhaustivamente para daño/defensa. Las joyas opcionales se añaden por mejora marginal; los perfiles Artianos se optimizan para el escenario dentro del modelo. Por ello **la clasificación no certifica el máximo global**, aunque cada build emitida supera el verificador de requisitos.

El daño es una **estimación por combo**, no DPS ni una comparación de eficiencia temporal entre armas. El motor y los movimientos de referencia no están certificados contra cada parche. Hay habilidades y mecánicas especiales sin modelar; la build muestra las habilidades sin efecto numérico modelado. Los movimientos se presentan con los nombres de la fuente de referencia, mientras que el equipo y las habilidades usan localización del juego. Munición y bombardeos incompatibles con un arma se excluyen del cálculo con aviso. Los estados alterados no se convierten artificialmente en daño elemental por golpe.

Los perfiles teóricos modelan infusiones de ataque/afinidad, atributos y hasta dos refuerzos de afilado/capacidad. Gogma usa los mejores escalones permitidos de cada tipo dentro del perfil; no enumera todas las permutaciones ni simula la secuencia RNG de una partida. Las propiedades especiales de un arma a distancia y sus cambios con piezas/munición no están completamente simulados. El optimizador debe tratarse como una herramienta de planificación, pendiente de contraste numérico de todos los casos especiales con el juego.

Los materiales suman las recetas conocidas de forja, cadena de mejoras y trascendencia. No incluyen esferas de armadura, tiradas de talismanes ni costes RNG garantizados de conseguir una Artiana concreta.

## Actualizar las fuentes

Solo durante el desarrollo, con acceso a Internet:

```sh
npm run data:fetch
npm run data:build
npm run data:icons
npm run check:data
npm test
npm run build
```

Los originales se guardan en `.cache/sources/` (ignorado por Git) y se normalizan en `public/data/database.json`. Antes de subir la versión objetivo, verificar las notas oficiales y la cobertura real. Los snapshots de referencia de GitHub están fijados a revisiones; actualizar esas revisiones requiere una revisión explícita de los cambios.

Para reconstruir el módulo de combate adaptado:

```sh
npm run combat:fetch
npm run combat:build
```

`src/vendor/calculator/` conserva las fuentes y la licencia. `src/engine/combat-reference.mjs` es su módulo generado, usado tanto por el Worker como por las pruebas.

## Verificación

Las 19 pruebas incluyen un oráculo exhaustivo independiente para 150 casos aleatorios de colocación de joyas, incompatibilidad de huecos y munición, talismanes legales, umbrales de conjunto/grupo, trascendencia, refuerzos Gogma, afinidad negativa y críticos, habilidades condicionales, reparto de búsqueda entre los 14 tipos de arma, búsquedas válidas/imposibles, detección de builds alteradas, materiales y pausa/continuación real del Worker. Se comprobó además el renderizado de los componentes de resultados, catálogo y fuentes en los dos idiomas y la integridad de los archivos precargados para uso sin conexión.

Se verificó la compilación de producción. La inspección visual automatizada no se pudo realizar: la herramienta de uso del ordenador detuvo el acceso al no poder determinar la URL de Brave con suficiente confianza. El diseño responsive y las interacciones necesitan una pasada visual en un navegador disponible.
