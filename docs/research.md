# MH Wilds Build Optimizer: investigación inicial

Fecha de consulta: 9 de noviembre de 2026.

Este documento registra fuentes y decisiones pendientes. No constituye una base de datos importada ni una certificación de que los datos de terceros estén completos para el último parche.

## Requisitos del usuario

- Aplicación estática con React, Tailwind CSS, PrimeReact y Vite.
- Apariencia Lara oscura, color principal cian.
- Interfaz y datos del juego en inglés y español, con selector de idioma.
- Base de datos distribuida con la aplicación; búsqueda y cálculos en el navegador sin servicios remotos durante su uso.
- Selección de habilidades y niveles mínimos; resultados válidos con arma, cinco piezas de armadura, talismán y colocación explícita de joyas.
- Incluir armas Artianas y Gogma Artianas y sus configuraciones legales.
- Priorizar el cumplimiento de requisitos antes que defensa, rareza u otros criterios de ordenación.
- Mostrar habilidades completas, ataque, afinidad, afilado, defensa y cálculo de daño con supuestos visibles.
- Añadir materiales si la cobertura de recetas lo permite.

## Versión del juego

La versión más reciente localizada es **1.042.00.03**, identificada en un anuncio de Capcom en Steam:

- https://steamcommunity.com/games/2246340/announcements/detail/668380665149915563
- Índice secundario que fecha el parche el 27 de octubre de 2026: https://senseos.gg/wiki/monster-hunter-wilds/updates/

Límites de comprobación: se pudo recuperar el título del anuncio oficial, pero no su cuerpo. El índice de actualizaciones de Capcom devolvió HTTP 403. La fecha procede del índice secundario; otros índices fechan la publicación el 28 de octubre. No se ha certificado la versión de cada plataforma ni la cobertura de cada fuente de datos.

No confundir tres campos distintos: versión objetivo del juego, versión del contenido realmente importado y fecha de descarga. Un commit reciente tampoco demuestra que todos los datos estén actualizados.

## Fuentes candidatas

