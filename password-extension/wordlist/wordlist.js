/**
 * Lista de palabras para generación de passphrases estilo Diceware
 * ─────────────────────────────────────────────────────────────────
 * Criterios de selección:
 *  - Palabras cortas (3-8 letras) y fáciles de recordar
 *  - Sin palabras ofensivas, ambiguas ni difíciles de pronunciar
 *  - Mezcla de sustantivos, adjetivos y verbos comunes en español
 *
 * Tamaño actual: 200 palabras → ~7.6 bits de entropía por palabra
 * Con 5 palabras → ~38 bits de entropía (recomendable mínimo 50 bits: usar 7 palabras)
 *
 * Para mayor seguridad, se recomienda usar la lista EFF completa (7776 palabras → 12.9 bits/palabra)
 * https://www.eff.org/files/2016/07/18/eff_large_wordlist.txt
 */

export const WORDLIST_ES = [
  // Naturaleza
  "arbol", "monte", "playa", "nubes", "viento", "piedra", "flor", "luna",
  "solar", "tierra", "fuego", "agua", "selva", "campo", "rio", "mar",
  "lluvia", "nieve", "bosque", "lago", "isla", "valle", "cerro", "planta",

  // Animales
  "gato", "perro", "pez", "ave", "lobo", "oso", "tigre", "zorro",
  "cabra", "vaca", "caballo", "pato", "toro", "leon", "rana", "burro",
  "elefante", "delfin", "aguila", "serpiente", "tortuga", "raton", "conejo", "ballena",

  // Objetos cotidianos
  "mesa", "silla", "libro", "puerta", "taza", "caja", "mapa", "llave",
  "vela", "bolsa", "coche", "bici", "barco", "tren", "avion", "radio",
  "reloj", "carta", "lapiz", "gorro", "bota", "pared", "tecla", "frasco",

  // Colores y formas
  "rojo", "verde", "azul", "negro", "blanco", "gris", "dorado", "plata",
  "redondo", "plano", "largo", "corto", "ancho", "fino", "suave", "duro",

  // Verbos en infinitivo
  "saltar", "correr", "nadar", "volar", "cantar", "leer", "pintar", "crear",
  "mover", "girar", "subir", "bajar", "abrir", "cerrar", "romper", "unir",
  "buscar", "hallar", "traer", "llevar", "pensar", "soñar", "jugar", "ganar",

  // Números y tiempo
  "lunes", "martes", "enero", "marzo", "verano", "otoño", "noche", "tarde",
  "rapido", "lento", "nuevo", "viejo", "grande", "pequeño", "alto", "bajo",

  // Comida
  "mango", "limon", "uva", "pera", "melon", "tomate", "queso", "pan",
  "pasta", "arroz", "sopa", "leche", "miel", "sal", "azucar", "cafe",

  // Otros sustantivos
  "amigo", "familia", "grupo", "ciudad", "mundo", "cielo", "mar", "hora",
  "idea", "forma", "modo", "tipo", "nivel", "punto", "zona", "parte",
  "caso", "cosa", "lugar", "vez", "lado", "paso", "cambio", "sistema",
];

// Wordlist en inglés compacta (más bits por palabra al tener 4096 palabras en versión EFF)
// Aquí una muestra representativa para pruebas
export const WORDLIST_EN = [
  "able", "acid", "aged", "also", "apex", "arch", "area", "army",
  "back", "bake", "ball", "band", "bank", "bark", "barn", "base",
  "bath", "bead", "beam", "bean", "bear", "beat", "beef", "bell",
  "belt", "best", "bike", "bill", "bird", "bite", "blow", "blue",
  "boat", "body", "bold", "bolt", "bond", "bone", "book", "boom",
  "boot", "born", "bowl", "brow", "buck", "bulb", "bulk", "bull",
  "burn", "call", "calm", "came", "camp", "card", "care", "cart",
  "case", "cash", "cast", "cave", "cell", "chat", "chip", "city",
  "clam", "clap", "clay", "clip", "club", "coal", "coat", "code",
  "coil", "coin", "cold", "colt", "comb", "cone", "cook", "cool",
  "cope", "cord", "cork", "corn", "cost", "couch", "crab", "crop",
  "crow", "cult", "curl", "cute", "damp", "dark", "dart", "dash",
  "dawn", "deal", "dean", "deer", "desk", "dial", "dirt", "disk",
  "dock", "dome", "door", "dove", "down", "drag", "draw", "drop",
  "drum", "duck", "dune", "dusk", "dust", "echo", "edge", "epic",
  "even", "exam", "face", "fact", "fade", "fair", "fall", "fame",
  "farm", "fast", "fate", "fawn", "feel", "feet", "felt", "fern",
  "fill", "film", "find", "fire", "fish", "fist", "flag", "flat",
  "flaw", "flea", "flew", "flip", "flow", "foam", "fold", "folk",
  "fond", "font", "food", "foot", "ford", "fork", "form", "fort",
  "fowl", "fox", "frog", "from", "fuel", "full", "fund", "fury",
  "fuse", "gale", "game", "gang", "gate", "gave", "gaze", "gear",
  "germ", "gift", "girl", "give", "glow", "glue", "goal", "goat",
  "gold", "golf", "gone", "good", "grab", "gram", "gray", "grit",
];

// Exporta la lista por defecto (española)
export default WORDLIST_ES;