/**
 * Formato de registro de uso de equipos de investigacion (RF-78).
 *
 * <p>Es el papel que el laboratorio hace firmar cuando un equipo sale a
 * trabajar. Aqui viaja solo la mitad que escribe una persona: la del equipo
 * —su codigo, su marca, su valor y la condicion en que esta— la pone el
 * servidor a partir del bien, que es quien la tiene registrada, de modo que
 * el documento no puede salir con un dato que contradiga al inventario.</p>
 *
 * <p><b>Nada de esto se guarda (RN-36).</b> El formato se genera, se lee, se
 * descarga y se acaba: no deja fila en la base de datos, no aparece en el
 * historial del bien y no cambia su condicion. El prestamo, si lo hay, se
 * registra aparte y con su propia pantalla (RF-59).</p>
 */
export interface FormatoUsoPeticion {
  /** 1. Responsable del equipamiento. El cargo, Coordinador, lo pone el sistema. */
  investigadorEncargado: string | null;
  correoEncargado: string | null;
  celularEncargado: string | null;

  /** 3. Datos del usuario que se lleva el equipo. */
  nombreInvestigador: string | null;
  correoInvestigador: string | null;
  telefonoInvestigador: string | null;

  /** 4. Proyecto asociado y actividad (PAO – Prociencia u otro). */
  proyecto: string | null;

  /**
   * 5. Fin del uso. El inicio no viaja: es el momento en que se genera el
   * documento, y lo pone el reloj del servidor.
   */
  fechaFinUso: string | null;
  horaFinUso: string | null;
  actividadRealizada: string | null;

  /** 6 y 7. Conformidad de la entrega y de la devolucion. */
  entregadoOperativo: boolean | null;
  devueltoOperativo: boolean | null;

  /** 8. Incidentes, fallas o daños. */
  incidente: string | null;
  accionCorrectiva: string | null;

  /** 10. Observaciones generales. */
  observaciones: string | null;
}

/** Un formato recien generado: el PDF y como se llamara al descargarse. */
export interface FormatoUsoGenerado {
  nombre: string;
  contenido: Blob;
}