| Fuente | Uso propuesto | Evidencia y límites |
| --- | --- | --- |
| [MHDB API](https://docs.wilds.mhdb.io/) | Base principal candidata: armas, armaduras, habilidades, joyas, talismanes fabricables, objetos y recetas | Documenta textos localizados procedentes del juego, endpoints por idioma, defensa, afilado, rareza, habilidades y materiales. La documentación declara pendientes Motion Values y Ailments. Falta comprobar respuestas reales y cobertura del parche objetivo. |
| [MHDB extraction toolkit](https://github.com/LartTyler/mhdb-wilds-data) | Datos JSON de origen, traducciones y revisión de tablas | El README identifica output/merged como datos ya procesados. Contiene Armor.json, ArmorUpgrade.json, Charm.json, Amulet.json, Accessory.json, Item.json, Skill.json y weapons/. El toolkit declara GPL-3.0; no extrapolar esa licencia a recursos de Capcom ni a todos los datos. |
| [Kiranico](https://mhwilds.kiranico.com/) | Contraste de habilidades, equipo y recetas | Su portada declara Game Ver. 1.040 en la consulta. Hay una página de Gogmazios alfa. No usar su portada como evidencia de cobertura 1.042. |
| [Monster Hunter Wiki: módulos MHWilds](https://monsterhunterwiki.org/wiki/Module:MHWilds) | Contraste estructurado de equipo, talismanes aleatorios y grupos de habilidades | Publica módulos Weapons, Armor, Items, Skills, Talismans, RngTalismans, TalismanSkillGroups, Decorations y datos de monstruos. Weapons contiene costes y materiales de fabricación/mejora. RngTalismans contiene grupos y combinaciones de huecos, incluido DecoType. Falta auditar actualidad y condiciones de reutilización. |
| [Charm Odds Calculator](https://github.com/ni-null/MHWilds-Charm-Odds-Calculator) | Referencia para restricciones y probabilidades de talismanes aleatorios | Su README describe búsqueda por múltiples habilidades y combinaciones. No se verificó una licencia de reutilización; no asumir autorización para copiar código. |
| [MH Wilds Damage Calculator](https://github.com/chanleyou/mhwilds-calculator) | Referencia para fórmulas, redondeo y valores de movimiento | Declara MIT, mantenimiento lento y pendientes de equipo 1.030/1.040 y cambios de MV. No sirve por sí solo como catálogo actual completo. |
| [Calculador indicado por el usuario](https://mhwilds-calculator.netlify.app/) | Referencia de experiencia de usuario y resultados | Muestra equipo, buffs, ataque efectivo, afinidad, afilado y daño por ataque/combo. No se ha demostrado que su despliegue coincida exactamente con la revisión actual del repositorio anterior. |
| [cecilbowen/mhwilds-set-search](https://github.com/cecilbowen/mhwilds-set-search) | Referencia de búsqueda de combinaciones | Declara MIT y busca armaduras por habilidades/huecos. Tiene imágenes y un script de extracción desde Kiranico. No se ha auditado su cobertura actual. |
| [Rayleon Armour Builder and Search](https://mhwilds.rayleon.net/) | Referencia funcional especialmente próxima | La interfaz ofrece búsqueda por condiciones, inventario de joyas, equipo trascendido, armas Gogmazios e inventario de estas, ordenación por defensa y armas primaria/secundaria. No se verificó acceso a código/datos reutilizables. |
| [Gogma Artian Roll Planner](https://github.com/WiseHorror/Gogma-Artian-Roll-Planner) | Referencia de refuerzos, habilidades de serie/grupo y configuración de armas existentes | Su README describe calculador web y exportación desde REFramework. La página por sí misma no lee la partida. No se verificó licencia de reutilización. |

Fextralife se intentó consultar, pero no resultó accesible mediante la herramienta de navegación utilizada. No se atribuyen datos verificados a esa fuente.

## Iconos e imágenes

Los campos icon de MHDB documentan identificadores, tipos y colores; no equivalen a un paquete descargado de imágenes. La distribución de recursos locales necesita una tarea separada de adquisición, mapeo y atribución.

Se localizaron public/images en el buscador de cecilbowen y referencias de iconos/renders en los módulos de Monster Hunter Wiki. No se ha descargado ni auditado aún ningún paquete de recursos. La licencia de código de un proyecto no debe presentarse como licencia de sus imágenes del juego.

## Arquitectura propuesta

1. Importador ejecutado durante desarrollo/actualización para descargar fuentes, normalizar identificadores y generar archivos estáticos. Ninguna API externa será necesaria para generar builds en producción.
2. Datos comunes separados de textos en/es, enlazados por identificadores estables. MHDB advierte que id puede cambiar tras una importación; preferir gameId cuando exista y mantener mapas explícitos para fuentes secundarias.
3. Manifiesto con fuentes, revisiones o hashes, fecha de extracción, versión objetivo y cobertura realmente validada. Los datos ausentes deben quedar identificados.
4. Motor de restricciones en un Web Worker, con progreso y cancelación; interfaz React independiente del cálculo.
5. Verificador de resultados separado del buscador: comprobar niveles mínimos, capacidades y tipos de huecos, inventario, combinaciones de talismanes y armas, y umbrales de serie/grupo.
6. Ordenación configurable solo entre resultados válidos. La defensa máxima debe incorporar correctamente las mejoras aplicables y los efectos configurados.
7. No eliminar candidatos solo por tener menor defensa: pueden ser necesarios por sus habilidades, huecos o aportaciones de serie/grupo. Cualquier poda debe conservar la corrección de la búsqueda.
8. Diferenciar búsqueda finalizada, cancelada y detenida por límite. Una búsqueda parcial sin resultados no demuestra imposibilidad ni optimalidad.
9. Estadísticas base y condicionadas separadas. Mostrar ataque de menú, ataque real cuando corresponda, afinidad, elemento/estado y afilado; sustituir afilado por propiedades pertinentes en armas a distancia.
10. Daño asociado a un escenario explícito: monstruo/parte, estado, ataque o combo, buffs y activación de habilidades. No tratar un índice de ataque efectivo como daño real ni DPS.
11. Materiales: agregar recetas sin duplicar cantidades y distinguir fabricación directa de rutas de mejora; para equipo aleatorio, separar costes conocidos de obtención incierta.
12. Guardar preferencias, inventarios y builds en el dispositivo, con exportación/importación. El modo sin conexión después de una visita requiere caché local de aplicación/datos/recursos; no equivale a abrir dist/index.html mediante file://.

Las actualizaciones de datos requieren regenerar/distribuir una nueva versión o importar un paquete local. Una aplicación que no consulta servidores durante su uso no puede verificar silenciosamente la última versión del juego.

## Tecnología consultada

Se utilizó Context7 para resolver PrimeReact y consultar integración con Tailwind y temas Lara. La documentación actual distingue los temas CSS de v10 y los presets de tokens de v11; no mezclar importaciones entre versiones. Antes de fijar dependencias, comprobar la versión estable elegida y su compatibilidad con React/Vite/Tailwind.

Referencias oficiales recuperadas:

- https://primereact.dev/docs/styled/guides/theming/tailwind
- https://primereact.dev/docs/primitive/guides/migration/updating-to-v11

## Decisiones recibidas del usuario

- Usar cualquier talismán legal, aunque no forme parte de su inventario.
- Buscar automáticamente entre los 14 tipos de arma.
- Ofrecer dos prioridades seleccionables en el builder: defensa máxima y después rareza; o daño esperado, después defensa y finalmente rareza.
- En ambos órdenes, satisfacer todas las habilidades requeridas sigue siendo una restricción obligatoria anterior a la ordenación.

## Decisiones adicionales recibidas

- Artianas y Gogma: configuraciones teóricas legales.
- Joyas: cantidades ilimitadas siempre.
- Daño por ataques/combos contra monstruo y parte, con efectos configurables.
- Resultados progresivos, conservando las mejores 20–50 builds encontradas.

## Supuestos de implementación

- Alcance de equipo: incluir todos los rangos/eventos con filtros de disponibilidad/progreso.
- Distribución: web estática, uso sin conexión tras primera carga y/o paquete para servidor estático local.

## Estado de la investigación

La carpeta estaba vacía y no contenía un repositorio Git al comenzar. El acceso a las fuentes funcionó posteriormente mediante la ejecución autorizada con acceso de red. Se descargaron y normalizaron los datos bilingües de MHDB y las tablas complementarias, y se implementó la aplicación. El estado, las pruebas y las limitaciones actuales están descritos en README.md; los hashes y revisiones están en public/data/manifest.json.
